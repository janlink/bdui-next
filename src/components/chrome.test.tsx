import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { normalizeBeads } from '../bd/parser';
import { getGlyphs } from '../session/glyphs';
import { isModalOpen, useBeadsStore } from '../state/store';
import { getTheme } from '../themes/themes';
import { FOOTER_PRIMARY_SHORTCUTS } from './Footer';
import stringWidth, { setAmbiguousWidth } from 'string-width';
import { pressKeys, renderLines } from '../test-utils/ink-render';
import { Board } from './Board';
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

const VIEWS = ['tree', 'graph', 'kanban', 'stats', 'memories'] as const;

describe('view chrome', () => {
  for (const viewMode of VIEWS) {
    test(`${viewMode} fills exactly ${HEIGHT} rows and ends on the footer`, async () => {
      const lines = await frameOf({ viewMode });
      expect(lines).toHaveLength(HEIGHT);
      expect(lines[HEIGHT - 2]).toContain(FOOTER_PRIMARY_SHORTCUTS);
      expect(lines[HEIGHT - 1]).toContain('Tree');
      expect(lines[HEIGHT - 1]).toContain('Memories');
    });
  }

  test('tree keeps its legend directly above the footer', async () => {
    const lines = await frameOf({ viewMode: 'tree' });
    expect(lines[HEIGHT - 3]).toContain('deferred');
  });

  test('the split detail panel closes its bottom edge inside the frame', async () => {
    const lines = await frameOf({ viewMode: 'tree', showDetails: true });
    const bottomEdge = lines.findIndex(line => /[╰┘╝].*$/.test(line.trimEnd()));
    expect(bottomEdge).toBeGreaterThan(0);
    expect(bottomEdge).toBeLessThan(HEIGHT - 2);
  });

  test('shared chrome above the view shortens the view, not the frame', async () => {
    const lines = await frameOf({ viewMode: 'tree', showSearch: true });
    expect(lines).toHaveLength(HEIGHT);
    expect(lines[HEIGHT - 2]).toContain(FOOTER_PRIMARY_SHORTCUTS);
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
  // The narrow end: below 92 columns the tab names collapse to bare numbers, and
  // the shortcut row is longer than the terminal is wide.
  for (const mode of ['narrow', 'wide'] as const) {
  for (const width of [60, 70, 91, 92, 140]) {
    test(`stays two rows at ${width} columns (ambiguous ${mode})`, async () => {
      setAmbiguousWidth(mode);
      const lines = await frameOf({ viewMode: 'tree' }, width);
      setAmbiguousWidth('narrow');
      expect(lines).toHaveLength(HEIGHT);

      const shortcuts = lines[HEIGHT - 2]!;
      const tabs = lines[HEIGHT - 1]!;
      expect(stringWidth(shortcuts)).toBeLessThanOrEqual(width);
      expect(stringWidth(tabs)).toBeLessThanOrEqual(width);
      expect(tabs).toStartWith(' [1]');
      expect(tabs).toContain('q quit');
    });
  }
  }
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
