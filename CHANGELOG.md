# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Session axes for what a terminal cannot tell us: `BDUI_GLYPHS` picks the
  character set (`fancy`, `safe`, `ascii`; `--glyph-check` prints them side by
  side), `BDUI_COLOR` the colour depth (`auto`, `256`, `16`, `none`, honouring
  `NO_COLOR`), and `BDUI_AMBIGUOUS` the East Asian Ambiguous width (probed once
  at startup).
- A header rule above each view naming the view and the workspace, with issue
  and root counts, the cursor position, and a live/stale indicator for the last
  poll.
- A description too long for the detail panel says how many lines are cut and
  pages on `PgUp`/`PgDn`, beside the list as well as over it.
- The terminal tab is named `bdui - <workspace>`, so two open windows stay
  apart. The shell's own title is saved at startup and put back on exit, and
  the name costs no column, which is why the chrome rules carry the workspace
  rather than the program's name.

### Removed
- The dependency graph view. It grouped issues by blocker depth, but the level
  it computed collapsed: on a real workspace 74 of its 78 nodes sat on level 0
  while the tree showed 153 rows. It also read only the status visibility, so
  search and filter never reached it. Blocking is still shown where it is
  precise: the tree marks a blocked row and the detail panel names what blocks
  an issue and what it blocks. The views renumber to `1` Tree, `2` Kanban,
  `3` Stats and `4` Memories, and `:graph` leaves the command bar.

### Changed
- The tree view is redrawn as a quiet hierarchy: a priority gutter, the status
  glyph (a fold caret on parents), an ID column measured over the whole tree
  between 15 and 24 cells that carries the tree stems and shortens long IDs
  from the left, the type word for every type but `task`, the title in the
  remaining width, and a right-hand column that says `closed/total`,
  `P1 in progress`, `blocked`, `closed` or the priority in words. Colour is
  spent on status only; epics are bold, closed rows are dimmed down to their
  gutter, and the selection is marked with a lifted background.
- The chrome is drawn as open rules rather than boxes on a painted background,
  and the header and footer rules carry their words. Beside the list the rules
  fork at the panel border, name the issue above the panel and its keys below
  it, so the panel drops its own border, id row and key row and the tree gains
  the row its trailer used to spend.
- The Kanban board takes the same chrome. Its `BD TUI - Kanban Board` title,
  the terminal-size hint and the counts row give way to one header rule that
  names the view, the workspace, the issue count, how many columns are hidden
  and the cursor position in the active column. The detail panel beside the
  board is framed by the rules instead of drawing its own border, which leaves
  the board a row it used to spend on chrome.
- The detail panel is a borderless key/value grid with a progress bar for
  parents, the subtasks with their status, ISO timestamps, and the description
  paged underneath; the side pane is 40 cells wide in Tree and Kanban.
- The footer rule carries the view tabs with the active one in the accent
  colour, the hidden statuses, and the rows above and below the scrolled
  window. Under it a second row holds the key hints for search, filter,
  details, the command bar and help, the notification state as `n on`/`n off`,
  and, from 120 columns on, the status legend. The `q quit` and `v show` hints
  left the footer; both keys still work and the help overlay lists them.
- Themes are defined per colour depth: at 256 colours bdui paints app-owned
  indices, at 16 it uses the terminal's role colours and inverts the selection,
  at `none` it emits no escape sequences and marks the selection in the gutter.
- Every width-measured column pads to the widest glyph of its set, so mixed
  East Asian Ambiguous glyphs no longer shift columns.

### Fixed
- Under Bun the terminal probe could leave stdin paused, so the UI rendered but
  ignored every key including `Ctrl+C`; the probe now reads the way Ink does.
- The export dialog stays mounted for as long as its flag is set, so `x` can no
  longer leave the keyboard dead.
- Card and panel titles are cut with the character set's own ellipsis, keeping
  the `ascii` tier pure ASCII.

## [0.3.0] - 2026-09-14

First standalone release of `bdui-next`, continuing the no-longer-maintained
[assimelha/bdui](https://github.com/assimelha/bdui).

### Added
- Memories view showing `bd remember` entries, with delete and refresh.
- Statistics dashboard with project-wide metrics and progress bars.
- Search and filter now apply across every view.
- Collapsible rows in the tree view via the arrow keys.

### Changed
- The tree view is now the default and first view; view keys are renumbered
  (`1` Tree, `2` Kanban, `3` Graph, `4` Stats, `5` Memories).
- Faster keyboard navigation: native `Bun.stringWidth` measurement and no
  duplicate full-board render per keystroke.
- Background polling relaxed to a 5s interval, configurable via `BDUI_POLL_MS`.

### Removed
- The List view, superseded by the tree view.
