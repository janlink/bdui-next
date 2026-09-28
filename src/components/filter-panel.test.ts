import { expect, test } from 'bun:test';
import { optionWindow } from './FilterPanel';

test('the option window keeps every selection in view', () => {
  for (let selected = 0; selected < 12; selected++) {
    const window = optionWindow(12, selected, 5);
    expect(window.end - window.start).toBe(5);
    expect(selected).toBeGreaterThanOrEqual(window.start);
    expect(selected).toBeLessThan(window.end);
    expect(window.above + (window.end - window.start) + window.below).toBe(12);
  }
});

test('the option window counts the options hidden above and below it', () => {
  expect(optionWindow(12, 0, 5)).toEqual({ start: 0, end: 5, above: 0, below: 7 });
  expect(optionWindow(12, 6, 5)).toEqual({ start: 4, end: 9, above: 4, below: 3 });
  expect(optionWindow(12, 11, 5)).toEqual({ start: 7, end: 12, above: 7, below: 0 });
});

test('a short option list shows whole and hides nothing', () => {
  expect(optionWindow(3, 2, 5)).toEqual({ start: 0, end: 3, above: 0, below: 0 });
  expect(optionWindow(0, 0, 5)).toEqual({ start: 0, end: 0, above: 0, below: 0 });
});
