import type { Command } from '../shell/types';

export const cd: Command = {
  name: 'cd',
  description: 'change directory: cd <dir>',
  builtin: true,
  async run(ctx, argv) {
    const target = argv[1] ?? '/';
    const err = ctx.chdir(target);
    if (err) ctx.stdout.print(`cd: ${err}`);
  },
};
