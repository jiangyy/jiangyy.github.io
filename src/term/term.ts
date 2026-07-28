// Terminal abstraction over xterm.js. Owns the xterm instance + addons and exposes
// two modes:
//   - shell mode: raw input via onShellData (the shell implements line editing)
//   - tui mode:   takeOver() hands an app exclusive key + draw control
//
// Uses xterm's default DOM renderer (no canvas/webgl addon): on resize it updates
// the DOM row-by-row instead of clearing a whole canvas, so window-dragging
// doesn't flicker. OSC 8 hyperlinks still work.
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';

export interface KeyEvent {
  key: string;
  domEvent: KeyboardEvent;
}
export interface TermSize {
  cols: number;
  rows: number;
}

/** Control surface handed to a TUI app while it owns the terminal. */
export interface TuiSession {
  readonly cols: number;
  readonly rows: number;
  write(s: string): void;
  clear(): void;
  onKey(cb: (e: KeyEvent) => void): () => void;
  onResize(cb: (size: TermSize) => void): () => void;
  /** Return control to the shell. */
  release(): void;
}

/** If `target` is an internal same-page link, return its command slug; else null. */
function internalPage(target: string): string | null {
  if (target.startsWith('#')) return target.slice(1) || null;
  try {
    const u = new URL(target, location.href);
    if (u.origin === location.origin && u.pathname === location.pathname && u.hash) {
      return u.hash.slice(1) || null;
    }
  } catch {
    /* not a url */
  }
  return null;
}

export class Term {
  readonly xterm: Terminal;
  private fitAddon = new FitAddon();
  private mode: 'shell' | 'tui' = 'shell';
  private shellDataCb?: (d: string) => void;
  private tuiKeyCb?: (e: KeyEvent) => void;
  private tuiResizeCb?: (size: TermSize) => void;
  private cleanups: Array<() => void> = [];
  private readonly onNavigate?: (cmd: string) => void;

  constructor(host: HTMLElement, onNavigate?: (cmd: string) => void) {
    this.onNavigate = onNavigate;
    this.xterm = new Terminal({
      fontFamily:
        '"Maple Mono", "Fira Code", "JetBrains Mono", "SFMono-Regular", ui-monospace, Menlo, Consolas, ' +
        '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", ' +
        '"Apple Color Emoji", "Segoe UI Emoji", monospace',
      fontSize: 16,
      lineHeight: 1.0,
      letterSpacing: 0,
      cursorBlink: true,
      allowProposedApi: true,
      linkHandler: {
        allowNonHttpProtocols: true,
        activate: (_event, target) => {
          // Internal same-page links go through onNavigate (pushState + run);
          // everything else opens in a new tab.
          const page = internalPage(target);
          if (page !== null) {
            this.onNavigate?.(page);
            return;
          }
          window.open(target, '_blank', 'noopener');
        },
      },
      theme: {
        background: '#fafafa',
        foreground: '#2e3338',
        cursor: '#4a5158',
        selectionBackground: '#d0d7de',
      },
    });

    this.xterm.loadAddon(this.fitAddon);
    this.xterm.open(host);

    try {
      // Wide-character (CJK / emoji) width handling.
      this.xterm.loadAddon(new Unicode11Addon());
      this.xterm.unicode.activeVersion = '11';
    } catch (e) {
      console.warn('unicode11 addon unavailable', e);
    }

    this.fit();
    const ro = new ResizeObserver(() => this.fit());
    ro.observe(host);
    this.cleanups.push(() => ro.disconnect());

    const d1 = this.xterm.onData((d) => {
      if (this.mode === 'shell') this.shellDataCb?.(d);
    });
    this.cleanups.push(() => d1.dispose());

    const d2 = this.xterm.onKey((e) => {
      if (this.mode === 'tui') this.tuiKeyCb?.(e);
    });
    this.cleanups.push(() => d2.dispose());

    const d3 = this.xterm.onResize(({ cols, rows }) => {
      if (this.mode === 'tui') this.tuiResizeCb?.({ cols, rows });
    });
    this.cleanups.push(() => d3.dispose());
  }

  get cols() {
    return this.xterm.cols;
  }
  get rows() {
    return this.xterm.rows;
  }

  write(s: string) {
    this.xterm.write(s.replace(/(?<!\r)\n/g, '\r\n'));
  }
  print(s: string) {
    this.write(s + '\n');
  }
  clear() {
    this.xterm.clear();
  }
  fit() {
    // Fit xterm to its host; the host's column count is capped in CSS
    // (max-width: calc(80ch + ...) in index.html), so this is all that's needed.
    this.fitAddon.fit();
  }
  focus() {
    this.xterm.focus();
  }

  /** Shell-mode raw keystream. Returns an unsubscribe. */
  onShellData(cb: (d: string) => void): () => void {
    this.shellDataCb = cb;
    return () => {
      if (this.shellDataCb === cb) this.shellDataCb = undefined;
    };
  }

  /** Hand the terminal to a TUI app. */
  takeOver(): TuiSession {
    this.mode = 'tui';
    const xt = this.xterm;
    const self = this;
    return {
      get cols() {
        return xt.cols;
      },
      get rows() {
        return xt.rows;
      },
      write: (s) => xt.write(s),
      clear: () => xt.reset(),
      onKey: (cb) => {
        self.tuiKeyCb = cb;
        return () => {
          if (self.tuiKeyCb === cb) self.tuiKeyCb = undefined;
        };
      },
      onResize: (cb) => {
        self.tuiResizeCb = cb;
        return () => {
          if (self.tuiResizeCb === cb) self.tuiResizeCb = undefined;
        };
      },
      release: () => {
        self.mode = 'shell';
      },
    };
  }

  dispose() {
    for (const c of this.cleanups) c();
    this.xterm.dispose();
  }
}
