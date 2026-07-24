import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContent } from './build-content';

test('compiler: derives documents from the content tree', async () => {
  const m = await buildContent();
  const slugs = m.documents.map((d) => d.slug).sort();
  assert.deepEqual(slugs, ['bio', 'help', 'index', 'papers']);
});

test('compiler: title from first h1, slug from path, default kind page', async () => {
  const m = await buildContent();
  const index = m.documents.find((d) => d.slug === 'index')!;
  assert.ok(index.title.includes('Yanyan Jiang'), `title was: ${index.title}`);
  assert.equal(index.kind, 'page');
  const papers = m.documents.find((d) => d.slug === 'papers')!;
  assert.equal(papers.title, 'Papers');
});

test('compiler: bodies are non-empty', async () => {
  const m = await buildContent();
  for (const d of m.documents) {
    assert.ok(d.body.length > 0, `${d.slug} should have a body`);
  }
});
