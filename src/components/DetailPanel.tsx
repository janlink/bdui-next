import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Issue } from '../types';
import { useBeadsStore } from '../state/store';
import { fitToWidth, padEndCells } from '../utils/cells';
import {
  PRIORITY_LABELS,
  getPriorityColor,
  getTypeColor,
  getStatusColor,
} from '../utils/constants';
import { statusGlyph, statusWord } from './IssueRow';
import type { GlyphSet } from '../session/glyphs';
import type { Theme } from '../themes/themes';
import { plainLine, renderMarkdown, type MarkdownRole, type StyledLine } from '../utils/markdown';

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

interface WrappedLine {
  graphemes: string[];
  /** Where each line starts, so a caller can take the text from any row on. */
  starts: number[];
  ends: number[];
}

function wrapGraphemes(line: string, lineWidth: number): WrappedLine {
  const graphemes = Array.from(graphemeSegmenter.segment(line), ({ segment }) => segment);
  const starts: number[] = [];
  const ends: number[] = [];
  let start = 0;

  while (start < graphemes.length) {
    let end = start;
    let width = 0;
    while (end < graphemes.length) {
      const nextWidth = Bun.stringWidth(graphemes[end]);
      if (end > start && width + nextWidth > lineWidth) break;
      width += nextWidth;
      end += 1;
    }

    let next = end;
    if (end < graphemes.length && !/\s/u.test(graphemes[end])) {
      // Indentation is not a break opportunity; breaking there would leave
      // the row empty.
      let content = start;
      while (content < end && /\s/u.test(graphemes[content])) content += 1;
      for (let index = end - 1; index > content; index -= 1) {
        if (/\s/u.test(graphemes[index])) {
          end = index;
          next = index + 1;
          break;
        }
      }
    }

    // The whitespace a line breaks on belongs to neither line.
    while (end > start && /\s/u.test(graphemes[end - 1]) && next < graphemes.length) end -= 1;
    while (next < graphemes.length && /\s/u.test(graphemes[next])) next += 1;

    starts.push(start);
    ends.push(end);
    start = next;
  }

  return { graphemes, starts, ends };
}

function wrapDescriptionLine(line: string, lineWidth: number): string[] {
  if (!line) return [''];
  const { graphemes, starts, ends } = wrapGraphemes(line, lineWidth);
  return starts.map((start, index) => graphemes.slice(start, ends[index]).join(''));
}

export function getDescriptionPage(
  description: string,
  lineWidth: number,
  pageSize: number,
  offset: number,
) {
  return pageLines(sourceLines(description, lineWidth), pageSize, offset);
}

function sourceLines(description: string, lineWidth: number): string[] {
  return description
    .split('\n')
    .flatMap(line => wrapDescriptionLine(line, lineWidth));
}

export function descriptionLines(
  description: string,
  lineWidth: number,
  glyphs: GlyphSet,
  markdown: boolean,
): StyledLine[] {
  return markdown
    ? renderMarkdown(description, lineWidth, glyphs)
    : sourceLines(description, lineWidth).map(plainLine);
}

export function pageLines<T>(lines: T[], pageSize: number, offset: number) {
  const safeOffset = Math.min(offset, Math.max(0, lines.length - 1));
  const endOffset = Math.min(safeOffset + pageSize, lines.length);
  return {
    lines: lines.slice(safeOffset, endOffset),
    nextOffset: endOffset < lines.length ? endOffset : safeOffset,
    previousOffset: Math.max(0, safeOffset - pageSize),
    hasMore: endOffset < lines.length,
    hasPrevious: safeOffset > 0,
    above: safeOffset,
    remaining: lines.length - endOffset,
  };
}

/** Rows a title may take before its tail is cut. */
export const TITLE_MAX_LINES = 3;

export function wrapTitle(
  title: string,
  lineWidth: number,
  ellipsis: string,
  maxLines: number = TITLE_MAX_LINES,
): string[] {
  const lines = wrapDescriptionLine(title, lineWidth);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines - 1);
  const { graphemes, starts } = wrapGraphemes(title, lineWidth);
  const rest = graphemes.slice(starts[maxLines - 1]).join('');
  return [...kept, fitToWidth(rest, lineWidth, ellipsis)];
}

/** Local time, one format everywhere, so a stamp never depends on the locale. */
export function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Segments the panel's progress bar is drawn in. */
export const PANEL_BAR_SEGMENTS = 10;

interface DetailPanelProps {
  issue: Issue | null;
  maxHeight?: number;
  availableWidth?: number;
  // Side-by-side layouts navigate the list with the arrow keys, so the panel
  // there pages its description on PgUp/PgDn only.
  enablePaging?: boolean;
  // A hosted panel sits in a frame its view draws, which names the issue over
  // it and the keys under it; the panel then draws neither border nor those rows.
  chrome?: 'own' | 'hosted';
}

interface DetailPagingOverlays {
  showSearch: boolean;
  showFilter: boolean;
  showExportDialog: boolean;
  showThemeSelector: boolean;
  showJumpToPage: boolean;
  showHelp: boolean;
  showConfirmDialog: boolean;
}

export function detailPagingIsActive(overlays: DetailPagingOverlays): boolean {
  return !Object.values(overlays).some(Boolean);
}

// The padding on both sides, and the left border where the panel draws its own.
const FRAME_WIDTH = { own: 3, hosted: 2 } as const;
const LABEL_WIDTH = 10;
const SUBTASKS_SHOWN = 5;
// Rows the description gets when no height is known.
const DEFAULT_DESCRIPTION_ROWS = 8;

interface GridRow {
  label: string;
  value: React.ReactNode;
}

function roleStyle(role: MarkdownRole, theme: Theme): React.ComponentProps<typeof Text> {
  const ink = theme.ink;
  switch (role) {
    case 'heading':
    case 'strong': return { ...ink.strong, bold: true };
    case 'emph': return { ...ink.text, italic: true };
    case 'del': return { ...ink.dim, strikethrough: true };
    case 'code': return { color: theme.colors.primary };
    case 'link': return { color: theme.colors.primary, underline: true };
    case 'faint': return ink.faint;
    case 'rule': return ink.rule;
    default: return ink.text;
  }
}

function progressBar(closed: number, total: number, glyphs: GlyphSet): { done: string; rest: string } {
  // A started parent keeps at least one filled segment, so "some" never rounds
  // down to the same picture as "none".
  const filled = closed === 0 ? 0 : Math.max(1, Math.round((closed / total) * PANEL_BAR_SEGMENTS));
  return { done: glyphs.barDone.repeat(filled), rest: glyphs.barEmpty.repeat(PANEL_BAR_SEGMENTS - filled) };
}

function Frame({
  width,
  height,
  theme,
  glyphs,
  hosted,
  children,
}: React.PropsWithChildren<{ width: number; height?: number; theme: Theme; glyphs: GlyphSet; hosted: boolean }>) {
  const border = hosted ? {} : {
    borderStyle: glyphs.border('single'),
    borderLeft: true,
    borderTop: false,
    borderRight: false,
    borderBottom: false,
    borderLeftColor: theme.colors.border,
  };
  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      flexShrink={0}
      {...border}
      paddingX={1}
      overflow="hidden"
    >
      <Box flexDirection="column" flexShrink={0}>
        {children}
      </Box>
    </Box>
  );
}

/**
 * The panel reads top to bottom in the order a viewer asks: what is it, where
 * does it stand, what does it say, what hangs off it, when. Every row is one
 * line cut to the panel's width, so the rows above the description are
 * countable and the description gets exactly what is left.
 */
export function DetailPanel({
  issue,
  maxHeight,
  availableWidth = 50,
  enablePaging = true,
  chrome = 'own',
}: DetailPanelProps) {
  const hosted = chrome === 'hosted';
  const pagingIsActive = useBeadsStore(state => detailPagingIsActive({
    showSearch: state.showSearch,
    showFilter: state.showFilter,
    showExportDialog: state.showExportDialog,
    showThemeSelector: state.showThemeSelector,
    showJumpToPage: state.showJumpToPage,
    showHelp: state.showHelp,
    showConfirmDialog: state.showConfirmDialog,
  }));
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const byId = useBeadsStore(state => state.data.byId);
  const markdown = useBeadsStore(state => state.descriptionMarkdown);

  const [descriptionOffset, setDescriptionOffset] = useState(0);
  useEffect(() => setDescriptionOffset(0), [issue?.id]);

  const inner = Math.max(1, availableWidth - FRAME_WIDTH[chrome]);
  const valueWidth = Math.max(1, inner - LABEL_WIDTH);
  const ink = theme.ink;

  const titleLines = issue ? wrapTitle(issue.title || issue.id, inner, glyphs.ellipsis) : [];
  const grid: GridRow[] = [];
  const children = issue?.children ?? [];
  if (issue) {
    grid.push({
      label: 'type',
      value: <Text color={getTypeColor(issue.issue_type, theme)}>{fitToWidth(issue.issue_type, valueWidth, glyphs.ellipsis)}</Text>,
    });
    grid.push({
      label: 'prio',
      value: (
        <Text color={getPriorityColor(issue.priority, theme)}>
          {fitToWidth(`P${issue.priority} ${PRIORITY_LABELS[issue.priority] ?? ''}`.trim(), valueWidth, glyphs.ellipsis)}
        </Text>
      ),
    });
    grid.push({
      label: 'status',
      value: <Text color={getStatusColor(issue.displayStatus, theme)}>{fitToWidth(statusWord(issue), valueWidth, glyphs.ellipsis)}</Text>,
    });
    if (issue.progress && issue.progress.total > 0) {
      const bar = progressBar(issue.progress.closed, issue.progress.total, glyphs);
      grid.push({
        label: 'progress',
        value: (
          <Text>
            <Text color={getStatusColor(issue.displayStatus, theme)}>{bar.done}</Text>
            <Text {...ink.rule}>{bar.rest}</Text>
            <Text {...ink.dim}> {issue.progress.percent} %</Text>
          </Text>
        ),
      });
    }
    if (issue.assignee) {
      grid.push({ label: 'assignee', value: <Text color={theme.colors.success}>{fitToWidth(`@${issue.assignee}`, valueWidth, glyphs.ellipsis)}</Text> });
    }
    if (issue.labels && issue.labels.length > 0) {
      grid.push({ label: 'labels', value: <Text {...ink.dim}>{fitToWidth(issue.labels.map(label => `#${label}`).join(' '), valueWidth, glyphs.ellipsis)}</Text> });
    }
    if (issue.blockedBy && issue.blockedBy.length > 0) {
      grid.push({ label: 'blocked by', value: <Text color={theme.colors.statusBlocked}>{fitToWidth(issue.blockedBy.join(', '), valueWidth, glyphs.ellipsis)}</Text> });
    }
    if (issue.blocks && issue.blocks.length > 0) {
      grid.push({ label: 'blocks', value: <Text {...ink.dim}>{fitToWidth(issue.blocks.join(', '), valueWidth, glyphs.ellipsis)}</Text> });
    }
    if (issue.parent) {
      grid.push({ label: 'parent', value: <Text {...ink.dim}>{fitToWidth(issue.parent, valueWidth, glyphs.ellipsis)}</Text> });
    }
  }

  const subtaskRows = children.length === 0
    ? 0
    : 2 + Math.min(children.length, SUBTASKS_SHOWN) + (children.length > SUBTASKS_SHOWN ? 1 : 0);
  const stampRows = 1 + 2 + (issue?.closed_at ? 1 : 0);
  const description = issue?.description || '';
  // Title, [id], blank, grid, rule, [description], subtasks, stamps, [keys].
  const fixedRows = titleLines.length + (hosted ? 1 : 2) + grid.length + (description ? 1 : 0)
    + subtaskRows + stampRows + (hosted ? 0 : 1);
  const room = maxHeight === undefined
    ? DEFAULT_DESCRIPTION_ROWS
    : Math.max(1, maxHeight - fixedRows);

  const lines = useMemo(
    () => descriptionLines(description, inner, glyphs, markdown),
    [description, inner, glyphs, markdown],
  );
  useEffect(() => setDescriptionOffset(0), [markdown]);
  const roomyPage = pageLines(lines, room, descriptionOffset);
  // A description that does not fit says so on its last row, whether or not
  // the arrow keys page it here.
  const paged = roomyPage.hasPrevious || roomyPage.hasMore;
  const descriptionPage = paged
    ? pageLines(lines, Math.max(1, room - 1), descriptionOffset)
    : roomyPage;

  // The arrows page only where the panel owns them; PgUp/PgDn page everywhere.
  useInput((_input, key) => {
    if (!description) return;
    if ((enablePaging && key.downArrow) || key.pageDown) setDescriptionOffset(descriptionPage.nextOffset);
    if ((enablePaging && key.upArrow) || key.pageUp) setDescriptionOffset(descriptionPage.previousOffset);
  }, { isActive: pagingIsActive });

  if (!issue) {
    return (
      <Frame width={availableWidth} height={maxHeight} theme={theme} glyphs={glyphs} hosted={hosted}>
        <Text {...ink.dim} italic>No issue selected</Text>
        <Text {...ink.faint}>Select an issue with the arrow keys</Text>
      </Frame>
    );
  }

  const label = (text: string) => <Text {...ink.faint}>{padEndCells(text, LABEL_WIDTH)}</Text>;
  const stamp = (name: string, iso: string) => (
    <Text key={name} wrap="truncate-end">
      {label(name)}
      <Text {...ink.rule}>{formatStamp(iso)}</Text>
    </Text>
  );

  return (
    <Frame width={availableWidth} height={maxHeight} theme={theme} glyphs={glyphs} hosted={hosted}>
      {titleLines.map((line, index) => (
        <Text key={index} bold {...ink.strong} wrap="truncate-end">{line}</Text>
      ))}
      {hosted ? null : <Text {...ink.dim} wrap="truncate-end">{fitToWidth(issue.id, inner, glyphs.ellipsis)}</Text>}
      <Text> </Text>

      {grid.map(row => (
        <Text key={row.label} wrap="truncate-end">
          {label(row.label)}
          {row.value}
        </Text>
      ))}

      {description ? (
        <Box flexDirection="column" flexShrink={0}>
          <Text {...ink.rule}>{glyphs.treeDash.repeat(inner)}</Text>
          {descriptionPage.lines.map((line, index) => (
            <Text key={index} {...ink.text}>
              {line.length === 0 ? ' ' : line.map((span, spanIndex) => (
                <Text key={spanIndex} {...roleStyle(span.role, theme)}>{span.text}</Text>
              ))}
            </Text>
          ))}
          {paged && (
            <Text wrap="truncate-end">
              <Text {...ink.faint}>
                {descriptionPage.hasPrevious ? `${glyphs.scrollUp} ${descriptionPage.above} above` : ''}
                {descriptionPage.hasPrevious && descriptionPage.hasMore ? '  ' : ''}
                {descriptionPage.hasMore ? `${glyphs.scrollDown} ${descriptionPage.remaining} more line${descriptionPage.remaining === 1 ? '' : 's'}` : ''}
              </Text>
              {enablePaging ? null : <Text {...ink.rule}>  pgup/pgdn</Text>}
            </Text>
          )}
        </Box>
      ) : null}

      {children.length > 0 && (
        <Box flexDirection="column" flexShrink={0}>
          <Text> </Text>
          <Text wrap="truncate-end">
            <Text {...ink.faint}>subtasks </Text>
            <Text {...ink.dim}>{issue.progress?.closed ?? 0}/{children.length}</Text>
          </Text>
          {children.slice(0, SUBTASKS_SHOWN).map(id => {
            const child = byId.get(id);
            const glyph = child ? statusGlyph(child, glyphs) : glyphs.statusOther;
            const color = child ? getStatusColor(child.displayStatus, theme) : theme.colors.statusOther;
            const head = `${glyph} ${id} `;
            return (
              <Text key={id} wrap="truncate-end">
                <Text color={color}>{glyph}</Text>
                <Text {...ink.text}> {id} </Text>
                <Text {...ink.faint}>
                  {fitToWidth(child?.title ?? '', Math.max(0, inner - Bun.stringWidth(head)), glyphs.ellipsis)}
                </Text>
              </Text>
            );
          })}
          {children.length > SUBTASKS_SHOWN && (
            <Text {...ink.rule}>{glyphs.ellipsis} {children.length - SUBTASKS_SHOWN} more</Text>
          )}
        </Box>
      )}

      <Box flexDirection="column" flexShrink={0}>
        <Text> </Text>
        {stamp('created', issue.created_at)}
        {stamp('updated', issue.updated_at)}
        {issue.closed_at ? stamp('closed', issue.closed_at) : null}
      </Box>

      {hosted ? null : (
        <Text wrap="truncate-end">
          <Text {...ink.strong}>e</Text><Text {...ink.faint}> edit  </Text>
          <Text {...ink.strong}>x</Text><Text {...ink.faint}> export  </Text>
          {description ? <><Text {...ink.strong}>m</Text><Text {...ink.faint}>{markdown ? ' source  ' : ' markdown  '}</Text></> : null}
          <Text {...ink.strong}>esc</Text><Text {...ink.faint}> close</Text>
        </Text>
      )}
    </Frame>
  );
}
