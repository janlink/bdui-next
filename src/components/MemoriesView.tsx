import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore, isModalOpen } from '../state/store';
import { loadMemories, forgetMemory } from '../bd/memories';
import type { Memory } from '../types';
import { Footer } from './Footer';
import { listBudget } from '../utils/constants';
import { Header, type HeaderStat } from './Header';

interface MemoriesViewProps {
  terminalWidth: number;
  terminalHeight: number;
}

export function MemoriesView({ terminalWidth, terminalHeight }: MemoriesViewProps) {
  const beadsPath = useBeadsStore(state => state.beadsPath);
  const showToast = useBeadsStore(state => state.showToast);
  const showConfirm = useBeadsStore(state => state.showConfirm);
  const modalOpen = useBeadsStore(isModalOpen);
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nav, setNav] = useState({ selectedIndex: 0, scrollOffset: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadMemories(beadsPath ?? '.beads');
      setMemories(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [beadsPath]);

  // Lazy load: read once when the view mounts (and whenever the workspace changes).
  useEffect(() => {
    void load();
  }, [load]);

  // Keep the selection in range when the list shrinks (delete, reload).
  useEffect(() => {
    setNav(prev => {
      const maxIndex = Math.max(0, memories.length - 1);
      if (prev.selectedIndex <= maxIndex) return prev;
      return { selectedIndex: maxIndex, scrollOffset: 0 };
    });
  }, [memories.length]);

  const itemsPerPage = listBudget('memories', terminalHeight).itemsPerPage;

  const scrollFor = (selectedIndex: number, scrollOffset: number): number => {
    if (selectedIndex < scrollOffset) return selectedIndex;
    if (selectedIndex >= scrollOffset + itemsPerPage) return selectedIndex - itemsPerPage + 1;
    return scrollOffset;
  };

  useInput((input, key) => {
    if (modalOpen) return;

    if (input === 'r') {
      void load();
      return;
    }

    if (key.upArrow || input === 'k') {
      setNav(prev => {
        if (prev.selectedIndex <= 0) return prev;
        const selectedIndex = prev.selectedIndex - 1;
        return { selectedIndex, scrollOffset: scrollFor(selectedIndex, prev.scrollOffset) };
      });
      return;
    }

    if (key.downArrow || input === 'j') {
      setNav(prev => {
        if (prev.selectedIndex >= memories.length - 1) return prev;
        const selectedIndex = prev.selectedIndex + 1;
        return { selectedIndex, scrollOffset: scrollFor(selectedIndex, prev.scrollOffset) };
      });
      return;
    }

    if (input === 'd') {
      const memory = memories[nav.selectedIndex];
      if (!memory) return;
      showConfirm(
        'Memory löschen',
        `"${memory.key}" löschen? Dies kann nicht rückgängig gemacht werden.`,
        () => {
          void (async () => {
            try {
              await forgetMemory(memory.key, beadsPath ?? '.beads');
              showToast(`Memory gelöscht: ${memory.key}`, 'success');
              await load();
            } catch (err) {
              showToast(`Löschen fehlgeschlagen: ${err instanceof Error ? err.message : err}`, 'error');
            }
          })();
        },
      );
    }
  });

  const selectedIndex = Math.min(nav.selectedIndex, Math.max(0, memories.length - 1));
  const selected = memories[selectedIndex];
  const visible = memories.slice(nav.scrollOffset, nav.scrollOffset + itemsPerPage);

  const useSplit = terminalWidth >= 72;
  const listWidth = useSplit ? Math.min(40, Math.floor(terminalWidth / 2)) : terminalWidth;
  const detailWidth = useSplit ? terminalWidth - listWidth - 1 : terminalWidth;
  const keyColumnWidth = Math.max(6, listWidth - 4);
  const trailer = {
    above: nav.scrollOffset,
    below: Math.max(0, memories.length - (nav.scrollOffset + itemsPerPage)),
  };
  const headerStats: HeaderStat[] = [
    { text: `${memories.length} memories` },
    ...(loading ? [{ text: 'loading', strong: true }] : []),
  ];
  const panel = useSplit && selected ? { width: detailWidth } : undefined;

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      <Header
        view="Memories"
        stats={headerStats}
        width={terminalWidth}
        panel={panel ? { ...panel, title: selected.key } : undefined}
      />

      {/* Body */}
      <Box flexGrow={1} overflow="hidden">
        {error ? (
          <Box paddingX={1}>
            <Text color={theme.colors.error}>Fehler beim Laden: {error}</Text>
          </Box>
        ) : memories.length === 0 ? (
          <Box flexDirection="column" paddingX={1}>
            <Text color={theme.colors.textDim}>Keine Memories gespeichert.</Text>
            <Text color={theme.colors.textDim}>{'Mit `bd remember "<insight>"` in diesem Workspace anlegen.'}</Text>
          </Box>
        ) : (
          <>
            {/* Key list */}
            <Box flexDirection="column" width={listWidth} flexShrink={0} overflow="hidden">
              {visible.map((memory, idx) => {
                const isSelected = nav.scrollOffset + idx === selectedIndex;
                const label = memory.key.length > keyColumnWidth
                  ? memory.key.slice(0, keyColumnWidth - 1) + glyphs.ellipsis
                  : memory.key;
                return (
                  <Text
                    key={memory.key}
                    color={isSelected ? theme.colors.primary : theme.colors.text}
                    bold={isSelected}
                  >
                    {isSelected ? `${glyphs.prompt} ` : '  '}{label}
                  </Text>
                );
              })}
            </Box>

            {/* Value detail */}
            {useSplit && selected && (
              <Box
                marginLeft={1}
                paddingX={1}
                flexGrow={1}
                flexDirection="column"
                borderStyle={glyphs.border('single')}
                borderLeft
                borderTop={false}
                borderRight={false}
                borderBottom={false}
                borderColor={theme.colors.rule}
                overflow="hidden"
                width={detailWidth}
              >
                <Text color={theme.colors.text} wrap="wrap">{selected.value}</Text>
              </Box>
            )}
          </>
        )}
      </Box>

      <Footer
        currentView="memories"
        trailer={trailer}
        panel={panel ? { ...panel, actions: [['d', 'delete'], ['r', 'refresh']] } : undefined}
      />
    </Box>
  );
}
