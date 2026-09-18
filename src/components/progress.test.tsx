import { afterEach, beforeEach, expect, test } from 'bun:test';
import React from 'react';
import { Readable, Writable } from 'node:stream';
import { render } from 'ink';
import { normalizeBeads } from '../bd/parser';
import { getGlyphs } from '../session/glyphs';
import { useBeadsStore } from '../state/store';
import { Board } from './Board';
import { DetailPanel } from './DetailPanel';
import { IssueCard } from './IssueCard';

async function renderText(node: React.ReactNode, columns = 120, rows = 30): Promise<string> {
  let output = '';
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  }) as NodeJS.WriteStream;
  Object.assign(stdout, { columns, rows, isTTY: true });
  const stdin = new Readable({ read() {} }) as NodeJS.ReadStream;
  Object.assign(stdin, {
    isTTY: true,
    isRaw: false,
    setRawMode(mode: boolean) { this.isRaw = mode; return this; },
    ref() { return this; },
    unref() { return this; },
  });

  await new Promise<void>((resolve) => {
    let instance: ReturnType<typeof render>;
    instance = render(node, {
      stdout,
      stdin,
      debug: true,
      patchConsole: false,
      onRender: () => queueMicrotask(() => {
        instance.unmount();
        resolve();
      }),
    });
  });
  return output;
}

const issues = normalizeBeads([
  { id: 'parent', title: 'Parent work', status: 'open', issue_type: 'epic', priority: 1 },
  { id: 'closed-child', title: 'Done', status: 'closed', issue_type: 'task', priority: 2,
    dependencies: [{ issue_id: 'closed-child', depends_on_id: 'parent', type: 'parent-child' }] },
  { id: 'open-child', title: 'Not done', status: 'open', issue_type: 'task', priority: 2,
    dependencies: [{ issue_id: 'open-child', depends_on_id: 'parent', type: 'parent-child' }] },
  { id: 'blocked-child', title: 'Also not done', status: 'blocked', issue_type: 'task', priority: 2,
    dependencies: [{ issue_id: 'blocked-child', depends_on_id: 'parent', type: 'parent-child' }] },
]);

beforeEach(() => {
  useBeadsStore.setState({
    data: issues,
    previousIssues: new Map(issues.byId),
    selectedColumn: 0,
    columnStates: {
      open: { selectedIndex: 0, scrollOffset: 0 },
      in_progress: { selectedIndex: 0, scrollOffset: 0 },
      blocked: { selectedIndex: 0, scrollOffset: 0 },
      closed: { selectedIndex: 0, scrollOffset: 0 },
      other: { selectedIndex: 0, scrollOffset: 0 },
    },
    itemsPerPage: 1,
    viewMode: 'kanban',
    showDetails: false,
    showHelp: false,
    searchQuery: '',
    filter: {},
    notificationsEnabled: false,
  });
});

afterEach(() => useBeadsStore.setState({ showDetails: false }));

test('parent card progress counts only closed direct children', async () => {
  const output = await renderText(<IssueCard issue={issues.byId.get('parent')!} />);
  expect(output).toMatch(/1\s*\/\s*3/);
});

test('leaf card has no numeric progress', async () => {
  const output = await renderText(<IssueCard issue={issues.byId.get('open-child')!} />);
  expect(output).not.toMatch(/\d+\s*\/\s*\d+/);
});

test('single-child progress fills the bar and counts one of one', async () => {
  const singleChildData = normalizeBeads([
    { id: 'single-parent', title: 'Single parent', status: 'open', issue_type: 'epic', priority: 1 },
    { id: 'single-child', title: 'Done', status: 'closed', issue_type: 'task', priority: 2,
      dependencies: [{ issue_id: 'single-child', depends_on_id: 'single-parent', type: 'parent-child' }] },
  ]);

  const output = await renderText(<DetailPanel issue={singleChildData.byId.get('single-parent')!} />);
  expect(output).toContain('100 %');
  expect(output).toContain('subtasks 1/1');
});

test('details replace the board at the minimum supported width', async () => {
  useBeadsStore.setState({ terminalWidth: 60, terminalHeight: 30, showDetails: true });
  const output = await renderText(<Board />, 60, 30);

  expect(output).toMatch(/parent work/i);
  expect(output).toContain('esc close');
  expect(output).not.toContain('Terminal too narrow for detail panel');
});

test('details preserve board context when both fit', async () => {
  useBeadsStore.setState({ terminalWidth: 250, terminalHeight: 30, showDetails: true });
  const output = await renderText(<Board />, 250, 30);

  expect(output).toMatch(/Open \(2\)/);
  expect(output).toContain('esc close');
});

test('minimum-height details show one complete line and paging control', async () => {
  const data = normalizeBeads([{
    id: 'short-panel', title: 'Short panel', status: 'open', issue_type: 'bug', priority: 1,
    description: `${'A'.repeat(47)}\nSECOND PAGE LINE`,
  }]);

  const output = await renderText(<DetailPanel issue={data.byId.get('short-panel')!} maxHeight={10} />, 60, 10);
  expect(output).toContain('A'.repeat(47));
  expect(output).not.toContain('SECOND PAGE LINE');
  expect(output).toContain('↓ 1 more line');
});

// 57 inner cells hold 28 wide characters, so 40 of them wrap onto a second
// title row; with two title rows the fixed rows come to twelve.
test('a wide title wraps onto a second row and the description keeps its rows', async () => {
  const data = normalizeBeads([{
    id: 'long-title', title: '界'.repeat(40), status: 'open', issue_type: 'bug', priority: 1,
    description: 'FIRST VISIBLE ROW\nSECOND VISIBLE ROW',
  }]);

  const output = await renderText(<DetailPanel issue={data.byId.get('long-title')!} maxHeight={14} availableWidth={60} />, 60, 14);
  expect(output).toMatch(/界{28}\n[^\n]*界{12}\n[^\n]*long-title/);
  expect(output).toContain('FIRST VISIBLE ROW');
  expect(output).toContain('SECOND VISIBLE ROW');
  expect(output).not.toMatch(/↓ \d+ more line/);
});

test('a title past three rows is cut with the ellipsis on the third', async () => {
  const data = normalizeBeads([{
    id: 'longer-title', title: '界'.repeat(100), status: 'open', issue_type: 'bug', priority: 1,
  }]);

  const output = await renderText(<DetailPanel issue={data.byId.get('longer-title')!} maxHeight={14} availableWidth={60} />, 60, 14);
  expect(output).toMatch(/界{28}\n[^\n]*界{28}\n[^\n]*界{28}…\n[^\n]*longer-title/);
});

test('roomy full-width details show more than eight wrapped lines without paging', async () => {
  const description = Array.from(
    { length: 10 },
    (_, index) => `LINE ${index + 1}: ${'wide-panel-content '.repeat(4)}END-${index + 1}`,
  ).join('\n');
  const data = normalizeBeads([{
    id: 'roomy', title: 'Roomy details', status: 'open', issue_type: 'bug', priority: 1,
    description,
  }]);
  useBeadsStore.setState({
    data,
    previousIssues: new Map(data.byId),
    terminalWidth: 80,
    terminalHeight: 40,
    showDetails: true,
  });

  const output = await renderText(<Board />, 80, 40);
  expect(output).toContain('END-10');
  expect(output).not.toMatch(/↓ \d+ more line/);
  expect(output).not.toMatch(/↑ \d+ above/);
});

test('all detail layouts use their actual available width', async () => {
  // Rows fit the 37 inner cells of the 40-wide side panel but would wrap
  // against anything narrower, so paging is the regression signal.
  const description = Array.from(
    { length: 14 },
    (_, index) => `ROW ${String(index + 1).padStart(2, '0')} ${'x'.repeat(20)} END-${index + 1}`,
  ).join('\n');
  const data = normalizeBeads([
    { id: 'layout-parent', title: 'Layout parent', status: 'open', issue_type: 'epic', priority: 1,
      description },
    { id: 'layout-child', title: 'Layout child', status: 'closed', issue_type: 'task', priority: 2,
      dependencies: [{ issue_id: 'layout-child', depends_on_id: 'layout-parent', type: 'parent-child' }] },
  ]);

  for (const { viewMode, columns } of [
    { viewMode: 'kanban' as const, columns: 250 },
    { viewMode: 'tree' as const, columns: 120 },
  ]) {
    useBeadsStore.setState({
      data,
      previousIssues: new Map(data.byId),
      viewMode,
      terminalWidth: columns,
      terminalHeight: 40,
      showDetails: true,
    });

    const output = await renderText(<Board />, columns, 40);
    expect(output).toContain('END-14');
    expect(output).not.toMatch(/↓ \d+ more line/);
  }
});

test('detail paging starts exactly one row past each visible layout boundary', async () => {
  // The panel spends fifteen rows around the description here: one title row,
  // id, blank, four grid rows, the rule, three subtask rows, three stamp rows
  // and the key hints. The rest of each layout's panel height is the page.
  const layouts = [
    { name: 'replacement Kanban', viewMode: 'kanban' as const, columns: 80, pageRows: 11 },
    { name: 'side-by-side Kanban', viewMode: 'kanban' as const, columns: 250, pageRows: 11 },
    { name: 'Tree', viewMode: 'tree' as const, columns: 80, pageRows: 12 },
  ];

  for (const layout of layouts) {
    for (const overflow of [false, true]) {
      // One row past the page costs the hint row too, so two rows end up below.
      const rowCount = layout.pageRows + (overflow ? 1 : 0);
      const description = Array.from({ length: rowCount }, (_, index) => `BOUNDARY-${index + 1}`).join('\n');
      const data = normalizeBeads([
        { id: 'boundary-parent', title: layout.name, status: 'open', issue_type: 'epic', priority: 1,
          description },
        { id: 'boundary-child', title: 'Child', status: 'closed', issue_type: 'task', priority: 2,
          dependencies: [{ issue_id: 'boundary-child', depends_on_id: 'boundary-parent', type: 'parent-child' }] },
      ]);
      useBeadsStore.setState({
        data,
        previousIssues: new Map(data.byId),
        viewMode: layout.viewMode,
        terminalWidth: layout.columns,
        terminalHeight: 30,
        showDetails: true,
        showSearch: false,
        showFilter: false,
        showJumpToPage: false,
        searchQuery: '',
        filter: {},
      });

      const output = await renderText(<Board />, layout.columns, 30);
      expect(output).toContain('BOUNDARY-1');
      if (overflow) {
        expect(output).not.toContain(`BOUNDARY-${rowCount}`);
        expect(output).toContain('↓ 2 more lines');
      } else {
        expect(output).toContain(`BOUNDARY-${layout.pageRows}`);
        expect(output).not.toMatch(/↓ \d+ more line/);
      }
    }
  }
});

// The panel lists the children with their titles, so a child's title no longer
// proves the list is there. The tree's priority gutter is what only a list row
// draws.
const LIST_MARKERS = { tree: getGlyphs('fancy').gutter } as const;

test('the tree shows the list beside details when wide enough', async () => {
  for (const viewMode of ['tree'] as const) {
    useBeadsStore.setState({
      data: issues,
      previousIssues: new Map(issues.byId),
      viewMode,
      terminalWidth: 140,
      terminalHeight: 30,
      showDetails: true,
    });

    const output = await renderText(<Board />, 140, 30);
    // Detail panel is present...
    expect(output).toContain('esc close');
    // ...alongside the list.
    expect(output).toContain(LIST_MARKERS[viewMode]);
  }
});

test('the tree replaces the list with details when too narrow', async () => {
  for (const viewMode of ['tree'] as const) {
    useBeadsStore.setState({
      data: issues,
      previousIssues: new Map(issues.byId),
      viewMode,
      terminalWidth: 80,
      terminalHeight: 30,
      showDetails: true,
    });

    const output = await renderText(<Board />, 80, 30);
    expect(output).toContain('esc close');
    expect(output).not.toContain(LIST_MARKERS[viewMode]);
  }
});

test('side-by-side details announce their tail and offer PgUp/PgDn instead of the arrows', async () => {
  const description = Array.from({ length: 60 }, (_, index) => `LINE-${index + 1}`).join('\n');
  const data = normalizeBeads([
    { id: 'p', title: 'Parent', status: 'open', issue_type: 'epic', priority: 1, description },
    { id: 'c', title: 'Child row', status: 'open', issue_type: 'task', priority: 2,
      dependencies: [{ issue_id: 'c', depends_on_id: 'p', type: 'parent-child' }] },
  ]);
  useBeadsStore.setState({
    data,
    previousIssues: new Map(data.byId),
    viewMode: 'tree',
    terminalWidth: 140,
    terminalHeight: 30,
    showDetails: true,
  });

  const output = await renderText(<Board />, 140, 30);
  expect(output).toContain('LINE-1');         // detail panel is shown...
  expect(output).toMatch(/child row/i);     // ...beside the list...
  expect(output).toMatch(/↓ \d+ more lines  pgup\/pgdn/); // ...and says how to page what is cut
});

test('description stays visible before variable-height metadata', async () => {
  const data = normalizeBeads([{
    id: 'verbose', title: 'Verbose issue', status: 'blocked', issue_type: 'bug', priority: 1,
    description: 'DESCRIPTION MARKER ' + 'readable words '.repeat(20),
    labels: Array.from({ length: 20 }, (_, index) => `label-${index}`),
    dependencies: Array.from({ length: 12 }, (_, index) => ({
      issue_id: 'verbose', depends_on_id: `blocker-${index}`, type: 'blocks',
    })),
  }]);

  const output = await renderText(<DetailPanel issue={data.byId.get('verbose')!} maxHeight={20} />, 60, 20);
  expect(output).toContain('DESCRIPTION MARKER');
});

