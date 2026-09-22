import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useBeadsStore } from '../state/store';
import { buildVisibleTree, flattenTree } from '../utils/tree';
import { useTreeNavigation } from './useTreeNavigation';
import { ListHeader, ListRow, idColumnWidth } from './IssueRow';
import { DetailPanel } from './DetailPanel';
import { Footer } from './Footer';
import { Header, type HeaderStat } from './Header';
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
  const recentChanges = useBeadsStore(state => state.recentChanges);
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
  const listShown = !detailsVisible || detailsAlongside;
  const listWidth = detailsAlongside ? split.listWidth : terminalWidth;

  const stats: HeaderStat[] = [
    { text: `${data.stats.total} issues` },
    { text: `${tree.length} roots` },
    { text: `${flatNodes.length === 0 ? 0 : selectedIndex + 1}/${flatNodes.length}`, strong: true },
  ];
  const idWidth = idColumnWidth(flatNodes, glyphs, listWidth);
  const panel = detailsAlongside ? { width: split.panelWidth } : undefined;

  return (
    <Box flexDirection="column" width="100%" height={terminalHeight}>
      <Header
        view="Tree"
        stats={stats}
        width={terminalWidth}
        panel={panel && selectedIssue ? { ...panel, title: selectedIssue.id } : undefined}
      />

      <Box flexGrow={1} overflow="hidden">
        {flatNodes.length === 0 ? (
          <Text {...theme.ink.faint}>No issues to display</Text>
        ) : !listShown ? (
          <DetailPanel
            issue={selectedIssue ?? null}
            maxHeight={budget.panelHeight}
            availableWidth={terminalWidth}
          />
        ) : (
          <>
            <Box flexDirection="column" flexShrink={0} width={listWidth}>
              <ListHeader theme={theme} glyphs={glyphs} width={listWidth} idWidth={idWidth} />
              {visibleNodes.map((node, idx) => (
                <ListRow
                  key={node.issue.id}
                  node={node}
                  isSelected={scrollOffset + idx === selectedIndex}
                  theme={theme}
                  glyphs={glyphs}
                  width={listWidth}
                  idWidth={idWidth}
                  change={recentChanges.get(node.issue.id)?.kind}
                />
              ))}
            </Box>
            {detailsAlongside && (
              <Box
                marginLeft={1}
                width={split.panelWidth}
                flexShrink={0}
                borderStyle={glyphs.border('single')}
                borderLeft
                borderTop={false}
                borderRight={false}
                borderBottom={false}
                borderColor={theme.colors.rule}
                overflow="hidden"
              >
                <DetailPanel
                  issue={selectedIssue ?? null}
                  maxHeight={budget.panelHeight}
                  availableWidth={split.panelWidth - 1}
                  enablePaging={false}
                  chrome="hosted"
                />
              </Box>
            )}
          </>
        )}
      </Box>

      <Footer currentView="tree" trailer={listShown ? { above: scrollOffset, below } : undefined} panel={panel} />
    </Box>
  );
}
