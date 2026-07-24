import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine } from './parser';

test('parseLine: simple', () => {
  assert.deepEqual(parseLine('cat about'), ['cat', 'about']);
});

test('parseLine: preserves spaces inside quotes', () => {
  assert.deepEqual(parseLine('echo "hello world"'), ['echo', 'hello world']);
});

test('parseLine: collapses extra whitespace', () => {
  assert.deepEqual(parseLine('  ls   -a  '), ['ls', '-a']);
});

test('parseLine: empty input', () => {
  assert.deepEqual(parseLine(''), []);
});
