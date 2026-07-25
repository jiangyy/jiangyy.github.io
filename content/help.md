# Help

This site is a terminal. Documents are commands — `home`, `help`, `papers` —
and tools live in `/bin`.

## commands

- `ls [dir]`    list a directory (try `ls /bin`)
- `cat <path>`  print a document (no clear; pipe-friendly)
- `head [path]` first lines (`head -n 5 home`, `cat home | head`)
- `tail [path]` last lines (`tail -n 3 home`)
- `grep <pat>`  filter lines (`cat home | grep foo`)
- `find [path]` walk the FS (`find /bin -type f`, `find -name papers`)
- `tree [path]` draw the FS as a tree
- `more [path]` page a document or stdin (space/b/q)
- `less [path]` same pager, with PageUp/PageDown
- `cd <dir>`    change directory (`cd /bin`, `cd ..`, `cd /`)
- `clear`       clear the screen
- `wc`          count lines/words/bytes from stdin
- `exit`        return to the home page (same as Ctrl-D on an empty line)

## tips

- Run a page like `home` to open it (clears the screen).
- Pipes work: `cat home | wc -l`.
- Paths: `./papers`, `/help`, `../`.
- History: ↑/↓ or Ctrl-P/N. Cancel: Ctrl-C. Clear: Ctrl-L.
