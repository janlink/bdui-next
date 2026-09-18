import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { useBeadsStore, isModalOpen } from '../state/store';
import { Board } from './Board';
import { BeadsWatcher } from '../bd/watcher';
import { basename } from 'node:path';
import { loadBeads, findBeadsDir } from '../bd/parser';
import { workspaceForBeadsPath } from '../bd/client';

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const setData = useBeadsStore(state => state.setData);
  const setTerminalSize = useBeadsStore(state => state.setTerminalSize);
  const setReloadCallback = useBeadsStore(state => state.setReloadCallback);
  const setBeadsPath = useBeadsStore(state => state.setBeadsPath);
  const setWorkspaceName = useBeadsStore(state => state.setWorkspaceName);
  const setLiveState = useBeadsStore(state => state.setLiveState);
  const theme = useBeadsStore(state => state.theme);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Update terminal dimensions
  useEffect(() => {
    if (stdout) {
      const updateSize = () => {
        setTerminalSize(stdout.columns, stdout.rows);
      };

      updateSize();

      // Listen for resize events
      stdout.on('resize', updateSize);

      return () => {
        stdout.off('resize', updateSize);
      };
    }
  }, [stdout, setTerminalSize]);

  // Find and load .beads/ directory on mount
  useEffect(() => {
    let disposed = false;
    let activeWatcher: BeadsWatcher | null = null;
    let unsubscribe: (() => void) | null = null;

    async function init() {
      try {
        const path = await findBeadsDir();
        if (disposed) return;

        if (!path) {
          setError('No .beads/ directory found in current or parent directories');
          setLoading(false);
          return;
        }

        // Load initial data
        const data = await loadBeads(path);
        if (disposed) return;
        setData(data);
        setBeadsPath(path);
        setWorkspaceName(basename(workspaceForBeadsPath(path)));
        setLiveState('live');

        // Set up watcher
        const pollMs = Number(process.env.BDUI_POLL_MS);
        // A failed poll keeps the last snapshot on screen; the header says so.
        const watcher = new BeadsWatcher(path, {
          ...(Number.isFinite(pollMs) && pollMs > 0 ? { intervalMs: pollMs } : {}),
          onError: () => {
            if (!disposed) setLiveState('stale');
          },
        });
        activeWatcher = watcher;
        unsubscribe = watcher.subscribe((data) => {
          if (disposed) return;
          setData(data);
          setLiveState('live');
        });
        watcher.start();

        // Set reload callback in store
        setReloadCallback(() => {
          if (!disposed) void watcher.reload();
        });

        setLoading(false);
      } catch (err) {
        if (disposed) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    void init();

    return () => {
      disposed = true;
      unsubscribe?.();
      activeWatcher?.stop();
      setReloadCallback(null);
      setBeadsPath(null);
      setWorkspaceName(null);
    };
  }, [setData, setReloadCallback, setBeadsPath, setWorkspaceName, setLiveState]);

  // Keyboard navigation
  const moveUp = useBeadsStore(state => state.moveUp);
  const moveDown = useBeadsStore(state => state.moveDown);
  const moveLeft = useBeadsStore(state => state.moveLeft);
  const moveRight = useBeadsStore(state => state.moveRight);
  const jumpToFirst = useBeadsStore(state => state.jumpToFirst);
  const jumpToLast = useBeadsStore(state => state.jumpToLast);
  const toggleHelp = useBeadsStore(state => state.toggleHelp);
  const toggleDetails = useBeadsStore(state => state.toggleDetails);
  const toggleNotifications = useBeadsStore(state => state.toggleNotifications);
  const toggleSearch = useBeadsStore(state => state.toggleSearch);
  const toggleFilter = useBeadsStore(state => state.toggleFilter);
  const toggleJumpToPage = useBeadsStore(state => state.toggleJumpToPage);
  const navigateToCreateIssue = useBeadsStore(state => state.navigateToCreateIssue);
  const navigateToEditIssue = useBeadsStore(state => state.navigateToEditIssue);
  const returnToPreviousView = useBeadsStore(state => state.returnToPreviousView);
  const toggleExportDialog = useBeadsStore(state => state.toggleExportDialog);
  const toggleThemeSelector = useBeadsStore(state => state.toggleThemeSelector);
  const clearFilters = useBeadsStore(state => state.clearFilters);
  const setViewMode = useBeadsStore(state => state.setViewMode);
  const viewMode = useBeadsStore(state => state.viewMode);
  const showDetails = useBeadsStore(state => state.showDetails);
  const modalOpen = useBeadsStore(isModalOpen);
  const toggleVisibilityPanel = useBeadsStore(state => state.toggleVisibilityPanel);
  const showToast = useBeadsStore(state => state.showToast);
  const undo = useBeadsStore(state => state.undo);
  const reloadCallback = useBeadsStore(state => state.reloadCallback);

  // Handle keyboard input
  useInput((input, key) => {
    // A mounted modal owns every keystroke, 'q' and '?' included, so its own
    // handler can accept them as text instead of quitting or opening help.
    if (modalOpen) return;

    // If in form view, allow ESC to return to previous view
    if (viewMode === 'create-issue' || viewMode === 'edit-issue') {
      if (key.escape) {
        returnToPreviousView();
      }
      // Let form components handle all other input
      return;
    }

    if (input === 'q') {
      exit();
    }

    if (input === '?') {
      toggleHelp();
    }

    if (key.escape && showDetails) {
      toggleDetails();
      return;
    }

    // Refresh
    if (input === 'r') {
      if (reloadCallback) {
        reloadCallback();
        showToast('Data refreshed', 'info');
      }
    }

    // Undo (Ctrl+Z or u)
    if ((key.ctrl && input === 'z') || input === 'u') {
      const entry = undo();
      if (entry) {
        showToast(`Undo available: ${entry.action} on ${entry.issueId}`, 'info');
        // Note: Actual undo would require calling bd CLI to revert
        // For now, just show the notification
      } else {
        showToast('Nothing to undo', 'info');
      }
    }

    // Toggle search
    if (input === '/') {
      toggleSearch();
      return;
    }

    // Toggle filter
    if (input === 'f') {
      toggleFilter();
      return;
    }

    // Clear filters
    if (input === 'c') {
      clearFilters();
      showToast('Filters cleared', 'info');
      return;
    }

    // Command bar (: or g)
    if (input === ':' || input === 'g') {
      toggleJumpToPage();
      return;
    }

    // Create new issue
    if (input === 'N') { // Shift+N
      navigateToCreateIssue();
      return;
    }

    // Theme selector
    if (input === 't') {
      toggleThemeSelector();
      return;
    }

    // Visibility panel (choose which statuses are shown)
    if (input === 'v') {
      toggleVisibilityPanel();
      return;
    }

    // Detail panel
    if (key.return || input === ' ') {
      toggleDetails();
    }

    // Toggle notifications
    if (input === 'n') {
      toggleNotifications();
    }

    // View switching
    if (input === '1') {
      setViewMode('tree');
    }
    if (input === '2') {
      setViewMode('kanban');
    }
    if (input === '3') {
      setViewMode('stats');
    }
    if (input === '4') {
      setViewMode('memories');
    }

    // Only Kanban keeps selection in the store. The row views own their
    // navigation locally, so routing these keys through the store there would
    // trigger a wasted full-board re-render on every keypress. Edit and export
    // act on that selection, so those views handle them too.
    if (viewMode === 'kanban') {
      if (input === 'e') {
        navigateToEditIssue();
        return;
      }
      if (input === 'x') {
        toggleExportDialog();
        return;
      }
      if (input === 'G' || input === '$') {
        jumpToLast();
        return;
      }
      if (input === '0') {
        jumpToFirst();
        return;
      }
      // Arrow keys scroll the description while details are open. Vim keys still
      // change selection, so users can inspect another issue without closing it.
      if ((!showDetails && key.upArrow) || input === 'k') {
        moveUp();
      }
      if ((!showDetails && key.downArrow) || input === 'j') {
        moveDown();
      }
      if ((!showDetails && key.leftArrow) || input === 'h') {
        moveLeft();
      }
      if ((!showDetails && key.rightArrow) || input === 'l') {
        moveRight();
      }
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text color={theme.colors.primary}>Loading beads...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.error} bold>Error:</Text>
        <Text color={theme.colors.error}>{error}</Text>
        <Box marginTop={1}>
          <Text color={theme.colors.textDim}>
            Make sure you're in a directory with a .beads/ folder
          </Text>
        </Box>
      </Box>
    );
  }

  return <Board />;
}
