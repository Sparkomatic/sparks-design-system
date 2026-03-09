import fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Registry root ────────────────────────────────────────────────────────────
// In local dev the registry lives at the repo root.
// Compiled output is at dist/lib/registry.js, so __dirname = dist/lib/.
// We need to go up 4 levels to reach the repo root:
//   dist/lib → dist → packages/cli → packages → sparks-design-system/
// When the CLI is published to npm, swap this to fetch raw GitHub URLs instead.
const REGISTRY_ROOT = path.resolve(__dirname, '../../../../registry');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComponentEntry {
  name:         string;
  description:  string;
  files:        string[];          // relative to registry/components/<name>/
  dependencies: string[];          // npm packages to install
  tokens:       string[];          // token files, relative to registry/
}

export interface Registry {
  version:    string;
  components: ComponentEntry[];
}

// ── Loaders ───────────────────────────────────────────────────────────────────

export async function loadRegistry(): Promise<Registry> {
  const registryFile = path.join(REGISTRY_ROOT, 'registry.json');

  if (!(await fs.pathExists(registryFile))) {
    throw new Error(
      `registry.json not found at ${registryFile}.\n` +
      `Make sure you're running the CLI from the sparks-design-system repo, ` +
      `or that the CLI package has been published with the registry bundled.`
    );
  }

  return fs.readJson(registryFile) as Promise<Registry>;
}

export async function getComponent(name: string): Promise<ComponentEntry | undefined> {
  const registry = await loadRegistry();
  return registry.components.find(c => c.name === name);
}

export async function readComponentFile(componentName: string, file: string): Promise<string> {
  const filePath = path.join(REGISTRY_ROOT, 'components', componentName, file);
  return fs.readFile(filePath, 'utf-8');
}

export async function readTokenFile(tokenPath: string): Promise<string> {
  return fs.readFile(path.join(REGISTRY_ROOT, tokenPath), 'utf-8');
}
