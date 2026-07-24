// A tiny fullscreen TUI app — exercises the takeOver() path so oneshot and TUI
// commands share one shell. Type to rename, q / ESC to quit. (Not pipeable.)
import type { Command } from '../shell/types';
import { box, move, BOLD, DIM, RESET } from '../term/ansi';

export const tui: Command = {
  name: 'tui',
  description: 'demo: fullscreen TUI app (q/ESC to quit)',
  async run(ctx) {
    const s = ctx.term.takeOver();
    let name = 'guest';

    const draw = () => {
      s.clear();
      const w = Math.min(s.cols - 4, 52);
      const h = Math.min(s.rows - 4, 12);
      const x = Math.floor((s.cols - w) / 2);
      const y = Math.floor((s.rows - h) / 2);
      s.write(box(x, y, w, h));
      s.write(move(x + 2, y + 1) + BOLD + '◆ TUI demo' + RESET);
      s.write(move(x + 2, y + 3) + `hello, ${name}`);
      s.write(move(x + 2, y + 5) + DIM + 'type to rename · q / ESC to quit' + RESET);
      s.write(move(x + 2, y + 6) + `terminal: ${s.cols}×${s.rows}`);
    };

    draw();
    await new Promise<void>((resolve) => {
      const off = s.onKey((e) => {
        const k = e.domEvent.key;
        if (k === 'q' || k === 'Escape') {
          off();
          resolve();
          return;
        }
        if (k === 'Backspace') {
          name = name.slice(0, -1);
          draw();
          return;
        }
        if (k.length === 1) {
          name += k;
          draw();
        }
      });
    });

    s.release();
    s.clear();
    ctx.term.print('back to shell.');
  },
};
