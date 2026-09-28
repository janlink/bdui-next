import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import stringWidth from 'string-width';
import { getGlyphs } from '../session/glyphs';
import { useBeadsStore } from '../state/store';
import { getTheme } from '../themes/themes';
import { pressKeys, renderLines } from '../test-utils/ink-render';
import { Box } from 'ink';
import { Frame, fitTitleRow } from './Frame';
import { tailToWidth } from './FormRow';
import { activeFilterWords, filterNote } from './Footer';
import { HelpOverlay, helpLines, helpSections } from './HelpOverlay';

const initial = useBeadsStore.getState();
afterEach(() => useBeadsStore.setState(initial, true));

describe('fitTitleRow', () => {
  const hints = ['Tab switch', 'Space toggle', 'Esc close'];

  test('keeps everything that fits', () => {
    expect(fitTitleRow(80, 'Filters', 'none active', hints, '·', '…'))
      .toEqual({ aside: 'none active', hints: 'Tab switch · Space toggle · Esc close' });
  });

  test('drops hints from the end before it cuts the aside', () => {
    const row = fitTitleRow(48, 'Filters', 'active: P1', hints, '·', '…');
    expect(row).toEqual({ aside: 'active: P1', hints: 'Tab switch · Space toggle' });
  });

  test('cuts the aside once no hint is left, then drops it', () => {
    expect(fitTitleRow(20, 'Filters', 'active: janlink, P1', hints, '·', '…').aside).toBe('active: ja…');
    expect(fitTitleRow(12, 'Filters', 'active: janlink', hints, '·', '…')).toEqual({ aside: '', hints: '' });
  });
});

describe('Frame', () => {
  test('draws the title, aside, and hints in one row inside a rounded border', async () => {
    useBeadsStore.setState({ theme: getTheme('default', 'ansi256'), glyphs: getGlyphs('fancy') });
    const lines = await renderLines(
      <Frame title="Search" aside="1/3 matches" hints={['Esc close']} width={40}><></></Frame>,
      40,
    );
    expect(lines[0]).toMatch(/^╭─{38}╮$/);
    expect(lines[1]).toMatch(/^│ Search {2}1\/3 matches +Esc close │$/);
    expect(lines[2]).toMatch(/^╰─{38}╯$/);
  });

  test('stays in ASCII in the ascii tier', async () => {
    useBeadsStore.setState({ theme: getTheme('default', 'none'), glyphs: getGlyphs('ascii') });
    const lines = await renderLines(<Frame title="Search" hints={['a', 'b']} width={30}><></></Frame>, 30);
    for (const line of lines) expect(line).toMatch(/^[\x20-\x7E]*$/);
  });
});

describe('footer filter note', () => {
  test('names the search and each filter, then the count and the clear key', () => {
    const active = activeFilterWords({ assignee: 'jan', priority: 1, status: 'in_progress', tags: ['ci'] }, 'dbt', '…');
    expect(active).toEqual(['search "dbt"', 'jan', 'in progress', 'P1', 'ci']);
    expect(filterNote(active, ['closed'], 3, 40, '·'))
      .toBe('filter: search "dbt", jan, in progress, P1, ci, closed hidden · 3/40 · c clear');
  });

  test('only hidden statuses carry no count and no clear key', () => {
    expect(filterNote([], ['closed'], 40, 40, '·')).toBe('filter: closed hidden');
    expect(filterNote([], [], 40, 40, '·')).toBe('');
  });

  test('cuts a long search', () => {
    expect(activeFilterWords({}, 'a very long search query', '…')).toEqual(['search "a very long se…"']);
  });
});

describe('tailToWidth', () => {
  test('keeps the end of an over-long value, where the cursor is', () => {
    expect(tailToWidth('abcdefghij', 6, '…')).toBe('…fghij');
    expect(tailToWidth('abc', 6, '…')).toBe('abc');
    expect(stringWidth(tailToWidth('日本語のテキスト', 7, '…'))).toBeLessThanOrEqual(7);
  });
});

describe('help overlay', () => {
  const setup = (terminalHeight: number) => useBeadsStore.setState({
    theme: getTheme('default', 'ansi256'),
    glyphs: getGlyphs('fancy'),
    terminalWidth: 100,
    terminalHeight,
    showHelp: true,
  });

  test('fits a short terminal and counts the rows it holds back', async () => {
    setup(20);
    const total = helpLines(helpSections(getGlyphs('fancy'))).length;
    const lines = await renderLines(<Box width={100} height={20}><HelpOverlay /></Box>, 100, 20, { keepBlank: true });
    const frame = lines.filter(line => line.trim());
    expect(frame.length).toBeLessThanOrEqual(20 - 1 - 2);
    expect(frame.some(line => line.includes(`1-14 of ${total}`))).toBe(true);
    expect(frame.some(line => line.includes('Quit'))).toBe(false);
  });

  test('shows the whole reference without a count when it fits', async () => {
    setup(120);
    const lines = await renderLines(<Box width={100} height={120}><HelpOverlay /></Box>, 100, 120);
    expect(lines.some(line => /\d+-\d+ of \d+/.test(line))).toBe(false);
    expect(lines.some(line => line.includes('Quit'))).toBe(true);
  });

  test.each(['\u001B', 'q', '?'])('closes on %j', async key => {
    setup(40);
    await pressKeys(<HelpOverlay />, [key], 100, 40);
    expect(useBeadsStore.getState().showHelp).toBe(false);
  });
});
