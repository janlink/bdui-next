// The name a terminal shows in its tab, its task bar and its window frame.
// Nothing of it is part of the frame bdui draws, so it costs no cell and no
// redraw, which is why the chrome rules carry the workspace and not the
// program's own name.

const ESC = '';
const BEL = '';

/** Save the shell's own title, and put it back when bdui leaves. */
export const PUSH_TITLE = `${ESC}[22;2t`;
export const POP_TITLE = `${ESC}[23;2t`;

// A tab shows far less than this; past it a title carries only what no tab can
// show anyway.
const TITLE_MAX = 64;
const CUT = '...';

/**
 * Control characters would end the sequence early or move the cursor, and a
 * workspace name reaches us from the filesystem, so it is not ours to trust.
 */
function sanitize(text: string): string {
  return Array.from(text)
    .filter(character => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f && !(code >= 0x80 && code <= 0x9f);
    })
    .join('')
    .trim();
}

/** `bdui - <workspace>`, or the bare name while no workspace is known yet. */
export function windowTitle(workspace?: string | null): string {
  const name = sanitize(workspace ?? '');
  const title = name ? `bdui - ${name}` : 'bdui';
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - CUT.length)}${CUT}` : title;
}

export function titleSequence(title: string): string {
  return `${ESC}]2;${title}${BEL}`;
}

/**
 * Writes the title whenever the workspace changes, and never twice for the same
 * one: the store publishes on every keystroke, the terminal should not.
 */
export function createWindowTitleWriter(
  stream: NodeJS.WriteStream = process.stdout,
): (workspace?: string | null) => void {
  let last: string | undefined;
  return workspace => {
    if (!stream.isTTY) return;
    const title = windowTitle(workspace);
    if (title === last) return;
    last = title;
    stream.write(titleSequence(title));
  };
}
