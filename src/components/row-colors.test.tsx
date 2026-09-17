import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import chalk from 'chalk';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBeads } from '../bd/parser';
import { getGlyphs } from '../session/glyphs';
import { chalkLevelFor, COLOR_DEPTHS } from '../session/colors';
import { getTheme, getThemeNames, themes, themes16, themesNone } from '../themes/themes';
import { buildVisibleTree, flattenTree } from '../utils/tree';
import { renderFrame } from '../test-utils/ink-render';
import { ListRow } from './IssueRow';
import type { ColorDepth } from '../session/colors';

const data = normalizeBeads([
  { id: 'bd-0001', title: 'Row under test', status: 'open', issue_type: 'epic', priority: 1 },
]);
const node = flattenTree(buildVisibleTree(data, new Set(['bd-0001'])))[0]!;

const detectedLevel = chalk.level;
afterEach(() => {
  chalk.level = detectedLevel;
});

// The renderer's faked stdout carries no colour depth, so each test sets one.
async function renderAt(depth: ColorDepth, isSelected: boolean): Promise<string> {
  chalk.level = chalkLevelFor(depth);
  const frame = await renderFrame(
    <ListRow
      node={node}
      isSelected={isSelected}
      theme={getTheme('default', depth)}
      glyphs={getGlyphs('fancy')}
      width={50}
    />,
    50,
  );
  return frame.split('\n')[0]!;
}

describe('256 colours', () => {
  test('puts the status colour on the status glyph', async () => {
    const line = await renderAt('ansi256', false);
    expect(line).toContain('[38;5;75m○');
  });

  test('paints the selected row as one background run from the first cell', async () => {
    const line = await renderAt('ansi256', true);
    expect(line.match(/\[48;5;\d+m/g)).toHaveLength(1);
    expect(line.startsWith('[48;5;237m')).toBe(true);
    expect(line).toEndWith('[49m');
  });

  test('leaves an unselected row without a background', async () => {
    const line = await renderAt('ansi256', false);
    expect(line).not.toContain('48;5;');
  });

  // Colour is spent on status; a closed row has nothing left to be urgent about.
  test('paints the gutter in the priority colour on an open row and in rule grey on a closed one', async () => {
    chalk.level = chalkLevelFor('ansi256');
    const theme = getTheme('default', 'ansi256');
    const gutter = getGlyphs('fancy').gutter;
    const rowOf = async (status: string) => {
      const closedData = normalizeBeads([{ id: 'bd-0001', title: 'Row under test', status, issue_type: 'task', priority: 1 }]);
      const closedNode = flattenTree(buildVisibleTree(closedData, new Set(['bd-0001'])))[0]!;
      const frame = await renderFrame(
        <ListRow node={closedNode} isSelected={false} theme={theme} glyphs={getGlyphs('fancy')} width={50} />,
        50,
      );
      return frame.split('\n')[0]!;
    };
    expect(await rowOf('open')).toContain(`[38;5;209m${gutter}`);
    expect(await rowOf('closed')).toContain(`[38;5;239m${gutter}`);
    expect(await rowOf('closed')).not.toContain('38;5;209m');
  });
});

describe('16 colours', () => {
  test('inverts the selected row instead of painting a surface', async () => {
    const line = await renderAt('ansi16', true);
    expect(line).toContain('[7m');
    expect(line).not.toContain('48;5;');
  });

  // Inverse is per span, so any hue left on a selected row would break the one
  // surface into as many colours as the row has spans.
  test('drops every hue from the selected row and keeps them on the others', async () => {
    const hue = /\[(3[0-7]|9[0-7])m/g;
    expect((await renderAt('ansi16', true)).match(hue)).toBeNull();
    expect((await renderAt('ansi16', false)).match(hue)).not.toBeNull();
  });

  test('never emits a 256-colour code', async () => {
    for (const selected of [false, true]) {
      expect(await renderAt('ansi16', selected)).not.toContain('38;5;');
    }
  });
});

describe('no colour', () => {
  test('emits no escape sequence at all', async () => {
    for (const selected of [false, true]) {
      expect(await renderAt('none', selected)).not.toContain('[');
    }
  });

  test('marks the selection with the gutter, since no colour is left', async () => {
    expect(await renderAt('none', true)).toStartWith('▌');
    expect(await renderAt('none', false)).toStartWith(' ');
  });
});

describe('theme tables', () => {
  test('cover the same themes', () => {
    for (const table of [themes, themes16, themesNone]) {
      expect(Object.keys(table)).toEqual(getThemeNames());
    }
  });

  test('define the same tokens in every theme and depth', () => {
    const expected = Object.keys(themes.default!.colors).sort();
    for (const depth of COLOR_DEPTHS) {
      for (const name of getThemeNames()) {
        expect(Object.keys(getTheme(name, depth).colors).sort()).toEqual(expected);
      }
    }
  });

  test('resolve to the same object for the same name and depth', () => {
    expect(getTheme('ocean', 'ansi256')).toBe(getTheme('ocean', 'ansi256'));
  });
});

describe('render path', () => {
  const componentDir = join(import.meta.dir);

  function scanComponents(pattern: RegExp): string[] {
    const offenders: string[] = [];
    for (const file of readdirSync(componentDir)) {
      if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) continue;
      const source = readFileSync(join(componentDir, file), 'utf8');
      for (const match of source.matchAll(pattern)) offenders.push(`${file}: ${match[0]}`);
    }
    return offenders;
  }

  test('names no colour outside the theme tables', () => {
    expect(scanComponents(/(color|backgroundColor|borderColor)="[a-z]+"/g)).toEqual([]);
  });

  test('names no border style outside the glyph tiers', () => {
    expect(scanComponents(/borderStyle=(?!\{[^}]*glyphs\.border\()/g)).toEqual([]);
  });
});
