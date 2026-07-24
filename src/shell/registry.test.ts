import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from './registry';
import type { Command } from './types';

const fake: Command = { name: 'foo', description: 'd', async run() {} };

test('registry: register then get', () => {
  const r = createRegistry();
  r.register(fake);
  assert.equal(r.get('foo'), fake);
  assert.equal(r.get('missing'), undefined);
});

test('registry: list reflects registered commands', () => {
  const r = createRegistry();
  r.register(fake);
  assert.equal(r.list().length, 1);
  assert.equal(r.list()[0].name, 'foo');
});
