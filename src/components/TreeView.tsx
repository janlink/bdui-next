import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useBeadsStore } from '../state/store';
import { buildVisibleTree, flattenTree } from '../utils/tree';
import { useTreeNavigation } from './useTreeNavigation';
import { ListRow } from './IssueRow';
import { DetailPanel } from './DetailPanel';
import { Footer } from './Footer';
import { listBudget, splitViewLayout } from '../utils/constants';
import type { BeadsData } from '../types';

interface TreeViewProps {
  data: BeadsData;
  terminalWidth: number;
  terminalHeight: number;
}

export function TreeView({ data, terminalWidth, terminalHeight }: TreeViewProps) {
  const showDetails = useBeadsStore(state => state.showDetails);
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const statusVisibility = useBeadsStore(state => state.statusVisibility);
  const searchQuery = useBeadsStore(state => state.searchQuery);
  const filter = useBeadsStore(state => state.filter);
  const getRowVisibleIds = useBeadsStore(state => state.getRowVisibleIds);

  const visibleIds = useMemo(
    () => getRowVisibleIds(),
    [data, statusVisibility, searchQuery, filter, getRowVisibleIds],
  );
  const tree = useMemo(() => buildVisibleTree(data, visibleIds), [data, visibleIds]);

  const budget = listBudget('tree', terminalHeight);
  // Details replace the list only when the terminal is too narrow to split; there
  // the arrow keys scroll the panel, otherwise they navigate the list.
  const split = splitViewLayout(terminalWidth);
  const detailsReplaceList = showDetails && !split.fits;
  const { flatNodes, selectedIndex, scrollOffset, selectedIssue } = useTreeNavigation(
    tree,
    flattenTree,
    budget.itemsPerPage,
    detailsReplaceList,
  );

  const visibleNodes = flatNodes.slice(scrollOffset, scrollOffset + budget.itemsPerPage);
  const below = flatNodes.length - (scrollOffset + budget.itemsPerPage);

  const detailsVisible = showDetails && selectedIssue !== undefined;
  const detailsAlongside = detailsVisible && split.fits;
  const listWidth = detailsAlongside ? split.listWidth : terminalWidth;

  return (
    <Box flexDirection="column" width="100%" height={terminalHeight}>
      <Box justifyContent="space-between">
        <Text {...theme.ink.strong}>Tree</Text>
        <Box gap={1}>
          <Text {...theme.ink.faint}>{scrollOffset > 0 ? `${glyphs.scrollUp}${scrollOffset}` : ''}</Text>
          <Text {...theme.ink.faint}>{below > 0 ? `${glyphs.scrollDown}${below}` : ''}</Text>
        </Box>
      </Box>
      <Box gap={2}>
        <Text {...theme.ink.faint}>Total: <Text {...theme.ink.dim}>{data.stats.total}</Text></Text>
        <Text {...theme.ink.faint}>Roots: <Text {...theme.ink.dim}>{tree.length}</Text></Text>
        <Text {...theme.ink.faint}>
          Selected: <Text {...theme.ink.dim}>{flatNodes.length === 0 ? 0 : selectedIndex + 1}/{flatNodes.length}</Text>
        </Text>
      </Box>

      <Box flexGrow={1} overflow="hidden">
        {flatNodes.length === 0 ? (
          <Text {...theme.ink.faint}>No issues to display</Text>
        ) : detailsVisible && !detailsAlongside ? (
          <Box flexGrow={1} overflow="hidden">
            <DetailPanel
              issue={selectedIssue ?? null}
              maxHeight={budget.panelHeight}
              availableWidth={terminalWidth}
            />
          </Box>
        ) : (
          <>
            <Box flexDirection="column" flexShrink={0} width={listWidth}>
              {visibleNodes.map((node, idx) => (
                <ListRow
                  key={node.issue.id}
                  node={node}
                  isSelected={scrollOffset + idx === selectedIndex}
                  theme={theme}
                  glyphs={glyphs}
                  width={listWidth}
                />
              ))}
            </Box>
            {detailsAlongside && (
              <Box marginLeft={2} flexGrow={1} overflow="hidden">
                <DetailPanel
                  issue={selectedIssue ?? null}
                  maxHeight={budget.panelHeight}
                  availableWidth={split.panelWidth}
                  enablePaging={false}
                />
              </Box>
            )}
          </>
        )}
      </Box>

      <Box paddingX={1} gap={2}>
        <Text color={theme.colors.statusOpen}>{glyphs.statusOpen} open</Text>
        <Text color={theme.colors.statusInProgress}>{glyphs.statusInProgress} in progress</Text>
        <Text color={theme.colors.statusBlocked}>{glyphs.statusBlocked} blocked</Text>
        <Text color={theme.colors.statusClosed}>{glyphs.statusClosed} closed</Text>
        <Text color={theme.colors.statusDeferred}>{glyphs.statusDeferred} deferred</Text>
      </Box>

      <Footer currentView="tree" />
    </Box>
  );
}
