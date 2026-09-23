import { expect, test } from 'bun:test';
import stringWidth from 'string-width';
import { GLYPH_TIERS, getGlyphs } from '../session/glyphs';
import { lineText, renderMarkdown, wrapSpans, type StyledLine } from './markdown';

const SAMPLE = [
  '# Heading with `code`',
  'Some **bold** and *emphasis* in a paragraph long enough to wrap, with a [link](https://example.com) & <tag>.',
  'A single newline breaks the line.',
  '',
  '- item',
  '- [x] done task',
  '- [ ] open task whose text runs long enough to wrap onto a second line',
  '  - nested item',
  '',
  '1. first',
  '2. second',
  '',
  '> quoted text',
  '',
  '```ts',
  'const answer = 42; // a comment long enough that the panel has to cut it',
  '```',
  '',
  '| ID | Title | P |',
  '|----|-------|--:|',
  '| bdui-fly | Render Markdown in the detail panel description | 2 |',
  '| x | short | 10 |',
  '',
  '---',
  'end',
].join('\n');

const texts = (lines: StyledLine[]) => lines.map(lineText);
const roleOf = (lines: StyledLine[], text: string) =>
  lines.flat().find(span => span.text.includes(text))?.role;

test('no rendered line exceeds the width in any glyph tier', () => {
  for (const tier of GLYPH_TIERS) {
    for (const width of [12, 24, 40, 80]) {
      for (const line of renderMarkdown(SAMPLE, width, getGlyphs(tier))) {
        expect(stringWidth(lineText(line))).toBeLessThanOrEqual(width);
      }
    }
  }
});

test('the ascii tier adds no character outside ASCII', () => {
  for (const width of [12, 40, 80]) {
    for (const line of renderMarkdown(SAMPLE, width, getGlyphs('ascii'))) {
      expect(lineText(line)).toMatch(/^[\x20-\x7e]*$/u);
    }
  }
});

test('inline markup becomes roles instead of markers', () => {
  const lines = renderMarkdown(SAMPLE, 200, getGlyphs('fancy'));
  const text = texts(lines).join('\n');

  expect(text).not.toContain('**');
  expect(text).not.toContain('# Heading');
  expect(roleOf(lines, 'Heading with')).toBe('heading');
  expect(roleOf(lines, 'bold')).toBe('strong');
  expect(roleOf(lines, 'emphasis')).toBe('emph');
  expect(roleOf(lines, 'link')).toBe('link');
  expect(roleOf(lines, '(https://example.com)')).toBe('faint');
  expect(text).toContain('& <tag>.');
});

test('single newlines break lines and blank lines separate blocks', () => {
  const lines = texts(renderMarkdown('one\ntwo\n\nthree', 40, getGlyphs('fancy')));
  expect(lines).toEqual(['one', 'two', '', 'three']);
});

test('plain text descriptions keep their layout', () => {
  const source = 'Why: something broke\nWhat: fix it';
  expect(texts(renderMarkdown(source, 80, getGlyphs('fancy')))).toEqual(source.split('\n'));
});

test('list items wrap under their text, not under the marker', () => {
  const lines = texts(renderMarkdown('- alpha beta gamma delta', 12, getGlyphs('fancy')));
  expect(lines).toEqual(['• alpha beta', '  gamma', '  delta']);
});

test('task lists draw the tier checkboxes', () => {
  const lines = texts(renderMarkdown('- [x] done\n- [ ] open', 40, getGlyphs('ascii')));
  expect(lines).toEqual(['* [x] done', '* [ ] open']);
});

test('code blocks keep their lines and cut overlong ones', () => {
  const lines = renderMarkdown('```\n  indented\nabcdefghijklmnop\n```', 10, getGlyphs('ascii'));
  expect(texts(lines)).toEqual(['|   inden~', '| abcdefg~']);
  expect(roleOf(lines, 'abc')).toBe('code');
});

test('tables pad columns to their measured width and honour alignment', () => {
  const source = '| ID | Title | P |\n|----|-------|--:|\n| a | short | 2 |\n| bb | x | 10 |';
  const lines = renderMarkdown(source, 40, getGlyphs('ascii'));
  expect(texts(lines)).toEqual([
    'ID  Title   P',
    '--  -----  --',
    'a   short   2',
    'bb  x      10',
  ]);
  expect(roleOf(lines, 'Title')).toBe('heading');
});

test('an overwide table shrinks its widest column first', () => {
  const source = '| ID | Title |\n|----|-------|\n| a-1 | a long title that does not fit |';
  const lines = texts(renderMarkdown(source, 20, getGlyphs('ascii')));
  expect(lines[2]).toBe('a-1  a long title t~');
  for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(20);
});

test('a table too wide for minimum columns falls back to its source', () => {
  const source = '| a | b | c | d |\n|---|---|---|---|\n| 1 | 2 | 3 | 4 |';
  const lines = texts(renderMarkdown(source, 8, getGlyphs('ascii')));
  expect(lines[0].startsWith('| a |')).toBe(true);
});

test('wide graphemes wrap by cells', () => {
  const lines = wrapSpans([{ text: '界界界界界A', role: 'text' }], 4);
  expect(lines.map(lineText)).toEqual(['界界', '界界', '界A']);
});
