import { expect, test } from 'bun:test';
import { descriptionLines, detailPagingIsActive, getDescriptionPage, pageLines, wrapTitle } from './DetailPanel';
import { getGlyphs } from '../session/glyphs';
import { lineText } from '../utils/markdown';
import { FOOTER_HINT_WORDS } from './Footer';

test('description pages preserve all content for scrolling', () => {
  const description = 'first line\n' + 'word '.repeat(30) + 'final marker';
  const pages: string[] = [];
  let offset = 0;

  let hasMore: boolean;
  do {
    const page = getDescriptionPage(description, 20, 2, offset);
    pages.push(...page.lines);
    offset = page.nextOffset;
    hasMore = page.hasMore;
  } while (hasMore);

  expect(pages[0]).toBe('first line');
  // The one space each soft wrap breaks on is the only thing not drawn.
  expect(pages.slice(1).join(' ')).toBe(description.split('\n')[1]);
});

test('description paging uses terminal cells for wide graphemes', () => {
  const description = '界界界界界A';
  const firstPage = getDescriptionPage(description, 4, 1, 0);

  expect(firstPage.lines).toEqual(['界界']);
  expect(firstPage.hasMore).toBe(true);
  expect(getDescriptionPage(description, 4, 1, firstPage.nextOffset).lines).toEqual(['界界']);
  expect(getDescriptionPage(description, 4, 1, 2).lines).toEqual(['界A']);
});

test('soft wraps keep indentation and inner runs of spaces', () => {
  const description = '  indented  and   spaced words';
  const fragments: string[] = [];
  let offset = 0;
  let page;

  do {
    page = getDescriptionPage(description, 16, 1, offset);
    fragments.push(...page.lines);
    offset = page.nextOffset;
  } while (page.hasMore);

  expect(fragments).toEqual(['  indented  and', 'spaced words']);
});

test('a soft wrap that falls on a space keeps the word before it', () => {
  expect(getDescriptionPage('alpha beta gamma', 10, 5, 0).lines).toEqual(['alpha beta', 'gamma']);
});

test('a title cut after its last row keeps the spaces of its tail', () => {
  expect(wrapTitle('one two three four five', 8, '~', 2)).toEqual(['one two', 'three f~']);
});

test('detail paging yields input ownership to every overlay', () => {
  const closed = {
    showSearch: false,
    showFilter: false,
    showExportDialog: false,
    showThemeSelector: false,
    showJumpToPage: false,
    showHelp: false,
    showConfirmDialog: false,
  };

  expect(detailPagingIsActive(closed)).toBe(true);
  for (const overlay of Object.keys(closed) as Array<keyof typeof closed>) {
    expect(detailPagingIsActive({ ...closed, [overlay]: true })).toBe(false);
  }
});

test('description pages count the lines above and below them', () => {
  const description = Array.from({ length: 12 }, (_, index) => `L${index + 1}`).join('\n');
  const first = getDescriptionPage(description, 20, 5, 0);
  expect(first.above).toBe(0);
  expect(first.remaining).toBe(7);

  const second = getDescriptionPage(description, 20, 5, first.nextOffset);
  expect(second.above).toBe(5);
  expect(second.remaining).toBe(2);

  const last = getDescriptionPage(description, 20, 5, second.nextOffset);
  expect(last.above).toBe(10);
  expect(last.remaining).toBe(0);
  expect(last.hasMore).toBe(false);
});

test('final description page keeps its valid page offset', () => {
  const finalPage = getDescriptionPage('first\nsecond\nthird', 20, 2, 2);

  expect(finalPage.lines).toEqual(['third']);
  expect(finalPage.hasMore).toBe(false);
  expect(finalPage.nextOffset).toBe(2);
});

test('footer advertises the open-details shortcut', () => {
  expect(FOOTER_HINT_WORDS).toContain('details');
});

test('description lines render Markdown by default and the source on request', () => {
  const glyphs = getGlyphs('ascii');
  const source = '# Title\n- **item**';

  expect(descriptionLines(source, 40, glyphs, true).map(lineText)).toEqual(['Title', '', '* item']);
  expect(descriptionLines(source, 40, glyphs, false).map(lineText)).toEqual(['# Title', '- **item**']);
});

test('rendered description lines page like source lines', () => {
  const lines = descriptionLines('a\nb\nc', 20, getGlyphs('fancy'), true);
  const first = pageLines(lines, 2, 0);

  expect(first.lines.map(lineText)).toEqual(['a', 'b']);
  expect(first.remaining).toBe(1);
  expect(pageLines(lines, 2, first.nextOffset).lines.map(lineText)).toEqual(['c']);
});
