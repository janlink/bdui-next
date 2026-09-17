import React from 'react';
import { Text } from 'ink';
import stringWidth from 'string-width';
import { getTypeColor, getStatusColor, getPriorityColor, rowLayout } from '../utils/constants';
import { fitFromRight, fitToWidth, keepLastCells, padEndCells, padStartCells } from '../utils/cells';
import type { GlyphSet } from '../session/glyphs';
import type { Ladder, Theme, TextStyle } from '../themes/themes';
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

/** The glyph column shows the fold state of a parent and the status of a leaf. */
export function rowGlyph(node: FlatNode, glyphs: GlyphSet): string {
  if (node.hasChildren) return node.collapsed ? glyphs.caretCollapsed : glyphs.caretExpanded;
  return statusGlyph(node.issue, glyphs);
}

export interface RowMeta {
  text: string;
  color?: string;
  style?: TextStyle;
}

// The meta column answers "how far" for a parent and "what is it waiting on"
// for a leaf. An open leaf has nothing to wait on, so the column spells out the
// priority the gutter only colours.
export function rowMeta(issue: Issue, theme: Theme, ink: Ladder): RowMeta {
  const progress = issue.progress;
  if (progress && progress.total > 0) {
    return { text: `${progress.closed}/${progress.total}`, color: getStatusColor(issue.displayStatus, theme) };
  }
  if (issue.displayStatus === 'blocked') return { text: 'blocked', color: theme.colors.statusBlocked };
  switch (issue.status) {
    case 'in_progress': return { text: `P${issue.priority} in progress`, color: theme.colors.statusInProgress };
    case 'closed': return { text: 'closed', style: ink.rule };
    case 'open': return { text: `P${issue.priority}`, style: ink.faint };
    default: return { text: statusWord(issue), style: ink.faint };
  }
}

function branchOf(node: FlatNode, glyphs: GlyphSet): string {
  const stem = node.prefix.replaceAll('│', glyphs.treeVertical);
  if (node.depth === 0) return stem;
  const join = node.isLast ? glyphs.treeLast : glyphs.treeBranch;
  return `${stem}${join}${glyphs.treeDash} `;
}

const NO_SELECTION = {} as const;

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

  const lead = keepLastCells(branchOf(node, glyphs), grid.id - 1);
  const idRoom = grid.id - stringWidth(lead) - 1;
  const id = padEndCells(fitFromRight(issue.id, idRoom, glyphs.ellipsis), idRoom + 1);

  const closed = issue.status === 'closed';
  const epic = issue.issue_type === 'epic';
  const typeText = issue.issue_type && issue.issue_type !== 'task' ? `${issue.issue_type} ` : '';
  const titleWidth = Math.max(0, grid.title - stringWidth(typeText));
  const title = padEndCells(
    fitToWidth(issue.title || issue.id, titleWidth, glyphs.ellipsis),
    titleWidth,
  );
  const titleInk = rung(closed ? ink.dim : epic ? ink.strong : ink.text);

  const glyphInk = node.hasChildren
    ? rung(ink.dim)
    : { color: hue(getStatusColor(issue.displayStatus, theme)) };
  const typeInk = closed ? rung(ink.faint) : { color: hue(getTypeColor(issue.issue_type, theme)) };
  const meta = rowMeta(issue, theme, ink);
  const metaInk = meta.style ? rung(meta.style) : { color: hue(meta.color ?? '') };

  return (
    <Text {...(isSelected ? theme.selection : NO_SELECTION)} wrap="truncate-end">
      <Text color={hue(getPriorityColor(issue.priority, theme))}>
        {padEndCells(gutterVisible ? glyphs.gutter : ' ', grid.gutter)}
      </Text>
      <Text {...glyphInk}>{padEndCells(rowGlyph(node, glyphs), grid.status)}</Text>
      <Text>{' '.repeat(grid.gap)}</Text>
      <Text {...rung(ink.rule)}>{lead}</Text>
      <Text {...rung(ink.dim)}>{id}</Text>
      {typeText ? <Text {...typeInk}>{typeText}</Text> : null}
      <Text {...titleInk} bold={titleInk.bold || (epic && !closed)}>{title}</Text>
      <Text {...metaInk}>
        {padStartCells(fitToWidth(meta.text, grid.meta, glyphs.ellipsis), grid.meta)}
      </Text>
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
