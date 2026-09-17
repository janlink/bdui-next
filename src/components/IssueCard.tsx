import React from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import type { Issue } from '../types';
import { useBeadsStore } from '../state/store';
import { fitToWidth } from '../utils/cells';
import {
  PRIORITY_LABELS,
  getPriorityColor,
  getTypeColor,
  LAYOUT,
} from '../utils/constants';

const BORDER = 2;
const PADDING = 1;

interface IssueCardProps {
  issue: Issue;
  isSelected?: boolean;
  width?: number;
}

export function IssueCard({ issue, isSelected = false, width = LAYOUT.columnWidth - 2 }: IssueCardProps) {
  const glyphs = useBeadsStore(state => state.glyphs);
  const theme = useBeadsStore(state => state.theme);

  const priorityColor = getPriorityColor(issue.priority, theme);
  const typeColor = getTypeColor(issue.issue_type, theme);
  const priorityLabel = PRIORITY_LABELS[issue.priority] || 'Unknown';
  // Ink truncates with an ellipsis of its own choosing, which no tier below
  // fancy can draw, so every field that can overrun is cut here instead.
  const content = width - BORDER - PADDING * 2;
  const fit = (text: string, room: number) => fitToWidth(text, room, glyphs.ellipsis);
  const extraLabels = (issue.labels?.length ?? 0) - 2;

  return (
    <Box
      borderStyle={glyphs.border('round')}
      borderColor={isSelected ? theme.colors.primary : theme.colors.border}
      paddingX={1}
      flexDirection="column"
      width={width}
    >
      <Box flexDirection="column">
        <Text bold color={isSelected ? theme.colors.primary : theme.colors.text}>
          {fit(issue.title, content)}
        </Text>
        <Text color={theme.colors.textDim}>{issue.id}</Text>
      </Box>

      <Box gap={1}>
        <Text color={typeColor}>{issue.issue_type}</Text>
        <Text color={theme.colors.textDim}>|</Text>
        <Text color={priorityColor}>P{issue.priority}</Text>
        <Text color={theme.colors.textDim}>
          {fit(`(${priorityLabel.toLowerCase()})`, content - stringWidth(issue.issue_type) - 6)}
        </Text>
      </Box>

      {issue.displayStatus === 'other' && (
        <Text color={theme.colors.textDim}>Status: {issue.status}</Text>
      )}

      {issue.assignee && (
        <Box gap={1}>
          <Text color={theme.colors.textDim}>@</Text>
          <Text color={theme.colors.success}>{fit(issue.assignee, content - 2)}</Text>
        </Box>
      )}

      {issue.labels && issue.labels.length > 0 && (
        <Box gap={1}>
          <Text color={theme.colors.textDim}>#</Text>
          <Text color={theme.colors.textDim}>
            {fit(
              issue.labels.slice(0, 2).join(', '),
              content - 2 - (extraLabels > 0 ? stringWidth(`+${extraLabels}`) + 1 : 0),
            )}
          </Text>
          {extraLabels > 0 && <Text color={theme.colors.textDim}>+{extraLabels}</Text>}
        </Box>
      )}

      {issue.blockedBy && issue.blockedBy.length > 0 && (
        <Box>
          <Text color={theme.colors.statusBlocked}>
            [!] Blocked by {issue.blockedBy.length}
          </Text>
        </Box>
      )}

      {issue.progress && (
        <Box gap={1}>
          <Text color={theme.colors.textDim}>Progress</Text>
          <Text color={issue.progress.closed === issue.progress.total ? theme.colors.success : theme.colors.primary}>
            {issue.progress.closed}/{issue.progress.total} ({issue.progress.percent}%)
          </Text>
        </Box>
      )}
    </Box>
  );
}
