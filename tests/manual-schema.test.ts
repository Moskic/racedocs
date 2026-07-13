import assert from 'node:assert/strict';
import test from 'node:test';

import { assertManualFilename, manualSchema } from '../src/lib/manual-schema.ts';

function validManual(): any {
  return {
    slug: 'example-manual',
    published: false,
    titleZh: '示例手册',
    titleEn: 'Example Manual',
    contentType: 'vehicle-manual',
    brand: 'Example Motors',
    vehicleClass: 'GT3',
    platform: 'Example Simulator',
    discipline: 'sports-car',
    cover: './assets/example-manual/cover.webp',
    source: {
      type: 'synthetic',
      title: '测试来源',
      revision: '1.0',
      publishedAt: '2026-07-12',
      notice: '仅供测试',
    },
    sections: [
      {
        id: 'introduction',
        level: 2,
        titleZh: '简介',
        titleEn: 'Introduction',
        bodyZh: '中文正文',
        bodyEn: 'English body',
      },
    ],
  };
}

function assertInvalid(change: (manual: ReturnType<typeof validManual>) => void, message: string) {
  const manual = validManual();
  change(manual);
  const result = manualSchema.safeParse(manual);
  if (result.success) {
    assert.fail('Expected manual validation to fail');
  }
  assert.match(result.error.message, new RegExp(message));
}

test('accepts a valid manual', () => {
  assert.equal(manualSchema.safeParse(validManual()).success, true);
});

test('only accepts supported racing disciplines', () => {
  for (const discipline of [
    'oval',
    'sports-car',
    'formula-car',
    'dirt-oval',
    'legacy-car',
    'other',
  ]) {
    const manual = validManual();
    manual.discipline = discipline;
    assert.equal(manualSchema.safeParse(manual).success, true);
  }

  assertInvalid((manual) => (manual.discipline = 'formula'), 'Invalid option');
});

test('rejects an invalid slug', () => {
  assertInvalid((manual) => (manual.slug = 'Invalid Slug'), 'slug');
});

test('requires at least one section', () => {
  assertInvalid((manual) => (manual.sections = []), '至少包含一个章节');
});

test('rejects duplicate section IDs', () => {
  assertInvalid((manual) => manual.sections.push({ ...manual.sections[0] }), '重复');
});

test('only accepts H2 and H3', () => {
  assertInvalid((manual) => (manual.sections[0].level = 4), 'Invalid input');
});

test('requires an H2 before an H3', () => {
  assertInvalid((manual) => (manual.sections[0].level = 3), '之前没有 H2');
});

test('accepts complete, body-only, and heading-only language content', () => {
  const englishOnly = validManual();
  delete englishOnly.sections[0].titleZh;
  delete englishOnly.sections[0].bodyZh;
  assert.equal(manualSchema.safeParse(englishOnly).success, true);

  const chineseOnly = validManual();
  delete chineseOnly.sections[0].titleEn;
  delete chineseOnly.sections[0].bodyEn;
  assert.equal(manualSchema.safeParse(chineseOnly).success, true);

  assert.equal(manualSchema.safeParse(validManual()).success, true);

  const bodyOnly = validManual();
  delete bodyOnly.sections[0].titleEn;
  assert.equal(manualSchema.safeParse(bodyOnly).success, true);

  const headingOnly = validManual();
  delete headingOnly.sections[0].bodyEn;
  assert.equal(manualSchema.safeParse(headingOnly).success, true);
});

test('requires at least one title or body per section', () => {
  assertInvalid((manual) => {
    delete manual.sections[0].titleZh;
    delete manual.sections[0].bodyZh;
    delete manual.sections[0].titleEn;
    delete manual.sections[0].bodyEn;
  }, '至少提供一种语言的标题或正文');
});

test('requires a cover before publishing', () => {
  assertInvalid((manual) => {
    manual.published = true;
    delete manual.cover;
  }, '已发布手册必须设置封面');
});

test('restricts cover images to the manual media directory', () => {
  assertInvalid((manual) => (manual.cover = 'https://example.com/cover.webp'), '封面必须位于');
  assertInvalid(
    (manual) => (manual.cover = '/media/manuals/example-manual/cover.webp'),
    '封面必须位于',
  );
  assertInvalid(
    (manual) => (manual.cover = './assets/another-manual/cover.webp'),
    '自己的媒体目录',
  );
});

test('requires slug and filename to match', () => {
  const manual = manualSchema.parse(validManual());
  assert.throws(() => assertManualFilename(manual, 'other-file'), /必须与文件名/);
});
