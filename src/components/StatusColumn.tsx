import React from 'react';
import { Box } from 'ink';
import type { Issue } from '../types';
import { IssueCard } from './IssueCard';
import { useBeadsStore } from '../state/store';
import { LAYOUT, getStatusColor } from '../utils/constants';
import { Rule, words } from './Rule';

interface StatusColumnProps {
  title: string;
  issues: Issue[];
  isActive: boolean;
  selectedIndex: number;
  scrollOffset: number;
  itemsPerPage: number;
  statusKey: string;
  width?: number;
}

// The column is a labelled rule over a stack of cards. The global header carries
// the position and the footer the paging, so the column keeps neither; it spends
// one row on its name and gives the rest to whole cards, drawn without a gap so
// the band that runs down each card is the only thing between one and the next.
export function StatusColumn({
  title,
  issues,
  isActive,
  selectedIndex,
  scrollOffset,
  itemsPerPage,
  statusKey,
  width = LAYOUT.columnWidth,
}: StatusColumnProps) {
  const glyphs = useBeadsStore(state => state.glyphs);
  const theme = useBeadsStore(state => state.theme);

  const visibleIssues = issues.slice(scrollOffset, scrollOffset + itemsPerPage);
  const headColor = isActive ? theme.colors.primary : getStatusColor(statusKey, theme);
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
