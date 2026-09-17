import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Issue } from '../types';
import { useBeadsStore } from '../state/store';
import { hasActiveFilters } from '../utils/constants';
import { Footer } from './Footer';

interface StatsViewProps {
  issues: Issue[];
  totalIssues: number;
  terminalWidth: number;
  terminalHeight: number;
}

export function StatsView({ issues, totalIssues, terminalWidth, terminalHeight }: StatsViewProps) {
  const filter = useBeadsStore(state => state.filter);
  const searchQuery = useBeadsStore(state => state.searchQuery);
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);

  const filtersActive = hasActiveFilters(filter, searchQuery);

  const stats = useMemo(() => {
    const statusCounts = {
      open: issues.filter(i => i.displayStatus === 'open').length,
      in_progress: issues.filter(i => i.displayStatus === 'in_progress').length,
      blocked: issues.filter(i => i.displayStatus === 'blocked').length,
      closed: issues.filter(i => i.displayStatus === 'closed').length,
      other: issues.filter(i => i.displayStatus === 'other').length,
    };

    const priorityCounts = {
      p0: issues.filter(i => i.priority === 0).length,
      p1: issues.filter(i => i.priority === 1).length,
      p2: issues.filter(i => i.priority === 2).length,
      p3: issues.filter(i => i.priority === 3).length,
      p4: issues.filter(i => i.priority === 4).length,
    };

    const typeCounts = {
      task: issues.filter(i => i.issue_type === 'task').length,
      epic: issues.filter(i => i.issue_type === 'epic').length,
      bug: issues.filter(i => i.issue_type === 'bug').length,
      feature: issues.filter(i => i.issue_type === 'feature').length,
      chore: issues.filter(i => i.issue_type === 'chore').length,
      decision: issues.filter(i => i.issue_type === 'decision').length,
      other: issues.filter(i => !['task', 'epic', 'bug', 'feature', 'chore', 'decision'].includes(i.issue_type)).length,
    };

    const assignees = new Map<string, number>();
    for (const issue of issues) {
      const assignee = issue.assignee || 'unassigned';
      assignees.set(assignee, (assignees.get(assignee) || 0) + 1);
    }

    const labels = new Map<string, number>();
    for (const issue of issues) {
      if (issue.labels) {
        for (const label of issue.labels) {
          labels.set(label, (labels.get(label) || 0) + 1);
        }
      }
    }

    const completionRate = issues.length > 0
      ? Math.round((statusCounts.closed / issues.length) * 100)
      : 0;

    const topAssignees = Array.from(assignees.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topLabels = Array.from(labels.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { statusCounts, priorityCounts, typeCounts, completionRate, topAssignees, topLabels };
  }, [issues]);

  const useWideLayout = terminalWidth >= 84;
  const columnWidth = useWideLayout ? Math.floor((terminalWidth - 4) / 2) : terminalWidth - 2;
  const labelWidth = 14;
  const barWidth = Math.max(10, columnWidth - labelWidth - 16); // padding, border, count, spacing

  const padLabel = (label: string) => label.padEnd(labelWidth);

  const renderBar = (label: string, count: number, total: number, color: string) => {
    const filled = total > 0 ? Math.round((count / total) * barWidth) : 0;
    const empty = barWidth - filled;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <Box>
        <Text color={color}>{padLabel(label)}</Text>
        <Text color={color}>{glyphs.barDone.repeat(filled)}</Text>
        <Text {...theme.ink.rule}>{glyphs.barEmpty.repeat(empty)}</Text>
        <Text color={theme.colors.textDim}> {count} ({pct}%)</Text>
      </Box>
    );
  };

  const total = issues.length;
  const overviewBarWidth = Math.max(10, terminalWidth - 8);
  const segments = [
    { count: stats.statusCounts.closed, color: theme.colors.statusClosed },
    { count: stats.statusCounts.in_progress, color: theme.colors.statusInProgress },
    { count: stats.statusCounts.blocked, color: theme.colors.statusBlocked },
    { count: stats.statusCounts.open, color: theme.colors.statusOpen },
    { count: stats.statusCounts.other, color: theme.colors.textDim },
  ];
  let cumulative = 0;
  let used = 0;
  const segChars = segments.map(segment => {
    cumulative += segment.count;
    const target = total > 0 ? Math.round((cumulative / total) * overviewBarWidth) : 0;
    const length = Math.max(0, target - used);
    used = target;
    return { color: segment.color, text: glyphs.barDone.repeat(length) };
  });
  const remainder = Math.max(0, overviewBarWidth - used);

  const headerCount = filtersActive ? `${issues.length}/${totalIssues}` : `${totalIssues}`;

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold color={theme.colors.primary}>BD TUI - Statistics</Text>
        <Box gap={2}>
          <Text color={theme.colors.textDim}>Total: <Text color={theme.colors.text}>{headerCount}</Text></Text>
          {filtersActive && <Text color={theme.colors.warning}>[filtered]</Text>}
        </Box>
      </Box>

      {/* Overview: flagship progress bar */}
      <Box flexDirection="column" borderStyle={glyphs.border('round')} borderColor={theme.colors.border} paddingX={1} marginTop={1}>
        <Box>
          <Text bold color={theme.colors.primary}>Overview</Text>
          <Box flexGrow={1} />
          <Text color={theme.colors.success} bold>{stats.completionRate}% complete</Text>
          <Text color={theme.colors.textDim}> {glyphs.middot} {stats.statusCounts.closed}/{total} done</Text>
        </Box>
        <Box>
          {segChars.map((segment, index) => (
            <Text key={index} color={segment.color}>{segment.text}</Text>
          ))}
          {remainder > 0 && <Text {...theme.ink.rule}>{glyphs.barEmpty.repeat(remainder)}</Text>}
        </Box>
        <Box gap={3}>
          <Box gap={1}><Text color={theme.colors.statusOpen}>{glyphs.statusOpen}</Text><Text color={theme.colors.textDim}>{stats.statusCounts.open} open</Text></Box>
          <Box gap={1}><Text color={theme.colors.statusInProgress}>{glyphs.statusInProgress}</Text><Text color={theme.colors.textDim}>{stats.statusCounts.in_progress} in progress</Text></Box>
          <Box gap={1}><Text color={theme.colors.statusBlocked}>{glyphs.statusBlocked}</Text><Text color={theme.colors.textDim}>{stats.statusCounts.blocked} blocked</Text></Box>
          <Box gap={1}><Text color={theme.colors.statusClosed}>{glyphs.statusClosed}</Text><Text color={theme.colors.textDim}>{stats.statusCounts.closed} closed</Text></Box>
          <Box gap={1}><Text color={theme.colors.statusOther}>{glyphs.statusOther}</Text><Text color={theme.colors.textDim}>{stats.statusCounts.other} other</Text></Box>
        </Box>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} flexDirection={useWideLayout ? 'row' : 'column'} gap={1} marginTop={1}>
        {/* Left column */}
        <Box flexDirection="column" width={useWideLayout ? columnWidth : undefined} gap={1}>
          {/* Status */}
          <Box flexDirection="column" borderStyle={glyphs.border('round')} borderColor={theme.colors.border} paddingX={1}>
            <Text bold color={theme.colors.primary}>Status</Text>
            <Box flexDirection="column">
              {renderBar('Open', stats.statusCounts.open, total, theme.colors.statusOpen)}
              {renderBar('In Progress', stats.statusCounts.in_progress, total, theme.colors.statusInProgress)}
              {renderBar('Blocked', stats.statusCounts.blocked, total, theme.colors.statusBlocked)}
              {renderBar('Closed', stats.statusCounts.closed, total, theme.colors.statusClosed)}
              {renderBar('Other', stats.statusCounts.other, total, theme.colors.textDim)}
            </Box>
          </Box>

          {/* Priority */}
          <Box flexDirection="column" borderStyle={glyphs.border('round')} borderColor={theme.colors.border} paddingX={1}>
            <Text bold color={theme.colors.primary}>Priority</Text>
            <Box flexDirection="column">
              {renderBar('P0 Critical', stats.priorityCounts.p0, total, theme.colors.priorityCritical)}
              {renderBar('P1 High', stats.priorityCounts.p1, total, theme.colors.priorityHigh)}
              {renderBar('P2 Medium', stats.priorityCounts.p2, total, theme.colors.priorityMedium)}
              {renderBar('P3 Low', stats.priorityCounts.p3, total, theme.colors.priorityLow)}
              {renderBar('P4 Backlog', stats.priorityCounts.p4, total, theme.colors.priorityLowest)}
            </Box>
          </Box>
        </Box>

        {/* Right column */}
        <Box flexDirection="column" width={useWideLayout ? columnWidth : undefined} gap={1}>
          {/* Types */}
          <Box flexDirection="column" borderStyle={glyphs.border('round')} borderColor={theme.colors.border} paddingX={1}>
            <Text bold color={theme.colors.primary}>Type</Text>
            <Box flexDirection="column">
              {stats.typeCounts.epic > 0 && renderBar('Epic', stats.typeCounts.epic, total, theme.colors.typeEpic)}
              {stats.typeCounts.feature > 0 && renderBar('Feature', stats.typeCounts.feature, total, theme.colors.typeFeature)}
              {stats.typeCounts.bug > 0 && renderBar('Bug', stats.typeCounts.bug, total, theme.colors.typeBug)}
              {stats.typeCounts.task > 0 && renderBar('Task', stats.typeCounts.task, total, theme.colors.typeTask)}
              {stats.typeCounts.chore > 0 && renderBar('Chore', stats.typeCounts.chore, total, theme.colors.typeChore)}
              {stats.typeCounts.decision > 0 && renderBar('Decision', stats.typeCounts.decision, total, theme.colors.typeDecision)}
              {stats.typeCounts.other > 0 && renderBar('Other', stats.typeCounts.other, total, theme.colors.textDim)}
            </Box>
          </Box>

          {/* Assignees */}
          <Box flexDirection="column" borderStyle={glyphs.border('round')} borderColor={theme.colors.border} paddingX={1}>
            <Text bold color={theme.colors.primary}>Assignees</Text>
            <Box flexDirection="column">
              {stats.topAssignees.length > 0 ? (
                stats.topAssignees.map(([assignee, count]) => {
                  const displayName = assignee.length > labelWidth - 1
                    ? assignee.slice(0, labelWidth - 2) + glyphs.ellipsis
                    : assignee;
                  const color = assignee === 'unassigned' ? theme.colors.textDim : theme.colors.text;
                  return <Box key={assignee}>{renderBar(displayName, count, total, color)}</Box>;
                })
              ) : (
                <Text color={theme.colors.textDim}>No assignees</Text>
              )}
            </Box>
          </Box>

          {/* Labels */}
          <Box flexDirection="column" borderStyle={glyphs.border('round')} borderColor={theme.colors.border} paddingX={1}>
            <Text bold color={theme.colors.primary}>Labels</Text>
            <Box flexDirection="column">
              {stats.topLabels.length > 0 ? (
                stats.topLabels.map(([label, count]) => {
                  const displayLabel = '#' + (label.length > labelWidth - 2
                    ? label.slice(0, labelWidth - 3) + glyphs.ellipsis
                    : label);
                  return <Box key={label}>{renderBar(displayLabel, count, total, theme.colors.textDim)}</Box>;
                })
              ) : (
                <Text color={theme.colors.textDim}>No labels</Text>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Footer currentView="stats" />
    </Box>
  );
}
