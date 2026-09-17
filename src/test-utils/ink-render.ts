import React from 'react';
import { Readable, Writable } from 'node:stream';
import { render } from 'ink';

export const ANSI = /\[[0-9;?]*[A-Za-z]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/**
 * One rendered frame, escapes included.
 *
 * Ink writes cursor escapes and the frame as separate chunks, and unmounting
 * emits a second frame, so the first chunk carrying text is the whole frame.
 * The faked stdout decides only the width Ink lays out to; colour depth belongs
 * to chalk and stays a parameter of the caller.
 */
export async function renderFrame(
  node: React.ReactNode,
  columns: number,
  rows = 30,
): Promise<string> {
  const chunks: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  }) as NodeJS.WriteStream;
  Object.assign(stdout, { columns, rows, isTTY: true });
  const stdin = new Readable({ read() {} }) as NodeJS.ReadStream;
  Object.assign(stdin, {
    isTTY: true,
    isRaw: false,
    setRawMode(mode: boolean) { this.isRaw = mode; return this; },
    ref() { return this; },
    unref() { return this; },
  });

  await new Promise<void>(resolve => {
    const instance = render(node, {
      stdout,
      stdin,
      debug: true,
      patchConsole: false,
      onRender: () => queueMicrotask(() => {
        instance.unmount();
        resolve();
      }),
    });
  });

  const frame = chunks.find(chunk => stripAnsi(chunk).trim().length > 0);
  if (frame === undefined) throw new Error('render produced no frame');
  return frame;
}

export async function renderLines(
  node: React.ReactNode,
  columns: number,
  rows = 30,
  options: { keepBlank?: boolean } = {},
): Promise<string[]> {
  const lines = stripAnsi(await renderFrame(node, columns, rows)).split('\n');
  return options.keepBlank ? lines : lines.filter(line => line.length > 0);
}
