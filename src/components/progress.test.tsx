import { afterEach, beforeEach, expect, test } from 'bun:test';
import React from 'react';
import { Readable, Writable } from 'node:stream';
import { render } from 'ink';
import { normalizeBeads } from '../bd/parser';
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

test('single-child progress uses singular copy in details', async () => {
  const singleChildData = normalizeBeads([
    { id: 'single-parent', title: 'Single parent', status: 'open', issue_type: 'epic', priority: 1 },
    { id: 'single-child', title: 'Done', status: 'closed', issue_type: 'task', priority: 2,
      dependencies: [{ issue_id: 'single-child', depends_on_id: 'single-parent', type: 'parent-child' }] },
  ]);

  const output = await renderText(<DetailPanel issue={singleChildData.byId.get('single-parent')!} />);
  expect(output).toContain('1/1 child closed (100%)');
  expect(output).not.toContain('1/1 children closed');
});

test('details replace the board at the minimum supported width', async () => {
  useBeadsStore.setState({ terminalWidth: 60, terminalHeight: 30, showDetails: true });
  const output = await renderText(<Board />, 60, 30);

  expect(output).toMatch(/parent work/i);
  expect(output).toContain('Type:');
  expect(output).not.toContain('Terminal too narrow for detail panel');
});

test('details preserve board context when both fit', async () => {
  useBeadsStore.setState({ terminalWidth: 250, terminalHeight: 30, showDetails: true });
  const output = await renderText(<Board />, 250, 30);

  expect(output).toMatch(/Open \(2\)/);
  expect(output).toContain('Type:');
});

test('minimum-height details show one complete line and paging control', async () => {
  const data = normalizeBeads([{
    id: 'short-panel', title: 'Short panel', status: 'open', issue_type: 'bug', priority: 1,
    description: `${'A'.repeat(47)}\nSECOND PAGE LINE`,
  }]);

  const output = await renderText(<DetailPanel issue={data.byId.get('short-panel')!} maxHeight={10} />, 60, 10);
  expect(output).toContain('A'.repeat(46));
  expect(output).not.toContain('A'.repeat(47));
  expect(output).not.toContain('SECOND PAGE LINE');
  expect(output).toContain('↓ more');
});

test('long wide title stays on one row without reducing the description page', async () => {
  const data = normalizeBeads([{
    id: 'long-title', title: '界'.repeat(40), status: 'open', issue_type: 'bug', priority: 1,
    description: 'FIRST VISIBLE ROW\nSECOND VISIBLE ROW',
  }]);

  const output = await renderText(<DetailPanel issue={data.byId.get('long-title')!} maxHeight={11} />, 60, 11);
  expect(output).toContain('FIRST VISIBLE ROW');
  expect(output).toContain('SECOND VISIBLE ROW');
  expect(output).toContain('…');
  expect(output).not.toContain('界'.repeat(40));
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
    terminalWidth: 120,
    terminalHeight: 40,
    showDetails: true,
  });

  const output = await renderText(<Board />, 120, 40);
  expect(output).toContain('END-10');
  expect(output).not.toContain('↓ more');
  expect(output).not.toContain('↑ previous');
});

test('all detail layouts use their actual available width', async () => {
  // Rows fit the narrowest actual panel (Tree/Graph side-by-side ~55 cols) but
  // would wrap against a stale hardcoded 50, so paging is the regression signal.
  const description = Array.from(
    { length: 14 },
    (_, index) => `ROW ${String(index + 1).padStart(2, '0')} ${'x'.repeat(35)} END-${index + 1}`,
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
    { viewMode: 'graph' as const, columns: 120 },
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
    expect(output).not.toContain('↓ more');
  }
});

test('detail paging starts exactly one row past each visible layout boundary', async () => {
  const layouts = [
    { name: 'replacement Kanban', viewMode: 'kanban' as const, columns: 120, pageRows: 18 },
    { name: 'side-by-side Kanban', viewMode: 'kanban' as const, columns: 250, pageRows: 18 },
    { name: 'Tree', viewMode: 'tree' as const, columns: 80, pageRows: 17 },
    { name: 'Graph', viewMode: 'graph' as const, columns: 80, pageRows: 16 },
  ];

  for (const layout of layouts) {
    for (const overflow of [false, true]) {
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
        expect(output).toContain('↓ more');
      } else {
        expect(output).toContain(`BOUNDARY-${layout.pageRows}`);
        expect(output).not.toContain('↓ more');
      }
    }
  }
});

test('tree and graph show the list beside details when wide enough', async () => {
  for (const viewMode of ['tree', 'graph'] as const) {
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
    expect(output).toContain('Type:');
    // ...alongside the list, whose non-selected rows only the list renders.
    expect(output).toMatch(/not done/i);
  }
});

test('tree and graph replace the list with details when too narrow', async () => {
  for (const viewMode of ['tree', 'graph'] as const) {
    useBeadsStore.setState({
      data: issues,
      previousIssues: new Map(issues.byId),
      viewMode,
      terminalWidth: 80,
      terminalHeight: 30,
      showDetails: true,
    });

    const output = await renderText(<Board />, 80, 30);
    expect(output).toContain('Type:');
    expect(output).not.toMatch(/not done/i);
  }
});

test('side-by-side details are a passive follower without an arrow-paging hint', async () => {
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
  expect(output).toContain('Description:'); // detail panel is shown...
  expect(output).toMatch(/child row/i);     // ...beside the list...
  expect(output).not.toContain('↓ more');   // ...and the panel does not page on arrows
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

