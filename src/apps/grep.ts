// grep — print lines matching a pattern. Intentionally simple: every argument
// that starts with "-" is ignored (no -i/-v/-n/...), so the first remaining
// token is the pattern and the rest are optional paths. Reads stdin when no
// path is given (`cat home | grep foo`). A pattern that isn't valid regex
// falls back to a literal substring match.
import type { Command } from '../shell/types';
import { resolvePath } from '../shell/path';
import { renderMarkdown } from '../content/render';

export const grep: Command = {
  name: 'grep',
  description: 'lines matching a pattern: grep <pattern> [path...]',
  async run(ctx, argv) {
    const rest = argv.slice(1).filter((a) => !a.startsWith('-'));
    const pattern = rest[0];
    if (!pattern) {
      ctx.stdout.print('usage: grep <pattern> [path...]');
      return;
    }
    const files = rest.slice(1);
    const inputs =
      files.length === 0
        ? [{ name: '(stdin)', text: ctx.stdin }]
        : files.map((f) => {
            const doc = ctx.store.get(resolvePath(f, ctx.cwd));
            return doc
              ? { name: f, text: renderMarkdown(doc.body) }
              : { name: f, text: null as string | null };
          });

    const re = compile(pattern);
    const multi = inputs.length > 1;
    const hits: string[] = [];
    for (const { name, text } of inputs) {
      if (text === null) {
        ctx.stdout.print(`grep: ${name}: no such file`);
        continue;
      }
      for (const line of text.split('\n')) {
        if (re.test(line)) hits.push(multi ? `${name}:${line}` : line);
      }
    }
    if (hits.length > 0) ctx.stdout.print(hits.join('\n'));
  },
};

/** Compile to a regex; fall back to a literal match if the input isn't valid. */
function compile(pattern: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }
}
