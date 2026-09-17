import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import chalk from 'chalk';
import stringWidth from 'string-width';
import { getGlyphs } from '../session/glyphs';
import { useBeadsStore } from '../state/store';
import { getTheme } from '../themes/themes';
import { renderFrame, renderLines } from '../test-utils/ink-render';
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
    workspaceName: 'kidicap-analytics-pipeline',
    liveState: 'live',
    ...overrides,
  });
}

const DOT = getGlyphs('fancy').indicator;

describe('header', () => {
  test.each([34, 60, 80, 140])('rules the whole row at %i columns', async width => {
    arrange();
    const [line] = await renderLines(<Header view="Tree" stats={STATS} width={width} />, width);
    expect(stringWidth(line!)).toBe(width);
    expect(line!.startsWith('─ Tree ─')).toBe(true);
    expect(line!.endsWith(`${DOT} live ─`)).toBe(true);
  });

  test('sets the view, the workspace, the counts and the freshness into the rule', async () => {
    arrange();
    const [line] = await renderLines(<Header view="Tree" stats={STATS} width={120} />, 120);
    expect(line).toMatch(
      new RegExp(`^─ Tree ─ kidicap-analytics-pipeline ─+ 196 issues · 8 roots · 1/145 · ${DOT} live ─$`),
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
  });

  test('reports a failed poll as stale', async () => {
    arrange({ liveState: 'stale' });
    const [line] = await renderLines(<Header view="Tree" stats={[]} width={80} />, 80);
    expect(line).toContain(`${DOT} stale`);
  });

  test('forks at the panel border and names the issue over the panel', async () => {
    arrange();
    const [line] = await renderLines(
      <Header view="Tree" stats={STATS} width={140} panel={{ width: 40, title: 'bdui-7bc.4' }} />,
      140,
    );
    expect(stringWidth(line!)).toBe(140);
    expect(line![99]).toBe('─');
    expect(line![100]).toBe('┬');
    expect(line!.slice(101)).toMatch(/^─ bdui-7bc\.4 ─+$/);
    expect(line!.slice(0, 99).endsWith(`${DOT} live ─`)).toBe(true);
  });

  test('cuts a long id to the panel with its own ellipsis', async () => {
    arrange({ glyphs: getGlyphs('ascii'), theme: getTheme('default', 'none') });
    const [line] = await renderLines(
      <Header view="Tree" stats={STATS} width={107} panel={{ width: 36, title: 'x'.repeat(50) }} />,
      107,
    );
    expect(line).toMatch(/^[\x20-\x7E]*$/);
    expect(line!.slice(71)).toMatch(/^\+- x+~ -$/);
  });

  test('paints no background: the rule is the only chrome', async () => {
    arrange();
    chalk.level = 2;
    const frame = await renderFrame(<Header view="Tree" stats={STATS} width={100} />, 100);
    expect(frame).not.toContain('48;5;');
  });
});
