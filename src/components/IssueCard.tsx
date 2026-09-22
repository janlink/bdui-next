import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import type { Issue } from '../types';
import { useBeadsStore } from '../state/store';
import { cellWidthOf } from '../session/glyphs';
import { fitToWidth, padEndCells } from '../utils/cells';
import { wrapTitle } from './DetailPanel';
import {
  getPriorityColor,
  getStatusColor,
  getTypeColor,
  LAYOUT,
} from '../utils/constants';
import type { Ladder, TextStyle, Theme } from '../themes/themes';

// A card is three fixed rows so the board pages in whole cards. A status band
// runs down its left edge and breaks at the top of every following card, which
// is what sets one card off from the next without spending a row on a rule.

// "P0".."P4" padded to a fixed gutter beside the band, so titles start at one
// column on every card.
const PRIORITY_COLUMN = 3;

const NO_SELECTION = {} as const;

interface IssueCardProps {
  issue: Issue;
  isSelected?: boolean;
  width?: number;
  /** A following card breaks its band at the top; the first visible one keeps it. */
  bandBreak?: boolean;
}

interface CardMeta {
  text: string;
  color?: string;
  style?: TextStyle;
}

// One right-aligned fact answers the card's most pressing question and the rest
// waits in the detail panel: a parent's progress, then what a leaf is waiting on.
function cardMeta(issue: Issue, theme: Theme, ink: Ladder): CardMeta {
  const progress = issue.progress;
  if (progress && progress.total > 0) {
    return { text: `${progress.closed}/${progress.total}`, color: getStatusColor(issue.displayStatus, theme) };
  }
  if (issue.blockedBy && issue.blockedBy.length > 0) {
    return { text: `blocked ${issue.blockedBy.length}`, color: theme.colors.statusBlocked };
  }
  if (issue.assignee) return { text: `@${issue.assignee}`, color: theme.colors.success };
  if (issue.labels && issue.labels.length > 0) {
    const extra = issue.labels.length - 1;
    return { text: `#${issue.labels[0]}${extra > 0 ? ` +${extra}` : ''}`, style: ink.faint };
  }
  return { text: '' };
}

export function IssueCard({
  issue,
  isSelected = false,
  width = LAYOUT.columnWidth - 2,
  bandBreak = false,
}: IssueCardProps) {
  const glyphs = useBeadsStore(state => state.glyphs);
  const theme = useBeadsStore(state => state.theme);

  const ink = isSelected ? theme.inkSelected : theme.ink;
  // Inverse swaps foreground and background per span, so a selected 16-colour
  // card that kept its hues would break its one surface into as many colours as
  // it has spans. It drops the hues and keeps the attributes instead.
  const flat = isSelected && theme.depth === 'ansi16';
  const hue = (color: string): string | undefined => (flat ? undefined : color);
  const rung = (style: TextStyle): TextStyle | { bold?: boolean; dimColor?: boolean } =>
    (flat ? { bold: style.bold, dimColor: style.dimColor } : style);

  const bandCells = cellWidthOf([glyphs.band, glyphs.gutter]);
  const content = Math.max(0, width - bandCells - PRIORITY_COLUMN);

  const [titleLine1 = '', titleLine2 = ''] = wrapTitle(issue.title || issue.id, content, glyphs.ellipsis, 2);
  const epic = issue.issue_type === 'epic';
  const closed = issue.status === 'closed';
  const titleInk = rung(closed ? ink.dim : epic ? ink.strong : ink.text);

  // The band is the only channel the selection has left at `none`, where a
  // surface paints nothing: a heavier glyph for the selected card, the thin one
  // otherwise. Selection also draws the band on the top row a follower breaks.
  const bandGlyph = isSelected ? glyphs.gutter : glyphs.band;
  const bandColor = isSelected
    ? hue(theme.colors.primary)
    : hue(getStatusColor(issue.displayStatus, theme));
  const band = (draw: boolean) => (
    <Text color={bandColor}>{padEndCells(draw ? bandGlyph : '', bandCells)}</Text>
  );
  const prioBlank = ' '.repeat(PRIORITY_COLUMN);
  const priorityInk = { color: hue(getPriorityColor(issue.priority, theme)) };

  // Right-aligned meta first, then id and type share what is left of the row.
  const meta = cardMeta(issue, theme, ink);
  const metaCells = Math.min(stringWidth(meta.text), Math.max(0, content - 2));
  const metaText = metaCells > 0 ? fitToWidth(meta.text, metaCells, glyphs.ellipsis) : '';
  const metaInk = meta.style ? rung(meta.style) : { color: hue(meta.color ?? theme.colors.textDim) };

  const leftRoom = content - stringWidth(metaText);
  const idShown = fitToWidth(issue.id, leftRoom, glyphs.ellipsis);
  const afterId = leftRoom - stringWidth(idShown);
  const typeShown = afterId >= 2 && issue.issue_type
    ? fitToWidth(issue.issue_type, afterId - 1, glyphs.ellipsis)
    : '';
  const sep = typeShown ? ' ' : '';
  const filler = ' '.repeat(Math.max(0, leftRoom - stringWidth(idShown) - sep.length - stringWidth(typeShown)));

  const line = (children: React.ReactNode) => (
    <Text {...(isSelected ? theme.selection : NO_SELECTION)} wrap="truncate-end">
      {children}
    </Text>
  );

  return (
    <Box flexDirection="column" width={width}>
      {line(
        <>
          {band(isSelected || !bandBreak)}
          <Text {...priorityInk}>{padEndCells(`P${issue.priority}`, PRIORITY_COLUMN)}</Text>
          <Text {...titleInk} bold={epic && !closed}>{padEndCells(titleLine1, content)}</Text>
        </>,
      )}
      {line(
        <>
          {band(true)}
          <Text>{prioBlank}</Text>
          <Text {...titleInk} bold={epic && !closed}>{padEndCells(titleLine2, content)}</Text>
        </>,
      )}
      {line(
        <>
          {band(true)}
          <Text>{prioBlank}</Text>
          <Text {...rung(ink.dim)}>{idShown}</Text>
          {typeShown ? <Text>{sep}</Text> : null}
          {typeShown
            ? <Text {...(closed ? rung(ink.faint) : { color: hue(getTypeColor(issue.issue_type, theme)) })}>{typeShown}</Text>
            : null}
          <Text>{filler}</Text>
          <Text {...metaInk}>{metaText}</Text>
        </>,
      )}
    </Box>
  );
}
