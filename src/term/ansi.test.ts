import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayWidth, prevClusterStart, nextClusterEnd } from './ansi';

test('displayWidth: ascii / cjk', () => {
  assert.equal(displayWidth('abc'), 3);
  assert.equal(displayWidth('蒋炎岩'), 6);
});

test('displayWidth: single emoji is 2 cells', () => {
  assert.equal(displayWidth('😀'), 2);
  assert.equal(displayWidth('a😀b'), 4);
});

test('displayWidth: ZWJ family emoji collapses to 2', () => {
  assert.equal(displayWidth('👨‍👩‍👧'), 2);
  assert.equal(displayWidth('🏳️‍🌈'), 2);
});

test('displayWidth: flag pair is 2', () => {
  assert.equal(displayWidth('🇨🇳'), 2);
});

test('displayWidth: combining diacritics add nothing', () => {
  assert.equal(displayWidth('é'), 1); // é as e + combining acute
});

test('prevClusterStart: deletes a whole ZWJ family', () => {
  const s = '👨‍👩‍👧';
  assert.equal(prevClusterStart(s, s.length), 0);
});

test('prevClusterStart: stops at cluster boundary', () => {
  const s = 'ab😀c';
  // cursor right after the emoji (index 4: 'a','b', then 😀 = 2 units at [2,4])
  assert.equal(prevClusterStart(s, 4), 2);
});

test('nextClusterEnd: consumes a whole emoji forward', () => {
  const s = '😀ab';
  assert.equal(nextClusterEnd(s, 0), 2);
});

test('nextClusterEnd: ZWJ family forward', () => {
  const s = '👨‍👩‍👧x';
  assert.equal(nextClusterEnd(s, 0), '👨‍👩‍👧'.length);
});
