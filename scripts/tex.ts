// Terminal-friendly math rendering. Turns a small subset of LaTeX-like notation
// into Unicode text that reads well on a single-line terminal cell grid.
//
// Scope: Greek letters, common symbols (sum/int/sqrt/relations/arrows/sets),
// super/subscripts (via Unicode where possible), and \frac (inline: `a/b`;
// block: stacked with a vinculum). NOT supported: matrices, align environments,
// integral limit stacking, nested fractions. Good enough for typical CS paper
// notation; extend the tables below as needed.
//
// Used at BUILD time by scripts/macros.ts, so output is plain text — no ANSI,
// no terminal width (block formulas are left-aligned within their code fence).

/** Unicode superscript map. If any char in a group is missing we fall back to `^(...)`. */
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'j': 'ʲ', 'k': 'ᵏ',
  'l': 'ˡ', 'm': 'ᵐ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ',
  'A': 'ᴬ', 'B': 'ᴮ', 'D': 'ᴰ', 'E': 'ᴱ', 'G': 'ᴳ', 'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ', 'K': 'ᴷ', 'L': 'ᴸ',
  'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ', 'P': 'ᴾ', 'R': 'ᴿ', 'T': 'ᵀ', 'U': 'ᵁ', 'V': 'ⱽ', 'W': 'ᵂ',
};

/** Unicode subscript map. Same fallback policy as SUP. */
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'h': 'ₕ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ',
  'p': 'ₚ', 's': 'ₛ', 't': 'ₜ', 'i': 'ᵢ', 'j': 'ⱼ', 'r': 'ᵣ', 'u': 'ᵤ', 'v': 'ᵥ',
};

/** `\name` → Unicode. Covers Greek letters and common math symbols. */
const SYM: Record<string, string> = {
  // Greek lowercase
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ',
  upsilon: 'υ', phi: 'φ', varphi: 'ϕ', chi: 'χ', psi: 'ψ', omega: 'ω',
  // Greek uppercase
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ',
  Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  // Binary operators
  cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆', otimes: '⊗', oplus: '⊕',
  // Relations
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', sim: '∼',
  propto: '∝', parallel: '∥', perp: '⊥', ll: '≪', gg: '≫',
  // Arrows
  to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', Leftarrow: '⇐', leftrightarrow: '↔',
  Leftrightarrow: '⇔', mapsto: '↦', uparrow: '↑', downarrow: '↓',
  // Set theory
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇',
  cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅', setminus: '∖',
  // Big operators & misc
  sum: '∑', prod: '∏', int: '∫', oint: '∮', bigcup: '⋃', bigcap: '⋂', bigoplus: '⨁', bigotimes: '⨂',
  sqrt: '√', partial: '∂', nabla: '∇', angle: '∠', degree: '°', circ: '∘',
  cdots: '⋯', ldots: '…', dots: '…', prime: '′', infty: '∞', forall: '∀', exists: '∃', nexists: '∄',
  // Spacing commands
  ',': ' ', ':': ' ', ';': ' ', '!': '', '|': '∥',
};

/** Map every char in `g` via `table`; if any char is unmapped, signal fallback. */
function toScript(g: string, table: Record<string, string>): string | null {
  if (g === '') return '';
  let out = '';
  for (const ch of g) {
    const mapped = table[ch];
    if (mapped === undefined) return null;
    out += mapped;
  }
  return out;
}

function applySup(s: string): string {
  return s
    .replace(/\^\{([^{}]*)\}/g, (_m, g: string) => toScript(g, SUP) ?? `^(${g})`)
    .replace(/\^(.)/g, (_m, c: string) => {
      const mapped = SUP[c];
      return mapped !== undefined ? mapped : `^(${c})`;
    });
}

function applySub(s: string): string {
  return s
    .replace(/_\{([^{}]*)\}/g, (_m, g: string) => toScript(g, SUB) ?? `_(${g})`)
    .replace(/_(.)/g, (_m, c: string) => {
      const mapped = SUB[c];
      return mapped !== undefined ? mapped : `_(${c})`;
    });
}

/** Replace `\name` (and a few spacing punctuation commands) via SYM; unknown left as-is. */
function applySymbols(s: string): string {
  return s.replace(/\\([A-Za-z]+|[,:;!|])/g, (m, name: string) => SYM[name] ?? m);
}

/** `\frac{A}{B}` — inline collapses to `A/B`. */
function fracInline(s: string): string {
  return s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => `${a}/${b}`);
}

/** `\frac{A}{B}` — block stacks A over B with a vinculum, centered to the wider line. */
function fracBlock(s: string): string {
  return s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => {
    const w = Math.max(a.length, b.length, 1);
    const center = (line: string): string => {
      const lead = Math.floor((w - line.length) / 2);
      return ' '.repeat(lead) + line + ' '.repeat(w - line.length - lead);
    };
    return `${center(a)}\n${'─'.repeat(w)}\n${center(b)}`;
  });
}

/**
 * Render a TeX-like expression to Unicode text.
 * - `inline`: single line, fractions collapse to `a/b`.
 * - `block`: fractions stack; result may span multiple lines (caller wraps in a code fence).
 */
export function renderTex(input: string, mode: 'inline' | 'block'): string {
  let s = input;
  s = applySymbols(s);
  s = applySup(s);
  s = applySub(s);
  s = mode === 'block' ? fracBlock(s) : fracInline(s);
  s = s.replace(/[{}]/g, '');
  return s.trim();
}
