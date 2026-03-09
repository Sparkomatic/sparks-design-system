#!/usr/bin/env npx tsx
/**
 * scripts/sync-figma.ts
 *
 * Pulls variables, components, and styles from the Figma REST API and writes
 * design/figma-manifest.json — a committed snapshot used for design–code parity.
 *
 * Design leads. This script only reads from Figma — it never writes back.
 *
 * Usage:
 *   npm run sync-figma
 *
 * Required env var (add to ~/.zshrc):
 *   export FIGMA_API_TOKEN=your_personal_access_token
 *
 * Get a token at: Figma → account settings → Personal access tokens → Generate new token
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

// ── Config ─────────────────────────────────────────────────────────────────

const FILE_KEY  = process.env.FIGMA_FILE_KEY  ?? 'OzEZwWy8CQFot6GcTVeg8f';
const API_TOKEN = process.env.FIGMA_API_TOKEN ?? '';
const BASE_URL  = 'https://api.figma.com';
const OUT_PATH  = path.join(ROOT, 'design', 'figma-manifest.json');

// ── Figma API types ─────────────────────────────────────────────────────────

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

// ── Manifest output types ───────────────────────────────────────────────────

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
  };
  variables:     ManifestVariable[];
  componentSets: ManifestComponentSet[];
  styles:        ManifestStyle[];
}

// ── API helpers ─────────────────────────────────────────────────────────────

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

// ── Transform helpers ───────────────────────────────────────────────────────

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
  const parts = componentName.split(',').map(p => p.trim());

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      props[key] = val;
    }
  }

  return props;
}

// ── Main ────────────────────────────────────────────────────────────────────

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
  console.log(`  File: ${FILE_KEY}\n`);

  // ── Fetch in parallel ───────────────────────────────────────────────────

  const [fileMeta, variablesRes, componentsRes, componentSetsRes, stylesRes] = await Promise.all([
    figmaGet<{ name: string; lastModified: string; version: string }>(
      `/v1/files/${FILE_KEY}?depth=1`
    ).catch(handleErr('file metadata')),

    figmaGet<{
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
  let variableCount = 0;

  if (variablesRes?.meta?.variables) {
    const { variables, variableCollections } = variablesRes.meta;

    // Build an id → cssVar lookup for resolving aliases
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
          // Alias — resolve to CSS var name
          value = { aliasOf: idToCssVar[rawValue.id] ?? rawValue.id };
        } else if (v.resolvedType === 'COLOR' && rawValue && typeof rawValue === 'object' && 'r' in rawValue) {
          value = figmaColorToHex(rawValue as FigmaColor);
        } else {
          value = rawValue as string | number | boolean;
        }

        manifestVariables.push({
          collection:  collection.name,
          mode:        defaultMode.name,
          name:        v.name,
          cssVariable: toCssVar(v.name),
          resolvedType: v.resolvedType,
          value,
        });

        variableCount++;
      }
    }
  } else {
    console.log('  ⚠  Variables API unavailable (may require a paid Figma plan).');
    console.log('     Token names will need to be kept in sync manually.\n');
  }

  // ── Component sets ──────────────────────────────────────────────────────

  const manifestComponentSets: ManifestComponentSet[] = [];

  {
    const components  = componentsRes?.meta?.components        ?? [];
    const component_sets = componentSetsRes?.meta?.component_sets ?? [];

    // Group components by their parent component set id
    const bySetId: Record<string, FigmaComponent[]> = {};
    const standalone: FigmaComponent[] = [];

    for (const c of components) {
      if (c.componentSetId) {
        (bySetId[c.componentSetId] ??= []).push(c);
      } else {
        standalone.push(c);
      }
    }

    // Build component set entries
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

    // Standalone components (no variants)
    for (const c of standalone) {
      manifestComponentSets.push({
        name:             c.name,
        description:      c.description,
        variantProperties: {},
        componentCount:   1,
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
    },
    variables:     manifestVariables,
    componentSets: manifestComponentSets,
    styles:        manifestStyles,
  };

  // ── Write ───────────────────────────────────────────────────────────────

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log(`  ✔  Synced from "${manifest.meta.fileName}"`);
  console.log(`     Variables:      ${variableCount}`);
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
