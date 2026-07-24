import type { Command } from '../shell/types';

export const clear: Command = {
  name: 'clear',
  description: 'clear the screen',
  async run(ctx) {
    ctx.term.clear();
  },
};
