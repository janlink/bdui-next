import React, { useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useBeadsStore } from '../state/store';
import { StatusColumn, STRIP_WIDTH } from './StatusColumn';
import { DetailPanel } from './DetailPanel';
import { HelpOverlay } from './HelpOverlay';
import { TreeView } from './TreeView';
import { VisibilityPanel } from './VisibilityPanel';
import { SearchInput } from './SearchInput';
import { FilterPanel } from './FilterPanel';
import { CreateIssueForm } from './CreateIssueForm';
import { EditIssueForm } from './EditIssueForm';
import { ExportDialog } from './ExportDialog';
import { ThemeSelector } from './ThemeSelector';
import { StatsView } from './StatsView';
import { MemoriesView } from './MemoriesView';
import { FiltersBanner } from './FiltersBanner';
import { ConfirmDialog } from './ConfirmDialog';
import { CommandBar } from './CommandBar';
import { hasActiveFilters, listBudget, CHROME_HEIGHT, LAYOUT } from '../utils/constants';
import { Footer } from './Footer';
import { Header, type HeaderStat } from './Header';

// The panel's border stands on its own first cell, so one cell of gap is all
// the board gives up; the rules above and below fork on that border.
const SPLIT_GAP = 1;

function KanbanView({ height }: { height: number }) {
  const data = useBeadsStore(state => state.data);
  const selectedColumn = useBeadsStore(state => state.selectedColumn);
  const columnStates = useBeadsStore(state => state.columnStates);
  const itemsPerPage = useBeadsStore(state => state.itemsPerPage);
  const showDetails = useBeadsStore(state => state.showDetails);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);
  const getSelectedIssue = useBeadsStore(state => state.getSelectedIssue);
  const getVisibleColumns = useBeadsStore(state => state.getVisibleColumns);
  const searchQuery = useBeadsStore(state => state.searchQuery);
  const filter = useBeadsStore(state => state.filter);
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);

  const selectedIssue = getSelectedIssue();
  const visibleColumnsByStatus = useMemo(
    () => getVisibleColumns(),
    [data, searchQuery, filter, getVisibleColumns],
  );
  const filteredStats = {
    total: Object.values(visibleColumnsByStatus).reduce((total, issues) => total + issues.length, 0),
    open: visibleColumnsByStatus.open.length,
    closed: visibleColumnsByStatus.closed.length,
    blocked: visibleColumnsByStatus.blocked.length,
  };

  const statusConfig = [
    { key: 'open', title: 'Open' },
    { key: 'in_progress', title: 'In Progress' },
    { key: 'blocked', title: 'Blocked' },
    { key: 'closed', title: 'Closed' },
    { key: 'other', title: 'Other' },
  ] as const;

  // Responsive layout: a column with no cards always collapses to a thin strip,
  // even without a filter, and the columns that hold cards divide the width the
  // strips leave. The window over which columns are full pages across the
  // non-empty columns alone, so a strip never costs a full column its place.
  const MIN_COLUMN_WIDTH = 24;
  const MAX_COLUMN_WIDTH = 60;
  const shouldShowDetailsAlongside = showDetails
    && terminalWidth >= MIN_COLUMN_WIDTH * 2 + LAYOUT.detailPanelWidth + 2;
  const widthForColumns = shouldShowDetailsAlongside
    ? terminalWidth - LAYOUT.detailPanelWidth - SPLIT_GAP
    : terminalWidth;

  const nonEmptyColumns = statusConfig
    .map((_, index) => index)
    .filter(index => visibleColumnsByStatus[statusConfig[index].key].length > 0);

  // How many non-empty columns fit as full at once: every column that is not
  // full still costs a strip, so the five together must fit widthForColumns.
  const roomForFull = Math.floor(
    (widthForColumns - statusConfig.length * STRIP_WIDTH) / (MIN_COLUMN_WIDTH - STRIP_WIDTH),
  );
  const fullCount = Math.min(nonEmptyColumns.length, Math.max(nonEmptyColumns.length > 0 ? 1 : 0, roomForFull));
  const stripCount = statusConfig.length - fullCount;
  const widthForFull = Math.max(0, widthForColumns - stripCount * STRIP_WIDTH);
  const columnWidth = fullCount > 0
    ? Math.min(MAX_COLUMN_WIDTH, Math.floor(widthForFull / fullCount))
    : 0;

  // Slide the full window over the non-empty columns, keeping the selected one in
  // it; a selected empty column leaves the window on the first non-empty group.
  const selectedPosition = Math.max(0, nonEmptyColumns.indexOf(selectedColumn));
  const firstFull = Math.min(
    Math.max(0, selectedPosition - fullCount + 1),
    Math.max(0, nonEmptyColumns.length - fullCount),
  );
  const fullColumns = new Set(nonEmptyColumns.slice(firstFull, firstFull + fullCount));

  const detailWidth = terminalWidth - fullCount * columnWidth - stripCount * STRIP_WIDTH - SPLIT_GAP;
  const detailsHeight = listBudget('kanban', height).panelHeight;

  const activeColumn = statusConfig[selectedColumn] ?? statusConfig[0];
  const activeIssues = visibleColumnsByStatus[activeColumn.key];
  const activePosition = activeIssues.length === 0
    ? 0
    : Math.min(columnStates[activeColumn.key].selectedIndex + 1, activeIssues.length);
  const collapsedWithCards = nonEmptyColumns.length - fullCount;
  const stats: HeaderStat[] = [
    { text: `${filteredStats.total} issues` },
    ...(collapsedWithCards > 0 ? [{ text: `${collapsedWithCards} collapsed` }] : []),
    { text: `${activeColumn.title} ${activePosition}/${activeIssues.length}`, strong: true },
  ];
  const panel = shouldShowDetailsAlongside ? { width: detailWidth } : undefined;

  return (
    <Box flexDirection="column" width={terminalWidth} height={height}>
      <Header
        view="Kanban"
        stats={stats}
        width={terminalWidth}
        panel={panel && selectedIssue ? { ...panel, title: selectedIssue.id } : undefined}
      />

      {/* Main content */}
      <Box flexGrow={1} overflow="hidden">
        {showDetails && !shouldShowDetailsAlongside ? (
          <Box flexGrow={1} overflow="hidden">
            <DetailPanel
              issue={selectedIssue}
              maxHeight={detailsHeight}
              availableWidth={terminalWidth}
              enablePaging={false}
            />
          </Box>
        ) : (
          <>
            <Box flexShrink={0}>
              {statusConfig.map(({ key, title }, index) => {
                const columnState = columnStates[key];
                const full = fullColumns.has(index);
                return (
                  <StatusColumn
                    key={key}
                    title={title}
                    issues={visibleColumnsByStatus[key]}
                    isActive={selectedColumn === index}
                    selectedIndex={columnState.selectedIndex}
                    scrollOffset={columnState.scrollOffset}
                    itemsPerPage={itemsPerPage}
                    statusKey={key}
                    width={full ? columnWidth : STRIP_WIDTH}
                    collapsed={!full}
                  />
                );
              })}
            </Box>
            {shouldShowDetailsAlongside && (
              <Box
                marginLeft={SPLIT_GAP}
                width={detailWidth}
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
                  issue={selectedIssue}
                  maxHeight={detailsHeight}
                  availableWidth={detailWidth - 1}
                  enablePaging={false}
                  chrome="hosted"
                />
              </Box>
            )}
          </>
        )}
      </Box>

      <Footer currentView="kanban" panel={panel} />
    </Box>
  );
}

export function Board() {
  const viewMode = useBeadsStore(state => state.viewMode);
  const showHelp = useBeadsStore(state => state.showHelp);
  const showVisibilityPanel = useBeadsStore(state => state.showVisibilityPanel);
  const toggleVisibilityPanel = useBeadsStore(state => state.toggleVisibilityPanel);
  const data = useBeadsStore(state => state.data);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);
  const terminalHeight = useBeadsStore(state => state.terminalHeight);
  const returnToPreviousView = useBeadsStore(state => state.returnToPreviousView);
  const reloadCallback = useBeadsStore(state => state.reloadCallback);
  const getSelectedIssue = useBeadsStore(state => state.getSelectedIssue);
  const getStatsIssues = useBeadsStore(state => state.getStatsIssues);
  const searchQuery = useBeadsStore(state => state.searchQuery);
  const filter = useBeadsStore(state => state.filter);
  const showSearch = useBeadsStore(state => state.showSearch);
  const showFilter = useBeadsStore(state => state.showFilter);
  const showJumpToPage = useBeadsStore(state => state.showJumpToPage);
  const showExportDialog = useBeadsStore(state => state.showExportDialog);
  const showThemeSelector = useBeadsStore(state => state.showThemeSelector);
  const toggleExportDialog = useBeadsStore(state => state.toggleExportDialog);
  const toggleThemeSelector = useBeadsStore(state => state.toggleThemeSelector);
  const theme = useBeadsStore(state => state.theme);
  const setChromeHeight = useBeadsStore(state => state.setChromeHeight);

  const selectedIssue = getSelectedIssue();

  const statsIssues = useMemo(
    () => getStatsIssues(),
    [data, searchQuery, filter, getStatsIssues],
  );

  // Search, filter, the active-filter banner, and the command bar are shared
  // chrome: they own keyboard input in every view, so they mount here rather
  // than inside one view, and the view below shrinks by exactly what they take.
  const chromeHeight =
    (hasActiveFilters(filter, searchQuery) ? CHROME_HEIGHT.filtersBanner : 0)
    + (showSearch ? CHROME_HEIGHT.searchInput : 0)
    + (showFilter ? CHROME_HEIGHT.filterPanel : 0)
    + (showJumpToPage ? CHROME_HEIGHT.commandBar : 0);
  const viewHeight = Math.max(LAYOUT.issueCardHeight, terminalHeight - chromeHeight);
  useEffect(() => setChromeHeight(chromeHeight), [chromeHeight, setChromeHeight]);

  // Check minimum terminal width
  if (terminalWidth < LAYOUT.minTerminalWidth) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.error} bold>Terminal Too Narrow</Text>
        <Text color={theme.colors.text}>
          BD TUI requires at least {LAYOUT.minTerminalWidth} columns.
        </Text>
        <Text color={theme.colors.textDim}>
          Current width: {terminalWidth} columns
        </Text>
        <Box marginTop={1}>
          <Text color={theme.colors.textDim}>
            Please resize your terminal window.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      {/* Shared chrome above every view */}
      <FiltersBanner />
      {showSearch && <SearchInput />}
      {showFilter && <FilterPanel />}

      {/* Render view based on mode */}
      {viewMode === 'kanban' && <KanbanView height={viewHeight} />}
      {viewMode === 'tree' && (
        <TreeView data={data} terminalWidth={terminalWidth} terminalHeight={viewHeight} />
      )}
      {viewMode === 'stats' && (
        <StatsView
          issues={statsIssues}
          terminalWidth={terminalWidth}
          terminalHeight={viewHeight}
        />
      )}
      {viewMode === 'memories' && (
        <MemoriesView terminalWidth={terminalWidth} terminalHeight={viewHeight} />
      )}
      {viewMode === 'create-issue' && (
        <CreateIssueForm
          onClose={returnToPreviousView}
          onSuccess={() => {
            if (reloadCallback) reloadCallback();
          }}
        />
      )}
      {viewMode === 'edit-issue' && selectedIssue && (
        <EditIssueForm
          issue={selectedIssue}
          onClose={returnToPreviousView}
          onSuccess={() => {
            if (reloadCallback) reloadCallback();
          }}
        />
      )}

      {/* Command bar (vim-style) - shared across all views */}
      <CommandBar />

      {/* Export dialog - shared across all views */}
      {showExportDialog && (
        <Box
          position="absolute"
          marginTop={Math.max(0, Math.floor(terminalHeight / 2) - 10)}
          marginLeft={Math.max(0, Math.floor(terminalWidth / 2) - 35)}
        >
          <ExportDialog issue={selectedIssue ?? null} onClose={toggleExportDialog} />
        </Box>
      )}

      {/* Theme selector - shared across all views */}
      {showThemeSelector && (
        <Box
          position="absolute"
          marginTop={Math.max(0, Math.floor(terminalHeight / 2) - 10)}
          marginLeft={Math.max(0, Math.floor(terminalWidth / 2) - 30)}
        >
          <ThemeSelector onClose={toggleThemeSelector} />
        </Box>
      )}

      {/* Visibility panel - shared across all views */}
      {showVisibilityPanel && (
        <Box
          position="absolute"
          marginTop={Math.max(0, Math.floor(terminalHeight / 2) - 6)}
          marginLeft={Math.max(0, Math.floor(terminalWidth / 2) - 24)}
        >
          <VisibilityPanel onClose={toggleVisibilityPanel} />
        </Box>
      )}

      {/* Help overlay - shared across all views */}
      {showHelp && <HelpOverlay />}

      {/* Confirm dialog - shared across all views */}
      <ConfirmDialog />
    </Box>
  );
}
