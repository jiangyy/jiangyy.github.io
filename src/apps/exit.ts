// exit — return to the home page. Equivalent to pressing Ctrl-D on an empty
// line: reset cwd to / and re-render `index`. Reuses the index document command
// rather than duplicating render logic.
import type { Command } from '../shell/types';

export const exit: Command = {
  name: 'exit',
  description: 'return to the home page (same as Ctrl-D on an empty line)',
  async run(ctx) {
    ctx.chdir('/'); // back to root, like the Ctrl-D reset
    const home = ctx.resolve('index');
    if (home) await home.run(ctx, ['index']);
  },
};
