import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const manualsDirectory = 'src/data/manuals';
const mediaDirectory = 'src/data/manuals/assets';

test('validates the manual content inventory', async () => {
  const manualFiles = (await readdir(manualsDirectory))
    .filter((filename) => /\.ya?ml$/.test(filename))
    .sort();
  const slugs = new Set<string>();
  const referencedAssets = new Set<string>();

  assert.ok(manualFiles.length > 0, '至少需要一本手册');

  for (const filename of manualFiles) {
    const content = await readFile(path.join(manualsDirectory, filename), 'utf8');
    const slug = content.match(/^slug:\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/m)?.[1];

    assert.ok(slug, `${filename} 缺少有效的 slug`);
    assert.equal(filename.replace(/\.ya?ml$/, ''), slug, `${filename} 必须与 slug 一致`);
    assert.ok(!slugs.has(slug), `手册 slug“${slug}”重复`);
    slugs.add(slug);
    assert.doesNotMatch(content, /\/media\/manuals\//, `${filename} 仍在使用旧媒体路径`);

    for (const match of content.matchAll(/\.\/assets\/([a-z0-9-]+)\/([^\s)'"\]]+)/g)) {
      const [, mediaSlug, mediaPath] = match;
      assert.equal(mediaSlug, slug, `手册“${slug}”引用了其他手册的媒体`);
      assert.match(
        mediaPath,
        /^[a-z0-9][a-z0-9.-]*\.(?:png|jpe?g|webp|svg)$/,
        `手册“${slug}”包含无效的媒体文件名`,
      );
      await access(path.join(mediaDirectory, mediaSlug, mediaPath));
      referencedAssets.add(`${mediaSlug}/${mediaPath}`);
    }
  }

  const assetDirectories = await readdir(mediaDirectory, { withFileTypes: true });
  for (const directory of assetDirectories) {
    if (!directory.isDirectory()) continue;
    assert.ok(slugs.has(directory.name), `媒体目录“${directory.name}”没有对应手册`);

    const assets = await readdir(path.join(mediaDirectory, directory.name), {
      withFileTypes: true,
    });
    for (const asset of assets) {
      if (!asset.isFile() || asset.name === '.DS_Store') continue;
      assert.ok(
        referencedAssets.has(`${directory.name}/${asset.name}`),
        `媒体“${directory.name}/${asset.name}”未被任何内容引用`,
      );
    }
  }
});
