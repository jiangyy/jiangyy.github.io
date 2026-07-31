// Build-time macro expansion for content markdown. Runs in the compiler
// (scripts/build-content.ts) so the generated manifest — and therefore the
// deployed site — contains the final text; the `{{...}}` syntax lives only in
// source `content/*.md`.
//
// Supported:
//   {{displayDate(2026, 7, 31)}}   → Fri Jul 31 2026   (weekday derived; month is 1-indexed)
//   {{texify(e=mc^2)}}             → e=mc²             (inline math, see ./tex.ts)
//
// Block math uses a ```tex fenced code block, rewritten to ```plain with the
// rendered (possibly multi-line) output.
//
// Inside any OTHER fenced code block (e.g. the ASCII-art logo's ```plain),
// `{{...}}` is left untouched — code blocks are passed through verbatim.
// An unknown macro name is a build error so typos surface immediately.
import { renderTex } from './tex';

const INLINE_MACRO = /\{\{\s*(\w+)\s*\(([^)]*)\)\s*\}\}/g;

/** `displayDate(year, month, day)` → `new Date(y, month-1, d).toDateString()`. */
function displayDate(arg: string): string {
  const parts = arg.split(',').map((s) => s.trim());
  const nums = parts.map(Number);
  if (nums.length !== 3 || nums.some((n) => !Number.isFinite(n))) {
    throw new Error(`displayDate expects (year, month, day), got: (${arg})`);
  }
  const [y, m, d] = nums;
  return new Date(y, m - 1, d).toDateString();
}

/** Expand inline `{{name(args)}}` macros on a single line of text. */
function expandInline(line: string): string {
  return line.replace(INLINE_MACRO, (full, name: string, arg: string) => {
    const a = arg.trim();
    switch (name) {
      case 'displayDate':
        return displayDate(a);
      case 'texify':
        return renderTex(a, 'inline');
      default:
        throw new Error(`unknown macro ${full}`);
    }
  });
}

/**
 * Expand macros across a markdown body, fence-aware:
 * - ```tex blocks → ```plain with rendered math (no inline expansion inside).
 * - any other fenced block → verbatim (protects code/ASCII art from expansion).
 * - prose lines → inline macros expanded.
 */
export function expandMacros(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const open = /^```(.*)$/.exec(line.trimEnd());
    if (!open) {
      out.push(expandInline(line));
      i++;
      continue;
    }

    if (open[1].trim() === 'tex') {
      // ```tex block: collect body, render, re-emit as ```plain.
      const buf: string[] = [];
      i++;
      while (i < lines.length && lines[i].trimEnd() !== '```') {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence (tolerate unclosed)
      const rendered = renderTex(buf.join('\n'), 'block');
      out.push('```plain');
      out.push(...rendered.split('\n'));
      out.push('```');
    } else {
      // Any other fenced block: emit verbatim (no inline expansion inside).
      out.push(line);
      i++;
      while (i < lines.length) {
        const cur = lines[i];
        out.push(cur);
        i++;
        if (cur.trimEnd() === '```') break;
      }
    }
  }
  return out.join('\n');
}
