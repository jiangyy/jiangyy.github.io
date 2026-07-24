# Help

This site is a terminal. Documents are commands — `home`, `help`, `papers` —
and tools live in `/bin`.

## commands

- `ls [dir]`    list a directory (try `ls /bin`)
- `cat <path>`  print a document (no clear; pipe-friendly)
- `cd <dir>`    change directory (`cd /bin`, `cd ..`, `cd /`)
- `clear`       clear the screen
- `wc`          count lines/words/bytes from stdin
- `tui`         a fullscreen TUI demo (q/ESC to quit)

## tips

- Run a page like `home` to open it (clears the screen).
- Pipes work: `cat home | wc -l`.
- Paths: `./papers`, `/help`, `../`.
- History: ↑/↓ or Ctrl-P/N. Cancel: Ctrl-C. Clear: Ctrl-L.
