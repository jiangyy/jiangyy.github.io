// Minimal tokenizer: command name + argv, with double-quote support.
export function parseLine(line: string): string[] {
  const argv: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (const c of line) {
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(c)) {
      if (cur) {
        argv.push(cur);
        cur = '';
      }
      continue;
    }
    cur += c;
  }
  if (cur) argv.push(cur);
  return argv;
}
