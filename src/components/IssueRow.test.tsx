import { afterAll, describe, expect, test } from 'bun:test';
import React from 'react';
import { Box } from 'ink';
import stringWidth, { setAmbiguousWidth } from 'string-width';
import { normalizeBeads } from '../bd/parser';
import { GLYPH_TIERS, getGlyphs } from '../session/glyphs';
import { getTheme } from '../themes/themes';
import { rowLayout } from '../utils/constants';
import { buildVisibleTree, flattenTree } from '../utils/tree';
import { renderLines } from '../test-utils/ink-render';
import { ListRow } from './IssueRow';
import type { FlatNode } from '../utils/tree';

const theme = getTheme('default', 'ansi256');
const glyphs = getGlyphs('fancy');

// One row per depth, with the long ids the bd workspaces of real projects grow.
const data = normalizeBeads([
  { id: 'bd-0001', title: 'Root epic whose title is far too long to fit into a narrow terminal window', status: 'open', issue_type: 'epic', priority: 1 },
  { id: 'bdui-1a8.23', title: '日本語のタイトルは全角文字なので表示幅が二倍になる', status: 'in_progress', issue_type: 'task', priority: 2,
    dependencies: [{ issue_id: 'bdui-1a8.23', depends_on_id: 'bd-0001', type: 'parent-child' }] },
  { id: 'bdui-1a8.23.14', title: 'Short one 🚀', status: 'open', issue_type: 'bug', priority: 3,
    dependencies: [{ issue_id: 'bdui-1a8.23.14', depends_on_id: 'bdui-1a8.23', type: 'parent-child' }] },
  { id: 'bd-0004', title: 'Closed chore', status: 'closed', issue_type: 'chore', priority: 4 },
]);

const nodes: FlatNode[] = flattenTree(buildVisibleTree(data, new Set(data.issues.map(i => i.id))));

const WIDTHS = [60, 70, 122, 140];
const AMBIGUOUS_MODES = ['narrow', 'wide'] as const;

afterAll(() => setAmbiguousWidth('narrow'));

function rows(selectedIndex: number, width: number, tierGlyphs = glyphs) {
  return (
    <Box flexDirection="column" width={width}>
      {nodes.map((node, index) => (
        <ListRow
          key={node.issue.id}
          node={node}
          isSelected={index === selectedIndex}
          theme={theme}
          glyphs={tierGlyphs}
          width={width}
        />
      ))}
    </Box>
  );
}

for (const tier of GLYPH_TIERS) {
for (const mode of AMBIGUOUS_MODES) {
  const tierGlyphs = getGlyphs(tier);
  describe(`row geometry (${tier}, ambiguous ${mode})`, () => {
    for (const width of WIDTHS) {
      test(`at ${width} columns every row measures exactly ${width} cells`, async () => {
        setAmbiguousWidth(mode);
        const lines = await renderLines(rows(0, width, tierGlyphs), width);
        expect(lines).toHaveLength(nodes.length);
        for (const line of lines) {
          expect(stringWidth(line)).toBe(width);
        }
        setAmbiguousWidth('narrow');
      });

      // truncate-end eats the last column and puts the ellipsis in its place, so
      // a row that ends in one was wider than the terminal.
      test(`at ${width} columns no row ends in the ellipsis`, async () => {
        setAmbiguousWidth(mode);
        const lines = await renderLines(rows(0, width, tierGlyphs), width);
        setAmbiguousWidth('narrow');
        for (const line of lines) {
          expect(line.endsWith(tierGlyphs.ellipsis)).toBe(false);
        }
      });

      test(`at ${width} columns the id starts at the same index on every depth`, async () => {
        setAmbiguousWidth(mode);
        const grid = rowLayout(width, tierGlyphs);
        const lines = await renderLines(rows(0, width, tierGlyphs), width);
        setAmbiguousWidth('narrow');

        const idStart = grid.gutter + grid.status + grid.gap;
        for (const line of lines) {
          const before = [...line].reduce<{ text: string; cells: number }>(
            (acc, character) => (acc.cells >= idStart
              ? acc
              : { text: acc.text + character, cells: acc.cells + stringWidth(character) }),
            { text: '', cells: 0 },
          );
          expect(before.cells).toBe(idStart);
        }
      });
    }
  });
}
}

describe('row content', () => {
  test('truncates a long title on the right', async () => {
    const [root] = await renderLines(rows(-1, 60), 60);
    expect(root).toContain(glyphs.ellipsis);
    expect(root).not.toContain('narrow terminal window');
  });

  test('truncates a long id on the left, keeping the tail', async () => {
    const deep = nodes[2]!;
    const node = { ...deep, issue: { ...deep.issue, id: 'bdui-platform-1a8.23.14.7' } };
    const [line] = await renderLines(
      <ListRow node={node} isSelected={false} theme={theme} glyphs={glyphs} width={60} />,
      60,
    );
    expect(line).toContain(`${glyphs.ellipsis}`);
    expect(line).toContain('.23.14.7');
    expect(line).not.toContain('bdui-platform');
  });

  test('ends the row flush right with the meta column', async () => {
    const lines = await renderLines(rows(-1, 70), 70);
    for (const line of lines) {
      expect(line.endsWith(' ')).toBe(false);
    }
  });

  test('shows a progress bar of constant width whatever the progress', async () => {
    const widths = new Set<number>();
    for (const closed of [0, 1, 2, 3]) {
      const parent = { ...nodes[0]!, issue: { ...nodes[0]!.issue, progress: { closed, total: 3, percent: 0 } } };
      const [line] = await renderLines(
        <ListRow node={parent} isSelected={false} theme={theme} glyphs={glyphs} width={70} />,
        70,
      );
      widths.add(stringWidth(line!));
    }
    expect([...widths]).toEqual([70]);
  });
});

describe('deep nesting', () => {
  // Nine levels of indent cost more cells than the ID column has; the row must
  // still end on its own last column rather than on truncate-end's ellipsis.
  const deep = {
    ...nodes[2]!,
    depth: 9,
    prefix: '\u2502  '.repeat(9),
    issue: { ...nodes[2]!.issue, id: 'bdui-platform-1a8.23.14.7.2' },
  };

  test.each(WIDTHS)('measures exactly %i cells at depth 9', async width => {
    const [line] = await renderLines(
      <ListRow node={deep} isSelected={false} theme={theme} glyphs={glyphs} width={width} />,
      width,
    );
    expect(stringWidth(line!)).toBe(width);
    expect(line!.endsWith(glyphs.ellipsis)).toBe(false);
  });
});
