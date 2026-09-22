import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { normalizeBeads } from '../bd/parser';
import { getGlyphs } from '../session/glyphs';
import { getTheme } from '../themes/themes';
import { useBeadsStore } from '../state/store';
import { renderLines } from '../test-utils/ink-render';
import { IssueCard } from './IssueCard';
import { StatusColumn, STRIP_WIDTH } from './StatusColumn';
import { Board } from './Board';

const glyphs = getGlyphs('fancy');
const BAND = glyphs.band;
const GUTTER = glyphs.gutter;

const cards = normalizeBeads([
  { id: 'op-1', title: 'Short one', status: 'open', issue_type: 'task', priority: 2 },
  { id: 'op-2', title: 'A rather long card title that certainly needs a second row to fit',
    status: 'open', issue_type: 'feature', priority: 1 },
]);
const short = cards.byId.get('op-1')!;
const long = cards.byId.get('op-2')!;

const initial = useBeadsStore.getState();
afterEach(() => useBeadsStore.setState(initial, true));

function arrange() {
  useBeadsStore.setState({ theme: getTheme('default', 'ansi256'), glyphs: getGlyphs('fancy') });
}

describe('kanban card', () => {
  test('is exactly three rows', async () => {
    arrange();
    const lines = await renderLines(<IssueCard issue={short} width={35} />, 40, 10);
    expect(lines).toHaveLength(3);
  });

  test('sets the priority in a fixed column beside the band and the id onto the third row', async () => {
    arrange();
    const lines = await renderLines(<IssueCard issue={long} width={35} />, 40, 10, { keepBlank: true });
    expect(lines[0]!.startsWith(`${BAND}P1 `)).toBe(true);
    expect(lines[0]).toContain('A rather long');
    expect(lines[2]).toContain('op-2');
    expect(lines[2]).toContain('feature');
  });

  test('the first card keeps its band on every row and a follower breaks it at the top', async () => {
    arrange();
    const first = await renderLines(<IssueCard issue={short} width={35} bandBreak={false} />, 40, 10, { keepBlank: true });
    expect([first[0]![0], first[1]![0], first[2]![0]]).toEqual([BAND, BAND, BAND]);

    const follower = await renderLines(<IssueCard issue={short} width={35} bandBreak />, 40, 10, { keepBlank: true });
    expect(follower[0]![0]).toBe(' ');
    expect([follower[1]![0], follower[2]![0]]).toEqual([BAND, BAND]);
    // The broken top row still carries the priority and title, only not the band.
    expect(follower[0]!.startsWith(' P2 ')).toBe(true);
  });

  test('selection swaps the thin band for the heavy gutter on every row, top included', async () => {
    arrange();
    const lines = await renderLines(<IssueCard issue={short} width={35} isSelected bandBreak />, 40, 10, { keepBlank: true });
    expect([lines[0]![0], lines[1]![0], lines[2]![0]]).toEqual([GUTTER, GUTTER, GUTTER]);
  });
});

describe('collapsed column', () => {
  function strip(title: string, issues: typeof cards.issues, isActive = false) {
    arrange();
    return renderLines(
      <StatusColumn
        title={title}
        issues={issues}
        isActive={isActive}
        selectedIndex={0}
        scrollOffset={0}
        itemsPerPage={5}
        statusKey="in_progress"
        collapsed
      />,
      12,
      24,
      { keepBlank: true },
    );
  }

  test('an empty column is a three-cell spine of vertical letters', async () => {
    const lines = await strip('In Progress', []);
    expect(lines.every(line => line.trim().length <= 1)).toBe(true);
    expect(lines.some(line => line.trim().length > STRIP_WIDTH)).toBe(false);
    expect(lines.map(line => line.trim()).join('')).toBe('InProgress');
  });

  test('a windowed-out column carries its card count below its name', async () => {
    const three = normalizeBeads([
      { id: 'b-1', title: 'One', status: 'blocked', issue_type: 'task', priority: 2 },
      { id: 'b-2', title: 'Two', status: 'blocked', issue_type: 'task', priority: 2 },
      { id: 'b-3', title: 'Three', status: 'blocked', issue_type: 'task', priority: 2 },
    ]).issues;
    const lines = await strip('Blocked', three);
    expect(lines.map(line => line.trim()).join('')).toBe(`Blocked${glyphs.rule}3`);
  });
});

describe('kanban board', () => {
  const board = normalizeBeads([
    ...Array.from({ length: 3 }, (_, i) => ({ id: `o-${i}`, title: `Open ${i}`, status: 'open', issue_type: 'task', priority: 2 })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `p-${i}`, title: `WIP ${i}`, status: 'in_progress', issue_type: 'task', priority: 1 })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `k-${i}`, title: `Blk ${i}`, status: 'open', issue_type: 'bug', priority: 0,
      dependencies: [{ issue_id: `k-${i}`, depends_on_id: 'o-0', type: 'blocks' }] })),
  ]);

  async function frame(width: number, selectedColumn = 0): Promise<string[]> {
    useBeadsStore.setState({
      data: board,
      previousIssues: new Map(board.byId),
      theme: getTheme('default', 'ansi256'),
      glyphs: getGlyphs('fancy'),
      viewMode: 'kanban',
      showDetails: false,
      terminalWidth: width,
      terminalHeight: 24,
      selectedColumn,
    });
    useBeadsStore.getState().setChromeHeight(0);
    return renderLines(<Board />, width, 24, { keepBlank: true });
  }

  test('an empty column shows no full rule, only its spine', async () => {
    const lines = (await frame(140)).join('\n');
    expect(lines).toMatch(/─ Open \(3\)/);
    expect(lines).toMatch(/─ Blocked \(4\)/);
    // Closed is hidden by default and Other is empty, so neither takes a full rule.
    expect(lines).not.toContain('Closed (');
    expect(lines).not.toContain('Other (');
  });

  test('the header reports how many card-bearing columns collapsed when they will not all fit', async () => {
    // Three non-empty columns; sixty columns hold two full and collapse one.
    const lines = await frame(60);
    expect(lines[0]).toContain('1 collapsed');
  });
});
