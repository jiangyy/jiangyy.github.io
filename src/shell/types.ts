// The contract at the heart of the framework. Everything apps touch lives here.
// Apps depend only on `Command` + `Context`, never on xterm or the shell internals.
import type { Term } from '../term/term';
import type { ContentStore } from '../content/store';

export type Argv = string[];

/** Output sink — either the live terminal or an in-memory pipe buffer. */
export interface StdOut {
  /** Raw write (no implicit newline). */
  write(s: string): void;
  /** Write a line (newline appended). */
  print(s: string): void;
}

export interface Command {
  readonly name: string;
  readonly description: string;
  /** Builtin commands (like cd) are always available but not listed in /bin. */
  readonly builtin?: boolean;
  /** Document-commands (one per content file) live at /, not in /bin. */
  readonly doc?: boolean;
  /**
   * Run the command.
   * - Oneshot: read ctx.stdin, write ctx.stdout, return.
   * - TUI:     call ctx.term.takeOver(), draw and handle keys, then release()
   *            before returning. (TUI commands ignore stdin/stdout.)
   * Pipes: the shell chains commands by feeding one's stdout into the next's stdin.
   */
  run(ctx: Context, argv: Argv): Promise<void>;
}

/** A directory entry returned by ctx.listDir. */
export interface DirEntry {
  name: string;
  /** true if this entry is itself a directory. */
  dir: boolean;
}

export interface Context {
  readonly term: Term;
  readonly store: ContentStore;
  /** Piped input from the upstream command ('' when not in a pipe). */
  readonly stdin: string;
  /** Output sink. For the last pipe segment this is the live terminal. */
  readonly stdout: StdOut;
  /** True when stdout is the live terminal (not a pipe) — ok to clear / move cursor. */
  readonly tty: boolean;
  /** Current working directory (slug form: '' = root '/'). */
  readonly cwd: string;
  /** Resolve another command by name, so one command can invoke another. */
  resolve(name: string): Command | undefined;
  /** All registered commands (so `help`/`ls` can list them). */
  list(): Command[];
  /** Change directory; returns an error string, or null on success. */
  chdir(target: string): string | null;
  /** List a directory (relative to cwd); returns entries, or null if not a dir. */
  listDir(target: string): DirEntry[] | null;
}

export interface Registry {
  register(cmd: Command): void;
  get(name: string): Command | undefined;
  list(): Command[];
}
