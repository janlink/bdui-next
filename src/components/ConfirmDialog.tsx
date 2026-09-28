import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useBeadsStore } from '../state/store';
import { Floating, Frame } from './Frame';

const DIALOG_WIDTH = 56;

export function ConfirmDialog() {
  const showConfirmDialog = useBeadsStore(state => state.showConfirmDialog);
  const confirmDialogData = useBeadsStore(state => state.confirmDialogData);
  const hideConfirm = useBeadsStore(state => state.hideConfirm);
  const theme = useBeadsStore(state => state.theme);

  useInput((input, key) => {
    if (!showConfirmDialog) return;

    if (key.escape || input.toLowerCase() === 'n') {
      hideConfirm();
      return;
    }

    if (input.toLowerCase() === 'y' || key.return) {
      if (confirmDialogData?.onConfirm) {
        confirmDialogData.onConfirm();
      }
      hideConfirm();
    }
  });

  if (!showConfirmDialog || !confirmDialogData) return null;

  return (
    <Floating>
      <Frame
        title={confirmDialogData.title}
        hints={['y/Enter confirm', 'n/Esc cancel']}
        width={DIALOG_WIDTH}
        tone="warning"
        floating
      >
        <Box marginTop={1}>
          <Text {...theme.ink.text}>{confirmDialogData.message}</Text>
        </Box>
      </Frame>
    </Floating>
  );
}
