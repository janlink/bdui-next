import React, { useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useBeadsStore } from '../state/store';
import { StatusColumn } from './StatusColumn';
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
import { Toast } from './Toast';
import { FiltersBanner } from './FiltersBanner';
import { ConfirmDialog } from './ConfirmDialog';
import { CommandBar } from './CommandBar';
import { hasActiveFilters, listBudget, CHROME_HEIGHT, LAYOUT } from '../utils/constants';
import { Footer } from './Footer';

function KanbanView({ height }: { height: number }) {
  const data = useBeadsStore(state => state.data);
  const selectedColumn = useBeadsStore(state => state.selectedColumn);
  const columnStates = useBeadsStore(state => state.columnStates);
  const itemsPerPage = useBeadsStore(state => state.itemsPerPage);
  const showDetails = useBeadsStore(state => state.showDetails);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);
  // Header reports the real terminal size; `height` is only what is left for this view.
  const terminalHeight = useBeadsStore(state => state.terminalHeight);
  const getSelectedIssue = useBeadsStore(state => state.getSelectedIssue);
  const getVisibleColumns = useBeadsStore(state => state.getVisibleColumns);
  const searchQuery = useBeadsStore(state => state.searchQuery);
  const filter = useBeadsStore(state => state.filter);
  const theme = useBeadsStore(state => state.theme);

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

  // Responsive layout: fill the terminal width with as many of the 5 columns as fit.
  const MIN_COLUMN_WIDTH = 24;
  const MAX_COLUMN_WIDTH = 60;
  const shouldShowDetailsAlongside = showDetails
    && terminalWidth >= MIN_COLUMN_WIDTH * 2 + LAYOUT.detailPanelWidth + 2;
  const widthForColumns = shouldShowDetailsAlongside
    ? terminalWidth - LAYOUT.detailPanelWidth - 2
    : terminalWidth;
  const visibleColumns = Math.min(5, Math.max(1, Math.floor(widthForColumns / MIN_COLUMN_WIDTH)));
  const columnWidth = shouldShowDetailsAlongside
    ? MIN_COLUMN_WIDTH
    : Math.min(MAX_COLUMN_WIDTH, Math.floor(widthForColumns / visibleColumns));
  const detailWidth = terminalWidth - visibleColumns * columnWidth - 2;
  const detailsHeight = listBudget('kanban', height).panelHeight;

  const statusConfig = [
    { key: 'open', title: 'Open' },
    { key: 'in_progress', title: 'In Progress' },
    { key: 'blocked', title: 'Blocked' },
    { key: 'closed', title: 'Closed' },
    { key: 'other', title: 'Other' },
  ] as const;

  // Keep the selected column in the responsive window.
  const firstVisibleColumn = Math.min(
    Math.max(0, selectedColumn - visibleColumns + 1),
    statusConfig.length - visibleColumns,
  );
  const columnsToShow = statusConfig.slice(firstVisibleColumn, firstVisibleColumn + visibleColumns);

  return (
    <Box flexDirection="column" width={terminalWidth} height={height}>
      {/* Header */}
      <Box flexDirection="column">
        <Box justifyContent="space-between">
          <Text bold color={theme.colors.primary}>
            BD TUI - Kanban Board
          </Text>
          <Text color={theme.colors.textDim}>
            {terminalWidth}x{terminalHeight} | Press ? for help
          </Text>
        </Box>
        <Box gap={2}>
          <Text color={theme.colors.textDim}>Total: <Text color={theme.colors.text}>{filteredStats.total}</Text></Text>
          <Text color={theme.colors.textDim}>Open: <Text color={theme.colors.statusOpen}>{filteredStats.open}</Text></Text>
          <Text color={theme.colors.textDim}>Blocked: <Text color={theme.colors.statusBlocked}>{filteredStats.blocked}</Text></Text>
          <Text color={theme.colors.textDim}>Closed: <Text color={theme.colors.statusClosed}>{filteredStats.closed}</Text></Text>
          <Text color={theme.colors.textDim}>Other: <Text color={theme.colors.text}>{visibleColumnsByStatus.other.length}</Text></Text>
          {visibleColumns < 5 && (
            <Text color={theme.colors.warning}>[{5 - visibleColumns} hidden]</Text>
          )}
        </Box>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} overflow="hidden">
        {showDetails && !shouldShowDetailsAlongside ? (
          <Box flexGrow={1} overflow="hidden">
            <DetailPanel
              issue={selectedIssue}
              maxHeight={detailsHeight}
              availableWidth={terminalWidth}
            />
          </Box>
        ) : (
          <>
            <Box flexShrink={0}>
              {columnsToShow.map(({ key, title }, idx) => {
                const columnState = columnStates[key];
                return (
                  <StatusColumn
                    key={key}
                    title={title}
                    issues={visibleColumnsByStatus[key]}
                    isActive={selectedColumn === firstVisibleColumn + idx}
                    selectedIndex={columnState.selectedIndex}
                    scrollOffset={columnState.scrollOffset}
                    itemsPerPage={itemsPerPage}
                    statusKey={key}
                    width={columnWidth}
                  />
                );
              })}
            </Box>
            {shouldShowDetailsAlongside && (
              <Box marginLeft={2} flexGrow={1} overflow="hidden">
                <DetailPanel
                  issue={selectedIssue}
                  maxHeight={detailsHeight}
                  availableWidth={detailWidth}
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Footer */}
      <Footer currentView="kanban" />
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
      <Toast />
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
          totalIssues={data.issues.length}
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
