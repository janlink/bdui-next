#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './components/App';
import { handleCliArgs } from './cli';
import { applyAmbiguousWidth, resolveAmbiguousWidth } from './session/ambiguous';
import { applyColorDepth, resolveColorDepth } from './session/colors';
import { resolveGlyphTier } from './session/glyphs';
import { useBeadsStore } from './state/store';

if (handleCliArgs(process.argv.slice(2))) process.exit(0);

// The session axes are decided once, here, and then carried in the store. Later
// is too late: chalk freezes its detection at import, the ambiguous-width probe
// needs the terminal before Ink takes it, and a component that re-resolved a
// theme would hand React.memo a new object on every frame.
applyAmbiguousWidth(await resolveAmbiguousWidth());

const colorDepth = resolveColorDepth();
applyColorDepth(colorDepth);
useBeadsStore.getState().setSessionAxes({
  colorDepth,
  glyphTier: resolveGlyphTier(),
});

const { unmount, waitUntilExit } = render(<App />);

process.on('SIGINT', () => {
  unmount();
  process.exit(0);
});

process.on('SIGTERM', () => {
  unmount();
  process.exit(0);
});

await waitUntilExit();
