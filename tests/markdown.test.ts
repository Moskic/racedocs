import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderManualMarkdown,
  type ManualImageResolver,
} from '../src/lib/markdown.ts';

const validImageReference = './assets/example/image.png';
const fakeImageResolver: ManualImageResolver = async (reference) => {
  if (reference !== validImageReference) {
    throw new Error(`手册资源“${reference}”不存在`);
  }
  return {
    src: '/_astro/image.hash.webp',
    srcset: '/_astro/image-small.hash.webp 480w, /_astro/image.hash.webp 800w',
    sizes: '(max-width: 60rem) 100vw, 50rem',
    width: 800,
    height: 450,
    loading: 'lazy',
    decoding: 'async',
  };
};

function render(markdown: string, resolveImage = fakeImageResolver) {
  return renderManualMarkdown(markdown, {
    manualSlug: 'example',
    resolveImage,
  });
}

test('renders supported Markdown and wraps tables', async () => {
  const html = await render('#### Setting name\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
  assert.match(html, /<h4>Setting name<\/h4>/);
  assert.match(html, /<div class="table-scroll"><table>/);
  assert.match(html, /<td>1<\/td>/);
});

test('removes scripts, event handlers, and dangerous URLs', async () => {
  const html = await render(
    '<script>alert(1)</script>\n\n<img src="/safe.webp" onerror="alert(1)">\n\n[bad](javascript:alert(1))',
  );
  assert.doesNotMatch(html, /<script|onerror|javascript:/i);
});

test('adds safe attributes to external links only', async () => {
  const html = await render('[external](https://example.com) [internal](/manuals/example/)');
  assert.match(
    html,
    /href="https:\/\/example.com" target="_blank" rel="noopener noreferrer"/,
  );
  assert.match(html, /href="\/manuals\/example\/">internal<\/a>/);
});

test('replaces manual images with responsive optimized output', async () => {
  const html = await render(`![示意图](${validImageReference})`);
  assert.match(html, /src="\/_astro\/image\.hash\.webp"/);
  assert.match(html, /srcset="\/_astro\/image-small\.hash\.webp 480w, \/_astro\/image\.hash\.webp 800w"/);
  assert.match(html, /sizes="\(max-width: 60rem\) 100vw, 50rem"/);
  assert.match(html, /width="800"/);
  assert.match(html, /height="450"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
});

test('removes raw HTML images instead of preserving user-controlled attributes', async () => {
  const html = await render(
    `<img src="${validImageReference}" srcset="javascript:alert(1) 1x" sizes="1px" width="1" height="1" loading="eager" decoding="sync" onerror="alert(1)" style="display:none">`,
  );
  assert.doesNotMatch(html, /javascript:|onerror|style=|loading="eager"|decoding="sync"/i);
  assert.doesNotMatch(html, /<img/);
});

test('removes images outside the manual asset directory', async () => {
  const html = await render(
    '![remote](https://example.com/image.webp) ![wrong](/other/image.webp)',
  );
  assert.doesNotMatch(html, /<img/);
});

test('fails when a manual asset cannot be resolved', async () => {
  await assert.rejects(
    () => render('![missing](./assets/example/missing.png)'),
    /不存在/,
  );
  await assert.rejects(
    () =>
      render(
        '![other](./assets/other/image.png)',
        async () => {
          throw new Error('不能引用其他手册的资源');
        },
      ),
    /不能引用/,
  );
});
