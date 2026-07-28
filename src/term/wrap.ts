// Styled-line wrapping primitives shared by the markdown renderer and the pager.
// `tokenize` keeps ANSI SGR and OSC 8 hyperlink sequences intact so wrapping can
// never split a control sequence; active SGR is carried across line breaks so
// styling (and links) survive the wrap.
import { RESET, charWidth } from './ansi';

export type Tok =
  | { kind: 'sgr'; seq: string }
  | { kind: 'osc'; seq: string }
  | { kind: 'ch'; s: string; w: number };

/** Split a styled line into SGR / OSC / grapheme tokens so wrapping never cuts a
 *  control sequence in half. */
export function tokenize(line: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line.charCodeAt(i);
    if (c === 0x1b) {
      const next = line.charCodeAt(i + 1);
      if (next === 0x5b) {
        // CSI: ESC [ params final
        let j = i + 2;
        while (j < line.length && /[0-9;]/.test(line[j])) j++;
        toks.push({ kind: 'sgr', seq: line.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      if (next === 0x5d) {
        // OSC: ESC ] ... BEL | ST(ESC \)
        let j = i + 2;
        while (
          j < line.length &&
          line.charCodeAt(j) !== 0x07 &&
          !(line.charCodeAt(j) === 0x1b && line.charCodeAt(j + 1) === 0x5c)
        )
          j++;
        if (line.charCodeAt(j) === 0x07) {
          toks.push({ kind: 'osc', seq: line.slice(i, j + 1) });
          i = j + 1;
        } else {
          toks.push({ kind: 'osc', seq: line.slice(i, j + 2) });
          i = j + 2;
        }
        continue;
      }
      toks.push({ kind: 'osc', seq: line.slice(i, i + 2) });
      i += 2;
      continue;
    }
    // grapheme (handle surrogate pairs → one supplementary codepoint)
    if (c >= 0xd800 && c <= 0xdbff) {
      const s = line.slice(i, i + 2);
      toks.push({ kind: 'ch', s, w: charWidth(line.codePointAt(i) ?? 0) });
      i += 2;
      continue;
    }
    toks.push({ kind: 'ch', s: line[i], w: charWidth(c) });
    i += 1;
  }
  return toks;
}

/** Fold a token slice's SGR sequences into the active-style accumulator `open`. */
function foldSgr(open: string, toks: Tok[]): string {
  let o = open;
  for (const t of toks) {
    if (t.kind !== 'sgr') continue;
    o = t.seq === RESET || t.seq === '\x1b[m' ? '' : o + t.seq;
  }
  return o;
}

const tokStr = (ts: Tok[]) => ts.map((t) => (t.kind === 'ch' ? t.s : t.seq)).join('');

/** Wrap one logical line to `cols` display cells at the character boundary,
 *  carrying ANSI SGR across breaks. Used by the pager. */
export function wrapLine(line: string, cols: number): string[] {
  const toks = tokenize(line);
  const out: string[] = [];
  let cur = '';
  let w = 0;
  let open = ''; // active SGR to re-emit after a wrap
  const breakLine = () => {
    out.push(cur + (open ? RESET : ''));
    cur = open;
    w = 0;
  };
  for (const t of toks) {
    if (t.kind !== 'ch') {
      cur += t.seq;
      if (t.kind === 'sgr') open = t.seq === RESET || t.seq === '\x1b[m' ? '' : open + t.seq;
      continue;
    }
    if (w > 0 && w + t.w > cols) breakLine();
    cur += t.s;
    w += t.w;
  }
  out.push(cur + (open ? RESET : ''));
  return out;
}

/**
 * Word-wrap a styled line to `width` display cells, preferring breaks at spaces.
 * Continuation is the caller's job (hanging indent) — this returns raw physical
 * lines with no indentation. Active SGR is re-emitted at the start of each line
 * so styling and OSC 8 links survive the wrap. A single word wider than `width`
 * is hard-broken at the cell boundary (grapheme-aware, so CJK / emoji aren't
 * split mid-cluster).
 *
 * Embedded newlines (markdown soft/hard breaks, `<br>`) are treated as hard line
 * boundaries: each `\n`-delimited segment is wrapped on its own. Otherwise the
 * newline would be folded into a word as a width-1 character, miscounting the
 * line width and stranding following words on the wrong line.
 */
export function wrapWords(line: string, width: number): string[] {
  if (width < 1) width = 1;
  const out: string[] = [];
  for (const seg of line.split('\n')) {
    // One source newline = one line break: each segment's wrapped lines follow
    // the previous on consecutive lines (no blank line between). An empty
    // segment (from `\n\n`) is the one case that yields a blank line.
    const wrapped = wrapSegment(seg, width);
    if (wrapped.length) out.push(...wrapped);
    else out.push('');
  }
  return out;
}

/** Wrap a single newline-free segment. */
function wrapSegment(line: string, width: number): string[] {
  if (width < 1) width = 1;
  const toks = tokenize(line);

  // Group into words separated by space chars; spaces are dropped and re-added
  // singly between words (collapsing runs / leading spaces).
  type Word = { toks: Tok[]; w: number };
  const words: Word[] = [];
  let cur: Tok[] = [];
  let curW = 0;
  const flushWord = () => {
    if (cur.length) {
      words.push({ toks: cur, w: curW });
      cur = [];
      curW = 0;
    }
  };
  for (const t of toks) {
    if (t.kind === 'ch' && t.s === ' ') {
      flushWord();
      continue;
    }
    if (t.kind === 'ch') curW += t.w;
    cur.push(t);
  }
  flushWord();

  const out: string[] = [];
  let lineStr = ''; // current physical line text
  let w = 0; // visible width of lineStr
  let open = ''; // active SGR to re-emit after a break

  const flush = () => {
    out.push(lineStr + (open ? RESET : ''));
    lineStr = '';
    w = 0;
  };

  for (const word of words) {
    if (word.w === 0) {
      // control-only run (e.g. a stray SGR): fold into active style, no cells
      open = foldSgr(open, word.toks);
      continue;
    }
    if (w === 0) lineStr = open; // fresh line inherits active style
    const needSpace = w > 0 ? 1 : 0;
    if (w + needSpace + word.w > width && w > 0) {
      // word doesn't fit on the current line — flush and retry on a fresh line
      flush();
      lineStr = open;
    }
    if (w > 0) {
      lineStr += ' ';
      w += 1;
    }
    if (word.w <= width) {
      lineStr += tokStr(word.toks);
      w += word.w;
      open = foldSgr(open, word.toks);
    } else {
      // word longer than a whole line — hard-break char by char
      for (const t of word.toks) {
        if (t.kind !== 'ch') {
          lineStr += t.seq;
          if (t.kind === 'sgr') open = t.seq === RESET || t.seq === '\x1b[m' ? '' : open + t.seq;
          continue;
        }
        if (w > 0 && w + t.w > width) {
          flush();
          lineStr = open;
        }
        lineStr += t.s;
        w += t.w;
      }
    }
  }
  if (w > 0) flush();
  return out;
}
