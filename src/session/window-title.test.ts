import { describe, expect, test } from 'bun:test';
import { Writable } from 'node:stream';
import {
  POP_TITLE,
  PUSH_TITLE,
  createWindowTitleWriter,
  titleSequence,
  windowTitle,
} from './window-title';

function fakeStream(isTTY: boolean): { stream: NodeJS.WriteStream; written: string[] } {
  const written: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      written.push(chunk.toString());
      callback();
    },
  }) as NodeJS.WriteStream;
  Object.assign(stream, { isTTY });
  return { stream, written };
}

describe('window title', () => {
  test('names the workspace beside the program', () => {
    expect(windowTitle('kidicap-analytics-pipeline')).toBe('bdui - kidicap-analytics-pipeline');
  });

  test('stays the bare name while no workspace is known', () => {
    expect(windowTitle(null)).toBe('bdui');
    expect(windowTitle('   ')).toBe('bdui');
  });

  // The name comes from the filesystem, so it can carry anything, and a control
  // character would close the sequence early and leave the rest on the screen.
  test('drops control characters out of the name', () => {
    expect(windowTitle('workspace\nname')).toBe('bdui - workspacename');
  });

  test('cuts a title no tab could show', () => {
    const title = windowTitle('w'.repeat(200));
    expect(title.length).toBe(64);
    expect(title.endsWith('...')).toBe(true);
  });

  test('wraps the title in the operating system command', () => {
    expect(titleSequence('bdui')).toBe(']2;bdui');
  });

  test('pushes and pops the shell title around the session', () => {
    expect(PUSH_TITLE).toBe('[22;2t');
    expect(POP_TITLE).toBe('[23;2t');
  });
});

describe('window title writer', () => {
  test('writes once per workspace, not once per store update', () => {
    const { stream, written } = fakeStream(true);
    const write = createWindowTitleWriter(stream);

    write('first');
    write('first');
    write('second');

    expect(written).toEqual([titleSequence('bdui - first'), titleSequence('bdui - second')]);
  });

  test('says nothing to a stream that is not a terminal', () => {
    const { stream, written } = fakeStream(false);
    createWindowTitleWriter(stream)('workspace');
    expect(written).toEqual([]);
  });
});
