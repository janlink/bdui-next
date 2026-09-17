import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useBeadsStore } from '../state/store';
import { buildVisibleTree, flattenTree } from '../utils/tree';
import { useTreeNavigation } from './useTreeNavigation';
import { ListHeader, ListRow, idColumnWidth } from './IssueRow';
import { DetailPanel } from './DetailPanel';
import { Footer } from './Footer';
import { Header, type HeaderStat } from './Header';
import { listBudget, rowLayout, splitViewLayout } from '../utils/constants';
import type { BeadsData } from '../types';

interface TreeViewProps {
  data: BeadsData;
  terminalWidth: number;
  terminalHeight: number;
}

const TRAILER_ROWS = 1;

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

  // One row under the list belongs to the trailer that counts what scrolled
  // out of view; it is reserved even while the list fits, so folding a parent
  // never moves the rows below it.
  const budget = listBudget('tree', terminalHeight, TRAILER_ROWS);
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

  const stats: HeaderStat[] = [
    { text: `${data.stats.total} issues` },
    { text: `${tree.length} roots` },
    { text: `${flatNodes.length === 0 ? 0 : selectedIndex + 1}/${flatNodes.length}`, strong: true },
  ];
  const trailerIndent = (({ gutter, status, gap }) => gutter + status + gap)(rowLayout(listWidth, glyphs));
  const idWidth = idColumnWidth(flatNodes, glyphs, listWidth);

  return (
    <Box flexDirection="column" width="100%" height={terminalHeight}>
      <Header view="Tree" stats={stats} width={terminalWidth} />
      <ListHeader theme={theme} glyphs={glyphs} width={listWidth} idWidth={idWidth} />

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
                  idWidth={idWidth}
                />
              ))}
              {(scrollOffset > 0 || below > 0) && (
                <Box width={listWidth} justifyContent="space-between" paddingLeft={trailerIndent}>
                  <Text {...theme.ink.rule}>
                    {scrollOffset > 0 ? `${glyphs.scrollUp} ${scrollOffset}` : ''}
                  </Text>
                  <Text {...theme.ink.rule}>
                    {below > 0 ? `${glyphs.scrollDown} ${below} more` : ''}
                  </Text>
                </Box>
              )}
            </Box>
            {detailsAlongside && (
              <Box marginLeft={1} flexGrow={1} overflow="hidden">
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

      <Footer currentView="tree" />
    </Box>
  );
}
