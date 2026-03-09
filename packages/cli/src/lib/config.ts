import fs from 'fs-extra';
import * as path from 'path';

const CONFIG_FILENAME = 'sparks-ds.json';

export interface SparksConfig {
  /** Directory where components will be copied, relative to project root. */
  componentsDir: string;
  /** Path to the design tokens CSS file, relative to project root. */
  tokensFile: string;
}

export const defaultConfig: SparksConfig = {
  componentsDir: 'src/components/ui',
  tokensFile: 'src/styles/tokens.css',
};

export function configPath(cwd: string): string {
  return path.join(cwd, CONFIG_FILENAME);
}

export async function readConfig(cwd: string): Promise<SparksConfig | null> {
  const p = configPath(cwd);
  if (!(await fs.pathExists(p))) return null;
  return fs.readJson(p) as Promise<SparksConfig>;
}

export async function writeConfig(cwd: string, config: SparksConfig): Promise<void> {
  await fs.writeJson(configPath(cwd), config, { spaces: 2 });
}

/** Returns existing config or the defaults — never returns null. */
export async function getConfig(cwd: string): Promise<SparksConfig> {
  return (await readConfig(cwd)) ?? { ...defaultConfig };
}
