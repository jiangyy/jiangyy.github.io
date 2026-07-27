// Turns a compiled document into a Command — running a document (e.g. bare
// `home`) is "opening a page": it clears the screen and renders. (Reading via
// `cat` just prints text without clearing.) Lives in the content layer so the
// shell stays free of rendering knowledge.
import type { Command, Context } from '../shell/types';
import type { Document } from './types';
import { renderMarkdown } from './render';

/** "Execute" a document: clear the screen (when interactive) then print it. */
export async function renderDoc(ctx: Context, doc: Document): Promise<void> {
  if (ctx.tty) ctx.term.write('\x1b[2J\x1b[3J\x1b[H');
  ctx.stdout.write(renderMarkdown(doc.body, ctx.term.cols));
}

export function docCommand(doc: Document): Command {
  return {
    name: doc.slug,
    description: `${doc.kind} · ${doc.title}`,
    doc: true,
    async run(ctx) {
      switch (doc.kind) {
        case 'page':
          await renderDoc(ctx, doc);
          return;
        default:
          ctx.stdout.print(
            `'${doc.slug}' is a ${doc.kind} document — interactive handler pending (codegen).`,
          );
      }
    },
  };
}
