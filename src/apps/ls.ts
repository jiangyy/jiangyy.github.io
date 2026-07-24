import type { Command } from '../shell/types';

export const ls: Command = {
  name: 'ls',
  description: 'list directory contents: ls [dir]',
  async run(ctx, argv) {
    const target = argv[1] ?? '.';
    const entries = ctx.listDir(target);
    if (!entries) {
      ctx.stdout.print(`ls: ${target}: not a directory`);
      return;
    }
    if (entries.length === 0) {
      ctx.stdout.print('(empty)');
      return;
    }
    for (const e of entries) {
      ctx.stdout.print(`  ${e.name}${e.dir ? '/' : ''}`);
    }
  },
};
