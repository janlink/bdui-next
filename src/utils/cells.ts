import stringWidth from 'string-width';

// Every fit and pad here counts display cells, not code units, so a wide
// character cannot push a row past the terminal edge.

export function fitToWidth(text: string, width: number, ellipsis: string): string {
  if (width <= 0) return '';
  if (stringWidth(text) <= width) return text;

  const room = width - stringWidth(ellipsis);
  let fitted = '';
  let used = 0;
  for (const character of text) {
    const characterWidth = stringWidth(character);
    if (used + characterWidth > room) break;
    fitted += character;
    used += characterWidth;
  }
  return `${fitted}${ellipsis}`;
}

// An id's tail is what distinguishes siblings, its head is what says which tree
// it belongs to. Truncating cannot keep both, and in an indented list the tail
// is the part the eye needs.
export function fitFromRight(text: string, width: number, ellipsis: string): string {
  if (width <= 0) return '';
  if (stringWidth(text) <= width) return text;

  const room = width - stringWidth(ellipsis);
  let fitted = '';
  let used = 0;
  for (const character of [...text].reverse()) {
    const characterWidth = stringWidth(character);
    if (used + characterWidth > room) break;
    fitted = character + fitted;
    used += characterWidth;
  }
  return `${ellipsis}${fitted}`;
}

// Tree lines carry no text, so the tail - the connector and the caret - is the
// part worth keeping when an indent outgrows the column it lives in.
export function keepLastCells(text: string, width: number): string {
  if (stringWidth(text) <= width) return text;
  let kept = '';
  let used = 0;
  for (const character of [...text].reverse()) {
    const characterWidth = stringWidth(character);
    if (used + characterWidth > width) break;
    kept = character + kept;
    used += characterWidth;
  }
  return kept;
}

export function padEndCells(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - stringWidth(text)));
}

export function padStartCells(text: string, width: number): string {
  return ' '.repeat(Math.max(0, width - stringWidth(text))) + text;
}
