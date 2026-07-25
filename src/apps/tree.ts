// tree — draw the virtual FS as an indented tree (ASCII boxes). Reuses the same
// vfs traversal as `find`. Dirs are colored and trailed with '/'; a summary
// line counts directories and files beneath the root.
import type { Command, DirEntry } from '../shell/types';
import { resolvePath } from '../shell/path';
import { isDir, childrenOf } from '../shell/vfs';
import { BOLD, DIM, RESET, fg256 } from '../term/ansi';

const DIR_COLOR = fg256(62); // muted indigo, matches headings
const BRANCH = fg256(244); // soft gray for the box-drawing connectors

export const tree: Command = {
  name: 'tree',
  description: 'draw the FS as a tree: tree [path]',
  async run(ctx, argv) {
    const start = argv[1] ?? '.';
    const slug = resolvePath(start, ctx.cwd);
    if (!isDir(slug, ctx)) {
      ctx.stdout.print(`tree: ${start}: not a directory`);
      return;
    }
    const root = start.replace(/\/+$/, '') || '/';
    const lines: string[] = [root];
    const counts = { dirs: 0, files: 0 };
    drawChildren(slug, '', ctx, lines, counts);
    lines.push('');
    lines.push(
      `${DIM}${counts.dirs} director${counts.dirs === 1 ? 'y' : 'ies'}, ` +
        `${counts.files} file${counts.files === 1 ? '' : 's'}${RESET}`,
    );
    ctx.stdout.print(lines.join('\n'));
  },
};

function drawChildren(
  slug: string,
  prefix: string,
  ctx: Parameters<Command['run']>[0],
  out: string[],
  counts: { dirs: number; files: number },
) {
  const kids: DirEntry[] = childrenOf(slug, ctx);
  kids.forEach((k, i) => {
    const last = i === kids.length - 1;
    const edge = last ? '└── ' : '├── ';
    const cont = last ? '    ' : '│   ';
    const name = k.dir ? `${BOLD}${DIR_COLOR}${k.name}/${RESET}` : k.name;
    out.push(`${BRANCH}${prefix}${edge}${RESET}${name}`);
    if (k.dir) {
      counts.dirs++;
      drawChildren(slug === '' ? k.name : slug + '/' + k.name, prefix + cont, ctx, out, counts);
    } else {
      counts.files++;
    }
  });
}
