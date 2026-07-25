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

/**
 * Zero-width code point that extends a base rather than starting a new cell:
 * ZWJ/ZWNJ, emoji & text variation selectors, skin-tone modifiers, and the
 * common combining-mark ranges. These must not add to display width, and a ZWJ
 * also folds the following base into the same cluster.
 */
export function isExtender(code: number): boolean {
  return (
    code === 0x200d || // zero-width joiner
    code === 0x200c || // zero-width non-joiner
    (code >= 0xfe00 && code <= 0xfe0f) || // variation selectors (1–16)
    (code >= 0x1f3fb && code <= 0x1f3ff) || // emoji skin-tone modifiers
    (code >= 0x0300 && code <= 0x036f) || // combining diacritics
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f) // combining half marks
  );
}

/** Regional indicator (flag half); a pair forms one 2-cell flag. */
function isRegional(code: number): boolean {
  return code >= 0x1f1e6 && code <= 0x1f1ff;
}

/** Display width of one code point: 0 for extenders, 2 for CJK / wide emoji, else 1. */
export function charWidth(code: number): number {
  if (isExtender(code)) return 0;
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

/**
 * Display width of a string in terminal cells, accounting for grapheme clusters:
 * ZWJ-joined emoji (👨‍👩‍👧), variation selectors, skin-tone modifiers, flags
 * (🇨🇳), and combining diacritics (é) each count as a single cluster, not one
 * cell per code point. (xterm still renders ZWJ families cell-by-cell — this
 * only keeps our own cursor/rule math honest.)
 */
export function displayWidth(str: string): number {
  const cps: number[] = [];
  for (const ch of str) cps.push(ch.codePointAt(0) ?? 0);
  let w = 0;
  let joinNext = false;
  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i];
    if (cp === 0x200d) {
      joinNext = true; // ZWJ folds the next base into this cluster (no extra width)
      continue;
    }
    if (isExtender(cp)) continue;
    if (joinNext) {
      joinNext = false;
      continue;
    }
    if (isRegional(cp) && i + 1 < cps.length && isRegional(cps[i + 1])) {
      w += 2; // a flag is two indicators, one 2-cell cluster
      i++;
      continue;
    }
    w += charWidth(cp);
  }
  return w;
}

/** UTF-16 index where the grapheme cluster ending just before `at` begins. */
export function prevClusterStart(str: string, at: number): number {
  if (at <= 0) return 0;
  const cps = [...str.slice(0, at)];
  const cp = (i: number) => cps[i].codePointAt(0) ?? 0;
  let k = cps.length;
  while (k > 0 && isExtender(cp(k - 1))) k--; // trailing extenders belong to the cluster
  if (k === 0) return at;
  k--; // the base
  while (k >= 2 && cp(k - 1) === 0x200d) k -= 2; // fold ZWJ-joined bases
  if (k >= 2 && isRegional(cp(k - 1)) && isRegional(cp(k - 2))) k--; // fold a flag pair
  return cps.slice(0, k).reduce((n, s) => n + s.length, 0);
}

/** UTF-16 index just past the grapheme cluster beginning at `at`. */
export function nextClusterEnd(str: string, at: number): number {
  const cps = [...str.slice(at)];
  if (cps.length === 0) return at;
  const cp = (i: number) => cps[i].codePointAt(0) ?? 0;
  let k = 1; // the base
  const eat = () => {
    while (k < cps.length && isExtender(cp(k)) && cp(k) !== 0x200d) k++;
  };
  eat();
  while (k + 1 < cps.length && cp(k) === 0x200d) {
    k += 2; // ZWJ + the base it joins
    eat();
  }
  return at + cps.slice(0, k).reduce((n, s) => n + s.length, 0);
}

/** Strip ANSI SGR escape sequences, returning the visible text. */
export const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

