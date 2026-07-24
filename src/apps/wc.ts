import type { Command } from '../shell/types';

export const wc: Command = {
  name: 'wc',
  description: 'count lines/words/bytes from stdin: wc [-lwc]',
  async run(ctx, argv) {
    const text = ctx.stdin;
    const flag = argv.slice(1).find((a) => /^-[lwc]+$/.test(a));
    const want = (c: string) => !flag || flag.includes(c);
    const lines = (text.match(/\n/g) ?? []).length;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const bytes = text.length;
    const parts: string[] = [];
    if (want('l')) parts.push(String(lines));
    if (want('w')) parts.push(String(words));
    if (want('c')) parts.push(String(bytes));
    ctx.stdout.print(parts.join('\t'));
  },
};
