# BD TUI 🎯

A beautiful, real-time Text User Interface (TUI) visualizer for the [bd (Beads)](https://github.com/gastownhall/beads) issue tracker.

> **`bdui-next`** continues [assimelha/bdui](https://github.com/assimelha/bdui), which is no longer maintained. The repository lives at [janlink/bdui-next](https://github.com/janlink/bdui-next); the binary and command are still named `bdui`.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)
![Bun](https://img.shields.io/badge/runtime-Bun-f472b6.svg)

![BD TUI Screenshot](assets/screenshot.png)

## ✨ Features

### 📊 Multiple Visualizations
- **Kanban Board** - Five-column view (Open, In Progress, Blocked, Closed, Other)
- **Tree View** - Hierarchical parent-child relationships with interactive navigation
- **Statistics Dashboard** - Comprehensive analytics with visual bar charts

### 🎨 Rich User Experience
- **Real-time Updates** - Serialized polling through the supported `bd` CLI
- **Search & Filter** - Full-text search across title, description, and ID
- **Custom Themes** - 5 built-in color schemes (Default, Ocean, Forest, Sunset, Monochrome)
- **Responsive Layout** - Adapts to terminal size with smart column hiding
- **Vim-style Navigation** - hjkl keys supported alongside arrow keys

### ⚡ Issue Management
- **Create Issues** - Add new issues directly from the TUI
- **Edit Issues** - Modify title, description, priority, status, assignee, and labels
- **Export/Copy** - Export issues in Markdown, JSON, or plain text format
- **Desktop Notifications** - Native OS notifications with custom icons for status changes

### 🎯 Smart Features
- **Per-column Pagination** - Independent scroll positions for each status column
- **Detail Panel** - View full issue details including all dependencies
- **Blocked Status Detection** - Automatically moves issues with blockers to "Blocked" column
- **Keyboard-first** - Every action accessible via keyboard shortcuts

## 🚀 Installation

### Prerequisites
- A current [bd (Beads)](https://github.com/gastownhall/beads) installation
- An active Beads workspace (`bd where --json` must succeed)
- [Bun](https://bun.sh) only when running from source; release binaries include the runtime

### Download Pre-built Binary

Download the latest release for your platform:
- **macOS (ARM64)**: `bdui-macos-arm64`
- **macOS (x64)**: `bdui-macos-x64`
- **Linux (x64)**: `bdui-linux-x64`
- **Windows (x64)**: `bdui-windows-x64.exe`

Make it executable (Unix systems):
```bash
chmod +x bdui-macos-arm64
./bdui-macos-arm64
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/janlink/bdui-next.git
cd bdui-next

# Install dependencies
bun install

# Run in development mode
bun run dev

# Or build single binary for your platform
bun run build
./bdui
```

### Building for All Platforms

```bash
# Build for macOS (both ARM64 and x64)
bun run build:macos

# Build for Linux x64
bun run build:linux

# Build for Windows x64
bun run build:windows

# Build for all platforms
bun run build:all
```

Binaries will be created in the `dist/` directory (~50-60 MB each, includes Bun runtime).

## 📖 Usage

### Basic Usage

Navigate to a directory where `bd where --json` resolves an active workspace and run:

```bash
bdui
```

Or from the source directory:

```bash
bun run dev
```

The app discovers the active workspace with `bd where --json`. It reads and writes through public `bd --json` commands, so embedded and server-backed Dolt workspaces are supported without accessing Beads' internal database schema.

Background refresh polls the `bd` CLI every 5 seconds (your own edits refresh immediately). Set `BDUI_POLL_MS` to change the interval in milliseconds — raise it for large workspaces where `bd list` is slow, or lower it if you expect frequent external changes:

```bash
BDUI_POLL_MS=10000 bdui
```

### Terminal Capabilities

Three properties of a terminal cannot be detected reliably from inside it, so
bdui lets you state them. Each one defaults to the most capable setting and
falls back cleanly, so you only need these when your terminal renders something
wrong.

| Variable | Values | Default | What it controls |
| --- | --- | --- | --- |
| `BDUI_GLYPHS` | `fancy`, `safe`, `ascii` | `fancy` | Which characters bdui draws with |
| `BDUI_COLOR` | `auto`, `256`, `16`, `none` | `auto` | How many colors bdui spends |
| `BDUI_AMBIGUOUS` | `auto`, `narrow`, `wide` | `auto` | Width of East Asian Ambiguous characters |
| `NO_COLOR` | any value | unset | Same as `BDUI_COLOR=none` |

**Glyphs.** No escape sequence asks a terminal which characters its font covers,
and over SSH the font is on the other machine. Print the three sets side by side
and pick the last one that renders as single, distinct shapes:

```bash
bdui --glyph-check
BDUI_GLYPHS=safe bdui
```

`fancy` uses the full set, `safe` restricts it to the CP437 subset that terminal
fonts ship for compatibility, and `ascii` stays inside printable ASCII for
terminals without UTF-8.

**Color.** bdui detects the depth through chalk and honors `NO_COLOR`. At 256
colors it paints app-owned indices that no terminal theme can recolor; at 16 it
uses role names your terminal theme owns and inverts the selected row instead of
painting a surface; at `none` it emits no escape sequence at all and marks the
selection with the gutter. `BDUI_COLOR` overrides the detection in both
directions, which `FORCE_COLOR` cannot do downward.

**Ambiguous width.** Tree lines and status glyphs are East Asian Ambiguous, so
terminals disagree about whether they take one cell or two. bdui measures it once
at startup by printing one such character and asking for the cursor column; a
terminal that does not answer costs 150 ms and keeps the narrow default. Set
`BDUI_AMBIGUOUS` if your terminal answers with a position it then does not render
to.

### Keyboard Shortcuts

#### Navigation
- `↑/↓` or `k/j` - Move up/down (select issue)
- `←/→` or `h/l` - Move left/right (change column in Kanban view)
- `Enter` or `Space` - Toggle detail panel
- `PgUp/PgDn` - Page a description too long for the detail panel

#### Views
- `1` - Tree view (hierarchical, default)
- `2` - Kanban board view
- `3` - Statistics dashboard
- `4` - Memories

#### Actions
- `N` (Shift+N) - Create new issue
- `e` - Edit selected issue
- `x` - Export/copy selected issue
- `t` - Change theme

#### Search & Filter
- `/` - Open search (searches title, description, ID)
- `f` - Open filter panel (filter by assignee, tags, priority, status)
- `v` - Choose which statuses are shown
- `c` - Clear all filters and search
- `ESC` - Close search/filter/form panels

#### Command Bar
- `:` or `g` - Open the command bar
- `p 0` … `p 4` - Set the selected issue priority
- `s o`, `s i`, `s b`, `s c` - Set open, in-progress, blocked, or closed status
- `new`, `edit`, `help` - Open the corresponding UI

#### Other
- `r` - Refresh data through `bd`
- `n` - Toggle notifications
- `?` - Show help
- `q` or `Ctrl+C` - Quit

## 🎨 Views

### Kanban View
The main view shows issues organized in five columns:
- **Open** - New or ready-to-work issues
- **In Progress** - Currently being worked on
- **Blocked** - Issues waiting on dependencies or stored as blocked
- **Closed** - Completed issues
- **Other** - Deferred, pinned, hooked, custom, and future statuses; cards retain the raw status

Features:
- Beads priority semantics: P0 Critical, P1 High, P2 Medium, P3 Low, P4 Backlog
- Type indicators including epic, feature, bug, task, chore, and decision
- Label tags
- Per-column pagination and selection
- Responsive layout (adapts to terminal size)

### Tree View (Default)
Shows hierarchical parent-child relationships on a fixed grid, so the eye finds
the same thing in the same column on every row:
- Navigate with ↑/↓ or k/j
- Press ←/→ or h/l to collapse/expand a parent
- Press Enter/Space to toggle details
- Press `e` to edit selected issue
- The view sits between two rules: the header rule names the view, the
  workspace, the issue and root counts, your position and whether the last poll
  was live or went stale; the footer rule carries the view tabs, the hidden
  statuses and, while the list scrolls, the rows above and below the window
- Priority gutter, then the status glyph (a fold caret on parents), then an ID
  column measured over the whole tree, 15 to 24 cells wide: the tree stems draw
  inside it and longer IDs are shortened from the left so the distinctive tail
  stays readable. The column keeps its width while you scroll
- The title gets the remaining width; every type but `task` is named before it
- The right-hand column says what matters in words: `3/13` closed subtasks on
  a parent, `P1 in progress`, `blocked`, `closed`, or the bare priority
- Color is spent on status only; epics are bold, closed rows are dimmed down to
  their gutter, and the selected row is marked with a lifted background
- Below the footer rule a second row holds the key hints, and from 120 columns
  on the status legend beside them

### Statistics Dashboard
Comprehensive analytics:
- **Status Distribution** - Visual bar chart of issue statuses
- **Priority Breakdown** - Distribution across P0-P4
- **Issue Type Distribution** - Epic, feature, bug, task, chore, decision, and other counts
- **Key Metrics** - Completion rate, blocked rate, dependency count
- **Top Assignees** - Most active team members
- **Top Labels** - Most used labels

## 🔔 Notifications

BD TUI supports native desktop notifications for important events:

### Notification Types
- **Task Completed** ✅ - When an issue status changes to "closed"
  - Green checkmark icon
  - System sound (macOS)
  - Shows issue ID and priority

- **Task Blocked** 🚫 - When an issue becomes blocked
  - Red prohibition icon
  - Silent notification
  - Shows number of blocking issues

### Notification Icons
Custom icons are located in `assets/icons/`:
- `completed.png` - Green circle with white checkmark (512x512)
- `blocked.png` - Red circle with prohibition symbol (512x512)

Platform support:
- **macOS** - Full support with custom icons in Notification Center
- **Linux** - Freedesktop.org notification spec
- **Windows** - Toast notifications

Toggle notifications with the `n` key. The footer shows the current state as `n on` or `n off`.

### Testing Notifications
```bash
bun run test:notifications
```

## ✏️ Creating and Editing Issues

### Create New Issue
Press `N` (Shift+N) to open the create issue form:
- Tab/Shift+Tab to navigate between fields
- Fill in: title, description, priority (P0-P4), type, assignee, labels
- Press Enter to submit
- ESC to cancel

### Edit Existing Issue
Select any issue and press `e` to open the edit form:
- All fields pre-populated with current values
- Tab/Shift+Tab to navigate
- Use ↑/↓ to change priority and status
- Press Enter to save changes
- ESC to cancel

Changes run through `bd create`, `bd update`, and `bd close`, then refresh from `bd list --json`.

## 📤 Exporting Issues

Press `x` on any selected issue to open the export dialog:

### Format Options (←/→ to navigate)
- **Markdown** - Formatted markdown with headers and lists
- **JSON** - Complete issue data in JSON format
- **Plain Text** - Simple text format with clear structure

### Action Options (↑/↓ to navigate)
- **Copy to Clipboard** - Copy formatted issue to system clipboard
- **Export to File** - Save to `{issue-id}.{extension}` in current directory

Press Enter to execute. Works on macOS, Linux, and Windows.

## 🎨 Themes

BD TUI includes 5 built-in color schemes. Press `t` to open the theme selector:

### Available Themes
- **Default** - Classic blue/cyan theme with high contrast
- **Ocean** - Blue and cyan tones for a calm, aquatic feel
- **Forest** - Green-focused theme inspired by nature
- **Sunset** - Warm magenta and yellow tones
- **Monochrome** - Clean grayscale theme for distraction-free work

Use ↑/↓ or k/j to browse themes. Each theme shows a live color preview. Press Enter to apply.

## 🔍 Search & Filter

### Search (/)
- Full-text search across title, description, and issue ID
- Type to search incrementally
- ESC to close

### Filter (f)
- **Assignee** - Filter by assigned person
- **Tags** - Filter by labels (multi-select)
- **Priority** - Filter by P0-P4
- **Status** - Filter by open/in_progress/blocked/closed/other
- Tab to cycle between filter types
- Space/Enter to toggle selections
- ESC to close

### Clear Filters (c)
Removes all active search and filter criteria.

## 📊 Responsive Layout

### Terminal Size Adaptation
The Kanban board fills the width with as many 24-cell columns as fit:
- **120+ cols**: All five columns
- **96-119 cols**: Four columns; the window follows the active column
- **72-95 cols**: Three columns
- **60-71 cols**: Two columns

With the detail panel open, a terminal of 90 columns or more shows the panel
in a 40-cell pane beside the board; below that the panel replaces the board.
The Tree view splits at 107 columns, where the list keeps at least 70 cells
and the panel grows from 36 to 40. Beside the list the panel hangs in
the frame the view already draws: the rules fork at its border, name the issue
above it and its keys below it, and the panel drops its own border. A
description too long for it says how many lines are cut and pages on
`PgUp`/`PgDn`.

### Minimum Requirements
- Width: 60 columns (recommended: 125+)
- Height: 24 rows (recommended: 30+)
- 256-color support recommended; 16 colors and no color are supported (see Terminal Capabilities)

The Kanban header shows the terminal dimensions (e.g., "120x30").

## 🧪 Testing

```bash
# Automated tests, TypeScript validation, and a compiled build
bun run check

# Optional desktop notification check
bun run test:notifications

# Exercise the TUI against a current Beads workspace
cd /path/to/your/project
bun run /path/to/bdui/src/index.tsx
```

The automated suite creates isolated temporary embedded-Dolt workspaces with the installed `bd` CLI. It also covers argument safety, polling lifecycle, status normalization, filtering, navigation, and priority semantics.

## 🏗️ Architecture

### Technology Stack
- **Runtime**: Bun
- **UI Framework**: Ink (React for CLIs)
- **State Management**: Zustand
- **Beads integration**: Public `bd --json` CLI contract
- **Notifications**: node-notifier (cross-platform)

### Data Flow
1. **Workspace discovery** - `bd where --json`
2. **Issue reads** - `bd list --all --limit 0 --json`
3. **Normalization** - Tolerant DTO mapping with raw statuses, types, and dependency edges preserved
4. **Updates** - Shell-free argv calls to `bd create`, `bd update`, and `bd close`
5. **Refresh** - Serialized polling publishes only changed successful snapshots and retains the last good state on transient errors
6. **State and notifications** - Zustand drives the UI and detects status changes

### Project Structure
```
bdui-next/
├── src/
│   ├── components/       # React/Ink components
│   │   ├── App.tsx       # Main app with keyboard handling
│   │   ├── Board.tsx     # View router and five-column Kanban board
│   │   ├── TreeView.tsx  # Hierarchical tree view
│   │   ├── IssueRow.tsx  # One tree row on the shared column grid
│   │   ├── Header.tsx    # The rule above a view, forked at the panel
│   │   ├── Footer.tsx    # The rule below it, plus the key hint row
│   │   ├── Rule.tsx      # A horizontal rule with words set into it
│   │   ├── DetailPanel.tsx
│   │   ├── StatsView.tsx
│   │   ├── CreateIssueForm.tsx
│   │   ├── EditIssueForm.tsx
│   │   ├── ExportDialog.tsx
│   │   ├── ThemeSelector.tsx
│   │   └── ...
│   ├── bd/               # bd integration
│   │   ├── client.ts     # Bounded, shell-free bd process boundary
│   │   ├── parser.ts     # Public JSON normalization
│   │   ├── watcher.ts    # Serialized polling and deduplication
│   │   └── commands.ts   # Current create/update/close commands
│   ├── session/          # Terminal capabilities resolved once at startup
│   │   ├── glyphs.ts     # The three character sets and the tier switch
│   │   ├── colors.ts     # Color depth and the chalk level it implies
│   │   └── ambiguous.ts  # East Asian Ambiguous width probe
│   ├── state/            # State management
│   │   └── store.ts      # Zustand store
│   ├── themes/           # Theme definitions
│   │   └── themes.ts
│   ├── utils/            # Utilities
│   │   ├── notifications.ts
│   │   └── export.ts
│   ├── types.ts          # TypeScript types
│   └── index.tsx         # Entry point
├── assets/
│   └── icons/            # Notification icons
│       ├── completed.png
│       ├── blocked.png
│       └── README.md
├── CLAUDE.md             # Development documentation
├── package.json
└── README.md             # This file
```

## 🤝 Contributing

Contributions are welcome! This project uses [bd (Beads)](https://github.com/gastownhall/beads) for issue tracking.

### Development Setup
```bash
# Clone repository
git clone https://github.com/janlink/bdui-next.git
cd bdui-next

# Install dependencies
bun install

# Enable the Conventional Commits hook (once per clone)
git config core.hooksPath .githooks

# Run quality checks
bun run check

# Run in development mode
bun run dev
```

### Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<scope>)?!?: <subject>` with a type of `feat`, `fix`, `docs`, `style`,
`refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`. The
`.githooks/commit-msg` hook checks this locally (enable it with the command
above), and the `Commit lint` workflow re-checks every commit in a pull request.

### Code Guidelines
See `CLAUDE.md` for detailed architecture documentation and guidelines for:
- Adding new view modes
- Adding new filters
- Creating new components
- Modifying the data flow

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- [assimelha/bdui](https://github.com/assimelha/bdui) - The original project this TUI started as a fork of
- [bd (Beads)](https://github.com/gastownhall/beads) - The issue tracker that powers this TUI
- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [node-notifier](https://github.com/mikaelbr/node-notifier) - Cross-platform notifications

## 📞 Support

For issues, questions, or contributions:
1. Check the documentation in `CLAUDE.md`
2. Review existing GitHub issues and pull requests
3. Open a GitHub issue with reproduction steps and version details

---

**Made with ❤️ for developers who love the command line**
