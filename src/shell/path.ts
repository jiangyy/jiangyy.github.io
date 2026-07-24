// Virtual path resolution. cwd is "/" — content documents live at the root
// (e.g. /about, /blog/hello). /bin holds command entry points (registered
// commands). resolvePath turns user input (home, ./about, /x, blog/hello, ../y)
// into a canonical slug suitable for a registry / store lookup.
export function resolvePath(name: string, cwd = '/'): string {
  const full = name.startsWith('/') ? name : cwd.replace(/\/$/, '') + '/' + name;
  const parts: string[] = [];
  for (const seg of full.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}
