import type { Command } from '../shell/types';

export const whoami: Command = {
  name: 'whoami',
  description: 'who runs this site',
  async run(ctx) {
    ctx.stdout.print('jyy');
  },
};
