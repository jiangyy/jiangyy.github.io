import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandMacros } from './macros';
import { renderTex } from './tex';

test('macros: displayDate derives the weekday (1-indexed month)', () => {
  assert.equal(
    expandMacros('Last update: {{displayDate(2026, 7, 31)}}'),
    'Last update: Fri Jul 31 2026',
  );
});

test('macros: displayDate rejects bad arity', () => {
  assert.throws(() => expandMacros('{{displayDate(2026, 7)}}'), /displayDate expects/);
});

test('macros: texify inline renders superscripts', () => {
  assert.equal(expandMacros('Energy: {{texify(e=mc^2)}}'), 'Energy: e=mc²');
});

test('macros: texify renders greek + sub/superscripts', () => {
  const out = expandMacros('{{texify(\\sum_{i=1}^{n} i)}}');
  assert.ok(out.includes('∑'), `expected ∑ in: ${out}`);
  assert.ok(out.includes('ⁿ'), `expected superscript n in: ${out}`);
  assert.ok(out.includes('ᵢ'), `expected subscript i in: ${out}`);
});

test('macros: ```tex block is rewritten to ```plain with rendered math', () => {
  const body = 'intro\n\n```tex\n\\sum_{i=1}^{n} i = n(n+1)/2\n```\n\nafter';
  const out = expandMacros(body);
  assert.ok(out.includes('```plain'), `expected a plain fence, got: ${out}`);
  assert.ok(!out.includes('```tex'), `tex fence should be gone: ${out}`);
  assert.ok(out.includes('∑ᵢ₌₁ⁿ'), `expected rendered sum, got: ${out}`);
  assert.ok(out.startsWith('intro'), 'prose before the block preserved');
  assert.ok(out.endsWith('after'), 'prose after the block preserved');
});

test('macros: block \\frac stacks over a vinculum', () => {
  const out = renderTex('\\frac{a}{b}', 'block');
  const lines = out.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], '─', `expected a 1-char vinculum, got: ${lines[1]}`);
});

test('macros: fenced code blocks are not expanded (logo protection)', () => {
  const body = '```plain\nLast update: {{displayDate(2026, 7, 31)}}\n```';
  const out = expandMacros(body);
  assert.ok(out.includes('{{displayDate(2026, 7, 31)}}'), `macro inside code must stay literal: ${out}`);
  assert.ok(!out.includes('Fri Jul 31 2026'), `code block must not be expanded: ${out}`);
});

test('macros: unknown macro name throws at build time', () => {
  assert.throws(() => expandMacros('{{nope(x)}}'), /unknown macro/);
});
