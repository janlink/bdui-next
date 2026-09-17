import { cellWidthOf, statusGlyphsOf, type GlyphSet } from '../session/glyphs';
import { getTheme, type Theme } from '../themes/themes';

// Layout constants
export const LAYOUT = {
  columnWidth: 37,
  detailPanelWidth: 40,
  uiOverhead: 14,
  issueCardHeight: 8,
  titleMaxLength: 32,
  descriptionMaxLength: 200,
  minTerminalWidth: 60,
  minTerminalHeight: 20,
  // Below splitViewMinWidth the Tree/Graph detail panel replaces the list; at or
  // above it, list and panel sit side by side and each keeps at least its min.
  splitViewMinListWidth: 70,
  splitViewMinPanelWidth: 36,
  splitViewMinWidth: 107, // splitViewMinListWidth + splitViewMinPanelWidth + gap
} as const;

// Space between the list and the detail panel; mirrors the panel Box marginLeft.
// The panel's border stands on its own first cell, so the rules above and below
// fork one cell past the list.
const SPLIT_VIEW_GAP = 1;

// Row-oriented views (Tree, Graph) show the detail panel beside the list when the
// terminal is wide enough for both, otherwise it replaces the list (like Kanban).
// Panel width grows up to detailPanelWidth; the list takes the remainder.
export function splitViewLayout(terminalWidth: number): {
  fits: boolean;
  listWidth: number;
  panelWidth: number;
} {
  if (terminalWidth < LAYOUT.splitViewMinWidth) {
    return { fits: false, listWidth: terminalWidth, panelWidth: 0 };
  }
  const panelWidth = Math.max(
    LAYOUT.splitViewMinPanelWidth,
    Math.min(LAYOUT.detailPanelWidth, terminalWidth - LAYOUT.splitViewMinListWidth - SPLIT_VIEW_GAP),
  );
  return { fits: true, listWidth: terminalWidth - panelWidth - SPLIT_VIEW_GAP, panelWidth };
}

// The list row is a fixed grid with one elastic column. Everything that has to
// line up with a row reads these numbers, so a change moves them all at once.
export const ROW_GRID = {
  gutter: 1,
  status: 1,
  gap: 1,
  id: 15,
  meta: 16,
} as const;

/** Columns the grid spends before the title, at ambiguous-narrow width. */
export const ROW_FIXED_COLUMNS =
  ROW_GRID.gutter + ROW_GRID.status + ROW_GRID.gap + ROW_GRID.id + ROW_GRID.meta;

export interface RowLayout {
  gutter: number;
  status: number;
  gap: number;
  id: number;
  meta: number;
  fixed: number;
  title: number;
}

/** Cells the id column may grow to when a tree needs more than the grid's floor. */
export const ID_COLUMN_MAX = 24;

/**
 * The grid in cells rather than characters, so that a gutter or status glyph the
 * terminal draws two cells wide cannot shift the ID column. `idWidth` is the
 * column a view measured for its whole tree; the grid's floor when none is given.
 */
export function rowLayout(width: number, glyphs: GlyphSet, idWidth: number = ROW_GRID.id): RowLayout {
  const gutter = cellWidthOf([glyphs.gutter]);
  // Parents show a caret where leaves show their status, so both sets size
  // the column.
  const status = cellWidthOf([...statusGlyphsOf(glyphs), glyphs.caretCollapsed, glyphs.caretExpanded]);
  const fixed = gutter + status + ROW_GRID.gap + idWidth + ROW_GRID.meta;
  return {
    gutter,
    status,
    gap: ROW_GRID.gap,
    id: idWidth,
    meta: ROW_GRID.meta,
    fixed,
    title: Math.max(0, width - fixed),
  };
}

export type ListView = 'tree' | 'graph' | 'memories' | 'kanban' | 'stats';

// Rows each view spends on its own chrome, and on the chrome that frames its
// detail panel. One table instead of an offset per call site, so a changed
// header cannot leave a view one row short.
const VIEW_CHROME: Record<ListView, { body: number; panel: number }> = {
  tree: { body: 4, panel: 3 },
  graph: { body: 8, panel: 6 },
  memories: { body: 7, panel: 7 },
  kanban: { body: LAYOUT.uiOverhead, panel: 4 },
  stats: { body: 2, panel: 2 },
};

export interface ListBudget {
  body: number;
  itemsPerPage: number;
  panelHeight: number;
}

/**
 * How many rows a view may draw into. `extraRows` covers content the view
 * inserts between its chrome and its list, such as the graph's level labels.
 */
export function listBudget(view: ListView, height: number, extraRows = 0): ListBudget {
  const chrome = VIEW_CHROME[view];
  return {
    body: Math.max(1, height - chrome.body),
    itemsPerPage: Math.max(1, height - chrome.body - extraRows),
    panelHeight: Math.max(1, height - chrome.panel),
  };
}

// Rows the shared chrome above a view occupies when open. Each value covers the
// component's own content plus its border and bottom margin, so a view can
// subtract them to size its scrollable body.
export const CHROME_HEIGHT = {
  filtersBanner: 4,
  searchInput: 5,
  filterPanel: 16,
  commandBar: 3,
} as const;

// Beads priorities (0 is most urgent, 4 is backlog)
export const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical',
  1: 'High',
  2: 'Medium',
  3: 'Low',
  4: 'Backlog',
};

// Status labels
export const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  closed: 'Closed',
  other: 'Other',
};

// Issue type labels
export const TYPE_LABELS: Record<string, string> = {
  epic: 'Epic',
  feature: 'Feature',
  bug: 'Bug',
  task: 'Task',
  chore: 'Chore',
  decision: 'Decision',
};

// View names for footer display
export const VIEW_NAMES: Record<string, string> = {
  kanban: 'Kanban',
  tree: 'Tree',
  graph: 'Graph',
  stats: 'Stats',
  memories: 'Memories',
};

// Helper function to get priority color from theme
export function getPriorityColor(priority: number, theme: Theme): string {
  const colors: Record<number, string> = {
    0: theme.colors.priorityCritical,
    1: theme.colors.priorityHigh,
    2: theme.colors.priorityMedium,
    3: theme.colors.priorityLow,
    4: theme.colors.priorityLowest,
  };
  return colors[priority] || theme.colors.textDim;
}

// Helper function to get status color from theme
export function getStatusColor(status: string, theme: Theme): string {
  const colors: Record<string, string> = {
    open: theme.colors.statusOpen,
    in_progress: theme.colors.statusInProgress,
    blocked: theme.colors.statusBlocked,
    closed: theme.colors.statusClosed,
    deferred: theme.colors.statusDeferred,
    other: theme.colors.statusOther,
  };
  return colors[status] ?? theme.colors.statusOther;
}

// Helper function to get type color from theme
export function getTypeColor(type: string, theme: Theme): string {
  const colors: Record<string, string> = {
    epic: theme.colors.typeEpic,
    feature: theme.colors.typeFeature,
    bug: theme.colors.typeBug,
    task: theme.colors.typeTask,
    chore: theme.colors.typeChore,
    decision: theme.colors.typeDecision,
  };
  return colors[type] ?? theme.colors.typeOther;
}

// Truncate text with ellipsis, optionally at word boundary
export function truncateText(
  text: string,
  maxLength: number,
  atWordBoundary: boolean = false
): string {
  if (text.length <= maxLength) return text;

  let truncated = text.substring(0, maxLength);

  if (atWordBoundary) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.5) {
      truncated = truncated.substring(0, lastSpace);
    }
  }

  return truncated.trimEnd() + '...';
}

// Check if filters are active
export function hasActiveFilters(filter: {
  assignee?: string;
  tags?: string[];
  status?: string;
  priority?: number;
}, searchQuery: string): boolean {
  return !!(
    searchQuery.trim() ||
    filter.assignee ||
    filter.status ||
    filter.priority !== undefined ||
    (filter.tags && filter.tags.length > 0)
  );
}

// Count active filters
export function countActiveFilters(filter: {
  assignee?: string;
  tags?: string[];
  status?: string;
  priority?: number;
}, searchQuery: string): number {
  let count = 0;
  if (searchQuery.trim()) count++;
  if (filter.assignee) count++;
  if (filter.status) count++;
  if (filter.priority !== undefined) count++;
  if (filter.tags && filter.tags.length > 0) count++;
  return count;
}

// Form validation rules
export const VALIDATION = {
  title: {
    minLength: 1,
    maxLength: 200,
    required: true,
  },
  description: {
    maxLength: 5000,
    required: false,
  },
  assignee: {
    maxLength: 100,
    required: false,
  },
  labels: {
    maxLength: 500,
    required: false,
  },
} as const;

// Validate title
export function validateTitle(title: string): { valid: boolean; error?: string } {
  const trimmed = title.trim();
  if (!trimmed) {
    return { valid: false, error: 'Title is required' };
  }
  if (trimmed.length > VALIDATION.title.maxLength) {
    return { valid: false, error: `Title must be under ${VALIDATION.title.maxLength} characters` };
  }
  return { valid: true };
}
