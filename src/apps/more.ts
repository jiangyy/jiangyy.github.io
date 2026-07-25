// more — a simple pager. Pages a document (`more papers`) or piped stdin
// (`cat home | more`) one screen at a time, taking over the terminal like `tui`.
// Keys: Space/pgdn = next page, b/pgup = prev page, ↓/j = line down, ↑/k = line
// up, g = top, G = bottom, q/ESC = quit. Long lines are soft-wrapped to the
// terminal width, preserving ANSI styling across the wrap.
import type { Command } from '../shell/types';
import { resolvePath } from '../shell/path';
import { renderMarkdown } from '../content/render';
import { charWidth, RESET, DIM } from '../term/ansi';
import { move } from '../term/ansi';

const ERASE_BELOW = '\x1b[0J';

export const more: Command = {
  name: 'more',
  description: 'page a document or stdin: more [path]',
  async run(ctx, argv) {
    const file = argv[1];
    let text: string | null = null;
    if (file) {
      const doc = ctx.store.get(resolvePath(file, ctx.cwd));
      if (!doc) {
        ctx.stdout.print(`more: ${file}: no such file`);
        return;
      }
      text = renderMarkdown(doc.body);
    } else if (ctx.stdin) {
      text = ctx.stdin;
    }
    if (text === null) {
      ctx.stdout.print('usage: more [path]');
      return;
    }
    // Mid-pipe (not the last segment) there's no tty to take over — just pass through.
    if (!ctx.tty) {
      ctx.stdout.write(text);
      return;
    }
    await page(ctx, text);
  },
};

// `less` is the same pager under another name. Both already support PageUp/PageDown.
export const less: Command = {
  ...more,
  name: 'less',
  description: 'page a document or stdin: less [path]',
};

/** Run the interactive pager over already-rendered text. */
async function page(ctx: Parameters<Command['run']>[0], text: string): Promise<void> {
  const s = ctx.term.takeOver();
  const logical = text.split('\n');
  let top = 0;
  let drawnRows = 0;

  const draw = () => {
    s.clear();
    const cols = Math.max(1, s.cols);
    const pageH = Math.max(1, s.rows - 1); // reserve the bottom row for the status
    const wrapped: string[] = [];
    for (const ln of logical) wrapped.push(...wrapLine(ln, cols));
    const total = wrapped.length;
    const last = Math.max(0, total - pageH);
    top = Math.min(top, last);
    const vis = wrapped.slice(top, top + pageH);
    drawnRows = vis.length;
    s.write(vis.join('\r\n'));
    const atEnd = top >= last && total > 0;
    const pct = total === 0 ? 100 : Math.min(100, Math.round(((top + pageH) / total) * 100));
    const status = atEnd ? `${DIM}(END)${RESET}` : `${DIM}--More-- ${pct}%${RESET}`;
    s.write(move(0, s.rows - 1) + status);
    return { atEnd, pageH, last };
  };

  // Ctrl-D (bookmark) / Ctrl-U (view source) are reserved browser shortcuts;
  // swallow them at capture so they reach the pager instead of the browser.
  const swallow = (e: KeyboardEvent) => {
    if (e.ctrlKey && (e.key === 'd' || e.key === 'u' || e.key === '\x04' || e.key === '\x15'))
      e.preventDefault();
  };
  window.addEventListener('keydown', swallow, true);

  const STEP = 10; // lines per Ctrl-D / Ctrl-U
  let state = draw();
  try {
    await new Promise<void>((resolve) => {
      const off = s.onKey((e) => {
        const dom = e.domEvent;
        // Ctrl-D / Ctrl-U: vim-style scroll by STEP lines.
        if (dom.ctrlKey) {
          const c = dom.key;
          if (c === 'd' || c === 'D' || c === '\x04') top = Math.min(top + STEP, state.last);
          else if (c === 'u' || c === 'U' || c === '\x15') top = Math.max(top - STEP, 0);
          else return;
          state = draw();
          return;
        }
        const k = dom.key;
        if (k === 'q' || k === 'Escape') {
          off();
          resolve();
          return;
        }
        if (k === ' ' || k === 'PageDown' || k === 'f') {
          if (state.atEnd) {
            off(); // space at the end quits, like more
            resolve();
            return;
          }
          top = Math.min(top + state.pageH, state.last);
        } else if (k === 'b' || k === 'PageUp') {
          top = Math.max(top - state.pageH, 0);
        } else if (k === 'ArrowDown' || k === 'j' || k === 'Enter') {
          top = Math.min(top + 1, state.last);
        } else if (k === 'ArrowUp' || k === 'k') {
          top = Math.max(top - 1, 0);
        } else if (k === 'g') {
          top = 0;
        } else if (k === 'G') {
          top = state.last;
        } else {
          return;
        }
        state = draw();
      });
    });
  } finally {
    window.removeEventListener('keydown', swallow, true);
  }

  // Leave the content visible; drop the cursor just past it and clear below,
  // so the returning shell prompt lands cleanly on the next line.
  s.write(move(0, drawnRows) + ERASE_BELOW);
  s.release();
}

/** Wrap one logical line to `cols` display cells, carrying ANSI SGR across breaks. */
export function wrapLine(line: string, cols: number): string[] {
  const toks = tokenize(line);
  const out: string[] = [];
  let cur = '';
  let w = 0;
  let open = ''; // active SGR to re-emit after a wrap
  const breakLine = () => {
    out.push(cur + (open ? RESET : ''));
    cur = open;
    w = 0;
  };
  for (const t of toks) {
    if (t.kind !== 'ch') {
      cur += t.seq;
      if (t.kind === 'sgr') {
        if (t.seq === '\x1b[0m' || t.seq === '\x1b[m') open = '';
        else open += t.seq;
      }
      continue;
    }
    if (w > 0 && w + t.w > cols) breakLine();
    cur += t.s;
    w += t.w;
  }
  out.push(cur + (open ? RESET : ''));
  return out;
}

type Tok =
  | { kind: 'sgr'; seq: string }
  | { kind: 'osc'; seq: string }
  | { kind: 'ch'; s: string; w: number };

/** Split a styled line into SGR / OSC / grapheme tokens so wrapping never cuts a
 *  control sequence in half. */
function tokenize(line: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 0x1b) {
      const next = line.charCodeAt(i + 1);
      if (next === 0x5b) {
        // CSI: ESC [ params final
        let j = i + 2;
        while (j < line.length && /[0-9;]/.test(line[j])) j++;
        toks.push({ kind: 'sgr', seq: line.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      if (next === 0x5d) {
        // OSC: ESC ] ... BEL | ST(ESC \)
        let j = i + 2;
        while (
          j < line.length &&
          line.charCodeAt(j) !== 0x07 &&
          !(line.charCodeAt(j) === 0x1b && line.charCodeAt(j + 1) === 0x5c)
        )
          j++;
        if (line.charCodeAt(j) === 0x07) {
          toks.push({ kind: 'osc', seq: line.slice(i, j + 1) });
          i = j + 1;
        } else {
          toks.push({ kind: 'osc', seq: line.slice(i, j + 2) });
          i = j + 2;
        }
        continue;
      }
      toks.push({ kind: 'osc', seq: line.slice(i, i + 2) });
      i += 2;
      continue;
    }
    // grapheme (handle surrogate pairs → one supplementary codepoint)
    if (c >= 0xd800 && c <= 0xdbff) {
      const s = line.slice(i, i + 2);
      toks.push({ kind: 'ch', s, w: charWidth(line.codePointAt(i) ?? 0) });
      i += 2;
      continue;
    }
    toks.push({ kind: 'ch', s: line[i], w: charWidth(c) });
    i += 1;
  }
  return toks;
}
