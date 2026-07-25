// find — walk the virtual FS and print paths. Predicates are intentionally
// minimal: `-name GLOB` (basename, shell glob) and `-type f|d`. Unknown
// `-options` are ignored. Stdin is unused — find enumerates the FS. The tree
// traversal itself lives in shell/vfs, shared with `tree`.
import type { Command } from '../shell/types';
import { resolvePath } from '../shell/path';
import { isDir, isFile, childrenOf } from '../shell/vfs';

export const find: Command = {
  name: 'find',
  description: 'walk the FS: find [path...] [-name GLOB] [-type f|d]',
  async run(ctx, argv) {
    const { starts, name, type } = parse(argv);
    const roots = starts.length > 0 ? starts : ['.'];
    const out: string[] = [];
    const emit = (disp: string, dir: boolean) => {
      if (type && (type === 'f') === dir) return; // f wants files, d wants dirs
      if (name && !name.test(disp.split('/').pop() ?? disp)) return;
      out.push(disp);
    };

    for (const start of roots) {
      const slug = resolvePath(start, ctx.cwd);
      const dir = isDir(slug, ctx);
      if (!dir && !isFile(slug, ctx)) {
        ctx.stdout.print(`find: ${start}: no such file or directory`);
        continue;
      }
      const disp = dispRoot(start);
      emit(disp, dir);
      if (dir) for (const r of walk(slug, disp, ctx)) emit(r.disp, r.dir);
    }
    if (out.length > 0) ctx.stdout.print(out.join('\n'));
  },
};

interface Parsed {
  starts: string[];
  name: RegExp | null;
  type: 'f' | 'd' | null;
}

/** Split starting points from `-name`/`-type`; ignore any other `-option`. */
function parse(argv: string[]): Parsed {
  const starts: string[] = [];
  let name: RegExp | null = null;
  let type: 'f' | 'd' | null = null;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-name') {
      const v = argv[++i];
      if (v) name = globToRe(v);
    } else if (a === '-type') {
      const v = argv[++i];
      if (v === 'f' || v === 'd') type = v;
    } else if (!a.startsWith('-')) {
      starts.push(a);
    }
  }
  return { starts, name, type };
}

/** Depth-first walk yielding display paths of descendants (not the root). */
function* walk(
  slug: string,
  disp: string,
  ctx: Parameters<Command['run']>[0],
): Generator<{ disp: string; dir: boolean }> {
  for (const k of childrenOf(slug, ctx)) {
    const childDisp = (disp === '/' ? '' : disp) + '/' + k.name;
    const childSlug = slug === '' ? k.name : slug + '/' + k.name;
    yield { disp: childDisp, dir: k.dir };
    if (k.dir) yield* walk(childSlug, childDisp, ctx);
  }
}

/** Display form of the start path ('.', '/', '/bin', 'papers', ...). */
function dispRoot(start: string): string {
  const d = start.replace(/\/+$/, '');
  return d === '' ? '/' : d;
}

/** Shell glob (* and ?) → anchored RegExp. Other regex metachars are escaped. */
function globToRe(g: string): RegExp {
  const re = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + re + '$');
}
