import { getImage } from 'astro:assets';

import type { ManualImageResolver, RenderedManualImage } from './markdown';

const assetReferencePattern =
  /^\.\/assets\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9][a-z0-9.-]*\.(?:png|jpe?g|webp|svg))$/;
const importPathPrefix = '/src/data/manuals/';
const bodyImageSizes = '(max-width: 60rem) 100vw, 56rem';

const importedAssets = import.meta.glob<{ default: ImageMetadata }>(
  '/src/data/manuals/assets/**/*.{png,jpg,jpeg,webp,svg}',
  { eager: true },
);

const assetRegistry = new Map<string, ImageMetadata>();

for (const [importPath, module] of Object.entries(importedAssets)) {
  if (!importPath.startsWith(importPathPrefix)) {
    throw new Error(`无法识别手册资源路径“${importPath}”`);
  }

  const reference = `./${importPath.slice(importPathPrefix.length)}`;
  if (assetRegistry.has(reference)) {
    throw new Error(`手册资源路径“${reference}”重复`);
  }
  assetRegistry.set(reference, module.default);
}

const bodyImageCache = new Map<string, Promise<RenderedManualImage>>();
const shareImageCache = new Map<string, Promise<string>>();

export function resolveManualAsset(reference: string, expectedSlug: string): ImageMetadata {
  const match = assetReferencePattern.exec(reference);
  if (!match) {
    throw new Error(`手册资源“${reference}”必须使用 ./assets/{slug}/{filename} 路径`);
  }

  const [, assetSlug] = match;
  if (assetSlug !== expectedSlug) {
    throw new Error(`手册“${expectedSlug}”不能引用手册“${assetSlug}”的资源`);
  }

  const asset = assetRegistry.get(reference);
  if (!asset) {
    throw new Error(`手册资源“${reference}”不存在`);
  }
  return asset;
}

async function optimizeBodyImage(
  reference: string,
  expectedSlug: string,
): Promise<RenderedManualImage> {
  const asset = resolveManualAsset(reference, expectedSlug);
  if (asset.format === 'svg') {
    return {
      src: asset.src,
      width: asset.width,
      height: asset.height,
      loading: 'lazy',
      decoding: 'async',
    };
  }

  const primaryWidth = Math.min(896, asset.width);
  const widths = [
    ...new Set([640, 896, Math.min(asset.width, 1344), Math.min(asset.width, 1792)]),
  ]
    .filter((width) => width <= asset.width)
    .sort((a, b) => a - b);
  const image = await getImage({
    src: asset,
    width: primaryWidth,
    widths,
    sizes: bodyImageSizes,
    format: 'webp',
    quality: 'high',
  });

  return {
    src: image.src,
    srcset: image.srcSet.attribute || undefined,
    sizes: bodyImageSizes,
    width: primaryWidth,
    height: Math.round((asset.height / asset.width) * primaryWidth),
    loading: 'lazy',
    decoding: 'async',
  };
}

export function createManualImageResolver(expectedSlug: string): ManualImageResolver {
  return (reference) => {
    const cacheKey = `${expectedSlug}:${reference}`;
    let image = bodyImageCache.get(cacheKey);
    if (!image) {
      image = optimizeBodyImage(reference, expectedSlug);
      bodyImageCache.set(cacheKey, image);
    }
    return image;
  };
}

export function getManualShareImage(reference: string, expectedSlug: string): Promise<string> {
  const cacheKey = `${expectedSlug}:${reference}`;
  let image = shareImageCache.get(cacheKey);
  if (!image) {
    image = (async () => {
      const asset = resolveManualAsset(reference, expectedSlug);
      if (asset.format === 'svg') return asset.src;

      const optimized = await getImage({
        src: asset,
        width: Math.min(1200, asset.width),
        format: 'webp',
        quality: 'high',
      });
      return optimized.src;
    })();
    shareImageCache.set(cacheKey, image);
  }
  return image;
}
