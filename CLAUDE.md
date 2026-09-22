# CLAUDE.md

This file provides development guidance for BD TUI.

## Project workflow

Public bug reports and feature requests use GitHub Issues. When a maintainer or
coding agent has a configured local [bd (Beads)](https://github.com/gastownhall/beads)
workspace, run `bd prime` and use it for local implementation tracking instead
of markdown task lists. Do not initialize or commit `.beads/` as part of an
unrelated contribution; see `AGENTS.md` for the local-workspace entry point.

## Commit conventions

Every commit subject must follow [Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<scope>)?!?: <subject>`, where `<type>` is one of `feat`, `fix`, `docs`,
`style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`. Keep
the subject in the imperative mood and in English. The `.githooks/commit-msg`
hook enforces this locally (enable it once per clone with
`git config core.hooksPath .githooks`), and the `Commit lint` workflow re-checks
each commit in a pull request.

## Project overview

BD TUI is an Ink/React terminal UI for current Beads workspaces. It displays a
five-column Kanban board, a tree view, statistics, filters, notifications, and
issue forms.

The application treats the public `bd --json` CLI as its integration boundary.
It does not query SQLite, Dolt SQL, or Beads' internal files.

- **Runtime:** Bun
- **UI:** Ink 6 and React 19
- **State:** Zustand
- **Targets:** compiled macOS, Linux, and Windows binaries

## Development commands

```bash
bun install
bun run dev          # Run against the Beads workspace discovered from cwd
bun run test         # Automated tests, including temporary Dolt workspaces
bun run typecheck    # Strict TypeScript validation
bun run build        # Compile the current-platform binary
bun run check        # Test, typecheck, and build

bun run build:macos
bun run build:linux
bun run build:windows
bun run build:all
```

The release workflow must pass `bun run check` before building platform
artifacts.

## Architecture

### Render hot path (`patches/string-width-bun`)

Ink measures every rendered character with `string-width` on every frame. The
published implementation segments graphemes with `Intl.Segmenter`, which costs
about 26 µs per call under Bun and pushes a single keypress past 145 ms. A
package override in `package.json` replaces `string-width` for the whole
dependency tree with a shim over the native `Bun.stringWidth`, which measures
identically for Latin, CJK, emoji, ANSI, and box-drawing text.

The override is Bun-only by design and must stay listed in both `dependencies`
and `overrides`: Bun does not materialize a `file:` override that no dependency
declares. `src/utils/string-width.test.ts` guards both the measurements and the
per-call cost, so a lost override fails the suite instead of the frame budget.

### Beads process boundary (`src/bd/client.ts`)

`runBd()` starts `bd` with an argv array and never constructs a shell command.
It applies time and output bounds, escalates termination when needed, and
reports stderr on nonzero exits. Keep all future Beads subprocess calls behind
this boundary.

### Workspace discovery and reads (`src/bd/parser.ts`)

- Discover the active workspace with `bd where --json`.
- Read every issue with `bd list --all --limit 0 --json`.
- Normalize only fields consumed by the UI.
- Preserve raw status, type, and dependency values for forward compatibility.
- Build parent/child and blocking relationships in a second pass.
- Keep raw `status` separate from presentation `displayStatus`.

Open issues with active blockers use the Blocked presentation column. Deferred,
pinned, hooked, custom, and unknown statuses use Other while retaining their
raw status on the issue.

### Mutations (`src/bd/commands.ts`)

- Create with `bd create ... --json`.
- Update fields with `bd update ... --json`.
- Close with `bd close ... --json`; do not model closure as a generic edit.
- Pass every user value as one argv item.
- Propagate command and malformed-JSON failures instead of returning empty data.

Forms call these helpers and request an immediate refresh after successful
mutations.

### Refresh (`src/bd/watcher.ts`)

`BeadsWatcher` polls through the public CLI. Reloads are serialized, unchanged
snapshots are suppressed with a canonical fingerprint, and transient failures
retain the last successful data. Cleanup must prevent in-flight or stale
callbacks from publishing after disposal.

### State (`src/state/store.ts`)

Zustand is the single source of truth for data, filtering, navigation, modal
state, terminal size, and notifications.

The five presentation columns are:

1. Open
2. In Progress
3. Blocked
4. Closed
5. Other

`getVisibleColumns()` is the shared filtered/grouped view for the Kanban
columns. Rendering, selection, navigation, pagination, editing, and exporting
must all use this same view. When filters change, clamp or reset column
selection and scroll state.

The row-oriented list and tree views resolve status visibility hierarchically,
so they cannot reuse that view. `getRowVisibleIds()` is their equivalent: it
intersects the hierarchical status set with search and filter, then widens the
result by each match's ancestor chain so a matched child keeps the epic above
it as context. Both row views must read this one selector.

### UI (`src/components/`)

`App.tsx` owns workspace initialization, watcher lifetime, global input, and
terminal resize handling. `Board.tsx` routes views and renders the responsive
Kanban window. The tree view keeps local selection, so it must sync the exact
selected issue ID into the store before opening edit/export actions.

Input is modal. Normal navigation must not process keystrokes while search,
filter, forms, dialogs, theme selection, help, or the command bar owns input.
Every input-owning overlay mounts in `Board`, not inside a single view, so a
shortcut can never set a flag whose component is unmounted and leave the
keyboard dead. `isModalOpen()` is the one definition of that set; global and
per-view input handlers must gate on it, and it must precede the `q` and `?`
shortcuts so a modal can accept those as text. `CHROME_HEIGHT` records what the
shared rows occupy, and `Board` subtracts them from the height it passes down.

Ink 6 layout props belong on `Box`; do not place Box-only margin/layout props on
`Text`, and do not use unsupported absolute `top`/`left`/`right` props.

## Domain semantics

Beads priorities are ordered by urgency:

- P0 Critical
- P1 High
- P2 Medium
- P3 Low
- P4 Backlog

Keep labels, colors, sort order, statistics, filters, and arrow-key behavior
consistent with this ordering. Current creatable built-in types include task,
epic, bug, feature, chore, and decision. Read paths must preserve future or
custom types rather than rejecting them.

## Testing

The automated suite covers:

- current embedded-Dolt workspace loading
- safe argv mutation behavior
- command timeout and output limits
- tolerant status/type/dependency normalization
- serialized polling and cleanup
- filtered selection and navigation
- Other-column visibility
- priority labels and colors
- informational CLI flags

For interaction changes, also run the compiled TUI in a real terminal against a
representative current Beads workspace. Exercise each changed key path once;
builds and unit tests are not a substitute for rendered interaction checks.

For reproducible demo GIFs and screenshots, use the browser-free capture
pipeline in `demo/`: `bun run demo` seeds a deterministic Beads workspace, drives
the compiled binary through a pseudo-terminal with a keystroke tape
(`demo/board.tape`), records the raw output as an asciicast, and renders it to
`assets/demo.gif` (plus a still `assets/demo.png`) with `agg`. It needs `agg`
(`brew install agg`) and `python3`; see `demo/README.md` for how to add a tape.

For a quick headless text check with no assets, allocate a PTY with `script` and
feed timed keystrokes. The PTY reports 0 columns by default, which trips the
"Terminal Too Narrow" guard, so set the size with `stty` inside the child before
launching:

```bash
{ sleep 2; printf '2'; sleep 1; printf 'q'; } \
  | script -qfc "stty rows 45 cols 140; cd <workspace> && exec /abs/path/bdui" /dev/null \
  | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g; s/\r$//; s/\r/\n/g'   # strip ANSI to grep rendered text
```

## Branching and pull requests

`main` is protected: direct pushes are rejected for everyone (admins included),
history is linear, and merges land through squash. Every change therefore goes
through a branch and a pull request:

```bash
git switch -c <type>/<topic>
# ... commits (the commit-msg hook validates each message) ...
git push -u origin <type>/<topic>
gh pr create --fill
gh pr merge --squash --auto --delete-branch   # merges once required checks pass
```

Required PR checks are `Test, typecheck, and build` (CI) and
`Validate commit messages` (commit lint). Keep the squash title
Conventional-Commits compliant, since it becomes the commit on `main`.

## Release and documentation

Keep `README.md`, package scripts, and GitHub Actions aligned with the actual
CLI contract and supported views. Do not document `.beads/beads.db`, direct SQL,
`bd edit`, or file watching. Release binaries must support `--help` and
`--version` without entering raw terminal mode.

### Cutting a release

Releases are tag-driven: pushing a `v*` tag runs `.github/workflows/release.yml`,
which verifies the tag matches the package version, runs the quality gate, builds
the macOS/Linux/Windows binaries, and publishes a GitHub release. Steps:

1. On a branch, bump `version` in `package.json` following SemVer. Pre-1.0,
   breaking behavior changes bump the minor.
2. In `CHANGELOG.md`, rename the `## [Unreleased]` heading to
   `## [x.y.z] - YYYY-MM-DD` and add a fresh empty `## [Unreleased]` above it.
   The release job extracts the section whose heading is `## [x.y.z]` verbatim as
   the release-notes body, so the heading must match the tag's version exactly.
3. Run `bun run check` locally, then open a PR and merge it to `main`.
4. Tag the merged commit and push it:
   `git tag -a vX.Y.Z -m "bdui-next X.Y.Z" && git push origin vX.Y.Z`.

The tag must equal `v<package.json version>` or the workflow fails on its version
check. The changelog is a curated, human-readable summary, not a commit dump;
GitHub appends a "Full Changelog" compare link with the granular commit history.
Do not reuse or move the inherited `v0.1.0`/`v0.1.1`/`v0.2.0` tags — they mark the
upstream fork base, not `bdui-next` releases.
