import { expect, test } from 'bun:test';
import { detailPagingIsActive, getDescriptionPage } from './DetailPanel';
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
  expect(pages.slice(1).join('')).toBe(description.split('\n')[1]);
});

test('description paging uses terminal cells for wide graphemes', () => {
  const description = '界界界界界A';
  const firstPage = getDescriptionPage(description, 4, 1, 0);

  expect(firstPage.lines).toEqual(['界界']);
  expect(firstPage.hasMore).toBe(true);
  expect(getDescriptionPage(description, 4, 1, firstPage.nextOffset).lines).toEqual(['界界']);
  expect(getDescriptionPage(description, 4, 1, 2).lines).toEqual(['界A']);
});

test('soft wraps preserve indentation and repeated spaces across pages', () => {
  const description = '  indented   words  ';
  const fragments: string[] = [];
  let offset = 0;
  let page;

  do {
    page = getDescriptionPage(description, 6, 1, offset);
    fragments.push(...page.lines);
    offset = page.nextOffset;
  } while (page.hasMore);

  expect(fragments.join('')).toBe(description);
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

test('final description page keeps its valid page offset', () => {
  const finalPage = getDescriptionPage('first\nsecond\nthird', 20, 2, 2);

  expect(finalPage.lines).toEqual(['third']);
  expect(finalPage.hasMore).toBe(false);
  expect(finalPage.nextOffset).toBe(2);
});

test('footer advertises the open-details shortcut', () => {
  expect(FOOTER_HINT_WORDS).toContain('details');
});
