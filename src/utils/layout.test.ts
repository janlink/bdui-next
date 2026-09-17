import { describe, expect, test } from 'bun:test';
import { getGlyphs } from '../session/glyphs';
import {
  LAYOUT,
  ROW_FIXED_COLUMNS,
  listBudget,
  rowLayout,
  splitViewLayout,
} from './constants';

const fancy = getGlyphs('fancy');

describe('row grid', () => {
  test('spends 34 columns before the title', () => {
    expect(ROW_FIXED_COLUMNS).toBe(34);
  });

  test.each([
    [60, 26],
    [100, 66],
    [70, 36],
    [83, 49],
  ])('leaves the title %i - 34 = %i columns', (width, title) => {
    expect(rowLayout(width, fancy).title).toBe(title);
  });

  test('never reports a negative title width', () => {
    expect(rowLayout(20, fancy).title).toBe(0);
  });

  test('the columns add up to the row width', () => {
    const grid = rowLayout(140, fancy);
    expect(grid.gutter + grid.status + grid.gap + grid.id + grid.meta + grid.title).toBe(140);
  });
});

describe('split view', () => {
  test('keeps the list below the threshold', () => {
    expect(splitViewLayout(LAYOUT.splitViewMinWidth - 1).fits).toBe(false);
  });

  test.each([
    [122, 70, 50],
    [140, 83, 55],
  ])('at %i columns splits into a %i list and a %i panel', (width, list, panel) => {
    const split = splitViewLayout(width);
    expect(split.fits).toBe(true);
    expect(split.listWidth).toBe(list);
    expect(split.panelWidth).toBe(panel);
  });
});

describe('list budget', () => {
  test.each([
    ['tree', 40, 40, 40],
    ['graph', 37, 37, 39],
    ['memories', 38, 38, 38],
    ['kanban', 31, 31, 41],
    ['stats', 43, 43, 43],
  ] as const)('%s at 45 rows', (view, body, itemsPerPage, panelHeight) => {
    expect(listBudget(view, 45)).toEqual({ body, itemsPerPage, panelHeight });
  });

  test('the graph subtracts its level labels from the list only', () => {
    expect(listBudget('graph', 45, 3)).toEqual({ body: 37, itemsPerPage: 34, panelHeight: 39 });
  });

  test.each(['tree', 'graph', 'memories', 'kanban', 'stats'] as const)(
    '%s keeps at least one row on a tiny terminal',
    view => {
      const budget = listBudget(view, 2);
      expect(budget.body).toBe(1);
      expect(budget.itemsPerPage).toBe(1);
      expect(budget.panelHeight).toBe(1);
    },
  );
});
