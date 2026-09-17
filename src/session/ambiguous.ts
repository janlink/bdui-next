import { setAmbiguousWidth, type AmbiguousWidth } from 'string-width';

export type { AmbiguousWidth };

export const DEFAULT_AMBIGUOUS_WIDTH: AmbiguousWidth = 'narrow';

// The terminal decides how wide East Asian Ambiguous characters are, and the
// tree lines and status glyphs are Ambiguous. Nothing in the environment states
// the choice, so it is measured: print one Ambiguous character and ask the
// terminal which column the cursor ended up in.
const PROBE_CHARACTER = '│';
const ESC = '';
const DEVICE_STATUS_REPORT = `${ESC}[6n`;
const ERASE_LINE = `\r${ESC}[K`;
const PROBE_TIMEOUT_MS = 150;

const CURSOR_POSITION = /\[(\d+);(\d+)R/;

export function widthFromProbeColumn(column: number): AmbiguousWidth {
  return column >= 3 ? 'wide' : 'narrow';
}

interface ProbeStreams {
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
}

/**
 * Resolves once, before Ink takes the terminal. A terminal that does not answer
 * costs the timeout and nothing else; every failure path keeps the narrow
 * default.
 */
export function probeAmbiguousWidth(
  { input, output }: ProbeStreams = { input: process.stdin, output: process.stdout },
): Promise<AmbiguousWidth> {
  if (!input.isTTY || !output.isTTY) {
    return Promise.resolve(DEFAULT_AMBIGUOUS_WIDTH);
  }

  // The probe consumes stdin the way Ink does, through 'readable' and read(),
  // so the stream never enters flowing mode. Bun's TTY stdin does not survive
  // the alternative: a pause() issued from inside a 'data' handler disarms the
  // reader for good and every 'readable' listener added afterwards stays silent.
  return new Promise(resolve => {
    const wasRaw = input.isRaw;
    let pending = '';
    let settled = false;

    const finish = (width: AmbiguousWidth, rest: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.off('readable', onReadable);
      if (!wasRaw) input.setRawMode(false);
      output.write(ERASE_LINE);
      // Keystrokes that arrived during the probe are the user's, not ours.
      if (rest.length > 0) input.unshift(Buffer.from(rest, 'utf8'));
      resolve(width);
    };

    const onReadable = () => {
      let chunk: Buffer | string | null;
      while ((chunk = input.read()) !== null) {
        pending += chunk.toString('utf8');
        const match = CURSOR_POSITION.exec(pending);
        if (!match) continue;
        const rest = pending.slice(0, match.index) + pending.slice(match.index + match[0].length);
        finish(widthFromProbeColumn(Number(match[2])), rest);
        return;
      }
    };

    const timer = setTimeout(() => finish(DEFAULT_AMBIGUOUS_WIDTH, pending), PROBE_TIMEOUT_MS);

    try {
      input.setRawMode(true);
      input.on('readable', onReadable);
      output.write(`\r${PROBE_CHARACTER}${DEVICE_STATUS_REPORT}`);
    } catch {
      finish(DEFAULT_AMBIGUOUS_WIDTH, pending);
    }
  });
}

/**
 * BDUI_AMBIGUOUS skips the probe in both directions. It is the escape hatch for
 * a terminal that answers the report with a position it does not then render to.
 */
export async function resolveAmbiguousWidth(
  env: Record<string, string | undefined> = process.env,
  probe: () => Promise<AmbiguousWidth> = probeAmbiguousWidth,
): Promise<AmbiguousWidth> {
  const requested = env.BDUI_AMBIGUOUS?.trim().toLowerCase();
  if (requested === 'narrow' || requested === 'wide') return requested;
  if (requested && requested !== 'auto') return DEFAULT_AMBIGUOUS_WIDTH;
  return probe();
}

export function applyAmbiguousWidth(width: AmbiguousWidth): void {
  setAmbiguousWidth(width);
}
