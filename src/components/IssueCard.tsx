import React from 'react';
import { Box, Text } from 'ink';
import type { Issue } from '../types';
import { useBeadsStore } from '../state/store';
import {
  PRIORITY_LABELS,
  getPriorityColor,
  getTypeColor,
  LAYOUT,
} from '../utils/constants';

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

  return (
    <Box
      borderStyle={glyphs.border('round')}
      borderColor={isSelected ? theme.colors.primary : theme.colors.border}
      paddingX={1}
      flexDirection="column"
      width={width}
    >
      <Box flexDirection="column">
        <Text bold wrap="truncate-end" color={isSelected ? theme.colors.primary : theme.colors.text}>
          {issue.title}
        </Text>
        <Text color={theme.colors.textDim}>{issue.id}</Text>
      </Box>

      <Box gap={1}>
        <Text color={typeColor}>{issue.issue_type}</Text>
        <Text color={theme.colors.textDim}>|</Text>
        <Text color={priorityColor}>P{issue.priority}</Text>
        <Text color={theme.colors.textDim} wrap="truncate-end">({priorityLabel.toLowerCase()})</Text>
      </Box>

      {issue.displayStatus === 'other' && (
        <Text color={theme.colors.textDim}>Status: {issue.status}</Text>
      )}

      {issue.assignee && (
        <Box gap={1}>
          <Text color={theme.colors.textDim}>@</Text>
          <Text color={theme.colors.success} wrap="truncate-end">{issue.assignee}</Text>
        </Box>
      )}

      {issue.labels && issue.labels.length > 0 && (
        <Box gap={1}>
          <Text color={theme.colors.textDim}>#</Text>
          <Text color={theme.colors.textDim} wrap="truncate-end">{issue.labels.slice(0, 2).join(', ')}</Text>
          {issue.labels.length > 2 && (
            <Text color={theme.colors.textDim}>+{issue.labels.length - 2}</Text>
          )}
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
