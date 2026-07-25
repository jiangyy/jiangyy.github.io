// tail — last lines of stdin or a document. Mirror of head: pipe-friendly
// (`cat home | tail -n 3`) and accepts paths (`tail 5 papers`).
import type { Command } from '../shell/types';
import { resolvePath } from '../shell/path';
import { renderMarkdown } from '../content/render';
import { splitLines, joinLines } from './slicelines';

export const tail: Command = {
  name: 'tail',
  description: 'last lines: tail [-n N | -N] [path...]',
  async run(ctx, argv) {
    const { n, files } = parseArgs(argv);
    const inputs = collect(ctx, files);
    if (inputs.length === 0) return;
    const multi = inputs.length > 1;
    for (const { name, text } of inputs) {
      if (multi) ctx.stdout.print(`==> ${name} <==`);
      ctx.stdout.write(joinLines(splitLines(text).slice(-n)));
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
      ctx.stdout.print(`tail: ${f}: no such file`);
      continue;
    }
    out.push({ name: f, text: renderMarkdown(doc.body) });
  }
  return out;
}
