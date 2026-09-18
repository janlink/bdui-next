import { beforeEach, expect, test } from 'bun:test';
import React from 'react';
import { Readable, Writable } from 'node:stream';
import { render } from 'ink';
import { normalizeBeads } from '../bd/parser';
import { DEFAULT_STATUS_VISIBILITY } from '../utils/visibility';
import { useBeadsStore } from '../state/store';
import { Board } from './Board';

const COLUMNS = 120;
const ROWS = 30;

async function renderBoard(): Promise<string> {
  let output = '';
  const stdout = new Writable({
    write(chunk, _encoding, callback) { output += chunk.toString(); callback(); },
  }) as NodeJS.WriteStream;
  Object.assign(stdout, { columns: COLUMNS, rows: ROWS, isTTY: true });
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
    instance = render(<Board />, {
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

const data = normalizeBeads([
  { id: 'epic', title: 'Platform work', status: 'open', issue_type: 'epic', priority: 1 },
  { id: 'epic.hit', title: 'Search target', status: 'open', issue_type: 'task', priority: 2,
    dependencies: [{ issue_id: 'epic.hit', depends_on_id: 'epic', type: 'parent-child' }] },
  { id: 'epic.miss', title: 'Unrelated chore', status: 'open', issue_type: 'chore', priority: 3,
    dependencies: [{ issue_id: 'epic.miss', depends_on_id: 'epic', type: 'parent-child' }] },
]);

beforeEach(() => {
  useBeadsStore.setState({
    data,
    previousIssues: new Map(data.byId),
    terminalWidth: COLUMNS,
    terminalHeight: ROWS,
    itemsPerPage: 10,
    showDetails: false,
    showHelp: false,
    showSearch: false,
    showFilter: false,
    showJumpToPage: false,
    showExportDialog: false,
    showThemeSelector: false,
    showVisibilityPanel: false,
    showConfirmDialog: false,
    searchQuery: '',
    filter: {},
    statusVisibility: { ...DEFAULT_STATUS_VISIBILITY },
    notificationsEnabled: false,
  });
});

const VIEW_MODES = ['kanban', 'tree', 'stats'] as const;

test('the search box and filter panel render in every view', async () => {
  for (const viewMode of VIEW_MODES) {
    useBeadsStore.setState({ viewMode, showSearch: true, showFilter: false });
    expect(await renderBoard()).toContain('Search:');

    useBeadsStore.setState({ viewMode, showSearch: false, showFilter: true });
    expect(await renderBoard()).toContain('Filters');
  }
});

test('the search box echoes the query and its N/M match count', async () => {
  useBeadsStore.setState({ viewMode: 'tree', showSearch: true, searchQuery: 'target' });

  const output = await renderBoard();

  expect(output).toContain('Search: ');
  expect(output).toContain('target');
  expect(output).toContain('1/3 match');
});

test('search narrows the list to matches plus their ancestor chain', async () => {
  useBeadsStore.setState({ viewMode: 'tree', searchQuery: 'target' });

  const output = await renderBoard();

  expect(output).toContain('epic.hit');
  expect(output).toContain('epic ');
  expect(output).not.toContain('epic.miss');
});

test('the active-filter banner renders outside the Kanban view', async () => {
  useBeadsStore.setState({ viewMode: 'tree', searchQuery: 'target' });

  const output = await renderBoard();

  expect(output).toContain('1 filter active');
  expect(output).toContain('search: "target"');
});
