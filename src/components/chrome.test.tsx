import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { normalizeBeads } from '../bd/parser';
import { getGlyphs } from '../session/glyphs';
import { useBeadsStore } from '../state/store';
import { getTheme } from '../themes/themes';
import { FOOTER_PRIMARY_SHORTCUTS } from './Footer';
import { renderLines } from '../test-utils/ink-render';
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

async function frameOf(overrides: Partial<BeadsStore>): Promise<string[]> {
  useBeadsStore.setState({
    data,
    terminalWidth: WIDTH,
    terminalHeight: HEIGHT,
    theme: getTheme('default', 'ansi256'),
    glyphs: getGlyphs('fancy'),
    ...overrides,
  });
  return renderLines(<Board />, WIDTH, HEIGHT, { keepBlank: true });
}

const VIEWS = ['tree', 'graph', 'kanban', 'stats'] as const;

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
