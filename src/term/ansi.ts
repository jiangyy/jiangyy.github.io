// Tiny ANSI / TUI drawing primitives. Pure string builders — no xterm coupling,
// so TUI apps depend on this file rather than on the terminal implementation.

export const RESET = '\x1b[0m';
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const ITALIC = '\x1b[3m';
export const UNDERLINE = '\x1b[4m';
export const INVERSE = '\x1b[7m';

export const fg = (n: number) => `\x1b[${30 + n}m`; // 0–7
export const bg = (n: number) => `\x1b[${40 + n}m`;
export const fg256 = (n: number) => `\x1b[38;5;${n}m`; // 0–255
export const bg256 = (n: number) => `\x1b[48;5;${n}m`;

export const move = (x: number, y: number) => `\x1b[${y + 1};${x + 1}H`;
export const moveCol = (x: number) => `\x1b[${x + 1}G`;
export const clearLine = '\x1b[2K';
export const clearLineRight = '\x1b[0K';
export const saveCursor = '\x1b7';
export const restoreCursor = '\x1b8';

/** Clear screen and home cursor. */
export const clearScreen = '\x1b[2J\x1b[H';

/** Draw a single-line box with its top-left corner at (x, y). */
export function box(x: number, y: number, w: number, h: number): string {
  if (w < 2 || h < 2) return '';
  const top = move(x, y) + '┌' + '─'.repeat(w - 2) + '┐';
  let mid = '';
  for (let i = 1; i < h - 1; i++) {
    mid += move(x, y + i) + '│' + move(x + w - 1, y + i) + '│';
  }
  const bottom = move(x, y + h - 1) + '└' + '─'.repeat(w - 2) + '┘';
  return top + mid + bottom;
}

/**
 * OSC 8 hyperlink — the ONLY way to render a genuinely clickable link inside
 * xterm.js. Renders `text` as a link pointing at `url` (hover underline, click opens).
 */
export function link(url: string, text: string): string {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

/** Display width of one code point: 2 for CJK / wide emoji, else 1 cell. */
export function charWidth(code: number): number {
  if (code < 0x300) return 1;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3040 && code <= 0x33bf) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f000 && code <= 0x1faff)
  )
    return 2;
  return 1;
}

/** Display width of a string in terminal cells (handles CJK / emoji / surrogates). */
export function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) w += charWidth(ch.codePointAt(0) ?? 0);
  return w;
}

/** Strip ANSI SGR escape sequences, returning the visible text. */
export const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

