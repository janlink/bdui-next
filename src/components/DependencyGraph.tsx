import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore, isModalOpen } from '../state/store';
import { getTypeColor, getStatusColor, getPriorityColor } from '../utils/constants';
import { isStatusVisible, type StatusVisibility } from '../utils/visibility';
import { DetailPanel } from './DetailPanel';
import { Footer } from './Footer';
import { listBudget, splitViewLayout } from '../utils/constants';
import type { Issue, BeadsData } from '../types';

interface DependencyGraphProps {
  data: BeadsData;
  terminalWidth: number;
  terminalHeight: number;
}

interface GraphNode {
  issue: Issue;
  level: number;
  column: number;
}

function buildDependencyLevels(data: BeadsData, visibility: StatusVisibility): GraphNode[][] {
  const { byId } = data;
  const levels: GraphNode[][] = [];
  const processed = new Set<string>();
  const inProcess = new Set<string>();

  // Find issues with no dependencies (level 0)
  function getLevel(issue: Issue, visitedPath: Set<string> = new Set()): number {
    if (processed.has(issue.id)) {
      // Already computed
      const found = levels.findIndex(level =>
        level?.some(node => node.issue.id === issue.id)
      );
      return found >= 0 ? found : 0;
    }

    // Detect cycles
    if (visitedPath.has(issue.id)) {
      return 0;
    }

    visitedPath.add(issue.id);

    let maxDepLevel = 0;

    // Check blocked-by dependencies
    if (issue.blockedBy && issue.blockedBy.length > 0) {
      for (const depId of issue.blockedBy) {
        const dep = byId.get(depId);
        if (dep) {
          const depLevel = getLevel(dep, new Set(visitedPath));
          maxDepLevel = Math.max(maxDepLevel, depLevel + 1);
        }
      }
    }

    return maxDepLevel;
  }

  // Calculate levels for all visible issues with dependencies
  const issuesWithDeps = data.issues.filter(
    issue =>
      isStatusVisible(issue, visibility) &&
      ((issue.blockedBy && issue.blockedBy.length > 0) ||
      (issue.blocks && issue.blocks.length > 0) ||
      (issue.parent) ||
      (issue.children && issue.children.length > 0))
  );

  for (const issue of issuesWithDeps) {
    const level = getLevel(issue);
    if (!levels[level]) {
      levels[level] = [];
    }
    levels[level].push({ issue, level, column: levels[level].length });
    processed.add(issue.id);
  }

  return levels;
}

export function DependencyGraph({ data, terminalWidth, terminalHeight }: DependencyGraphProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const showDetails = useBeadsStore(state => state.showDetails);
  const selectIssueById = useBeadsStore(state => state.selectIssueById);
  const navigateToEditIssue = useBeadsStore(state => state.navigateToEditIssue);
  const toggleExportDialog = useBeadsStore(state => state.toggleExportDialog);

  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const statusVisibility = useBeadsStore(state => state.statusVisibility);
  const modalOpen = useBeadsStore(isModalOpen);

  const levels = useMemo(() => buildDependencyLevels(data, statusVisibility), [data, statusVisibility]);
  const flatNodes = useMemo(() => levels.flat(), [levels]);

  const budget = listBudget('graph', terminalHeight, levels.length);
  const itemsPerPage = budget.itemsPerPage;

  // Details replace the list only when the terminal is too narrow to split; there
  // the arrow keys scroll the panel, otherwise they navigate the list.
  const split = splitViewLayout(terminalWidth);
  const detailsReplaceList = showDetails && !split.fits;

  useEffect(() => {
    if (selectedIndex > flatNodes.length - 1) {
      setSelectedIndex(Math.max(0, flatNodes.length - 1));
      setScrollOffset(0);
    }
  }, [flatNodes.length]);

  useInput((input, key) => {
    if (modalOpen) return;
    // Navigation
    if ((!detailsReplaceList && key.upArrow) || input === 'k') {
      if (selectedIndex > 0) {
        const newIndex = selectedIndex - 1;
        setSelectedIndex(newIndex);

        // Scroll up if needed
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
      }
    }

    if ((!detailsReplaceList && key.downArrow) || input === 'j') {
      if (selectedIndex < flatNodes.length - 1) {
        const newIndex = selectedIndex + 1;
        setSelectedIndex(newIndex);

        // Scroll down if needed
        if (newIndex >= scrollOffset + itemsPerPage) {
          setScrollOffset(newIndex - itemsPerPage + 1);
        }
      }
    }

    // Edit and export read the store selection, so sync the selected node into
    // it first.
    if (input === 'e' || input === 'x') {
      const issue = flatNodes[selectedIndex]?.issue;
      if (!issue || !selectIssueById(issue.id)) return;
      if (input === 'e') navigateToEditIssue();
      else toggleExportDialog();
    }
  });

  if (levels.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text {...theme.ink.strong}>Graph</Text>
        <Box marginTop={1}>
          <Text {...theme.ink.faint}>No dependencies to visualize</Text>
        </Box>
      </Box>
    );
  }

  const selectedIssue = flatNodes[selectedIndex]?.issue;
  const visibleNodes = flatNodes.slice(scrollOffset, scrollOffset + itemsPerPage);

  const detailsVisible = showDetails && selectedIssue !== undefined;
  const detailsAlongside = detailsVisible && split.fits;
  const listWidth = detailsAlongside ? split.listWidth : terminalWidth;
  const detailHeight = budget.panelHeight;

  // Group visible nodes back into levels for rendering
  const visibleLevels = new Map<number, GraphNode[]>();
  for (const node of visibleNodes) {
    if (!visibleLevels.has(node.level)) {
      visibleLevels.set(node.level, []);
    }
    visibleLevels.get(node.level)!.push(node);
  }

  return (
    <Box flexDirection="column" width="100%" height={terminalHeight}>
      <Box marginBottom={1} flexDirection="column">
        <Text {...theme.ink.strong}>Graph</Text>
        <Box gap={2}>
          <Text {...theme.ink.faint}>With deps: <Text {...theme.ink.dim}>{flatNodes.length}</Text></Text>
          <Text {...theme.ink.faint}>Levels: <Text {...theme.ink.dim}>{levels.length}</Text></Text>
          <Text {...theme.ink.faint}>Selected: <Text {...theme.ink.dim}>{selectedIndex + 1}/{flatNodes.length}</Text></Text>
        </Box>
      </Box>

      <Box flexGrow={1} overflow="hidden">
        {detailsVisible && !detailsAlongside ? (
          <Box flexGrow={1} overflow="hidden">
            <DetailPanel
              issue={selectedIssue ?? null}
              maxHeight={detailHeight}
              availableWidth={terminalWidth}
            />
          </Box>
        ) : (
          <>
          <Box flexDirection="column" flexShrink={0} width={listWidth}>
            {Array.from(visibleLevels.entries()).map(([levelIdx, levelNodes]) => {
              const totalInLevel = levels[levelIdx]?.length || 0;

              return (
                <Box key={levelIdx} flexDirection="column">
                  <Text {...theme.ink.dim} bold>
                    Level {levelIdx} <Text {...theme.ink.faint}>({totalInLevel})</Text>
                  </Text>

                  {levelNodes.map((node) => {
                    const typeColor = getTypeColor(node.issue.issue_type, theme);
                    const statusColor = getStatusColor(node.issue.displayStatus, theme);
                    const priorityColor = getPriorityColor(node.issue.priority, theme);
                    const globalIndex = flatNodes.findIndex(n => n.issue.id === node.issue.id);
                    const isSelected = globalIndex === selectedIndex;
                    const nBlockedBy = node.issue.blockedBy?.length ?? 0;
                    const nBlocks = node.issue.blocks?.length ?? 0;
                    const nChildren = node.issue.children?.length ?? 0;

                    const gutter = isSelected ? `${glyphs.selectArrow} ` : '  ';
                    const idStr = `${node.issue.id}  `;
                    const badges = `${nBlockedBy ? ` x${nBlockedBy}` : ''}${nBlocks ? ` >${nBlocks}` : ''}${nChildren ? ` +${nChildren}` : ''}`;
                    const right = ` ${node.issue.issue_type} ${node.issue.displayStatus} P${node.issue.priority}${badges}`;
                    const titleWidth = Math.max(4, listWidth - 2 - gutter.length - idStr.length - right.length - 3);
                    const rawTitle = node.issue.title || node.issue.id;
                    const title = rawTitle.length > titleWidth ? `${rawTitle.slice(0, titleWidth - 1)}${glyphs.ellipsis}` : rawTitle;

                    return (
                      <Box key={node.issue.id} marginLeft={2}>
                        <Text color={theme.colors.primary}>{gutter}</Text>
                        <Text {...theme.ink.faint}>{idStr}</Text>
                        <Text {...(isSelected ? theme.ink.strong : theme.ink.text)}>{title}</Text>
                        <Box flexGrow={1} />
                        <Text color={typeColor}>{node.issue.issue_type} </Text>
                        <Text color={statusColor}>{node.issue.displayStatus} </Text>
                        <Text color={priorityColor}>P{node.issue.priority}</Text>
                        {nBlockedBy > 0 && <Text color={theme.colors.statusBlocked}> {glyphs.graphBlocked}{nBlockedBy}</Text>}
                        {nBlocks > 0 && <Text color={theme.colors.warning}> {glyphs.arrowRight}{nBlocks}</Text>}
                        {nChildren > 0 && <Text color={theme.colors.textDim}> {glyphs.graphEdge}{nChildren}</Text>}
                      </Box>
                    );
                  })}
                </Box>
              );
            })}

            <Box marginTop={1} justifyContent="space-between">
              <Text {...theme.ink.faint}>{scrollOffset > 0 ? `${glyphs.scrollUp} ${scrollOffset} above` : ''}</Text>
              <Text {...theme.ink.faint}>
                {scrollOffset + itemsPerPage < flatNodes.length
                  ? `${glyphs.scrollDown} ${flatNodes.length - (scrollOffset + itemsPerPage)} below`
                  : ''}
              </Text>
            </Box>
          </Box>
          {detailsAlongside && (
            <Box marginLeft={1} flexGrow={1} overflow="hidden">
              <DetailPanel
                issue={selectedIssue ?? null}
                maxHeight={detailHeight}
                availableWidth={split.panelWidth}
                enablePaging={false}
              />
            </Box>
          )}
          </>
        )}
      </Box>

      {/* Legend */}
      <Box paddingX={1} gap={2}>
        <Text color={theme.colors.primary}>{glyphs.selectArrow} selected</Text>
        <Text color={theme.colors.statusBlocked}>{glyphs.graphBlocked} blocked by</Text>
        <Text color={theme.colors.warning}>{glyphs.arrowRight} blocks</Text>
        <Text color={theme.colors.textDim}>{glyphs.graphEdge} children</Text>
      </Box>

      {/* Footer */}
      <Footer currentView="graph" />
    </Box>
  );
}
