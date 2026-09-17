import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Issue } from '../types';
import { useBeadsStore } from '../state/store';
import {
  PRIORITY_LABELS,
  getPriorityColor,
  getTypeColor,
  getStatusColor,
} from '../utils/constants';

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function wrapDescriptionLine(line: string, lineWidth: number): string[] {
  if (!line) return [''];

  const graphemes = Array.from(graphemeSegmenter.segment(line), ({ segment }) => segment);
  const wrapped: string[] = [];
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

    if (end < graphemes.length) {
      for (let index = end - 1; index >= start; index -= 1) {
        if (/\s/u.test(graphemes[index])) {
          end = index + 1;
          break;
        }
      }
    }

    wrapped.push(graphemes.slice(start, end).join(''));
    start = end;
  }

  return wrapped;
}

export function getDescriptionPage(
  description: string,
  lineWidth: number,
  pageSize: number,
  offset: number,
) {
  const lines = description
    .split('\n')
    .flatMap(line => wrapDescriptionLine(line, lineWidth));
  const safeOffset = Math.min(offset, Math.max(0, lines.length - 1));
  const endOffset = Math.min(safeOffset + pageSize, lines.length);
  return {
    lines: lines.slice(safeOffset, endOffset),
    nextOffset: endOffset < lines.length ? endOffset : safeOffset,
    previousOffset: Math.max(0, safeOffset - pageSize),
    hasMore: endOffset < lines.length,
    hasPrevious: safeOffset > 0,
  };
}

interface DetailPanelProps {
  issue: Issue | null;
  maxHeight?: number;
  availableWidth?: number;
  // Side-by-side layouts navigate the list with the arrow keys, so the panel
  // there is a passive follower: no arrow-driven description paging.
  enablePaging?: boolean;
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

export function DetailPanel({ issue, maxHeight, availableWidth = 50, enablePaging = true }: DetailPanelProps) {
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

  const [descriptionOffset, setDescriptionOffset] = useState(0);
  // The border and horizontal padding consume four cells. Reserve eight rows
  // for the same vertical chrome and header; reserve one more only when the
  // paging hint is actually needed.
  const descriptionWidth = Math.max(1, availableWidth - 4);
  const roomyPageSize = maxHeight ? Math.max(1, maxHeight - 8) : 8;
  const roomyPage = getDescriptionPage(
    issue?.description || '',
    descriptionWidth,
    roomyPageSize,
    descriptionOffset,
  );
  const descriptionPage = (roomyPage.hasPrevious || roomyPage.hasMore) && maxHeight
    ? getDescriptionPage(
      issue?.description || '',
      descriptionWidth,
      Math.max(1, maxHeight - 9),
      descriptionOffset,
    )
    : roomyPage;

  useEffect(() => setDescriptionOffset(0), [issue?.id]);

  useInput((_input, key) => {
    if (!issue?.description) return;
    if (key.downArrow) setDescriptionOffset(descriptionPage.nextOffset);
    if (key.upArrow) setDescriptionOffset(descriptionPage.previousOffset);
  }, { isActive: pagingIsActive && enablePaging });

  if (!issue) {
    return (
      <Box
        flexDirection="column"
        borderStyle={glyphs.border('single')}
        borderColor={theme.colors.border}
        padding={1}
        minWidth={50}
      >
        <Text color={theme.colors.textDim} italic>No issue selected</Text>
        <Box marginTop={1}>
          <Text color={theme.colors.textDim}>
            Select an issue with arrow keys
          </Text>
        </Box>
      </Box>
    );
  }

  const priorityLabel = PRIORITY_LABELS[issue.priority] || 'Unknown';
  const priorityColor = getPriorityColor(issue.priority, theme);
  const typeColor = getTypeColor(issue.issue_type, theme);
  const statusColor = getStatusColor(issue.status, theme);

  return (
    <Box
      flexDirection="column"
      borderStyle={glyphs.border('single')}
      borderColor={theme.colors.primary}
      padding={1}
      minWidth={50}
      flexGrow={1}
      height={maxHeight}
      overflow="hidden"
    >
      {/* Header */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={theme.colors.primary} wrap="truncate-end">{issue.title}</Text>
        <Text color={theme.colors.textDim}>{issue.id}</Text>
      </Box>

      {/* Description comes first so labels and dependency lists cannot push it
          outside the panel's clipped viewport. */}
      {issue.description && (
        <Box flexDirection="column" flexShrink={0}>
          <Text bold color={theme.colors.textDim}>Description:</Text>
          <Text color={theme.colors.text}>{descriptionPage.lines.join('\n')}</Text>
          {enablePaging && (descriptionPage.hasPrevious || descriptionPage.hasMore) && (
            <Text color={theme.colors.textDim}>
              {descriptionPage.hasPrevious ? `${glyphs.scrollUp} previous` : ''}
              {descriptionPage.hasPrevious && descriptionPage.hasMore ? ' | ' : ''}
              {descriptionPage.hasMore ? `${glyphs.scrollDown} more` : ''}
            </Text>
          )}
        </Box>
      )}

      {/* Metadata */}
      <Box flexDirection="column" gap={0} marginBottom={1}>
        <Box gap={2}>
          <Text color={theme.colors.textDim}>Type:</Text>
          <Text color={typeColor}>
            {issue.issue_type}
          </Text>
        </Box>

        <Box gap={2}>
          <Text color={theme.colors.textDim}>Priority:</Text>
          <Text color={priorityColor}>
            {priorityLabel} (P{issue.priority})
          </Text>
        </Box>

        <Box gap={2}>
          <Text color={theme.colors.textDim}>Status:</Text>
          <Text color={statusColor}>
            {issue.status.replace('_', ' ')}
          </Text>
        </Box>

        {issue.assignee && (
          <Box gap={2}>
            <Text color={theme.colors.textDim}>Assignee:</Text>
            <Text color={theme.colors.success}>@{issue.assignee}</Text>
          </Box>
        )}

        {issue.progress && (
          <Box gap={2}>
            <Text color={theme.colors.textDim}>Progress:</Text>
            <Text color={issue.progress.closed === issue.progress.total ? theme.colors.success : theme.colors.primary}>
              {issue.progress.closed}/{issue.progress.total} {issue.progress.total === 1 ? 'child' : 'children'} closed ({issue.progress.percent}%)
            </Text>
          </Box>
        )}
      </Box>

      {/* Labels */}
      {issue.labels && issue.labels.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.colors.textDim}>Labels:</Text>
          <Box gap={1} flexWrap="wrap">
            {issue.labels.map(label => (
              <Text key={label} color={theme.colors.textDim}>#{label}</Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Dependencies */}
      {issue.blockedBy && issue.blockedBy.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.colors.statusBlocked} bold>[!] Blocked by:</Text>
          {issue.blockedBy.map(id => (
            <Text key={id} color={theme.colors.textDim}>  - {id}</Text>
          ))}
        </Box>
      )}

      {issue.blocks && issue.blocks.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.colors.textDim}>Blocks:</Text>
          {issue.blocks.map(id => (
            <Text key={id} color={theme.colors.textDim}>  - {id}</Text>
          ))}
        </Box>
      )}

      {issue.parent && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.colors.textDim}>Parent:</Text>
          <Text color={theme.colors.textDim}>  - {issue.parent}</Text>
        </Box>
      )}

      {issue.children && issue.children.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={theme.colors.textDim}>Subtasks ({issue.children.length}):</Text>
          {issue.children.slice(0, 5).map(id => (
            <Text key={id} color={theme.colors.textDim}>  - {id}</Text>
          ))}
          {issue.children.length > 5 && (
            <Text color={theme.colors.textDim}>  ... and {issue.children.length - 5} more</Text>
          )}
        </Box>
      )}

      {/* Timestamps */}
      <Box flexDirection="column" marginTop={1} paddingTop={1} borderColor={theme.colors.border} borderTop>
        <Text color={theme.colors.textDim}>Created: {new Date(issue.created_at).toLocaleString()}</Text>
        <Text color={theme.colors.textDim}>Updated: {new Date(issue.updated_at).toLocaleString()}</Text>
        {issue.closed_at && (
          <Text color={theme.colors.textDim}>Closed: {new Date(issue.closed_at).toLocaleString()}</Text>
        )}
      </Box>

      {/* Actions hint */}
      <Box marginTop={1}>
        <Text color={theme.colors.textDim}>
          e edit | x export | ESC close
        </Text>
      </Box>
    </Box>
  );
}
