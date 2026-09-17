import { expect, test } from 'bun:test';
import React from 'react';
import { Readable, Writable } from 'node:stream';
import { render } from 'ink';
import { normalizeBeads } from '../bd/parser';
import { DependencyGraph } from './DependencyGraph';

async function renderGraph(rows: number, data = normalizeBeads([
  { id: 'leaf', title: 'Last work', status: 'open', issue_type: 'task', priority: 2,
    dependencies: [{ issue_id: 'leaf', depends_on_id: 'child', type: 'blocks' }] },
  { id: 'follower', title: 'Follow-up work', status: 'open', issue_type: 'task', priority: 2,
    dependencies: [{ issue_id: 'follower', depends_on_id: 'leaf', type: 'blocks' }] },
  { id: 'child', title: 'Blocked work', status: 'open', issue_type: 'task', priority: 2,
    dependencies: [{ issue_id: 'child', depends_on_id: 'root', type: 'blocks' }] },
  { id: 'root', title: 'Required work', status: 'open', issue_type: 'task', priority: 1 },
])): Promise<string> {
  let output = '';
  const stdout = new Writable({
    write(chunk, _encoding, callback) { output += chunk.toString(); callback(); },
  }) as NodeJS.WriteStream;
  Object.assign(stdout, { columns: 60, rows, isTTY: true });
  const stdin = new Readable({ read() {} }) as NodeJS.ReadStream;
  Object.assign(stdin, {
    isTTY: true,
    isRaw: false,
    setRawMode(mode: boolean) { this.isRaw = mode; return this; },
    ref() { return this; },
    unref() { return this; },
  });

  await new Promise<void>((resolve) => {
    let instance: ReturnType<typeof render>;
    instance = render(
      <DependencyGraph data={data} terminalWidth={60} terminalHeight={rows} />,
      {
        stdout,
        stdin,
        debug: true,
        patchConsole: false,
        onRender: () => queueMicrotask(() => {
          instance.unmount();
          resolve();
        }),
      },
    );
  });
  return output;
}

test('dependency graph renders when input order initially creates a sparse level array', async () => {
  expect(await renderGraph(15)).toContain('Level 0');
});

test('dependency graph renders its empty state in a narrow supported terminal', async () => {
  const empty = normalizeBeads([
    { id: 'solo', title: 'Independent work', status: 'open', issue_type: 'task', priority: 2 },
  ]);
  expect(await renderGraph(15, empty)).toContain('No dependencies to visualize');
});
