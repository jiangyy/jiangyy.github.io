import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from './render';

test('heading h1: bold + indigo + a rule line beneath (two lines)', () => {
  const out = renderMarkdown('# Title');
  assert.match(out, /Title/);
  assert.ok(out.includes('\x1b[1m'), 'heading should be bold');
  assert.ok(!out.includes('\x1b[4m'), 'heading should not be underlined (too retro)');
  assert.ok(out.includes('─'), 'h1 should have a rule line beneath');
});

test('link: emitted as OSC 8 (clickable) with blue color', () => {
  const out = renderMarkdown('[ex](https://example.com)');
  assert.ok(
    out.includes('\x1b]8;;https://example.com\x1b\\'),
    'link must use OSC 8 so it is clickable in xterm',
  );
  assert.ok(out.includes('ex'));
  assert.ok(out.includes('\x1b[38;5;33m'), 'link should be blue');
});

test('list: bullet points', () => {
  const out = renderMarkdown('- one\n- two\n- three');
  assert.ok(out.includes('•'));
  assert.ok(out.includes('one'));
  assert.ok(out.includes('two'));
  assert.ok(out.includes('three'));
});

test('code block: rendered as plain text, no header or left rule', () => {
  const out = renderMarkdown('```ts\nconst x = 1\n```');
  assert.match(out, /const x = 1/);
  assert.doesNotMatch(out, /code · ts/); // no header
  assert.doesNotMatch(out, /│/); // no left rule
});

test('codespan: gray underline, same style as links', () => {
  const out = renderMarkdown('`c`');
  assert.ok(out.includes('\x1b[4m'), 'codespan should be underlined like links');
  assert.ok(!out.includes('\x1b[4:4m'), 'underline should be plain, not dashed');
  assert.ok(out.includes('\x1b[58;5;252m'), 'underline should be a light gray');
  assert.ok(!out.includes('\x1b[7m'), 'no inverse video');
});

test('strong/em styling', () => {
  const out = renderMarkdown('**b** *i*');
  assert.ok(out.includes('\x1b[1m')); // bold
  assert.ok(out.includes('\x1b[3m')); // italic
});

test('render: ends with exactly one blank line (consistent spacing)', () => {
  const out = renderMarkdown('# T\n\nbody');
  assert.ok(out.endsWith('\n\n'), 'should end with content + one blank line');
});

test('email is not parsed as a link', () => {
  const out = renderMarkdown('contact jyy@nju.edu.cn');
  assert.ok(!out.includes('\x1b]8;;'), 'bare email must not become a link');
  assert.ok(out.includes('jyy@nju.edu.cn'));
});
