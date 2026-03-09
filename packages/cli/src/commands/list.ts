import chalk from 'chalk';
import { loadRegistry }  from '../lib/registry.js';
import { logger }        from '../lib/logger.js';

export async function list(): Promise<void> {
  let registry;

  try {
    registry = await loadRegistry();
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  logger.blank();
  logger.title(`Sparks DS — available components  (v${registry.version})`);
  logger.blank();

  for (const c of registry.components) {
    const name = chalk.bold.cyan(c.name.padEnd(22));
    const desc = chalk.gray(c.description);
    const deps = c.dependencies.length
      ? chalk.dim(`  [${c.dependencies.join(', ')}]`)
      : '';
    console.log(`  ${name}${desc}${deps}`);
  }

  logger.blank();
  logger.dim('  sparks-ds add <name>   — copy a component into your project');
  logger.blank();
}
