import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
import { copyToClipboard, exportToFile, formatIssueMarkdown, formatIssueJSON, formatIssuePlainText } from '../utils/export';
import type { Issue } from '../types';

interface ExportDialogProps {
  issue: Issue;
  onClose: () => void;
}

type ExportFormat = 'markdown' | 'json' | 'text';
type ExportAction = 'clipboard' | 'file';

const FORMATS: ExportFormat[] = ['markdown', 'json', 'text'];
const ACTIONS: ExportAction[] = ['clipboard', 'file'];

export function ExportDialog({ issue, onClose }: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
  const [selectedAction, setSelectedAction] = useState<ExportAction>('clipboard');
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const theme = useBeadsStore(state => state.theme);
  const glyphs = useBeadsStore(state => state.glyphs);

  useInput(async (input, key) => {
    // ESC to close
    if (key.escape) {
      onClose();
      return;
    }

    // Don't handle input while exporting
    if (isExporting) {
      return;
    }

    // Navigate formats with left/right
    if (key.leftArrow || input === 'h') {
      const currentIndex = FORMATS.indexOf(selectedFormat);
      if (currentIndex > 0) {
        setSelectedFormat(FORMATS[currentIndex - 1]);
      }
    }

    if (key.rightArrow || input === 'l') {
      const currentIndex = FORMATS.indexOf(selectedFormat);
      if (currentIndex < FORMATS.length - 1) {
        setSelectedFormat(FORMATS[currentIndex + 1]);
      }
    }

    // Navigate actions with up/down
    if (key.upArrow || input === 'k') {
      const currentIndex = ACTIONS.indexOf(selectedAction);
      if (currentIndex > 0) {
        setSelectedAction(ACTIONS[currentIndex - 1]);
      }
    }

    if (key.downArrow || input === 'j') {
      const currentIndex = ACTIONS.indexOf(selectedAction);
      if (currentIndex < ACTIONS.length - 1) {
        setSelectedAction(ACTIONS[currentIndex + 1]);
      }
    }

    // Enter to export
    if (key.return) {
      await handleExport();
    }
  });

  const handleExport = async () => {
    setIsExporting(true);
    setStatus(null);

    try {
      let content: string;

      switch (selectedFormat) {
        case 'markdown':
          content = formatIssueMarkdown(issue);
          break;
        case 'json':
          content = formatIssueJSON(issue);
          break;
        case 'text':
          content = formatIssuePlainText(issue);
          break;
      }

      if (selectedAction === 'clipboard') {
        await copyToClipboard(content);
        setStatus({ type: 'success', message: 'Copied to clipboard!' });
      } else {
        const filename = await exportToFile(issue, selectedFormat);
        setStatus({ type: 'success', message: `Exported to ${filename}` });
      }

      // Auto-close after successful export
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Export failed',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle={glyphs.border('double')}
      borderColor={theme.colors.primary}
      padding={1}
      width={70}
      backgroundColor={theme.colors.surface}
    >
      <Text {...theme.ink.strong}>
        Export Issue: {issue.id}
      </Text>
      <Text {...theme.ink.faint}>
        ESC to cancel | {glyphs.arrowLeft}/{glyphs.arrowRight} change format | {glyphs.scrollUp}/{glyphs.scrollDown} change action | Enter to export
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {/* Format selection */}
        <Box marginBottom={1}>
          <Text {...theme.ink.strong}>Format:</Text>
        </Box>
        <Box gap={2} marginBottom={1}>
          {FORMATS.map(format => (
            <Box
              key={format}
              borderStyle={glyphs.border('single')}
              borderColor={selectedFormat === format ? theme.colors.primary : theme.colors.border}
              paddingX={1}
            >
              <Text {...(selectedFormat === format ? theme.ink.strong : theme.ink.faint)}>
                {format.toUpperCase()}
              </Text>
            </Box>
          ))}
        </Box>

        {/* Action selection */}
        <Box marginBottom={1}>
          <Text {...theme.ink.strong}>Action:</Text>
        </Box>
        <Box flexDirection="column" gap={0} marginBottom={1}>
          <Box>
            <Text {...(selectedAction === 'clipboard' ? theme.ink.strong : theme.ink.faint)}>
              {selectedAction === 'clipboard' ? `${glyphs.selectArrow} ` : '  '}
              Copy to Clipboard
            </Text>
          </Box>
          <Box>
            <Text {...(selectedAction === 'file' ? theme.ink.strong : theme.ink.faint)}>
              {selectedAction === 'file' ? `${glyphs.selectArrow} ` : '  '}
              Export to File
            </Text>
          </Box>
        </Box>

        {/* Preview */}
        <Box flexDirection="column" borderStyle={glyphs.border('single')} borderColor={theme.colors.border} padding={1} marginTop={1}>
          <Text {...theme.ink.faint}>Preview:</Text>
          <Text {...theme.ink.text}>
            {selectedFormat === 'markdown' && '# '}
            {issue.title.substring(0, 50)}
            {issue.title.length > 50 && '...'}
          </Text>
        </Box>
      </Box>

      {/* Status message */}
      {status && (
        <Box marginTop={1}>
          <Text color={status.type === 'success' ? theme.colors.success : theme.colors.error}>
            {status.message}
          </Text>
        </Box>
      )}

      {/* Loading indicator */}
      {isExporting && (
        <Box marginTop={1}>
          <Text color={theme.colors.warning}>Exporting...</Text>
        </Box>
      )}
    </Box>
  );
}
