import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import chalk from 'chalk';
import stringWidth from 'string-width';
import { getGlyphs } from '../session/glyphs';
import { useBeadsStore } from '../state/store';
import { getTheme } from '../themes/themes';
import { renderFrame, renderLines, stripAnsi } from '../test-utils/ink-render';
import { Header } from './Header';

const initial = useBeadsStore.getState();
const detectedLevel = chalk.level;
afterEach(() => {
  useBeadsStore.setState(initial, true);
  chalk.level = detectedLevel;
});

const STATS = [{ text: '196 issues' }, { text: '8 roots' }, { text: '1/145', strong: true }];

function arrange(overrides: Partial<ReturnType<typeof useBeadsStore.getState>> = {}) {
  useBeadsStore.setState({
    theme: getTheme('default', 'ansi256'),
    glyphs: getGlyphs('fancy'),
    surface: 'on',
    workspaceName: 'kidicap-analytics-pipeline',
    liveState: 'live',
    ...overrides,
  });
}

const ESC = String.fromCharCode(27);
const BAR = getGlyphs('fancy').treeVertical;
const DOT = getGlyphs('fancy').indicator;

describe('header', () => {
  // Ink drops trailing blanks from a line it paints no background on, so the
  // right padding is the one cell a bare frame does not show.
  test.each([60, 80, 140])('ends one padding cell before %i', async width => {
    arrange();
    const [line] = await renderLines(<Header view="Tree" stats={STATS} width={width} />, width);
    expect(stringWidth(line!)).toBe(width - 1);
  });

  test('names the brand, the workspace, the view and the freshness', async () => {
    arrange();
    const [line] = await renderLines(<Header view="Tree" stats={STATS} width={120} />, 120);
    expect(line).toMatch(
      new RegExp(`^ bdui {2}kidicap-analytics-pipeline {2}${BAR} {2}Tree\\s+196 issues {2}8 roots {2}1/145 {2}${DOT} live$`),
    );
  });

  test('shortens the workspace before it drops a count', async () => {
    arrange();
    const [line] = await renderLines(<Header view="Tree" stats={STATS} width={62} />, 62);
    expect(line).toContain(getGlyphs('fancy').ellipsis);
    expect(line).toContain('196 issues');
    expect(line).toContain('1/145');
  });

  test('drops counts from the left once the workspace is gone', async () => {
    arrange();
    const [line] = await renderLines(<Header view="Tree" stats={STATS} width={34} />, 34);
    expect(line).not.toContain('kidicap');
    expect(line).not.toContain('196 issues');
    expect(line).toContain('1/145');
    expect(line).toContain(`${DOT} live`);
    expect(stringWidth(line!)).toBe(33);
  });

  test('reports a failed poll as stale', async () => {
    arrange({ liveState: 'stale' });
    const [line] = await renderLines(<Header view="Tree" stats={[]} width={80} />, 80);
    expect(line).toContain(`${DOT} stale`);
  });

  test('paints one surface run across the whole row when the axis is on', async () => {
    arrange();
    chalk.level = 2;
    const frame = await renderFrame(<Header view="Tree" stats={STATS} width={100} />, 100);
    const line = frame.split('\n')[0]!;
    expect(line.startsWith(`${ESC}[48;5;234m`)).toBe(true);
    expect(stringWidth(stripAnsi(line))).toBe(100);
  });

  test('paints nothing when the axis is off', async () => {
    arrange({ surface: 'off' });
    chalk.level = 2;
    const frame = await renderFrame(<Header view="Tree" stats={STATS} width={100} />, 100);
    expect(frame).not.toContain('48;5;');
  });

  test('paints nothing at sixteen colours, where the theme owns no surface', async () => {
    arrange({ theme: getTheme('default', 'ansi16') });
    chalk.level = 1;
    const frame = await renderFrame(<Header view="Tree" stats={STATS} width={100} />, 100);
    expect(frame).not.toMatch(new RegExp(`${ESC}\\[4\\dm`));
  });
});
