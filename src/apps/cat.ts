// cat — read one or more files to stdout. Unlike executing a document (which
// clears and full-screens), cat just prints rendered text, so it composes in
// pipes: `cat index | wc -l`, and concatenates several: `cat help index`.
import type { Command } from '../shell/types';
import { resolvePath } from '../shell/path';
import { renderMarkdown } from '../content/render';

export const cat: Command = {
  name: 'cat',
  description: 'print documents: cat <path> [path...]',
  async run(ctx, argv) {
    const paths = argv.slice(1);
    if (paths.length === 0) {
      ctx.stdout.print('usage: cat <path> [path...]');
      return;
    }
    for (const path of paths) {
      const doc = ctx.store.get(resolvePath(path, ctx.cwd));
      if (!doc) {
        ctx.stdout.print(`cat: ${path}: no such file`);
        continue;
      }
      ctx.stdout.write(renderMarkdown(doc.body, ctx.term.cols));
    }
  },
};
