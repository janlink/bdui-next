# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Session axes for what a terminal cannot tell us: `BDUI_GLYPHS` picks the
  character set (`fancy`, `safe`, `ascii`; `--glyph-check` prints them side by
  side), `BDUI_COLOR` the colour depth (`auto`, `256`, `16`, `none`, honouring
  `NO_COLOR`), `BDUI_AMBIGUOUS` the East Asian Ambiguous width (probed once at
  startup), and `BDUI_SURFACE` whether header, footer and detail panel sit on a
  painted background.
- A one-row tree header naming the workspace and the view, with issue and root
  counts, the cursor position, and a live/stale indicator for the last poll.
- A trailer under the tree list counting the rows above and below the window.

### Changed
- The tree view is redrawn as a quiet hierarchy: a priority gutter, the status
  glyph (a fold caret on parents), a fixed 15-cell ID column that carries the
  tree stems and shortens long IDs from the left, the type word for every type
  but `task`, the title in the remaining width, and a right-hand column that
  says `closed/total`, `P1 in progress`, `blocked`, `closed` or the priority in
  words. Colour is spent on status only; epics are bold and closed rows dimmed.
- The detail panel is a borderless surface with a key/value grid, a progress
  bar for parents, the subtasks with their status, ISO timestamps, and the
  description paged underneath; the side pane is 40 cells wide in Tree, Graph
  and Kanban.
- The footer shows the view tabs with the active one as an inverted chip, the
  key hints for search, filter, details, the command bar and help, the
  notification state as `n on`/`n off`, and the status legend with the hidden
  statuses named on the right. The `q quit` and `v show` hints left the footer;
  both keys still work and the help overlay lists them.
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
