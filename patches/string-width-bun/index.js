// Ink measures every rendered character with string-width on every frame
// (ink/build/output.js). The published implementation segments graphemes with
// Intl.Segmenter, which costs ~26 us per call under Bun; Bun.stringWidth is the
// same measurement natively. Bun-only: this package has no portable fallback.
if (typeof Bun === 'undefined') {
  throw new Error('The string-width override in patches/string-width-bun requires the Bun runtime.');
}

// Ink calls stringWidth without options, so the module default is the only place
// the East Asian Ambiguous width can be decided. It stays narrow until the
// bootstrap probes the terminal.
let ambiguousIsNarrow = true;

export function setAmbiguousWidth(mode) {
  ambiguousIsNarrow = mode !== 'wide';
}

export function getAmbiguousWidth() {
  return ambiguousIsNarrow ? 'narrow' : 'wide';
}

export default function stringWidth(input, options = {}) {
  if (typeof input !== 'string' || input.length === 0) {
    return 0;
  }

  return Bun.stringWidth(input, {
    countAnsiEscapeCodes: options.countAnsiEscapeCodes ?? false,
    ambiguousIsNarrow: options.ambiguousIsNarrow ?? ambiguousIsNarrow,
  });
}
