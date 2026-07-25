// Shared line plumbing for head/tail. Drops a single trailing newline before
// splitting so a final blank line isn't read as a phantom empty line; callers
// rejoin with '\n' and one trailing newline to reconstruct conventional output.

/** Split text into lines, ignoring one trailing newline. */
export function splitLines(text: string): string[] {
  const body = text.endsWith('\n') ? text.slice(0, -1) : text;
  return body === '' ? [] : body.split('\n');
}

/** Rejoin selected lines as output (one newline per line, trailing newline). */
export function joinLines(lines: string[]): string {
  return lines.length === 0 ? '' : lines.join('\n') + '\n';
}
