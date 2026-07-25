# ghpage — terminal-style homepage

A single-page, fully static personal site that pretends to be a terminal.
Built on `xterm.js` with a tiny shell on top. Content is plain markdown; the
compiler turns it into structured data the runtime consumes. Deployed to
GitHub Pages (`jiangyy.github.io`).

## Architecture — four decoupled layers

```
content/*.md ──[compiler]──▶ src/generated/content.ts (manifest)
                                   │
index.html ──vite──▶ dist/         ▼
                     runtime:   main.ts
                        ├─ term/     xterm.js wrapper + ANSI/TUI primitives + buttons
                        ├─ shell/    Registry + Parser + REPL (pipes, history, inject)
                        ├─ content/  manifest store + markdown→ANSI renderer + doc commands
                        └─ apps/     oneshot & TUI commands, plugin-registered
```

- **content** — pure markdown. No frontmatter, no type markers. The directory
  tree *is* the structure (`about.md` → `about`, `blog/hello.md` → `blog/hello`).
  The compiler alone decides what each document becomes (today: everything is a
  page; the `analyze()` hook is where a future LLM-driven pass decides kind and
  generated artifacts).
- **compiler** (`scripts/build-content.ts`) — standalone, runnable on its own.
  Emits `src/generated/content.ts`. Re-runs automatically in dev via the vite
  plugin whenever `content/` changes.
- **framework** (`term/`, `shell/`) — knows nothing about markdown. `shell/types.ts`
  is the contract every command codes against.
- **apps** (`apps/`) — each file exports a `Command`; add one and register it in
  `apps/index.ts`. Nothing else changes.

## Commands: oneshot and TUI share one shell

A `Command` is just `run(ctx, argv)`. Oneshot commands read `ctx.stdin` / write
`ctx.stdout`. A TUI command calls `ctx.term.takeOver()`, draws and handles keys,
then `release()`s — the shell awaits `run`, so the two never fight over input.
Pipes work (`about | wc -l`) because the shell chains `stdout` → next `stdin`.

Every content document is also a command, so `about` and `cat about` are equivalent.

## Scripts

| script            | what it does                                       |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | vite dev server; recompiles content on save        |
| `npm run build`   | compile content + production bundle to `dist/`     |
| `npm run preview` | serve the built `dist/` locally                    |
| `npm test`        | node:test unit tests (parser/render/store/...)      |
| `npm run typecheck` | `tsc --noEmit`                                   |
| `npm run deploy`  | build + push `dist/` to the `gh-pages` branch      |

## Try it

`help`, `ls`, `about`, `cat projects`, `about | wc -l`, `tree`, `more help`. Or
click the buttons on top — they just inject a command.
