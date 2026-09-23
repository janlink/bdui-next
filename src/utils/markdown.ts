import { Lexer, type Token, type Tokens } from 'marked';
import stringWidth from 'string-width';
import type { GlyphSet } from '../session/glyphs';
import { fitToWidth, padEndCells } from './cells';

// Descriptions render into lines of styled spans rather than an ANSI string,
// so the panel pages them by line and every width is measured before a theme
// colours anything.

export type MarkdownRole =
  | 'text'
  | 'heading'
  | 'strong'
  | 'emph'
  | 'del'
  | 'code'
  | 'link'
  | 'faint'
  | 'rule';

export interface Span {
  text: string;
  role: MarkdownRole;
}

export type StyledLine = Span[];

interface Cell {
  grapheme: string;
  role: MarkdownRole;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

// Two cells between table columns, and the narrowest a column may shrink to
// before the table gives up and shows its source.
const TABLE_GAP = 2;
const TABLE_MIN_COLUMN = 3;

const CACHE_LIMIT = 32;
const cache = new Map<string, StyledLine[]>();

export function renderMarkdown(source: string, width: number, glyphs: GlyphSet): StyledLine[] {
  const key = `${glyphs.tier}\0${width}\0${source}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Descriptions are typed like issue comments, where a single newline is a
  // line break; joining those lines would reflow plain-text descriptions.
  const tokens = new Lexer({ gfm: true, breaks: true }).lex(source);
  const lines = renderBlocks(tokens, Math.max(1, width), glyphs, false);

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, lines);
  return lines;
}

export function lineText(line: StyledLine): string {
  return line.map(span => span.text).join('');
}

export function plainLine(text: string): StyledLine {
  return text ? [{ text, role: 'text' }] : [];
}

function renderBlocks(tokens: Token[], width: number, glyphs: GlyphSet, tight: boolean): StyledLine[] {
  const lines: StyledLine[] = [];
  for (const token of tokens) {
    const rendered = renderBlock(token, width, glyphs);
    if (rendered.length === 0) continue;
    if (lines.length > 0 && !tight) lines.push([]);
    lines.push(...rendered);
  }
  return lines;
}

function renderBlock(token: Token, width: number, glyphs: GlyphSet): StyledLine[] {
  switch (token.type) {
    case 'space':
    case 'def':
      return [];
    case 'heading': {
      const { tokens } = token as Tokens.Heading;
      return wrapSpans(withRole(inlineSpans(tokens, glyphs), 'heading'), width);
    }
    case 'paragraph':
      return wrapSpans(inlineSpans((token as Tokens.Paragraph).tokens, glyphs), width);
    case 'text': {
      const text = token as Tokens.Text;
      const spans = text.tokens ? inlineSpans(text.tokens, glyphs) : [{ text: text.text, role: 'text' as const }];
      return wrapSpans(spans, width);
    }
    case 'code':
      return renderCode(token as Tokens.Code, width, glyphs);
    case 'blockquote':
      // A quote shares the code block's gutter, so its text is dimmed apart.
      return prefixLines(
        renderBlocks((token as Tokens.Blockquote).tokens, Math.max(1, width - 2), glyphs, false)
          .map(line => line.map(span => (span.role === 'text' ? { ...span, role: 'faint' as const } : span))),
        [{ text: `${glyphs.treeVertical} `, role: 'rule' }],
        [{ text: `${glyphs.treeVertical} `, role: 'rule' }],
      );
    case 'list':
      return renderList(token as Tokens.List, width, glyphs);
    case 'hr':
      return [[{ text: glyphs.treeDash.repeat(width), role: 'rule' }]];
    case 'table':
      return renderTable(token as Tokens.Table, width, glyphs);
    case 'html':
      return rawLines((token as Tokens.HTML).text.replace(/\n+$/u, ''), width);
    default:
      return 'raw' in token && typeof token.raw === 'string'
        ? rawLines(token.raw.replace(/\n+$/u, ''), width)
        : [];
  }
}

function rawLines(text: string, width: number): StyledLine[] {
  return text.split('\n').flatMap(line => wrapSpans(plainLine(line), width));
}

function renderCode(token: Tokens.Code, width: number, glyphs: GlyphSet): StyledLine[] {
  const gutter: Span = { text: `${glyphs.treeVertical} `, role: 'rule' };
  const room = Math.max(1, width - 2);
  // Code keeps its line structure; wrapping would break indentation that means
  // something, so an overlong line is cut instead.
  return token.text.split('\n').map(line => {
    const expanded = line.replace(/\t/gu, '  ');
    return expanded ? [gutter, { text: fitToWidth(expanded, room, glyphs.ellipsis), role: 'code' }] : [gutter];
  });
}

function renderList(token: Tokens.List, width: number, glyphs: GlyphSet): StyledLine[] {
  const start = typeof token.start === 'number' ? token.start : 1;
  const markers = token.items.map((item, index) => {
    const base = token.ordered ? `${start + index}.` : glyphs.bullet;
    if (!item.task) return base;
    return `${base} ${item.checked ? glyphs.checkboxOn : glyphs.checkboxOff}`;
  });
  const markerWidth = Math.max(...markers.map(marker => stringWidth(marker))) + 1;
  const room = Math.max(1, width - markerWidth);

  const lines: StyledLine[] = [];
  token.items.forEach((item, index) => {
    if (index > 0 && token.loose) lines.push([]);
    // marked keeps a task's checkbox as a leading token; the marker draws it.
    const body = item.tokens.filter(child => child.type !== 'checkbox');
    const rendered = renderBlocks(body, room, glyphs, !token.loose);
    lines.push(...prefixLines(
      rendered.length > 0 ? rendered : [[]],
      [{ text: padEndCells(markers[index], markerWidth), role: 'faint' }],
      [{ text: ' '.repeat(markerWidth), role: 'text' }],
    ));
  });
  return lines;
}

function renderTable(token: Tokens.Table, width: number, glyphs: GlyphSet): StyledLine[] {
  const header = token.header.map(cell => singleLine(inlineSpans(cell.tokens, glyphs)));
  const rows = token.rows.map(row => row.map(cell => singleLine(inlineSpans(cell.tokens, glyphs))));
  const columns = header.length;
  const natural = header.map((cell, column) => Math.max(
    1,
    spansWidth(cell),
    ...rows.map(row => spansWidth(row[column] ?? [])),
  ));

  const room = width - TABLE_GAP * (columns - 1);
  if (room < columns * TABLE_MIN_COLUMN) return rawLines(token.raw.replace(/\n+$/u, ''), width);

  // Take cells from the widest column first, so narrow columns (ids, flags)
  // keep their full text while prose columns absorb the shortfall.
  const widths = [...natural];
  let excess = widths.reduce((sum, value) => sum + value, 0) - room;
  while (excess > 0) {
    const widest = widths.indexOf(Math.max(...widths));
    if (widths[widest] <= TABLE_MIN_COLUMN) return rawLines(token.raw.replace(/\n+$/u, ''), width);
    widths[widest] -= 1;
    excess -= 1;
  }

  const gap: Span = { text: ' '.repeat(TABLE_GAP), role: 'text' };
  const renderRow = (cells: Span[][], roleOverride?: MarkdownRole): StyledLine => {
    const line: StyledLine = [];
    for (let column = 0; column < columns; column += 1) {
      if (column > 0) line.push(gap);
      let cell = fitSpans(cells[column] ?? [], widths[column], glyphs.ellipsis);
      if (roleOverride) cell = withRole(cell, roleOverride);
      const pad = widths[column] - spansWidth(cell);
      const align = token.align[column];
      const left = align === 'right' ? pad : align === 'center' ? Math.floor(pad / 2) : 0;
      // The last column's trailing pad is dropped so no row ends in blanks.
      const right = column === columns - 1 ? 0 : pad - left;
      if (left > 0) line.push({ text: ' '.repeat(left), role: 'text' });
      line.push(...cell);
      if (right > 0) line.push({ text: ' '.repeat(right), role: 'text' });
    }
    return mergeSpans(line);
  };

  const separator: StyledLine = [];
  widths.forEach((columnWidth, column) => {
    if (column > 0) separator.push(gap);
    separator.push({ text: glyphs.treeDash.repeat(columnWidth), role: 'rule' });
  });

  return [renderRow(header, 'heading'), mergeSpans(separator), ...rows.map(row => renderRow(row))];
}

function inlineSpans(tokens: Token[] | undefined, glyphs: GlyphSet, role: MarkdownRole = 'text'): Span[] {
  if (!tokens) return [];
  const spans: Span[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'strong':
        spans.push(...inlineSpans((token as Tokens.Strong).tokens, glyphs, 'strong'));
        break;
      case 'em':
        spans.push(...inlineSpans((token as Tokens.Em).tokens, glyphs, role === 'strong' ? 'strong' : 'emph'));
        break;
      case 'del':
        spans.push(...inlineSpans((token as Tokens.Del).tokens, glyphs, 'del'));
        break;
      case 'codespan':
        spans.push({ text: (token as Tokens.Codespan).text, role: 'code' });
        break;
      case 'br':
        spans.push({ text: '\n', role });
        break;
      case 'link': {
        const link = token as Tokens.Link;
        const label = inlineSpans(link.tokens, glyphs, 'link');
        spans.push(...label);
        // An autolink's label already is the address.
        if (spansText(label) !== link.href) spans.push({ text: ` (${link.href})`, role: 'faint' });
        break;
      }
      case 'image':
        spans.push({ text: (token as Tokens.Image).text || (token as Tokens.Image).href, role: 'faint' });
        break;
      case 'text': {
        const text = token as Tokens.Text;
        if (text.tokens) spans.push(...inlineSpans(text.tokens, glyphs, role));
        else spans.push({ text: decodeEntities(text.text), role });
        break;
      }
      case 'escape':
        spans.push({ text: decodeEntities((token as Tokens.Escape).text), role });
        break;
      default:
        if ('text' in token && typeof token.text === 'string') spans.push({ text: token.text, role });
        else if ('raw' in token && typeof token.raw === 'string') spans.push({ text: token.raw, role });
    }
  }
  return spans;
}

// marked escapes these in text tokens for its HTML renderer; a terminal wants
// the characters back.
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, '\'')
    .replace(/&amp;/gu, '&');
}

function withRole(spans: Span[], role: MarkdownRole): Span[] {
  // Code keeps its own look inside headings and bold runs.
  return spans.map(span => (span.role === 'code' ? span : { ...span, role }));
}

function singleLine(spans: Span[]): Span[] {
  return spans.map(span => ({ ...span, text: span.text.replace(/\n/gu, ' ') }));
}

function spansText(spans: Span[]): string {
  return spans.map(span => span.text).join('');
}

function spansWidth(spans: Span[]): number {
  return spans.reduce((sum, span) => sum + stringWidth(span.text), 0);
}

function fitSpans(spans: Span[], width: number, ellipsis: string): Span[] {
  if (spansWidth(spans) <= width) return spans;
  const room = width - stringWidth(ellipsis);
  const fitted: Span[] = [];
  let used = 0;
  let lastRole: MarkdownRole = 'text';
  for (const cell of toCells(spans)) {
    const cellWidth = stringWidth(cell.grapheme);
    if (used + cellWidth > room) break;
    fitted.push({ text: cell.grapheme, role: cell.role });
    used += cellWidth;
    lastRole = cell.role;
  }
  fitted.push({ text: ellipsis, role: lastRole });
  return mergeSpans(fitted);
}

function prefixLines(lines: StyledLine[], first: StyledLine, rest: StyledLine): StyledLine[] {
  return lines.map((line, index) => mergeSpans([...(index === 0 ? first : rest), ...line]));
}

function toCells(spans: Span[]): Cell[] {
  const cells: Cell[] = [];
  for (const span of spans) {
    for (const { segment } of graphemeSegmenter.segment(span.text)) {
      cells.push({ grapheme: segment, role: span.role });
    }
  }
  return cells;
}

function mergeSpans(spans: Span[]): StyledLine {
  const merged: StyledLine = [];
  for (const span of spans) {
    if (!span.text) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === span.role) last.text += span.text;
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * Greedy word wrap over styled cells, breaking after the last whitespace that
 * fits and hard-breaking a word wider than the line. Explicit newlines always
 * start a new line.
 */
export function wrapSpans(spans: Span[], width: number): StyledLine[] {
  const lines: StyledLine[] = [];
  let current: Cell[] = [];

  const flush = (cells: Cell[]) => {
    lines.push(mergeSpans(cells.map(cell => ({ text: cell.grapheme, role: cell.role }))));
  };

  const wrapParagraph = (cells: Cell[]) => {
    if (cells.length === 0) {
      lines.push([]);
      return;
    }
    let start = 0;
    while (start < cells.length) {
      let end = start;
      let used = 0;
      while (end < cells.length) {
        const cellWidth = stringWidth(cells[end].grapheme);
        if (end > start && used + cellWidth > width) break;
        used += cellWidth;
        end += 1;
      }
      if (end < cells.length && !/\s/u.test(cells[end].grapheme)) {
        for (let index = end - 1; index > start; index -= 1) {
          if (/\s/u.test(cells[index].grapheme)) {
            end = index + 1;
            break;
          }
        }
      }
      let line = cells.slice(start, end);
      // A space the break fell on stays behind on the line it ends.
      while (line.length > 0 && /\s/u.test(line[line.length - 1].grapheme) && end < cells.length) {
        line = line.slice(0, -1);
      }
      flush(line);
      start = end;
      while (start < cells.length && /\s/u.test(cells[start].grapheme)) start += 1;
    }
  };

  for (const cell of toCells(spans)) {
    if (cell.grapheme === '\n' || cell.grapheme === '\r\n') {
      wrapParagraph(current);
      current = [];
    } else {
      current.push(cell);
    }
  }
  wrapParagraph(current);
  return lines;
}
