import type { Command } from '../shell/types';

export const whoami: Command = {
  name: 'whoami',
  description: 'who runs this site',
  async run(ctx) {
    ctx.stdout.print('jiangyy — a person on the internet.');
    ctx.stdout.print('this site is a terminal. try `help`.');
  },
};
