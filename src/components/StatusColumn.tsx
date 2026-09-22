import React from 'react';
import { Box, Text } from 'ink';
import type { Issue } from '../types';
import { IssueCard } from './IssueCard';
import { useBeadsStore } from '../state/store';
import { LAYOUT, getStatusColor } from '../utils/constants';
import { Rule, words } from './Rule';

// A collapsed column keeps this many cells: one of padding, one letter, one of
// padding, so its spine lines up with the padded content of a full column.
export const STRIP_WIDTH = 3;

interface StatusColumnProps {
  title: string;
  issues: Issue[];
  isActive: boolean;
  selectedIndex: number;
  scrollOffset: number;
  itemsPerPage: number;
  statusKey: string;
  width?: number;
  collapsed?: boolean;
}

// The column is a labelled rule over a stack of cards. The global header carries
// the position and the footer the paging, so the column keeps neither; it spends
// one row on its name and gives the rest to whole cards, drawn without a gap so
// the band that runs down each card is the only thing between one and the next.
// A collapsed column drops to a spine of vertical letters, its count below, so an
// empty or windowed-out column stays in place at a fraction of the width.
export function StatusColumn({
  title,
  issues,
  isActive,
  selectedIndex,
  scrollOffset,
  itemsPerPage,
  statusKey,
  width = LAYOUT.columnWidth,
  collapsed = false,
}: StatusColumnProps) {
  const glyphs = useBeadsStore(state => state.glyphs);
  const theme = useBeadsStore(state => state.theme);
  const headColor = isActive ? theme.colors.primary : getStatusColor(statusKey, theme);

  if (collapsed) {
    const letters = [...title.replace(/\s+/g, '')];
    const count = issues.length > 0 ? [...String(issues.length)] : [];
    return (
      <Box flexDirection="column" width={STRIP_WIDTH} paddingX={1}>
        {letters.map((letter, index) => (
          <Text key={`l${index}`} color={headColor} bold={isActive}>{letter}</Text>
        ))}
        {count.length > 0 ? <Text {...theme.ink.faint}>{glyphs.rule}</Text> : null}
        {count.map((digit, index) => (
          <Text key={`c${index}`} {...theme.ink.dim}>{digit}</Text>
        ))}
      </Box>
    );
  }

  const visibleIssues = issues.slice(scrollOffset, scrollOffset + itemsPerPage);
  const inner = width - 2;

  return (
    <Box flexDirection="column" paddingX={1} width={width}>
      <Rule
        width={inner}
        left={words([[{ text: `${title} (${issues.length})`, style: { color: headColor, bold: true } }]], glyphs)}
        theme={theme}
        glyphs={glyphs}
      />
      <Box flexDirection="column">
        {visibleIssues.map((issue, idx) => {
          const absoluteIndex = scrollOffset + idx;
          const isSelected = isActive && absoluteIndex === selectedIndex;
          return (
            <IssueCard
              key={issue.id}
              issue={issue}
              isSelected={isSelected}
              width={inner}
              bandBreak={idx !== 0}
            />
          );
        })}
      </Box>
    </Box>
  );
}
