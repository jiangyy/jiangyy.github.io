// The REPL: prompt → line-edit user input → parse → run command (with pipes)
// → repeat. Owns the cwd, a tiny virtual FS view (/bin = commands, root = docs),
// and an in-line editor (history, cursor movement).
import type { Term } from '../term/term';
import type { ContentStore } from '../content/store';
import type { Context, DirEntry, Registry, StdOut } from './types';
import { parseLine } from './parser';
import { resolvePath } from './path';
import { displayWidth } from '../term/ansi';

export interface ShellDeps {
  term: Term;
  registry: Registry;
  store: ContentStore;
  /** Command to run once on start (e.g. the homepage). */
  initialCommand?: string;
}

/** Split a line into pipe segments, respecting double quotes. */
function splitPipe(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQ = false;
  for (const c of line) {
    if (c === '"') {
      inQ = !inQ;
      cur += c;
    } else if (c === '|' && !inQ) {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Longest common prefix of a set of strings. */
function commonPrefix(arr: string[]): string {
  if (arr.length === 0) return '';
  let pre = arr[0];
  for (const w of arr) {
    while (!w.startsWith(pre)) pre = pre.slice(0, -1);
  }
  return pre;
}

export class Shell {
  private readonly term: Term;
  private readonly registry: Registry;
  private readonly store: ContentStore;
  private readonly initialCommand?: string;
  private cwd = ''; // '' = root '/'
  private curPrompt = '';
  private curWidth = 0;
  private buffer = '';
  private cursor = 0;
  private history: string[] = [];
  private histIdx = -1;
  private resolveLine?: (line: string) => void;

  constructor(deps: ShellDeps) {
    this.term = deps.term;
    this.registry = deps.registry;
    this.store = deps.store;
    this.initialCommand = deps.initialCommand;
  }

  /** Build the prompt from the current cwd ('/' at root, else /bin etc). */
  private promptFor(): { text: string; width: number } {
    const loc = '/' + this.cwd; // cwd is '' at root → '/'
    return {
      text: `\x1b[38;5;62mjyy\x1b[0m:\x1b[38;5;33m${loc}\x1b[0m\x1b[38;5;244m$\x1b[0m `,
      width: `jyy:${loc}$ `.length,
    };
  }

  /** Start the read/eval loop. Never returns. */
  async start(): Promise<void> {
    this.term.onShellData((d) => this.onData(d));
    if (this.initialCommand) {
      const { text } = this.promptFor();
      this.term.write(text + this.initialCommand + '\r\n');
      await this.execute(this.initialCommand);
    }
    for (;;) {
      this.buffer = '';
      this.cursor = 0;
      this.histIdx = -1;
      const { text, width } = this.promptFor();
      this.curPrompt = text;
      this.curWidth = width;
      this.term.write(this.curPrompt);
      const line = await this.readLine();
      await this.execute(line);
    }
  }

  /** Run a command string exactly as if the user typed it (used by buttons). */
  inject(command: string): void {
    if (!this.resolveLine) return;
    this.term.write(command + '\r\n');
    const r = this.resolveLine;
    this.resolveLine = undefined;
    r(command);
  }

  private readLine(): Promise<string> {
    return new Promise<string>((resolve) => {
      this.resolveLine = resolve;
    });
  }

  // ---- virtual FS view ----
  private isDir(p: string): boolean {
    return p === '' || p === 'bin';
  }

  private chdir(target: string): string | null {
    const p = resolvePath(target, this.cwd);
    if (this.isDir(p)) {
      this.cwd = p;
      return null;
    }
    return `${target}: not a directory`;
  }

  private listDir(target: string): DirEntry[] | null {
    const p = resolvePath(target, this.cwd);
    if (p === '') {
      return [{ name: 'bin', dir: true }, ...this.store.all().map((d) => ({ name: d.slug, dir: false }))];
    }
    if (p === 'bin') {
      // Only real /bin executables — not builtins (cd) or document-commands.
      return this.registry
        .list()
        .filter((c) => !c.builtin && !c.doc)
        .map((c) => ({ name: c.name, dir: false }));
    }
    const doc = this.store.get(p);
    if (doc) return [{ name: doc.slug, dir: false }];
    return null;
  }

  /** Execute a (possibly piped) command line. */
  private async execute(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed) return;
    this.history.push(trimmed);

    const segments = splitPipe(trimmed);
    let stdin = '';
    for (let i = 0; i < segments.length; i++) {
      const argv = parseLine(segments[i]);
      const name = argv[0];
      const p = resolvePath(name, this.cwd);
      // /bin commands resolve by bare name (PATH) or by path; docs live at root.
      const cmd =
        this.registry.get(name) ??
        this.registry.get(p) ??
        (p.startsWith('bin/') ? this.registry.get(p.slice(4)) : undefined);
      if (!cmd) {
        this.term.print(`command not found: ${name} — try \`help\``);
        return;
      }

      const isLast = i === segments.length - 1;
      let buffer = '';
      const stdout: StdOut = isLast
        ? { write: (s) => this.term.write(s), print: (s) => this.term.print(s) }
        : { write: (s) => void (buffer += s), print: (s) => void (buffer += s + '\n') };

      const ctx: Context = {
        term: this.term,
        store: this.store,
        stdin,
        stdout,
        tty: isLast,
        cwd: this.cwd,
        resolve: (n: string) => this.registry.get(n),
        list: () => this.registry.list(),
        chdir: (t: string) => this.chdir(t),
        listDir: (t: string) => this.listDir(t),
      };

      try {
        await cmd.run(ctx, argv);
      } catch (e) {
        this.term.print(`error: ${String(e)}`);
        return;
      }
      stdin = buffer;
    }
  }

  // ---- inline line editor ----
  private onData(d: string): void {
    if (!this.resolveLine) return;
    switch (d) {
      case '\r':
      case '\n': {
        const line = this.buffer;
        this.term.write('\r\n');
        const r = this.resolveLine;
        this.resolveLine = undefined;
        r(line);
        break;
      }
      case '\x7f':
      case '\b': {
        if (this.cursor > 0) {
          let cut = this.cursor - 1;
          const unit = this.buffer.charCodeAt(cut);
          if (unit >= 0xdc00 && unit <= 0xdfff && cut > 0) {
            const prev = this.buffer.charCodeAt(cut - 1);
            if (prev >= 0xd800 && prev <= 0xdbff) cut -= 1;
          }
          this.buffer = this.buffer.slice(0, cut) + this.buffer.slice(this.cursor);
          this.cursor = cut;
          this.redraw();
        }
        break;
      }
      case '\x1b[A':
      case '\x1bOA':
      case '\x10': // Ctrl-P
        this.histMove('up');
        break;
      case '\x1b[B':
      case '\x1bOB':
      case '\x0e': // Ctrl-N
        this.histMove('down');
        break;
      case '\x1b[C':
      case '\x06': // Ctrl-F
        if (this.cursor < this.buffer.length) {
          this.cursor++;
          this.gotoCursor();
        }
        break;
      case '\x1b[D':
      case '\x02': // Ctrl-B
        if (this.cursor > 0) {
          this.cursor--;
          this.gotoCursor();
        }
        break;
      case '\x01': // Ctrl-A
        this.cursor = 0;
        this.gotoCursor();
        break;
      case '\x05': // Ctrl-E
        this.cursor = this.buffer.length;
        this.gotoCursor();
        break;
      case '\x0b': // Ctrl-K
        this.buffer = this.buffer.slice(0, this.cursor);
        this.redraw();
        break;
      case '\x15': // Ctrl-U
        this.buffer = this.buffer.slice(this.cursor);
        this.cursor = 0;
        this.redraw();
        break;
      case '\x17': {
        // Ctrl-W
        let i = this.cursor;
        while (i > 0 && /\s/.test(this.buffer[i - 1])) i--;
        while (i > 0 && !/\s/.test(this.buffer[i - 1])) i--;
        this.buffer = this.buffer.slice(0, i) + this.buffer.slice(this.cursor);
        this.cursor = i;
        this.redraw();
        break;
      }
      case '\x04': // Ctrl-D
        if (this.cursor < this.buffer.length) {
          this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
          this.redraw();
        }
        break;
      case '\x0c': {
        // Ctrl-L
        this.term.write('\x1b[2J\x1b[3J\x1b[H');
        this.redraw();
        break;
      }
      case '\x03': // Ctrl-C
        this.term.write('^C\r\n');
        if (this.resolveLine) {
          const r = this.resolveLine;
          this.resolveLine = undefined;
          r('');
        }
        break;
      case '\t': // Tab — complete the current word from the cwd
        this.complete();
        break;
      default:
        if (d.length >= 1 && !/[\x00-\x1f\x7f]/.test(d)) {
          this.buffer = this.buffer.slice(0, this.cursor) + d + this.buffer.slice(this.cursor);
          this.cursor += d.length;
          this.redraw();
        }
    }
  }

  private histMove(dir: 'up' | 'down'): void {
    const n = this.history.length;
    if (n === 0) return;
    if (dir === 'up') {
      this.histIdx = this.histIdx === -1 ? n - 1 : Math.max(0, this.histIdx - 1);
    } else {
      if (this.histIdx === -1) return;
      this.histIdx++;
      if (this.histIdx >= n) this.histIdx = -1;
    }
    const entry = this.histIdx === -1 ? '' : this.history[this.histIdx];
    this.buffer = entry;
    this.cursor = entry.length;
    this.redraw();
  }

  /** Tab-complete the word at the cursor using cwd entries (and /bin commands
   *  for the first word). */
  private complete(): void {
    const before = this.buffer.slice(0, this.cursor);
    const wordStart = before.lastIndexOf(' ') + 1;
    const prefix = before.slice(wordStart);
    const isFirstWord = wordStart === 0;

    const entries = this.listDir('.') ?? [];
    const names = new Set<string>();
    const dirs = new Set<string>();
    for (const e of entries) {
      names.add(e.name);
      if (e.dir) dirs.add(e.name);
    }
    if (isFirstWord) {
      for (const c of this.registry.list()) names.add(c.name);
    }
    const matches = [...names].filter((n) => n.startsWith(prefix)).sort();
    if (matches.length === 0) {
      this.term.write('\x07'); // bell
      return;
    }
    if (matches.length === 1) {
      const m = matches[0];
      this.replaceWord(wordStart, m + (dirs.has(m) ? '/' : ' '));
      return;
    }
    const lcp = commonPrefix(matches);
    if (lcp.length > prefix.length) {
      this.replaceWord(wordStart, lcp);
      return;
    }
    // ambiguous with no further shared prefix — list candidates on a new line
    this.term.write('\r\n' + matches.join('  ') + '\r\n');
    this.redraw();
  }

  private replaceWord(wordStart: number, replacement: string): void {
    this.buffer = this.buffer.slice(0, wordStart) + replacement + this.buffer.slice(this.cursor);
    this.cursor = wordStart + replacement.length;
    this.redraw();
  }

  private redraw(): void {
    this.term.write(`\r\x1b[0K${this.curPrompt}${this.buffer}`);
    const back = displayWidth(this.buffer) - displayWidth(this.buffer.slice(0, this.cursor));
    if (back > 0) this.term.write(`\x1b[${back}D`);
  }

  private gotoCursor(): void {
    this.term.write(`\x1b[${this.curWidth + displayWidth(this.buffer.slice(0, this.cursor)) + 1}G`);
  }
}
