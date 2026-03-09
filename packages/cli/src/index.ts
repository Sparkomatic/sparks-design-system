#!/usr/bin/env node
import { Command } from 'commander';
import { add }  from './commands/add.js';
import { list } from './commands/list.js';
import { init } from './commands/init.js';

const program = new Command();

program
  .name('sparks-ds')
  .description(
    'Sparks Design System — copy token-driven React components directly into your project'
  )
  .version('0.0.1');

program
  .command('init')
  .description('Set up Sparks DS in your project (creates sparks-ds.json)')
  .action(init);

program
  .command('list')
  .description('List all available components')
  .action(list);

program
  .command('add <name>')
  .description('Copy a component into your project')
  .action(add);

program.parse(process.argv);
