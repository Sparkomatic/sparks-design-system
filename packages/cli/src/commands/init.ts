import * as path from 'path';
import prompts from 'prompts';
import { logger }                           from '../lib/logger.js';
import { readConfig, writeConfig, defaultConfig } from '../lib/config.js';

export async function init(): Promise<void> {
  const cwd = process.cwd();

  logger.blank();
  logger.title('Initialise Sparks Design System');
  logger.blank();

  const existing = await readConfig(cwd);

  if (existing) {
    logger.warn('sparks-ds.json already exists in this directory.');
    logger.dim('  Edit it directly, or run `sparks-ds add <name>` to add components.');
    logger.blank();
    return;
  }

  const answers = await prompts(
    [
      {
        type:    'text',
        name:    'componentsDir',
        message: 'Where should components be copied?',
        initial: defaultConfig.componentsDir,
      },
      {
        type:    'text',
        name:    'tokensFile',
        message: 'Where should the design tokens CSS file live?',
        initial: defaultConfig.tokensFile,
      },
    ],
    {
      onCancel: () => {
        logger.blank();
        logger.warn('Cancelled.');
        process.exit(0);
      },
    }
  );

  await writeConfig(cwd, {
    componentsDir: answers.componentsDir,
    tokensFile:    answers.tokensFile,
  });

  logger.blank();
  logger.success(`Created sparks-ds.json`);
  logger.blank();
  logger.info('Next steps:');
  logger.dim('  sparks-ds add button   — add your first component');
  logger.dim('  sparks-ds list         — browse all available components');
  logger.blank();
  logger.dim(`Remember to import ${answers.tokensFile} in your app entry point`);
  logger.dim(`  (e.g. main.tsx or _app.tsx) after adding your first component.`);
  logger.blank();
}
