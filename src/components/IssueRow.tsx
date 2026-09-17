import React from 'react';
import { Text } from 'ink';
import stringWidth from 'string-width';
import { getTypeColor, getStatusColor, getPriorityColor, rowLayout } from '../utils/constants';
import { fitFromRight, fitToWidth, keepLastCells, padEndCells, padStartCells } from '../utils/cells';
import type { GlyphSet } from '../session/glyphs';
import type { Theme, TextStyle } from '../themes/themes';
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
  const filled = progress.closed === 0
    ? 0
    : Math.max(1, Math.round((progress.closed / progress.total) * PROGRESS_SEGMENTS));
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
  // Inverse swaps foreground and background per span, so a selected row that
  // kept its hues would paint its one surface in as many colours as it has
  // spans. It gives them up instead and keeps the attributes.
  const flat = isSelected && theme.depth === 'ansi16';
  const hue = (color: string): string | undefined => (flat ? undefined : color);
  const rung = (style: TextStyle): TextStyle | { bold?: boolean; dimColor?: boolean } =>
    (flat ? { bold: style.bold, dimColor: style.dimColor } : style);

  const lead = keepLastCells(`${branchOf(node, glyphs)}${caretOf(node, glyphs)}`, grid.id - 1);
  const idRoom = grid.id - stringWidth(lead) - 1;
  const id = padEndCells(fitFromRight(issue.id, idRoom, glyphs.ellipsis), idRoom + 1);

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
      <Text color={hue(getPriorityColor(issue.priority, theme))}>
        {padEndCells(gutterVisible ? glyphs.gutter : ' ', grid.gutter)}
      </Text>
      <Text color={hue(statusColor)}>{padEndCells(statusGlyph(issue, glyphs), grid.status)}</Text>
      <Text>{' '.repeat(grid.gap)}</Text>
      <Text {...rung(ink.rule)}>{lead}</Text>
      <Text {...rung(ink.dim)}>{id}</Text>
      {typeText ? <Text color={hue(getTypeColor(issue.issue_type, theme))}>{typeText}</Text> : null}
      <Text {...rung(titleStyle)}>{title}</Text>
      {bar ? (
        <Text>
          {' '.repeat(Math.max(0, grid.meta - stringWidth(bar.done + bar.rest)))}
          <Text color={hue(statusColor)}>{bar.done}</Text>
          <Text {...rung(ink.rule)}>{bar.rest}</Text>
        </Text>
      ) : (
        <Text {...rung(ink.faint)}>
          {padStartCells(fitToWidth(statusWord(issue), grid.meta, glyphs.ellipsis), grid.meta)}
        </Text>
      )}
    </Text>
  );
}

interface HeaderProps {
  theme: Theme;
  glyphs: GlyphSet;
  width: number;
}

// The header reads the same grid the row does; deriving its edges separately is
// what put it one cell beside the titles before.
export function ListHeader({ theme, glyphs, width }: HeaderProps) {
  const grid = rowLayout(width, glyphs);
  return (
    <Text {...theme.ink.faint} wrap="truncate-end">
      {' '.repeat(grid.gutter + grid.status + grid.gap)}
      {padEndCells('ID', grid.id)}
      {padEndCells('TITLE', grid.title)}
      {padStartCells('STATUS', grid.meta)}
    </Text>
  );
}

export const ListRow = React.memo(ListRowImpl);
