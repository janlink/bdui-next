import { beforeEach, expect, test } from 'bun:test';
import { normalizeBeads } from '../bd/parser';
import { DEFAULT_STATUS_VISIBILITY } from '../utils/visibility';
import { isModalOpen, useBeadsStore } from './store';

function data() {
  return normalizeBeads([
    { id: 'issue-hidden', title: 'Hidden card', status: 'open', issue_type: 'task', priority: 2 },
    { id: 'issue-visible', title: 'Visible target', status: 'open', issue_type: 'bug', priority: 1 },
    { id: 'issue-third', title: 'Third card', status: 'open', issue_type: 'task', priority: 3 },
  ]);
}

beforeEach(() => {
  useBeadsStore.setState({
    data: normalizeBeads([]),
    previousIssues: new Map(),
    selectedColumn: 0,
    columnStates: {
      open: { selectedIndex: 0, scrollOffset: 0 },
      in_progress: { selectedIndex: 0, scrollOffset: 0 },
      blocked: { selectedIndex: 0, scrollOffset: 0 },
      closed: { selectedIndex: 0, scrollOffset: 0 },
      other: { selectedIndex: 0, scrollOffset: 0 },
    },
    itemsPerPage: 1,
    searchQuery: '',
    filter: {},
    // selectIssueById reveals the selected issue's status category, so this has
    // to be reset or one test's lookup widens visibility for the next.
    statusVisibility: { ...DEFAULT_STATUS_VISIBILITY },
    viewMode: 'kanban',
    previousView: 'kanban',
    showSearch: false,
    showFilter: false,
    showExportDialog: false,
    showThemeSelector: false,
    showJumpToPage: false,
    showVisibilityPanel: false,
    showConfirmDialog: false,
    notificationsEnabled: false,
  });
});

test('the filtered visible card is the selected edit and export target', () => {
  let store = useBeadsStore.getState();
  store.setData(data());
  store.moveDown();
  expect(useBeadsStore.getState().columnStates.open).toEqual({ selectedIndex: 1, scrollOffset: 1 });

  useBeadsStore.getState().setSearchQuery('visible target');
  store = useBeadsStore.getState();

  expect(store.getVisibleColumns().open.map(issue => issue.id)).toEqual(['issue-visible']);
  expect(store.columnStates.open).toEqual({ selectedIndex: 0, scrollOffset: 0 });
  expect(store.getSelectedIssue()?.id).toBe('issue-visible');

  store.navigateToEditIssue();
  expect(useBeadsStore.getState().getSelectedIssue()?.id).toBe('issue-visible');
  useBeadsStore.getState().toggleExportDialog();
  expect(useBeadsStore.getState().getSelectedIssue()?.id).toBe('issue-visible');
});

test('navigation and pagination cannot exceed the filtered column', () => {
  let store = useBeadsStore.getState();
  store.setData(data());
  store.setFilter({ priority: 1 });

  store = useBeadsStore.getState();
  store.moveDown();
  store.moveDown();
  store.jumpToLast();
  store.jumpToPage(99);

  const current = useBeadsStore.getState();
  expect(current.getVisibleColumns().open).toHaveLength(1);
  expect(current.columnStates.open).toEqual({ selectedIndex: 0, scrollOffset: 0 });
  expect(current.getSelectedIssue()?.id).toBe('issue-visible');
  expect(current.getTotalPages()).toBe(1);
});

test('unknown statuses remain visible and navigable in Other', () => {
  const store = useBeadsStore.getState();
  store.setData(normalizeBeads([
    { id: 'deferred-one', title: 'Later', status: 'deferred', issue_type: 'decision', priority: 4 },
    { id: 'custom-one', title: 'Custom', status: 'awaiting_review', issue_type: 'custom', priority: 0 },
  ]));

  expect(useBeadsStore.getState().getVisibleColumns().other.map(issue => issue.status)).toEqual([
    'deferred',
    'awaiting_review',
  ]);

  useBeadsStore.getState().setFilter({ status: 'other' });
  for (let column = 0; column < 4; column++) useBeadsStore.getState().moveRight();
  useBeadsStore.getState().moveDown();

  const other = useBeadsStore.getState();
  expect(other.selectedColumn).toBe(4);
  expect(other.getCurrentPage()).toBe(2);
  expect(other.getSelectedIssue()?.status).toBe('awaiting_review');
});

test('exact ID selection wins over an earlier fuzzy match', () => {
  const store = useBeadsStore.getState();
  store.setData(normalizeBeads([
    { id: 'bd-a.1', title: 'Child', status: 'open', issue_type: 'task', priority: 2 },
    { id: 'bd-a', title: 'Exact parent', status: 'closed', issue_type: 'epic', priority: 1 },
  ]));

  expect(useBeadsStore.getState().selectIssueById('bd-a')).toBe(true);
  expect(useBeadsStore.getState().getSelectedIssue()?.id).toBe('bd-a');
});

test('every input-owning overlay counts as an open modal', () => {
  const flags = [
    'showSearch', 'showFilter', 'showExportDialog',
    'showThemeSelector', 'showJumpToPage', 'showVisibilityPanel', 'showConfirmDialog',
  ] as const;

  expect(isModalOpen(useBeadsStore.getState())).toBe(false);

  for (const flag of flags) {
    useBeadsStore.setState({ [flag]: true });
    expect(isModalOpen(useBeadsStore.getState())).toBe(true);
    useBeadsStore.setState({ [flag]: false });
  }
});

test('row views keep the ancestor chain of a search match and drop its siblings', () => {
  const store = useBeadsStore.getState();
  store.setData(normalizeBeads([
    { id: 'epic', title: 'Platform work', status: 'open', issue_type: 'epic', priority: 1 },
    { id: 'epic.hit', title: 'Search target', status: 'open', issue_type: 'task', priority: 2,
      dependencies: [{ issue_id: 'epic.hit', depends_on_id: 'epic', type: 'parent-child' }] },
    { id: 'epic.miss', title: 'Unrelated chore', status: 'open', issue_type: 'chore', priority: 3,
      dependencies: [{ issue_id: 'epic.miss', depends_on_id: 'epic', type: 'parent-child' }] },
  ]));

  expect([...useBeadsStore.getState().getRowVisibleIds()].sort())
    .toEqual(['epic', 'epic.hit', 'epic.miss']);

  useBeadsStore.getState().setSearchQuery('target');

  expect([...useBeadsStore.getState().getRowVisibleIds()].sort()).toEqual(['epic', 'epic.hit']);
});

test('row views apply field filters alongside search', () => {
  const store = useBeadsStore.getState();
  store.setData(normalizeBeads([
    { id: 'epic', title: 'Platform work', status: 'open', issue_type: 'epic', priority: 1 },
    { id: 'epic.p0', title: 'Urgent target', status: 'open', issue_type: 'bug', priority: 0,
      dependencies: [{ issue_id: 'epic.p0', depends_on_id: 'epic', type: 'parent-child' }] },
    { id: 'epic.p3', title: 'Later target', status: 'open', issue_type: 'task', priority: 3,
      dependencies: [{ issue_id: 'epic.p3', depends_on_id: 'epic', type: 'parent-child' }] },
  ]));

  useBeadsStore.getState().setFilter({ priority: 0 });

  expect([...useBeadsStore.getState().getRowVisibleIds()].sort()).toEqual(['epic', 'epic.p0']);
});

test('row views never resurface an issue the status toggle hides', () => {
  const store = useBeadsStore.getState();
  store.setData(normalizeBeads([
    { id: 'done', title: 'Closed target', status: 'closed', issue_type: 'task', priority: 2 },
    { id: 'todo', title: 'Open target', status: 'open', issue_type: 'task', priority: 2 },
  ]));

  useBeadsStore.getState().setSearchQuery('target');

  expect([...useBeadsStore.getState().getRowVisibleIds()]).toEqual(['todo']);
});

test('structured search tokens narrow the Kanban columns', () => {
  const store = useBeadsStore.getState();
  store.setData(data());

  useBeadsStore.getState().setSearchQuery('type:bug');
  expect(useBeadsStore.getState().getVisibleColumns().open.map(issue => issue.id)).toEqual(['issue-visible']);

  useBeadsStore.getState().setSearchQuery('type:task');
  expect(useBeadsStore.getState().getVisibleColumns().open.map(issue => issue.id))
    .toEqual(['issue-hidden', 'issue-third']);

  useBeadsStore.getState().setSearchQuery('p3');
  expect(useBeadsStore.getState().getVisibleColumns().open.map(issue => issue.id)).toEqual(['issue-third']);
});

test('search tokens AND with the panel filter across row views', () => {
  const store = useBeadsStore.getState();
  store.setData(normalizeBeads([
    { id: 'epic', title: 'Platform work', status: 'open', issue_type: 'epic', priority: 1 },
    { id: 'epic.bug', title: 'Fix it', status: 'open', issue_type: 'bug', priority: 0,
      dependencies: [{ issue_id: 'epic.bug', depends_on_id: 'epic', type: 'parent-child' }] },
    { id: 'epic.task', title: 'Do it', status: 'open', issue_type: 'task', priority: 0,
      dependencies: [{ issue_id: 'epic.task', depends_on_id: 'epic', type: 'parent-child' }] },
  ]));

  useBeadsStore.getState().setFilter({ priority: 0 });
  useBeadsStore.getState().setSearchQuery('type:bug');

  expect([...useBeadsStore.getState().getRowVisibleIds()].sort()).toEqual(['epic', 'epic.bug']);
});

test('global ID selection clears filters so the selected issue remains visible', () => {
  const store = useBeadsStore.getState();
  store.setData(data());
  store.setSearchQuery('visible target');

  expect(useBeadsStore.getState().selectIssueById('issue-third')).toBe(true);
  const selected = useBeadsStore.getState();
  expect(selected.searchQuery).toBe('');
  expect(selected.filter).toEqual({});
  expect(selected.getSelectedIssue()?.id).toBe('issue-third');
});

// Cards are whole rows of chrome, so the page size follows the height the board
// was given rather than the terminal's.
test('the board pages in whole cards against the height it was given', () => {
  const store = useBeadsStore.getState();
  store.setChromeHeight(0);

  store.setTerminalSize(140, 45);
  expect(useBeadsStore.getState().itemsPerPage).toBe(4);

  store.setTerminalSize(140, 61);
  expect(useBeadsStore.getState().itemsPerPage).toBe(6);
});

test('chrome above the board costs it a page of cards', () => {
  const store = useBeadsStore.getState();
  store.setChromeHeight(0);
  store.setTerminalSize(140, 61);

  store.setChromeHeight(16);
  expect(useBeadsStore.getState().itemsPerPage).toBe(4);
});

test('a resized page keeps the selected card on screen', () => {
  const store = useBeadsStore.getState();
  store.setChromeHeight(0);
  store.setTerminalSize(140, 61);
  useBeadsStore.setState({
    columnStates: {
      ...useBeadsStore.getState().columnStates,
      open: { selectedIndex: 7, scrollOffset: 5 },
    },
  });

  store.setChromeHeight(16);
  const open = useBeadsStore.getState().columnStates.open;
  expect(open.selectedIndex).toBe(7);
  expect(open.scrollOffset).toBe(4);
});
