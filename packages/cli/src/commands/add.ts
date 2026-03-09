import { logger }       from '../lib/logger.js';
import { getComponent } from '../lib/registry.js';
import { addComponent } from '../lib/installer.js';

export async function add(name: string): Promise<void> {
  const cwd = process.cwd();

  logger.blank();
  logger.title(`Adding ${name}…`);
  logger.blank();

  // Validate early so the error is clear
  let component;
  try {
    component = await getComponent(name);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (!component) {
    logger.error(`No component named "${name}" found in the registry.`);
    logger.dim('  Run `sparks-ds list` to see all available components.');
    process.exit(1);
  }

  try {
    await addComponent(name, cwd);

    logger.blank();
    logger.success(`${name} added successfully!`);
    logger.blank();
    logger.dim(`  Import it in your React code:`);
    logger.dim(`    import { Button } from './${name}/${name}';`);
    logger.blank();
  } catch (err) {
    logger.blank();
    logger.error(`Failed to add ${name}:`);
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
