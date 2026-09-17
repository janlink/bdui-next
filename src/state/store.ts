import { create } from 'zustand';
import type { BeadsData, Issue } from '../types';
import { detectStatusChanges, notifyStatusChange } from '../utils/notifications';
import { LAYOUT, listBudget, hasActiveFilters } from '../utils/constants';
import { DEFAULT_COLOR_DEPTH, type ColorDepth } from '../session/colors';
import { DEFAULT_GLYPH_TIER, getGlyphs, type GlyphSet, type GlyphTier } from '../session/glyphs';
import { getTheme, type Theme } from '../themes/themes';
import { parseSearchQuery, issueMatchesParsedQuery, type ParsedQuery } from '../utils/search-query';
import {
  STATUS_KEYS,
  DEFAULT_STATUS_VISIBILITY,
  statusCategory,
  isStatusVisible,
  computeVisibleIds,
  withAncestors,
  type StatusKey,
  type StatusVisibility,
} from '../utils/visibility';

type VisibleColumns = Record<StatusKey, Issue[]>;

interface ColumnState {
  selectedIndex: number;
  scrollOffset: number;
}

// Toast message for user feedback
interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

// Undo history entry
interface UndoEntry {
  action: string;
  issueId: string;
  previousData: Partial<Issue>;
  timestamp: number;
}

export interface BeadsStore {
  data: BeadsData;
  previousIssues: Map<string, Issue>; // Track previous state for notifications
  reloadCallback: (() => void) | null; // Callback to reload data from database
  beadsPath: string | null; // Active .beads directory, used for out-of-band reads (memories)

  // Terminal dimensions
  terminalWidth: number;
  terminalHeight: number;

  // Navigation - per column
  selectedColumn: number; // open/in_progress/blocked/closed/other
  columnStates: Record<StatusKey, ColumnState>; // Independent pagination per column
  itemsPerPage: number;

  // UI state
  viewMode: 'kanban' | 'tree' | 'graph' | 'stats' | 'memories' | 'create-issue' | 'edit-issue';
  previousView: 'kanban' | 'tree' | 'graph' | 'stats' | 'memories';
  showHelp: boolean;
  showDetails: boolean;
  showSearch: boolean;
  showFilter: boolean;
  showExportDialog: boolean;
  showThemeSelector: boolean;
  showJumpToPage: boolean;
  showVisibilityPanel: boolean;
  showConfirmDialog: boolean;
  confirmDialogData: {
    title: string;
    message: string;
    onConfirm: () => void;
  } | null;
  currentTheme: string;
  // The resolved theme is stored, not derived on read: React.memo compares it by
  // identity, so a component that recomputed it would re-render every row.
  theme: Theme;
  colorDepth: ColorDepth;
  glyphTier: GlyphTier;
  glyphs: GlyphSet;
  searchQuery: string;
  notificationsEnabled: boolean;

  // Toast messages for user feedback
  toastMessage: ToastMessage | null;

  // Undo history
  undoHistory: UndoEntry[];
  maxUndoHistory: number;

  filter: {
    assignee?: string;
    tags?: string[];
    status?: string;
    priority?: number;
  };

  // Which presentation-status categories are shown (closed hidden by default).
  statusVisibility: StatusVisibility;

  // Actions
  setData: (data: BeadsData) => void;
  setReloadCallback: (callback: (() => void) | null) => void;
  setBeadsPath: (path: string | null) => void;
  setFilter: (filter: BeadsStore['filter']) => void;
  toggleStatusVisibility: (key: StatusKey) => void;
  resetStatusVisibility: () => void;
  toggleVisibilityPanel: () => void;
  getFilteredIssues: () => Issue[];
  getStatsIssues: () => Issue[];
  getVisibleColumns: () => VisibleColumns;
  getRowVisibleIds: () => Set<string>;
  setTerminalSize: (width: number, height: number) => void;

  // Navigation actions
  moveUp: () => void;
  moveDown: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  jumpToFirst: () => void;
  jumpToLast: () => void;
  jumpToPage: (page: number) => void;
  getTotalPages: () => number;
  getCurrentPage: () => number;
  toggleHelp: () => void;
  toggleDetails: () => void;
  toggleNotifications: () => void;
  toggleSearch: () => void;
  toggleFilter: () => void;
  toggleExportDialog: () => void;
  toggleThemeSelector: () => void;
  toggleJumpToPage: () => void;
  setTheme: (theme: string) => void;
  setSessionAxes: (axes: { colorDepth: ColorDepth; glyphTier: GlyphTier }) => void;
  clearFilters: () => void;
  setViewMode: (mode: 'kanban' | 'tree' | 'graph' | 'stats' | 'memories' | 'create-issue' | 'edit-issue') => void;
  navigateToCreateIssue: () => void;
  navigateToEditIssue: () => void;
  returnToPreviousView: () => void;
  setSearchQuery: (query: string) => void;
  getSelectedIssue: () => Issue | null;
  getStatusKey: () => StatusKey;
  selectIssueById: (id: string) => boolean;

  // Toast actions
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // Confirmation dialog actions
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  hideConfirm: () => void;

  // Undo actions
  addToUndoHistory: (entry: Omit<UndoEntry, 'timestamp'>) => void;
  undo: () => UndoEntry | null;
  clearUndoHistory: () => void;
}

const ALL_STATUSES_VISIBLE: StatusVisibility = {
  open: true,
  in_progress: true,
  blocked: true,
  closed: true,
  other: true,
};

// Search and filter predicate without the status-visibility term, so column and
// row views can combine it with their own notion of which statuses are shown.
function matchesQuery(
  issue: Issue,
  filter: BeadsStore['filter'],
  parsed: ParsedQuery,
): boolean {
  if (!issueMatchesParsedQuery(issue, parsed)) return false;

  if (filter.assignee && issue.assignee !== filter.assignee) return false;
  if (filter.tags?.length && !issue.labels?.some(label => filter.tags?.includes(label))) return false;
  if (filter.status && issue.displayStatus !== filter.status) return false;
  if (filter.priority !== undefined && issue.priority !== filter.priority) return false;

  return true;
}

function filterIssues(
  data: BeadsData,
  filter: BeadsStore['filter'],
  searchQuery: string,
  statusVisibility: StatusVisibility,
): Issue[] {
  const parsed = parseSearchQuery(searchQuery);
  return data.issues.filter(issue =>
    isStatusVisible(issue, statusVisibility) && matchesQuery(issue, filter, parsed));
}

// Search, filter, dialogs, and forms own keyboard input exclusively; every
// normal-navigation handler must fall silent while one of them is mounted.
export function isModalOpen(state: BeadsStore): boolean {
  return state.showSearch
    || state.showFilter
    || state.showExportDialog
    || state.showThemeSelector
    || state.showJumpToPage
    || state.showVisibilityPanel
    || state.showConfirmDialog;
}

function groupVisibleIssues(issues: Issue[]): VisibleColumns {
  const columns: VisibleColumns = { open: [], in_progress: [], blocked: [], closed: [], other: [] };
  for (const issue of issues) {
    columns[statusCategory(issue)].push(issue);
  }
  return columns;
}

function resetColumnStates(): Record<StatusKey, ColumnState> {
  return {
    open: { selectedIndex: 0, scrollOffset: 0 },
    in_progress: { selectedIndex: 0, scrollOffset: 0 },
    blocked: { selectedIndex: 0, scrollOffset: 0 },
    closed: { selectedIndex: 0, scrollOffset: 0 },
    other: { selectedIndex: 0, scrollOffset: 0 },
  };
}

export const useBeadsStore = create<BeadsStore>((set, get) => ({
  data: {
    issues: [],
    byStatus: {
      'open': [],
      'closed': [],
      'in_progress': [],
      'blocked': [],
      'other': [],
    },
    byId: new Map(),
    stats: {
      total: 0,
      open: 0,
      closed: 0,
      blocked: 0,
    },
  },

  previousIssues: new Map(),
  reloadCallback: null,
  beadsPath: null,

  // Terminal dimensions (defaults, will be updated)
  terminalWidth: 120,
  terminalHeight: 30,

  // Navigation state - per column
  selectedColumn: 0,
  columnStates: resetColumnStates(),
  itemsPerPage: 10, // Will be recalculated based on terminal height

  // UI state
  viewMode: 'tree',
  previousView: 'tree',
  showHelp: false,
  showDetails: true,
  showSearch: false,
  showFilter: false,
  showExportDialog: false,
  showThemeSelector: false,
  showJumpToPage: false,
  showVisibilityPanel: false,
  showConfirmDialog: false,
  confirmDialogData: null,
  currentTheme: 'default',
  theme: getTheme('default', DEFAULT_COLOR_DEPTH),
  colorDepth: DEFAULT_COLOR_DEPTH,
  glyphTier: DEFAULT_GLYPH_TIER,
  glyphs: getGlyphs(DEFAULT_GLYPH_TIER),
  searchQuery: '',
  notificationsEnabled: true, // Enabled by default

  // Toast messages
  toastMessage: null,

  // Undo history
  undoHistory: [],
  maxUndoHistory: 10,

  filter: {},

  statusVisibility: { ...DEFAULT_STATUS_VISIBILITY },

  setTerminalSize: (width, height) => {
    const issueCardHeight = LAYOUT.issueCardHeight;
    const availableHeight = Math.max(listBudget('kanban', height).body, issueCardHeight);
    const itemsPerPage = Math.max(Math.floor(availableHeight / issueCardHeight), 1);
    const columnStates = { ...get().columnStates };
    for (const statusKey of STATUS_KEYS) {
      const selectedIndex = columnStates[statusKey].selectedIndex;
      columnStates[statusKey] = {
        selectedIndex,
        scrollOffset: Math.floor(selectedIndex / itemsPerPage) * itemsPerPage,
      };
    }

    set({ terminalWidth: width, terminalHeight: height, itemsPerPage, columnStates });
  },

  setData: (data) => {
    const state = get();

    // Detect status changes and notify (only if enabled)
    if (state.notificationsEnabled) {
      const changes = detectStatusChanges(state.previousIssues, data.byId);
      for (const change of changes) {
        notifyStatusChange(change);
      }
    }

    const visibleColumns = groupVisibleIssues(filterIssues(data, state.filter, state.searchQuery, state.statusVisibility));
    const newColumnStates = { ...state.columnStates };
    for (const statusKey of STATUS_KEYS) {
      const issueCount = visibleColumns[statusKey].length;
      const selectedIndex = Math.min(state.columnStates[statusKey].selectedIndex, Math.max(0, issueCount - 1));
      newColumnStates[statusKey] = {
        selectedIndex,
        scrollOffset: Math.floor(selectedIndex / state.itemsPerPage) * state.itemsPerPage,
      };
    }

    // Update state
    set({
      data,
      previousIssues: new Map(data.byId), // Clone for next comparison
      columnStates: newColumnStates,
    });
  },

  setReloadCallback: (callback) => set({ reloadCallback: callback }),

  setBeadsPath: (beadsPath) => set({ beadsPath }),

  setFilter: (filter) => set({ filter, columnStates: resetColumnStates() }),

  toggleStatusVisibility: (key) => set(state => ({
    statusVisibility: { ...state.statusVisibility, [key]: !state.statusVisibility[key] },
    columnStates: resetColumnStates(),
  })),

  resetStatusVisibility: () => set({
    statusVisibility: { ...DEFAULT_STATUS_VISIBILITY },
    columnStates: resetColumnStates(),
  }),

  toggleVisibilityPanel: () => set(state => ({ showVisibilityPanel: !state.showVisibilityPanel })),

  getFilteredIssues: () => {
    const { data, filter, searchQuery, statusVisibility } = get();
    return filterIssues(data, filter, searchQuery, statusVisibility);
  },

  // Statistics summarize the whole project, so they ignore the status
  // visibility toggle (hiding closed would make completion metrics meaningless).
  getStatsIssues: () => {
    const { data, filter, searchQuery } = get();
    return filterIssues(data, filter, searchQuery, ALL_STATUSES_VISIBLE);
  },

  getVisibleColumns: () => {
    return groupVisibleIssues(get().getFilteredIssues());
  },

  // List and tree resolve status visibility hierarchically, so they cannot reuse
  // getFilteredIssues (which applies it per issue). Search and filter are
  // intersected with that hierarchical set, then widened by ancestor context.
  getRowVisibleIds: () => {
    const { data, filter, searchQuery, statusVisibility } = get();
    const statusVisible = computeVisibleIds(data, statusVisibility);
    if (!hasActiveFilters(filter, searchQuery)) return statusVisible;

    const parsed = parseSearchQuery(searchQuery);
    const matched = new Set<string>();
    for (const issue of data.issues) {
      if (statusVisible.has(issue.id) && matchesQuery(issue, filter, parsed)) {
        matched.add(issue.id);
      }
    }
    return withAncestors(data, matched, statusVisible);
  },

  getStatusKey: () => {
    const { selectedColumn } = get();
    return STATUS_KEYS[selectedColumn];
  },

  getSelectedIssue: () => {
    const { selectedColumn, columnStates } = get();
    const statusKey = STATUS_KEYS[selectedColumn];
    const issues = get().getVisibleColumns()[statusKey];
    const selectedIndex = columnStates[statusKey].selectedIndex;
    return issues[selectedIndex] || null;
  },

  selectIssueById: (id: string) => {
    const { data, itemsPerPage } = get();
    const searchId = id.toLowerCase();

    // ID lookup remains global. Clear active filters so the selected issue is also visible.
    const columns = groupVisibleIssues(data.issues);
    for (const exact of [true, false]) {
      for (let colIndex = 0; colIndex < STATUS_KEYS.length; colIndex++) {
        const statusKey = STATUS_KEYS[colIndex];
        const issues = columns[statusKey];
        const issueIndex = issues.findIndex(issue => {
          const issueId = issue.id.toLowerCase();
          return exact ? issueId === searchId : issueId.includes(searchId);
        });

        if (issueIndex !== -1) {
          const columnStates = resetColumnStates();
          columnStates[statusKey] = {
            selectedIndex: issueIndex,
            scrollOffset: Math.floor(issueIndex / itemsPerPage) * itemsPerPage,
          };
          set(state => ({
            selectedColumn: colIndex,
            columnStates,
            searchQuery: '',
            filter: {},
            statusVisibility: { ...state.statusVisibility, [statusKey]: true },
          }));
          return true;
        }
      }
    }
    return false;
  },

  getTotalPages: () => {
    const { selectedColumn, itemsPerPage } = get();
    const statusKey = STATUS_KEYS[selectedColumn];
    const issues = get().getVisibleColumns()[statusKey];
    return Math.ceil(issues.length / itemsPerPage) || 1;
  },

  getCurrentPage: () => {
    const { selectedColumn, columnStates, itemsPerPage } = get();
    const statusKey = STATUS_KEYS[selectedColumn];
    const scrollOffset = columnStates[statusKey].scrollOffset;
    return Math.floor(scrollOffset / itemsPerPage) + 1;
  },

  moveUp: () => {
    const { selectedColumn, columnStates, itemsPerPage } = get();
    const statusKey = STATUS_KEYS[selectedColumn];
    const currentState = columnStates[statusKey];

    if (currentState.selectedIndex > 0) {
      const newIndex = currentState.selectedIndex - 1;
      let newOffset = currentState.scrollOffset;

      // Scroll up if needed
      if (newIndex < currentState.scrollOffset) {
        newOffset = newIndex;
      }

      set({
        columnStates: {
          ...columnStates,
          [statusKey]: {
            selectedIndex: newIndex,
            scrollOffset: newOffset,
          },
        },
      });
    }
  },

  moveDown: () => {
    const { selectedColumn, columnStates, itemsPerPage } = get();
    const statusKey = STATUS_KEYS[selectedColumn];
    const issues = get().getVisibleColumns()[statusKey];
    const currentState = columnStates[statusKey];

    if (currentState.selectedIndex < issues.length - 1) {
      const newIndex = currentState.selectedIndex + 1;
      let newOffset = currentState.scrollOffset;

      // Scroll down if needed
      if (newIndex >= currentState.scrollOffset + itemsPerPage) {
        newOffset = newIndex - itemsPerPage + 1;
      }

      set({
        columnStates: {
          ...columnStates,
          [statusKey]: {
            selectedIndex: newIndex,
            scrollOffset: newOffset,
          },
        },
      });
    }
  },

  moveLeft: () => {
    const { selectedColumn } = get();
    if (selectedColumn > 0) {
      set({ selectedColumn: selectedColumn - 1 });
    }
  },

  moveRight: () => {
    const { selectedColumn } = get();
    if (selectedColumn < STATUS_KEYS.length - 1) {
      set({ selectedColumn: selectedColumn + 1 });
    }
  },

  jumpToFirst: () => {
    const { selectedColumn, columnStates } = get();
    const statusKey = STATUS_KEYS[selectedColumn];

    set({
      columnStates: {
        ...columnStates,
        [statusKey]: {
          selectedIndex: 0,
          scrollOffset: 0,
        },
      },
    });
  },

  jumpToLast: () => {
    const { selectedColumn, columnStates, itemsPerPage } = get();
    const statusKey = STATUS_KEYS[selectedColumn];
    const issues = get().getVisibleColumns()[statusKey];
    const lastIndex = Math.max(0, issues.length - 1);
    const newOffset = Math.max(0, lastIndex - itemsPerPage + 1);

    set({
      columnStates: {
        ...columnStates,
        [statusKey]: {
          selectedIndex: lastIndex,
          scrollOffset: newOffset,
        },
      },
    });
  },

  jumpToPage: (page: number) => {
    const { selectedColumn, columnStates, itemsPerPage } = get();
    const statusKey = STATUS_KEYS[selectedColumn];
    const issues = get().getVisibleColumns()[statusKey];
    const totalPages = Math.ceil(issues.length / itemsPerPage) || 1;

    // Clamp page to valid range
    const validPage = Math.max(1, Math.min(page, totalPages));
    const newOffset = (validPage - 1) * itemsPerPage;
    const newIndex = Math.min(newOffset, issues.length - 1);

    set({
      columnStates: {
        ...columnStates,
        [statusKey]: {
          selectedIndex: Math.max(0, newIndex),
          scrollOffset: newOffset,
        },
      },
      showJumpToPage: false,
    });
  },

  toggleHelp: () => {
    set(state => ({ showHelp: !state.showHelp }));
  },

  toggleDetails: () => {
    set(state => ({ showDetails: !state.showDetails }));
  },

  toggleNotifications: () => {
    set(state => ({ notificationsEnabled: !state.notificationsEnabled }));
  },

  toggleSearch: () => {
    set(state => ({
      showSearch: !state.showSearch,
      // Close filter when opening search
      showFilter: state.showSearch ? state.showFilter : false,
    }));
  },

  toggleFilter: () => {
    set(state => ({
      showFilter: !state.showFilter,
      // Close search when opening filter
      showSearch: state.showFilter ? state.showSearch : false,
    }));
  },

  toggleExportDialog: () => {
    set(state => ({
      showExportDialog: !state.showExportDialog,
      // Close other modals when opening export dialog
      showSearch: state.showExportDialog ? state.showSearch : false,
      showFilter: state.showExportDialog ? state.showFilter : false,
      showThemeSelector: state.showExportDialog ? state.showThemeSelector : false,
    }));
  },

  toggleThemeSelector: () => {
    set(state => ({
      showThemeSelector: !state.showThemeSelector,
      // Close other modals when opening theme selector
      showSearch: state.showThemeSelector ? state.showSearch : false,
      showFilter: state.showThemeSelector ? state.showFilter : false,
      showExportDialog: state.showThemeSelector ? state.showExportDialog : false,
    }));
  },

  toggleJumpToPage: () => {
    set(state => ({
      showJumpToPage: !state.showJumpToPage,
      // Close other modals
      showSearch: false,
      showFilter: false,
      showExportDialog: false,
      showThemeSelector: false,
    }));
  },

  setTheme: (theme) =>
    set(state => ({ currentTheme: theme, theme: getTheme(theme, state.colorDepth) })),

  setSessionAxes: ({ colorDepth, glyphTier }) =>
    set(state => ({
      colorDepth,
      glyphTier,
      glyphs: getGlyphs(glyphTier),
      theme: getTheme(state.currentTheme, colorDepth),
    })),

  clearFilters: () => {
    set({
      searchQuery: '',
      filter: {},
      columnStates: resetColumnStates(),
      showSearch: false,
      showFilter: false,
    });
  },

  setViewMode: (mode) => {
    const state = get();
    // Save current view as previous if it's not a form view
    if (mode === 'create-issue' || mode === 'edit-issue') {
      if (state.viewMode !== 'create-issue' && state.viewMode !== 'edit-issue') {
        set({ viewMode: mode, previousView: state.viewMode });
      } else {
        set({ viewMode: mode });
      }
    } else {
      set({ viewMode: mode, previousView: mode });
    }
  },

  navigateToCreateIssue: () => {
    const state = get();
    if (state.viewMode !== 'create-issue' && state.viewMode !== 'edit-issue') {
      set({ viewMode: 'create-issue', previousView: state.viewMode });
    } else {
      set({ viewMode: 'create-issue' });
    }
  },

  navigateToEditIssue: () => {
    const state = get();
    if (state.viewMode !== 'create-issue' && state.viewMode !== 'edit-issue') {
      set({ viewMode: 'edit-issue', previousView: state.viewMode });
    } else {
      set({ viewMode: 'edit-issue' });
    }
  },

  returnToPreviousView: () => {
    const state = get();
    set({ viewMode: state.previousView });
  },

  setSearchQuery: (query) => set({ searchQuery: query, columnStates: resetColumnStates() }),

  // Toast actions
  showToast: (message, type) => {
    const toast: ToastMessage = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now(),
    };
    set({ toastMessage: toast });

    // Auto-clear toast after 3 seconds
    setTimeout(() => {
      const state = get();
      if (state.toastMessage?.id === toast.id) {
        set({ toastMessage: null });
      }
    }, 3000);
  },

  clearToast: () => set({ toastMessage: null }),

  // Confirmation dialog actions
  showConfirm: (title, message, onConfirm) => {
    set({
      showConfirmDialog: true,
      confirmDialogData: { title, message, onConfirm },
    });
  },

  hideConfirm: () => {
    set({
      showConfirmDialog: false,
      confirmDialogData: null,
    });
  },

  // Undo actions
  addToUndoHistory: (entry) => {
    const state = get();
    const newEntry: UndoEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    const newHistory = [newEntry, ...state.undoHistory].slice(0, state.maxUndoHistory);
    set({ undoHistory: newHistory });
  },

  undo: () => {
    const state = get();
    if (state.undoHistory.length === 0) return null;

    const [entry, ...rest] = state.undoHistory;
    set({ undoHistory: rest });
    return entry;
  },

  clearUndoHistory: () => set({ undoHistory: [] }),
}));

export { STATUS_KEYS };
export type { StatusKey, ToastMessage, UndoEntry };
