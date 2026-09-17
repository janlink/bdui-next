import React from 'react';
import { Text } from 'ink';
import stringWidth from 'string-width';
import { getTypeColor, getStatusColor, getPriorityColor, rowLayout } from '../utils/constants';
import type { GlyphSet } from '../session/glyphs';
import type { Theme } from '../themes/themes';
import type { FlatNode } from '../utils/tree';
import type { Issue } from '../types';

// Ink tokenizes, wraps and slices every text node once per frame, so a row costs
// far less as a single text node with nested spans than as a Box of siblings.
// Rows are memoized on top of that: moving the cursor then redraws two rows
// instead of the whole window.

interface RowProps {
  node: FlatNode;
  isSelected: boolean;
  theme: Theme;
  glyphs: GlyphSet;
  width: number;
}

/** Segments the progress bar is drawn in, whatever the issue's child count. */
export const PROGRESS_SEGMENTS = 6;

// Blocked is a presentation status, so it wins over the raw one.
export function statusGlyph(issue: Issue, glyphs: GlyphSet): string {
  if (issue.displayStatus === 'blocked') return glyphs.statusBlocked;
  switch (issue.status) {
    case 'open': return glyphs.statusOpen;
    case 'in_progress': return glyphs.statusInProgress;
    case 'closed': return glyphs.statusClosed;
    case 'deferred': return glyphs.statusDeferred;
    default: return glyphs.statusOther;
  }
}

export function statusWord(issue: Issue): string {
  if (issue.displayStatus === 'blocked') return 'blocked';
  return issue.status.replace('_', ' ');
}

// Every fit and pad below counts display cells, not code units, so a wide
// character cannot push a row past the terminal edge.
function fitToWidth(text: string, width: number, ellipsis: string): string {
  if (width <= 0) return '';
  if (stringWidth(text) <= width) return text;

  const room = width - stringWidth(ellipsis);
  let fitted = '';
  let used = 0;
  for (const character of text) {
    const characterWidth = stringWidth(character);
    if (used + characterWidth > room) break;
    fitted += character;
    used += characterWidth;
  }
  return `${fitted}${ellipsis}`;
}

// An id's tail is what distinguishes siblings, its head is what says which tree
// it belongs to. Truncating cannot keep both, and in an indented list the tail
// is the part the eye needs.
function fitIdFromLeft(id: string, width: number, ellipsis: string): string {
  if (width <= 0) return '';
  if (stringWidth(id) <= width) return id;

  const room = width - stringWidth(ellipsis);
  let fitted = '';
  let used = 0;
  for (const character of [...id].reverse()) {
    const characterWidth = stringWidth(character);
    if (used + characterWidth > room) break;
    fitted = character + fitted;
    used += characterWidth;
  }
  return `${ellipsis}${fitted}`;
}

function padEndCells(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - stringWidth(text)));
}

function padStartCells(text: string, width: number): string {
  return ' '.repeat(Math.max(0, width - stringWidth(text))) + text;
}

function padGlyph(glyph: string, width: number): string {
  return glyph + ' '.repeat(Math.max(0, width - stringWidth(glyph)));
}

function branchOf(node: FlatNode, glyphs: GlyphSet): string {
  const stem = node.prefix.replaceAll('│', glyphs.treeVertical);
  if (node.depth === 0) return stem;
  const join = node.isLast ? glyphs.treeLast : glyphs.treeBranch;
  return `${stem}${join}${glyphs.treeDash} `;
}

function caretOf(node: FlatNode, glyphs: GlyphSet): string {
  if (!node.hasChildren) return '  ';
  return `${node.collapsed ? glyphs.caretCollapsed : glyphs.caretExpanded} `;
}

interface Bar {
  done: string;
  rest: string;
}

const NO_SELECTION = {} as const;

function progressBar(issue: Issue, glyphs: GlyphSet): Bar | null {
  const progress = issue.progress;
  if (!progress || progress.total === 0) return null;
  // A started epic keeps at least one filled segment, so "some" never rounds
  // down to the same picture as "none".
  const filled = Math.max(1, Math.round((progress.closed / progress.total) * PROGRESS_SEGMENTS));
  return {
    done: glyphs.barDone.repeat(filled),
    rest: glyphs.barEmpty.repeat(PROGRESS_SEGMENTS - filled),
  };
}

function ListRowImpl({ node, isSelected, theme, glyphs, width }: RowProps) {
  const { issue } = node;
  const grid = rowLayout(width, glyphs);
  const ink = isSelected ? theme.inkSelected : theme.ink;
  // With no colour left to spend, the gutter is the only channel the selection
  // can still use.
  const gutterVisible = theme.depth !== 'none' || isSelected;

  const lead = `${branchOf(node, glyphs)}${caretOf(node, glyphs)}`;
  const idRoom = Math.max(0, grid.id - stringWidth(lead) - 1);
  const id = padEndCells(fitIdFromLeft(issue.id, idRoom, glyphs.ellipsis), idRoom + 1);

  const typeText = issue.issue_type && issue.issue_type !== 'task' ? `${issue.issue_type} ` : '';
  const titleWidth = Math.max(0, grid.title - stringWidth(typeText));
  const title = padEndCells(
    fitToWidth(issue.title || issue.id, titleWidth, glyphs.ellipsis),
    titleWidth,
  );

  const bar = progressBar(issue, glyphs);
  const statusColor = getStatusColor(issue.displayStatus, theme);
  const titleStyle = issue.status === 'closed' ? ink.dim : ink.text;

  return (
    <Text {...(isSelected ? theme.selection : NO_SELECTION)} wrap="truncate-end">
      <Text color={getPriorityColor(issue.priority, theme)}>
        {padGlyph(gutterVisible ? glyphs.gutter : ' ', grid.gutter)}
      </Text>
      <Text color={statusColor}>{padGlyph(statusGlyph(issue, glyphs), grid.status)}</Text>
      <Text>{' '.repeat(grid.gap)}</Text>
      <Text {...ink.rule}>{lead}</Text>
      <Text {...ink.dim}>{id}</Text>
      {typeText ? <Text color={getTypeColor(issue.issue_type, theme)}>{typeText}</Text> : null}
      <Text {...titleStyle}>{title}</Text>
      {bar ? (
        <Text>
          {' '.repeat(Math.max(0, grid.meta - stringWidth(bar.done + bar.rest)))}
          <Text color={statusColor}>{bar.done}</Text>
          <Text {...ink.rule}>{bar.rest}</Text>
        </Text>
      ) : (
        <Text {...ink.faint}>
          {padStartCells(fitToWidth(statusWord(issue), grid.meta, glyphs.ellipsis), grid.meta)}
        </Text>
      )}
    </Text>
  );
}

export const ListRow = React.memo(ListRowImpl);
