#!/usr/bin/env npx tsx
/**
 * scripts/sync-figma.ts
 *
 * Pulls variables, components, and styles from Figma and writes
 * design/figma-manifest.json — a committed snapshot used for design–code parity.
 *
 * Design leads. This script only reads from Figma — it never writes back.
 *
 * Usage:
 *   npx tsx scripts/sync-figma.ts
 *   npx tsx scripts/sync-figma.ts --variables path/to/exported-variables.json
 *
 * --variables <file>
 *   Path to a JSON file exported from the Figma variables plugin
 *   (claude-figma-variables-and-styles-plugin → Export button).
 *   Use this to populate variables for free — the REST API variables
 *   endpoint requires a paid Figma plan, but the plugin API does not.
 *   When this flag is provided, plugin variables take precedence over
 *   any variables returned by the REST API.
 *
 * Required env var (add to ~/.zshrc):
 *   export FIGMA_API_TOKEN=your_personal_access_token
 *
 * Optional env var (falls back to the hardcoded default):
 *   export FIGMA_FILE_KEY=OzEZwWy8CQFot6GcTVeg8f
 */

import * as fs   from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const variablesFileArg = (() => {
  const idx = args.indexOf('--variables');
  return idx !== -1 ? args[idx + 1] : undefined;
})();

// ── Config ──────────────────────────────────────────────────────────────────

const FILE_KEY  = process.env.FIGMA_FILE_KEY  ?? 'OzEZwWy8CQFot6GcTVeg8f';
const API_TOKEN = process.env.FIGMA_API_TOKEN ?? '';
const BASE_URL  = 'https://api.figma.com';
const OUT_PATH  = path.join(ROOT, 'design', 'figma-manifest.json');

// ── Figma REST API types ─────────────────────────────────────────────────────

interface FigmaColor { r: number; g: number; b: number; a: number; }
interface FigmaVariableAlias { type: 'VARIABLE_ALIAS'; id: string; }
type FigmaVariableValue = FigmaColor | string | number | boolean | FigmaVariableAlias;

interface FigmaVariable {
  id:                   string;
  name:                 string;
  key:                  string;
  variableCollectionId: string;
  resolvedType:         'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode:         Record<string, FigmaVariableValue>;
  description:          string;
  scopes:               string[];
  hiddenFromPublishing: boolean;
}

interface FigmaVariableCollection {
  id:            string;
  name:          string;
  key:           string;
  modes:         Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  variableIds:   string[];
}

interface FigmaComponent {
  key:              string;
  name:             string;
  description:      string;
  componentSetId?:  string;
}

interface FigmaComponentSet {
  key:         string;
  name:        string;
  description: string;
}

interface FigmaStyle {
  key:         string;
  name:        string;
  styleType:   'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  description: string;
}

// ── Plugin export types (from claude-figma-variables-and-styles-plugin) ──────
// Matches the ImportExportFile format the plugin writes when you click Export.

interface PluginExportValue {
  r?: number; g?: number; b?: number; a?: number; // COLOR
  $alias?: string; collection?: string;            // alias reference
}

interface PluginExportVariable {
  name:         string;
  type:         'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  scopes:       string[];
  description:  string;
  valuesByMode: Record<string, number | boolean | string | PluginExportValue>;
}

interface PluginExportCollection {
  name:      string;
  modes:     string[];       // mode names (not IDs); first entry = default mode
  variables: PluginExportVariable[];
}

interface PluginExportFile {
  version:    number;
  exportedAt: string;
  collections: PluginExportCollection[];
}

// ── Manifest output types ────────────────────────────────────────────────────

interface ManifestVariable {
  collection:   string;
  mode:         string;
  name:         string;
  cssVariable:  string;
  resolvedType: string;
  /** Resolved hex string for colors, raw value for others, or alias reference */
  value:        string | number | boolean | { aliasOf: string };
}

interface ManifestComponentSet {
  name:               string;
  description:        string;
  variantProperties:  Record<string, string[]>;
  componentCount:     number;
}

interface ManifestStyle {
  name:        string;
  type:        string;
  description: string;
}

interface FigmaManifest {
  meta: {
    fileKey:           string;
    fileName:          string;
    syncedAt:          string;
    figmaLastModified: string;
    variablesSource:   'plugin-export' | 'rest-api' | 'none';
  };
  variables:     ManifestVariable[];
  componentSets: ManifestComponentSet[];
  styles:        ManifestStyle[];
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function figmaGet<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': API_TOKEN },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Figma API error ${res.status} for ${endpoint}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Transform helpers ────────────────────────────────────────────────────────

function figmaColorToHex({ r, g, b, a }: FigmaColor): string {
  const ch = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return a < 0.9999
    ? `#${ch(r)}${ch(g)}${ch(b)}${ch(a)}`
    : `#${ch(r)}${ch(g)}${ch(b)}`;
}

/**
 * Converts a Figma variable name to a CSS custom property name.
 * "color/blue/600"  → "--color-blue-600"
 * "Color/Blue 600"  → "--color-blue-600"
 * "spacing/space-4" → "--spacing-space-4"
 */
function toCssVar(name: string): string {
  return '--' + name
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Parses variant properties from a Figma component name.
 * "Variant=Default, Size=MD, State=Default" → { Variant: "Default", Size: "MD", State: "Default" }
 */
function parseVariantProps(componentName: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const part of componentName.split(',').map(p => p.trim())) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      props[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim();
    }
  }
  return props;
}

// ── Plugin export → manifest variables ──────────────────────────────────────

/**
 * Transforms the JSON exported by claude-figma-variables-and-styles-plugin
 * into the ManifestVariable[] format used by figma-manifest.json.
 *
 * The plugin export uses mode names as keys and resolves aliases to
 * { $alias, collection } objects. We convert those to the manifest's
 * { aliasOf: "--css-var" } shape.
 */
function transformPluginExport(data: PluginExportFile): ManifestVariable[] {
  const result: ManifestVariable[] = [];

  for (const col of data.collections) {
    const defaultMode = col.modes[0]; // first mode is the default
    if (!defaultMode) continue;

    for (const v of col.variables) {
      const raw = v.valuesByMode[defaultMode];
      if (raw === undefined) continue;

      let value: ManifestVariable['value'];

      if (v.type === 'COLOR' && raw !== null && typeof raw === 'object' && 'r' in raw) {
        value = figmaColorToHex(raw as FigmaColor);
      } else if (raw !== null && typeof raw === 'object' && '$alias' in raw) {
        value = { aliasOf: toCssVar((raw as PluginExportValue).$alias ?? '') };
      } else {
        value = raw as string | number | boolean;
      }

      result.push({
        collection:   col.name,
        mode:         defaultMode,
        name:         v.name,
        cssVariable:  toCssVar(v.name),
        resolvedType: v.type,
        value,
      });
    }
  }

  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Validation ─────────────────────────────────────────────────────────

  if (!API_TOKEN) {
    console.error(
      '\n✖  FIGMA_API_TOKEN is not set.\n' +
      '   Add it to ~/.zshrc:\n' +
      '     export FIGMA_API_TOKEN=your_personal_access_token\n' +
      '   Then open a fresh terminal and run again.\n'
    );
    process.exit(1);
  }

  console.log('\n  Syncing from Figma…');
  console.log(`  File: ${FILE_KEY}`);
  if (variablesFileArg) {
    console.log(`  Variables: ${variablesFileArg} (plugin export)`);
  }
  console.log();

  // ── Load plugin variables (if --variables flag provided) ────────────────

  let pluginVariables: ManifestVariable[] | undefined;

  if (variablesFileArg) {
    const absPath = path.resolve(process.cwd(), variablesFileArg);
    try {
      const raw = await fs.readFile(absPath, 'utf-8');
      const data = JSON.parse(raw) as PluginExportFile;
      pluginVariables = transformPluginExport(data);
      console.log(`  ✔  Loaded ${pluginVariables.length} variables from plugin export`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n✖  Could not read --variables file: ${msg}\n`);
      process.exit(1);
    }
  }

  // ── Fetch from REST API ─────────────────────────────────────────────────

  const [fileMeta, variablesRes, componentsRes, componentSetsRes, stylesRes] = await Promise.all([
    figmaGet<{ name: string; lastModified: string; version: string }>(
      `/v1/files/${FILE_KEY}?depth=1`
    ).catch(handleErr('file metadata')),

    // Only attempt REST variables if no plugin file was provided
    pluginVariables
      ? Promise.resolve(undefined)
      : figmaGet<{
          status: number;
          meta: {
            variables: Record<string, FigmaVariable>;
            variableCollections: Record<string, FigmaVariableCollection>;
          };
        }>(`/v1/files/${FILE_KEY}/variables/local`)
        .catch(handleErr('variables')),

    figmaGet<{ meta: { components: FigmaComponent[] } }>(
      `/v1/files/${FILE_KEY}/components`
    ).catch(handleErr('components')),

    figmaGet<{ meta: { component_sets: FigmaComponentSet[] } }>(
      `/v1/files/${FILE_KEY}/component_sets`
    ).catch(handleErr('component_sets')),

    figmaGet<{ meta: { styles: FigmaStyle[] } }>(
      `/v1/files/${FILE_KEY}/styles`
    ).catch(handleErr('styles')),
  ]);

  // ── Variables ───────────────────────────────────────────────────────────

  const manifestVariables: ManifestVariable[] = [];
  let variablesSource: FigmaManifest['meta']['variablesSource'] = 'none';

  if (pluginVariables) {
    // Prefer plugin export — works on free plan
    manifestVariables.push(...pluginVariables);
    variablesSource = 'plugin-export';
  } else if (variablesRes?.meta?.variables) {
    // Fall back to REST API (requires paid plan)
    const { variables, variableCollections } = variablesRes.meta;

    const idToCssVar: Record<string, string> = {};
    for (const v of Object.values(variables)) {
      idToCssVar[v.id] = toCssVar(v.name);
    }

    for (const collection of Object.values(variableCollections)) {
      const defaultMode = collection.modes.find(m => m.modeId === collection.defaultModeId)
        ?? collection.modes[0];

      for (const varId of collection.variableIds) {
        const v = variables[varId];
        if (!v || v.hiddenFromPublishing) continue;

        const rawValue = v.valuesByMode[defaultMode.modeId];
        let value: ManifestVariable['value'];

        if (rawValue && typeof rawValue === 'object' && 'type' in rawValue && rawValue.type === 'VARIABLE_ALIAS') {
          value = { aliasOf: idToCssVar[rawValue.id] ?? rawValue.id };
        } else if (v.resolvedType === 'COLOR' && rawValue && typeof rawValue === 'object' && 'r' in rawValue) {
          value = figmaColorToHex(rawValue as FigmaColor);
        } else {
          value = rawValue as string | number | boolean;
        }

        manifestVariables.push({
          collection:   collection.name,
          mode:         defaultMode.name,
          name:         v.name,
          cssVariable:  toCssVar(v.name),
          resolvedType: v.resolvedType,
          value,
        });
      }
    }

    variablesSource = 'rest-api';
  } else if (!pluginVariables) {
    console.log('  ⚠  No variables found. Use --variables <file> to load from plugin export');
    console.log('     (REST API variables endpoint requires a paid Figma plan)\n');
  }

  // ── Component sets ──────────────────────────────────────────────────────

  const manifestComponentSets: ManifestComponentSet[] = [];

  {
    const components     = componentsRes?.meta?.components         ?? [];
    const component_sets = componentSetsRes?.meta?.component_sets  ?? [];

    const bySetId: Record<string, FigmaComponent[]> = {};
    const standalone: FigmaComponent[] = [];

    for (const c of components) {
      if (c.componentSetId) {
        (bySetId[c.componentSetId] ??= []).push(c);
      } else {
        standalone.push(c);
      }
    }

    for (const set of component_sets) {
      const members = bySetId[set.key] ?? [];
      const allProps: Record<string, Set<string>> = {};

      for (const member of members) {
        const props = parseVariantProps(member.name);
        for (const [k, v] of Object.entries(props)) {
          (allProps[k] ??= new Set()).add(v);
        }
      }

      const variantProperties: Record<string, string[]> = {};
      for (const [k, vals] of Object.entries(allProps)) {
        variantProperties[k] = [...vals];
      }

      manifestComponentSets.push({
        name:             set.name,
        description:      set.description,
        variantProperties,
        componentCount:   members.length,
      });
    }

    for (const c of standalone) {
      manifestComponentSets.push({
        name:              c.name,
        description:       c.description,
        variantProperties: {},
        componentCount:    1,
      });
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────

  const manifestStyles: ManifestStyle[] = (stylesRes?.meta?.styles ?? []).map(s => ({
    name:        s.name,
    type:        s.styleType,
    description: s.description,
  }));

  // ── Assemble manifest ───────────────────────────────────────────────────

  const manifest: FigmaManifest = {
    meta: {
      fileKey:           FILE_KEY,
      fileName:          fileMeta?.name ?? 'Unknown',
      syncedAt:          new Date().toISOString(),
      figmaLastModified: fileMeta?.lastModified ?? 'Unknown',
      variablesSource,
    },
    variables:     manifestVariables,
    componentSets: manifestComponentSets,
    styles:        manifestStyles,
  };

  // ── Write ───────────────────────────────────────────────────────────────

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log(`\n  ✔  Synced from "${manifest.meta.fileName}"`);
  console.log(`     Variables:      ${manifestVariables.length} (source: ${variablesSource})`);
  console.log(`     Component sets: ${manifestComponentSets.length}`);
  console.log(`     Styles:         ${manifestStyles.length}`);
  console.log(`\n  Written to design/figma-manifest.json`);
  console.log(`  Commit it: git add design/figma-manifest.json && git commit -m "chore: sync figma manifest"\n`);
}

function handleErr(label: string) {
  return (err: unknown): undefined => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠  Could not fetch ${label}: ${msg}`);
    return undefined;
  };
}

main().catch(err => {
  console.error('\n✖ ', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});
