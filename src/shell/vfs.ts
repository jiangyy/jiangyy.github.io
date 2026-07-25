// Read-only virtual FS view over the content store + command registry. The shell
// models `/` as documents (slugs may nest, e.g. `blog/hello` → implicit `blog/`
// dir) plus `/bin` (registered, non-builtin, non-doc commands). `find` and
// `tree` both walk this tree, so the traversal lives here rather than duplicated.
import type { Context, DirEntry } from './types';

/** Directory if root, /bin, or any document lives beneath `slug + '/'`. */
export function isDir(slug: string, ctx: Context): boolean {
  if (slug === '' || slug === 'bin') return true;
  const prefix = slug + '/';
  return ctx.store.all().some((d) => d.slug.startsWith(prefix));
}

/** File if a document has this exact slug, or it's a /bin command. */
export function isFile(slug: string, ctx: Context): boolean {
  if (slug === '' || slug === 'bin') return false;
  if (ctx.store.get(slug)) return true;
  if (slug.startsWith('bin/')) {
    return ctx.list().some((c) => !c.builtin && !c.doc && c.name === slug.slice(4));
  }
  return false;
}

/** Direct children of a directory slug (assumed to be a dir), sorted by name. */
export function childrenOf(slug: string, ctx: Context): DirEntry[] {
  if (slug === 'bin') {
    return ctx
      .list()
      .filter((c) => !c.builtin && !c.doc)
      .map((c) => ({ name: c.name, dir: false }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const prefix = slug === '' ? '' : slug + '/';
  const files = new Set<string>();
  const dirs = new Set<string>();
  for (const d of ctx.store.all()) {
    if (prefix === '') {
      const i = d.slug.indexOf('/');
      if (i === -1) files.add(d.slug);
      else dirs.add(d.slug.slice(0, i));
    } else if (d.slug.startsWith(prefix)) {
      const rest = d.slug.slice(prefix.length);
      const i = rest.indexOf('/');
      if (i === -1) files.add(rest);
      else dirs.add(rest.slice(0, i));
    }
  }
  return [
    ...(slug === '' ? [{ name: 'bin', dir: true }] : []),
    ...[...dirs].sort().map((name) => ({ name, dir: true })),
    ...[...files].sort().map((name) => ({ name, dir: false })),
  ];
}
