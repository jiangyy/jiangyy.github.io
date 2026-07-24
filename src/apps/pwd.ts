import type { Command } from '../shell/types';

export const pwd: Command = {
  name: 'pwd',
  description: 'print the working directory',
  builtin: true,
  async run(ctx) {
    ctx.stdout.print(ctx.cwd === '' ? '/' : '/' + ctx.cwd);
  },
};
