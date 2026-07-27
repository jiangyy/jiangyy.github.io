// head — first lines of stdin or a document. Pipe-friendly (`cat home | head`)
// and accepts paths (`head -n 5 papers`). Like cat, file args are rendered from
// markdown so the output matches what `cat <path>` would print.
import type { Command } from '../shell/types';
import { resolvePath } from '../shell/path';
import { renderMarkdown } from '../content/render';
import { splitLines, joinLines } from './slicelines';

export const head: Command = {
  name: 'head',
  description: 'first lines: head [-n N | -N] [path...]',
  async run(ctx, argv) {
    const { n, files } = parseArgs(argv);
    const inputs = collect(ctx, files);
    if (inputs.length === 0) return;
    const multi = inputs.length > 1;
    for (const { name, text } of inputs) {
      if (multi) ctx.stdout.print(`==> ${name} <==`);
      ctx.stdout.write(joinLines(splitLines(text).slice(0, n)));
    }
  },
};

/** Parse `-n N`, `-nN`, and `-N` (a bare negative number) into a line count. */
function parseArgs(argv: string[]): { n: number; files: string[] } {
  const files: string[] = [];
  let n = 10;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-n') {
      const v = argv[++i];
      n = v ? parseInt(v, 10) : 10;
    } else if (/^-n\d+$/.test(a)) {
      n = parseInt(a.slice(2), 10);
    } else if (/^-\d+$/.test(a)) {
      n = parseInt(a.slice(1), 10);
    } else {
      files.push(a);
    }
  }
  return { n: Number.isFinite(n) && n > 0 ? n : 0, files };
}

function collect(ctx: Parameters<Command['run']>[0], files: string[]) {
  if (files.length === 0) return [{ name: '(stdin)', text: ctx.stdin }];
  const out: { name: string; text: string }[] = [];
  for (const f of files) {
    const doc = ctx.store.get(resolvePath(f, ctx.cwd));
    if (!doc) {
      ctx.stdout.print(`head: ${f}: no such file`);
      continue;
    }
    out.push({ name: f, text: renderMarkdown(doc.body, ctx.term.cols) });
  }
  return out;
}
