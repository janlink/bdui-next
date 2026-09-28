import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
import { PRIORITY_LABELS } from '../utils/constants';
import { STATUS_LABELS, type StatusKey } from '../utils/visibility';
import { Frame } from './Frame';
import type { GlyphSet } from '../session/glyphs';

const OPTION_ROWS = 5;

/** A column heading, its visible options, and the row counting the hidden ones. */
export const FILTER_BODY_ROWS = 1 + OPTION_ROWS + 1;

export interface OptionWindow {
  start: number;
  end: number;
  above: number;
  below: number;
}

/** The slice of a column's options that keeps the selection in view. */
export function optionWindow(count: number, selected: number, rows = OPTION_ROWS): OptionWindow {
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), count - rows));
  const end = Math.min(count, start + rows);
  return { start, end, above: start, below: count - end };
}

const statusLabel = (status: string) => STATUS_LABELS[status as StatusKey] ?? status;

function hiddenOptions({ above, below }: OptionWindow, glyphs: GlyphSet): string {
  return [
    above > 0 ? `${glyphs.scrollUp} ${above} above` : '',
    below > 0 ? `${glyphs.scrollDown} ${below} below` : '',
  ].filter(Boolean).join('  ');
}

export function FilterPanel() {
  const data = useBeadsStore(state => state.data);
  const filter = useBeadsStore(state => state.filter);
  const setFilter = useBeadsStore(state => state.setFilter);
  const clearFilters = useBeadsStore(state => state.clearFilters);
  const toggleFilter = useBeadsStore(state => state.toggleFilter);
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);
  const terminalWidth = useBeadsStore(state => state.terminalWidth);

  const [selectedFilterType, setSelectedFilterType] = useState<'assignee' | 'tags' | 'priority' | 'status'>('assignee');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Get unique values for filters
  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    data.issues.forEach(issue => {
      if (issue.assignee) assignees.add(issue.assignee);
    });
    return Array.from(assignees).sort();
  }, [data.issues]);

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    data.issues.forEach(issue => {
      issue.labels?.forEach(label => tags.add(label));
    });
    return Array.from(tags).sort();
  }, [data.issues]);

  const priorities = [0, 1, 2, 3, 4];
  const statuses = ['open', 'in_progress', 'blocked', 'closed', 'other'];

  // Get current filter options based on selected type
  const getCurrentOptions = () => {
    switch (selectedFilterType) {
      case 'assignee': return uniqueAssignees;
      case 'tags': return uniqueTags;
      case 'priority': return priorities;
      case 'status': return statuses;
    }
  };

  const currentOptions = getCurrentOptions();
  const activeIndex = Math.min(selectedIndex, Math.max(0, currentOptions.length - 1));
  const assigneeWindow = optionWindow(uniqueAssignees.length, selectedFilterType === 'assignee' ? activeIndex : 0);
  const tagWindow = optionWindow(uniqueTags.length, selectedFilterType === 'tags' ? activeIndex : 0);

  useInput((input, key) => {
    // Close with Escape
    if (key.escape) {
      toggleFilter();
      return;
    }

    // Switch filter type with Tab
    if (key.tab) {
      const types: Array<'assignee' | 'tags' | 'priority' | 'status'> = ['assignee', 'tags', 'priority', 'status'];
      const currentIdx = types.indexOf(selectedFilterType);
      const nextIdx = (currentIdx + 1) % types.length;
      setSelectedFilterType(types[nextIdx]);
      setSelectedIndex(0);
      return;
    }

    // Navigate options
    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, activeIndex - 1));
      return;
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.max(0, Math.min(currentOptions.length - 1, activeIndex + 1)));
      return;
    }

    // Toggle selection with Enter or Space
    if (key.return || input === ' ') {
      const value = currentOptions[activeIndex];
      if (value === undefined) return;

      switch (selectedFilterType) {
        case 'assignee':
          setFilter({
            ...filter,
            assignee: filter.assignee === value ? undefined : String(value),
          });
          break;

        case 'tags':
          const currentTags = filter.tags || [];
          const tagValue = String(value);
          const newTags = currentTags.includes(tagValue)
            ? currentTags.filter(t => t !== tagValue)
            : [...currentTags, tagValue];
          setFilter({
            ...filter,
            tags: newTags.length > 0 ? newTags : undefined,
          });
          break;

        case 'priority':
          setFilter({
            ...filter,
            priority: filter.priority === value ? undefined : Number(value),
          });
          break;

        case 'status':
          setFilter({
            ...filter,
            status: filter.status === value ? undefined : String(value),
          });
          break;
      }
      return;
    }

    // Clear all filters with 'c'
    if (input === 'c') {
      clearFilters();
      return;
    }
  });

  const isSelected = (type: string, value: any): boolean => {
    switch (type) {
      case 'assignee':
        return filter.assignee === value;
      case 'tags':
        return filter.tags?.includes(String(value)) || false;
      case 'priority':
        return filter.priority === value;
      case 'status':
        return filter.status === value;
      default:
        return false;
    }
  };

  const getPriorityLabel = (priority: number) => `P${priority} (${PRIORITY_LABELS[priority]})`;

  const activeParts = [
    filter.assignee,
    ...(filter.tags ?? []),
    filter.priority !== undefined ? `P${filter.priority}` : undefined,
    filter.status ? statusLabel(filter.status) : undefined,
  ].filter((part): part is string => Boolean(part));

  return (
    <Frame
      title="Filters"
      aside={activeParts.length > 0 ? `active: ${activeParts.join(', ')}` : 'none active'}
      hints={['Tab switch', 'Space toggle', 'c clear', 'Esc close']}
      width={terminalWidth}
    >
      <Box gap={2} height={FILTER_BODY_ROWS}>
        {/* Assignee Filter */}
        <Box flexDirection="column" flexGrow={1} flexBasis={0}>
          <Text
            bold
            color={selectedFilterType === 'assignee' ? theme.colors.primary : theme.colors.textFaint}
            underline={selectedFilterType === 'assignee'}
          >
            Assignee
          </Text>
          {uniqueAssignees.length === 0 ? (
            <Text {...theme.ink.faint}>  No assignees</Text>
          ) : (
            uniqueAssignees.slice(assigneeWindow.start, assigneeWindow.end).map((assignee, offset) => {
              const idx = assigneeWindow.start + offset;
              return (
                <Box key={assignee}>
                  <Text color={selectedFilterType === 'assignee' && idx === activeIndex ? theme.colors.primary : theme.colors.text}>
                    {selectedFilterType === 'assignee' && idx === activeIndex ? `${glyphs.selectArrow} ` : '  '}
                    {isSelected('assignee', assignee) ? `${glyphs.checkboxOn} ` : `${glyphs.checkboxOff} `}
                    {assignee}
                  </Text>
                </Box>
              );
            })
          )}
          {(assigneeWindow.above > 0 || assigneeWindow.below > 0) && <Text {...theme.ink.faint}>  {hiddenOptions(assigneeWindow, glyphs)}</Text>}
        </Box>

        {/* Tags Filter */}
        <Box flexDirection="column" flexGrow={1} flexBasis={0}>
          <Text
            bold
            color={selectedFilterType === 'tags' ? theme.colors.primary : theme.colors.textFaint}
            underline={selectedFilterType === 'tags'}
          >
            Tags
          </Text>
          {uniqueTags.length === 0 ? (
            <Text {...theme.ink.faint}>  No tags</Text>
          ) : (
            uniqueTags.slice(tagWindow.start, tagWindow.end).map((tag, offset) => {
              const idx = tagWindow.start + offset;
              return (
                <Box key={tag}>
                  <Text color={selectedFilterType === 'tags' && idx === activeIndex ? theme.colors.primary : theme.colors.text}>
                    {selectedFilterType === 'tags' && idx === activeIndex ? `${glyphs.selectArrow} ` : '  '}
                    {isSelected('tags', tag) ? `${glyphs.checkboxOn} ` : `${glyphs.checkboxOff} `}
                    {tag}
                  </Text>
                </Box>
              );
            })
          )}
          {(tagWindow.above > 0 || tagWindow.below > 0) && <Text {...theme.ink.faint}>  {hiddenOptions(tagWindow, glyphs)}</Text>}
        </Box>

        {/* Priority Filter */}
        <Box flexDirection="column" flexGrow={1} flexBasis={0}>
          <Text
            bold
            color={selectedFilterType === 'priority' ? theme.colors.primary : theme.colors.textFaint}
            underline={selectedFilterType === 'priority'}
          >
            Priority
          </Text>
          {priorities.map((priority, idx) => (
            <Box key={priority}>
              <Text color={selectedFilterType === 'priority' && idx === activeIndex ? theme.colors.primary : theme.colors.text}>
                {selectedFilterType === 'priority' && idx === activeIndex ? `${glyphs.selectArrow} ` : '  '}
                {isSelected('priority', priority) ? `${glyphs.checkboxOn} ` : `${glyphs.checkboxOff} `}
                {getPriorityLabel(priority)}
              </Text>
            </Box>
          ))}
        </Box>

        {/* Status Filter */}
        <Box flexDirection="column" flexGrow={1} flexBasis={0}>
          <Text
            bold
            color={selectedFilterType === 'status' ? theme.colors.primary : theme.colors.textFaint}
            underline={selectedFilterType === 'status'}
          >
            Status
          </Text>
          {statuses.map((status, idx) => (
            <Box key={status}>
              <Text color={selectedFilterType === 'status' && idx === activeIndex ? theme.colors.primary : theme.colors.text}>
                {selectedFilterType === 'status' && idx === activeIndex ? `${glyphs.selectArrow} ` : '  '}
                {isSelected('status', status) ? `${glyphs.checkboxOn} ` : `${glyphs.checkboxOff} `}
                {statusLabel(status)}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Frame>
  );
}
