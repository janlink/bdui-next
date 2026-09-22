# Demo captures

Reproducible demo GIFs of `bdui`, produced by a **browser-free**
pipeline. It replaces ad-hoc `script`/`stty` captures and does not depend on VHS
(whose headless-Chromium recorder does not render under WSL2).

```
seed.sh ──▶ .workspace ──▶ record.py ──▶ board.cast ──▶ agg ──▶ demo.gif
(fixed bd    (throwaway     (PTY + timed   (asciicast    (Rust,
 workspace)   Dolt repo)     keystrokes)    v2)           no browser)
```

- **`seed.sh <dir>`** builds a deterministic Beads workspace: fixed issue IDs,
  titles, priorities, an epic with children, and every presentation column
  (Open / In Progress / Blocked / Closed / Other). A regenerated GIF changes only
  when this script changes — never because the surrounding project drifted.
- **`record.py`** spawns the compiled binary under a pseudo-terminal of a fixed
  size, replays a keystroke *tape*, and writes the raw terminal output as an
  [asciicast v2](https://docs.asciinema.org/manual/asciicast/v2/) file. `agg`
  owns the terminal emulation, so control bytes are recorded verbatim.
- **`board.tape`** is the keystroke script (see the grammar in `record.py`).
- **`render.sh`** ties it together and writes `assets/demo.gif`.

## Regenerate

```bash
bun run demo          # = bash demo/render.sh
```

Prerequisites:

- `agg` — `brew install agg` (Asciicast-to-GIF converter)
- `python3` — standard library only, no packages
- a `bdui` binary at the repo root (built with `bun run build` if absent)

The workspace (`demo/.workspace/`) and the intermediate cast (`demo/*.cast`) are
git-ignored; the committed output is `assets/demo.gif`.

## Add or change a tape

The tape grammar is intentionally tiny (one directive per line):

```
sleep <seconds>     # wait
key <token>         # one keypress: a literal char (2, q) or a name
                    # (enter, esc, space, tab, up, down, left, right, ctrl-c)
type <text>         # type the rest of the line literally
```

To record a different flow, copy `board.tape`, adjust the keys, and point
`record.py --tape` at it (or add a case to `render.sh`). Views: `1` Tree,
`2` Kanban, `3` Statistics, `4` Memories. Keep dwell times generous — a view is
only captured while it is on screen.
