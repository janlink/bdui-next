import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { normalizeBeads } from '../bd/parser';
import { getGlyphs } from '../session/glyphs';
import { isModalOpen, useBeadsStore } from '../state/store';
import { getTheme } from '../themes/themes';
import { splitViewLayout } from '../utils/constants';
import stringWidth, { setAmbiguousWidth } from 'string-width';
import { pressKeys, renderLines } from '../test-utils/ink-render';
import { Board } from './Board';
import { Footer } from './Footer';
import type { BeadsStore } from '../state/store';

const HEIGHT = 45;
const WIDTH = 140;

const data = normalizeBeads([
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `bd-${String(index).padStart(4, '0')}`,
    title: `Issue ${index}`,
    status: 'open',
    issue_type: 'task',
    priority: 2,
  })),
  {
    id: 'bd-9000',
    title: 'A title far longer than any column, panel or card can hold '.repeat(4),
    status: 'open',
    issue_type: 'feature',
    priority: 0,
    assignee: 'a-name-longer-than-the-card-is-wide',
    labels: ['first-label', 'second-label', 'third-label', 'fourth-label'],
  },
  {
    id: 'bd-9001',
    title: 'Blocked by the first issue',
    status: 'open',
    issue_type: 'bug',
    priority: 1,
    dependencies: [{ issue_id: 'bd-9001', depends_on_id: 'bd-0000', type: 'blocks' }],
  },
]);

const initial = useBeadsStore.getState();
afterEach(() => useBeadsStore.setState(initial, true));

async function frameOf(
  overrides: Partial<BeadsStore>,
  width = WIDTH,
): Promise<string[]> {
  useBeadsStore.setState({
    data,
    terminalWidth: width,
    terminalHeight: HEIGHT,
    theme: getTheme('default', 'ansi256'),
    glyphs: getGlyphs('fancy'),
    ...overrides,
  });
  return renderLines(<Board />, width, HEIGHT, { keepBlank: true });
}

const VIEWS = ['tree', 'kanban', 'stats', 'memories'] as const;
const DOT = getGlyphs('fancy').indicator;

describe('view chrome', () => {
  for (const viewMode of VIEWS) {
    test(`${viewMode} fills exactly ${HEIGHT} rows and ends on the footer`, async () => {
      const lines = await frameOf({ viewMode });
      expect(lines).toHaveLength(HEIGHT);
      expect(lines[HEIGHT - 2]).toMatch(/^─ 1 Tree ─ .*─ 4 Memories ─+/);
      expect(lines[HEIGHT - 1]).toContain('? help');
      expect(lines[HEIGHT - 1]).toContain('deferred');
    });
  }

  // 20 rows leave 16 for the list: the header rule, the column heads, 16 rows
  // and the two footer rows.
  test('tree counts the rows below the window in the footer rule', async () => {
    const lines = await frameOf({ viewMode: 'tree', terminalHeight: 20, showDetails: false });
    expect(lines).toHaveLength(20);
    expect(lines[17]).toContain('bd-0015');
    expect(lines[18]).toMatch(new RegExp(`^─ 1 Tree ─ .* ${getGlyphs('fancy').scrollDown} 16 more ─$`));
  });

  test('tree carries no trailer while the list fits', async () => {
    const lines = await frameOf({ viewMode: 'tree', showDetails: false });
    expect(lines.some(line => line.includes(' more'))).toBe(false);
    expect(lines[HEIGHT - 1]).toContain('deferred');
  });

  test.each([
    ['tree', 'Tree'],
    ['kanban', 'Kanban'],
    ['stats', 'Stats'],
    ['memories', 'Memories'],
  ] as const)('%s rules its own row above the view', async (viewMode, name) => {
    const lines = await frameOf({ viewMode, showDetails: false, workspaceName: 'bdui', liveState: 'live' });
    expect(lines[0]).toMatch(new RegExp(`^─ ${name} ─ bdui ─+ .*${DOT} live ─$`));
    expect(stringWidth(lines[0]!)).toBe(WIDTH);
  });

  test('the kanban rules fork at the panel border', async () => {
    const lines = await frameOf({ viewMode: 'kanban', showDetails: true });
    const glyphs = getGlyphs('fancy');
    const column = lines[0]!.indexOf(glyphs.ruleDown);
    expect(column).toBeGreaterThan(0);
    expect(lines[0]!.slice(column + 1)).toMatch(/^─ bd-0000 ─+$/);
    expect(lines[1]![column]).toBe(glyphs.treeVertical);
    expect(lines[HEIGHT - 2]![column]).toBe(glyphs.ruleUp);
    expect(lines[HEIGHT - 2]!.slice(column + 1)).toMatch(/^─ e edit {2}x export {2}esc close ─+$/);
  });

  test('the split detail panel joins the rules and draws its border on every body row', async () => {
    const lines = await frameOf({ viewMode: 'tree', showDetails: true });
    const glyphs = getGlyphs('fancy');
    const column = splitViewLayout(WIDTH).listWidth + 1;
    expect(lines[0]![column]).toBe(glyphs.ruleDown);
    expect(lines[0]!.slice(column + 1)).toMatch(/^─ bd-0000 ─+$/);
    for (const line of lines.slice(1, HEIGHT - 2)) {
      expect(line[column]).toBe(glyphs.treeVertical);
    }
    expect(lines[HEIGHT - 2]![column]).toBe(glyphs.ruleUp);
    expect(lines[HEIGHT - 2]!.slice(column + 1)).toMatch(/^─ e edit {2}x export {2}esc close ─+$/);
    // The rules name the issue and the keys, so the panel does not repeat them.
    const panel = lines.slice(1, HEIGHT - 2).map(line => line.slice(column + 1));
    expect(panel.some(line => line.includes('esc close'))).toBe(false);
    expect(panel.some(line => line.trim() === 'bd-0000')).toBe(false);
  });

  test('the replacing detail panel keeps its own id and key rows and silences the trailer', async () => {
    const lines = await frameOf({ viewMode: 'tree', showDetails: true, terminalHeight: 20 }, 80);
    expect(lines.some(line => /^│ bd-0000\s*$/.test(line))).toBe(true);
    expect(lines.some(line => line.includes('esc close'))).toBe(true);
    expect(lines[18]).not.toContain('esc close');
    expect(lines[18]).not.toContain(' more');
  });

  test('shared chrome above the view shortens the view, not the frame', async () => {
    const lines = await frameOf({ viewMode: 'tree', showSearch: true });
    expect(lines).toHaveLength(HEIGHT);
    expect(lines[HEIGHT - 1]).toContain('? help');
  });
});

// The tier promises the terminal it will draw with nothing but ASCII, so one
// character Ink or a view brought along of its own defeats the whole tier.
describe('the ascii tier', () => {
  for (const viewMode of VIEWS) {
    test.each([70, 140])(`draws ${viewMode} in ASCII alone at %i columns`, async width => {
      const lines = await frameOf(
        { viewMode, glyphs: getGlyphs('ascii'), theme: getTheme('default', 'none') },
        width,
      );
      for (const line of lines) {
        expect(line).toMatch(/^[\x20-\x7E]*$/);
      }
    });
  }

  test.each(['tree', 'kanban'] as const)('cuts an over-long title in %s with its own ellipsis', async viewMode => {
    const lines = await frameOf({ viewMode, glyphs: getGlyphs('ascii'), theme: getTheme('default', 'none') });
    expect(lines.some(line => line.includes(getGlyphs('ascii').ellipsis))).toBe(true);
  });
});

describe('footer', () => {
  // The narrow end: the tab names go before the filter note does, the hints
  // leave one by one, and help is the last to go.
  for (const mode of ['narrow', 'wide'] as const) {
  for (const width of [60, 70, 91, 92, 140]) {
    test(`stays two rows at ${width} columns (ambiguous ${mode})`, async () => {
      setAmbiguousWidth(mode);
      const lines = await frameOf({ viewMode: 'tree' }, width);
      const rule = lines[HEIGHT - 2]!;
      const hints = lines[HEIGHT - 1]!;
      const ruleWidth = stringWidth(rule);
      const hintsWidth = stringWidth(hints);
      setAmbiguousWidth('narrow');
      expect(lines).toHaveLength(HEIGHT);
      expect(ruleWidth).toBe(width);
      expect(rule).toMatch(/^─ 1 /);
      expect(rule).toContain('filter: closed hidden');
      // Ink caches a text's measured width by its string, so the hints row,
      // whose words are the same in both modes, keeps the narrow measurement
      // here; a real terminal never changes mode mid-session.
      if (mode === 'narrow') {
        expect(hintsWidth).toBeLessThanOrEqual(width);
        expect(hints).toContain('? help');
        expect(hints).toContain('n on');
      }
    });
  }
  }

  test('names the tabs and offers every hint when the rows are wide enough', async () => {
    const [rule, hints] = (await frameOf({ viewMode: 'tree' })).slice(HEIGHT - 2);
    expect(rule).toContain('─ 1 Tree ─ 2 Kanban ─ 3 Stats ─ 4 Memories ─');
    for (const word of ['search', 'filter', 'details', 'cmd', 'help']) expect(hints).toContain(word);
  });

  test('sets the hidden statuses into the end of the rule', async () => {
    const lines = await frameOf({ viewMode: 'tree', showDetails: false });
    expect(lines[HEIGHT - 2]).toMatch(/─ filter: closed hidden ─$/);
  });

  test('shows the legend from 120 columns on, all of it or none', async () => {
    const wide = await frameOf({ viewMode: 'tree' }, 120);
    expect(wide[HEIGHT - 1]).toMatch(/○ open {2}◐ in progress {2}● blocked {2}✓ closed {2}◊ deferred {2}n on$/);
    const narrow = await frameOf({ viewMode: 'tree' }, 119);
    expect(narrow[HEIGHT - 1]).not.toContain('open');
    expect(narrow[HEIGHT - 1]).toMatch(/\? help\s+n on$/);
  });

  test('brackets the active tab where no colour can mark it', async () => {
    const lines = await frameOf({ viewMode: 'stats', theme: getTheme('default', 'none') });
    expect(lines[HEIGHT - 2]).toContain('─ 1 Tree ─ 2 Kanban ─ [3 Stats] ─ 4 Memories ─');
  });

  test('gives memories its navigation hints and panel actions', async () => {
    useBeadsStore.setState({ terminalWidth: WIDTH, theme: getTheme('default', 'ansi256'), glyphs: getGlyphs('fancy') });
    const lines = await renderLines(
      <Footer currentView="memories" panel={{ width: 40, actions: [['d', 'delete'], ['r', 'refresh']] }} />,
      WIDTH,
    );
    expect(lines[0]).toMatch(/─ d delete {2}r refresh ─+$/);
    expect(lines[1]).toContain('j/k move');
    expect(lines[1]).toContain('d delete');
    expect(lines[1]).toContain('r refresh');
  });

  // The toast used to hang absolutely over the header, where the view painted
  // over it. It now takes the hints row, so it can neither hide nor move a row.
  test('a toast takes the hints row over and leaves the rule alone', async () => {
    const toastMessage = { id: 't', message: 'Data refreshed', type: 'info' as const, timestamp: 0 };
    const lines = await frameOf({ viewMode: 'tree', toastMessage });
    const plain = await frameOf({ viewMode: 'tree' });
    expect(lines).toHaveLength(HEIGHT);
    expect(lines[HEIGHT - 1]).toBe(' [i] Data refreshed');
    expect(lines[HEIGHT - 2]).toBe(plain[HEIGHT - 2]);
    expect(lines.slice(0, HEIGHT - 1)).toEqual(plain.slice(0, HEIGHT - 1));
  });

  test.each([
    ['fancy', '…'],
    ['ascii', '~'],
  ] as const)('cuts a long toast to one row with the %s ellipsis', async (tier, ellipsis) => {
    const width = 70;
    const toastMessage = { id: 't', message: 'bd update exited 1: '.repeat(10), type: 'error' as const, timestamp: 0 };
    const lines = await frameOf({ viewMode: 'kanban', toastMessage, glyphs: getGlyphs(tier) }, width);
    const row = lines[HEIGHT - 1]!;
    expect(lines).toHaveLength(HEIGHT);
    expect(row.startsWith(' [!] bd update exited 1:')).toBe(true);
    expect(row.endsWith(ellipsis)).toBe(true);
    expect(stringWidth(row)).toBe(width - 1);
  });

  // The rule's right end, narrowing: the tab names go, the note shortens, the
  // note goes; the trailer stays to the last.
  test.each([
    [88, '─ 1 Tree ─ 2 Kanban ─ 3 Stats ─ 4 Memories ──── filter: closed hidden ─ ↑ 3  ↓ 17 more ─'],
    [63, '─ 1 ─ 2 ─ 3 ─ 4 ────── filter: closed hidden ─ ↑ 3  ↓ 17 more ─'],
    [50, '─ 1 ─ 2 ─ 3 ─ 4 ── filter: clo… ─ ↑ 3  ↓ 17 more ─'],
    [46, '─ 1 ─ 2 ─ 3 ─ 4 ───────────── ↑ 3  ↓ 17 more ─'],
  ])('at %i columns sets the trailer into the rule as %s', async (width, expected) => {
    useBeadsStore.setState({ terminalWidth: width, theme: getTheme('default', 'ansi256'), glyphs: getGlyphs('fancy') });
    const [rule] = await renderLines(<Footer currentView="tree" trailer={{ above: 3, below: 17 }} />, width);
    expect(rule).toBe(expected);
  });
});

// Every flag isModalOpen() answers to gates the navigation handlers off. If the
// overlay behind one does not mount, no handler is left to read the keyboard and
// the frame stops responding without looking any different.
describe('modal flags', () => {
  type ModalFlag =
    | 'showSearch'
    | 'showFilter'
    | 'showExportDialog'
    | 'showThemeSelector'
    | 'showJumpToPage'
    | 'showVisibilityPanel'
    | 'showConfirmDialog';

  const FLAGS: ModalFlag[] = [
    'showSearch',
    'showFilter',
    'showExportDialog',
    'showThemeSelector',
    'showJumpToPage',
    'showVisibilityPanel',
    'showConfirmDialog',
  ];

  test.each(FLAGS)('%s hands the keyboard back on escape', async flag => {
    useBeadsStore.setState({
      data: normalizeBeads([]),
      terminalWidth: WIDTH,
      terminalHeight: HEIGHT,
      theme: getTheme('default', 'ansi256'),
      glyphs: getGlyphs('fancy'),
      viewMode: 'tree',
      ...(Object.fromEntries(FLAGS.map(name => [name, flag === name])) as Record<ModalFlag, boolean>),
    });

    await pressKeys(<Board />, ['\u001B']);

    expect(isModalOpen(useBeadsStore.getState())).toBe(false);
  });
});
