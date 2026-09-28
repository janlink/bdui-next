import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
import { fitToWidth } from '../utils/cells';
import { Frame } from './Frame';
import { copyToClipboard, exportToFile, formatIssueMarkdown, formatIssueJSON, formatIssuePlainText } from '../utils/export';
import type { Issue } from '../types';

interface ExportDialogProps {
  // The dialog stays mounted for as long as its flag is set, selection or not:
  // a set flag with no overlay behind it gates every other handler off and
  // leaves the keyboard dead.
  issue: Issue | null;
  onClose: () => void;
}

type ExportFormat = 'markdown' | 'json' | 'text';
type ExportAction = 'clipboard' | 'file';

const FORMATS: ExportFormat[] = ['markdown', 'json', 'text'];
const ACTIONS: ExportAction[] = ['clipboard', 'file'];

const DIALOG_WIDTH = 70;
const LABEL_WIDTH = 10;

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
    if (!issue) return;
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

  const hints = [
    `${glyphs.arrowLeft}${glyphs.arrowRight} format`,
    `${glyphs.scrollUp}${glyphs.scrollDown} action`,
    'Enter export',
    'Esc cancel',
  ];

  if (!issue) {
    return (
      <Frame title="Export" hints={['Esc close']} width={DIALOG_WIDTH} floating>
        <Text {...theme.ink.faint}>Nothing is selected.</Text>
      </Frame>
    );
  }

  const label = (text: string) => <Box width={LABEL_WIDTH} flexShrink={0}><Text {...theme.ink.dim}>{text}</Text></Box>;

  return (
    <Frame title={`Export ${issue.id}`} hints={hints} width={DIALOG_WIDTH} floating>
      <Box flexDirection="column" marginTop={1}>
        <Box>
          {label('Format')}
          <Box gap={2}>
            {FORMATS.map(format => (
              <Text
                key={format}
                {...(selectedFormat === format ? { color: theme.colors.primary, bold: true } : theme.ink.faint)}
              >
                {selectedFormat === format ? `${glyphs.selectArrow} ` : '  '}{format.toUpperCase()}
              </Text>
            ))}
          </Box>
        </Box>

        <Box marginTop={1}>
          {label('Action')}
          <Box flexDirection="column">
            {ACTIONS.map(action => (
              <Text
                key={action}
                {...(selectedAction === action ? { color: theme.colors.primary, bold: true } : theme.ink.faint)}
              >
                {selectedAction === action ? `${glyphs.selectArrow} ` : '  '}
                {action === 'clipboard' ? 'Copy to clipboard' : 'Export to file'}
              </Text>
            ))}
          </Box>
        </Box>

        <Box marginTop={1}>
          {label('Preview')}
          <Text {...theme.ink.text} wrap="truncate-end">
            {fitToWidth(`${selectedFormat === 'markdown' ? '# ' : ''}${issue.title}`, DIALOG_WIDTH - 4 - LABEL_WIDTH, glyphs.ellipsis)}
          </Text>
        </Box>
      </Box>

      {status && (
        <Box marginTop={1}>
          <Text color={status.type === 'success' ? theme.colors.success : theme.colors.error}>
            {status.message}
          </Text>
        </Box>
      )}

      {isExporting && (
        <Box marginTop={1}>
          <Text color={theme.colors.warning}>Exporting...</Text>
        </Box>
      )}
    </Frame>
  );
}
