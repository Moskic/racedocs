import { getCollection, type CollectionEntry } from 'astro:content';

import { assertManualFilename } from './manual-schema';

export type ManualEntry = CollectionEntry<'manuals'>;

export async function getManuals(): Promise<ManualEntry[]> {
  const manuals = await getCollection('manuals');
  const slugs = new Set<string>();

  for (const manual of manuals) {
    assertManualFilename(manual.data, manual.id);

    if (slugs.has(manual.data.slug)) {
      throw new Error(`手册 slug“${manual.data.slug}”重复`);
    }
    slugs.add(manual.data.slug);
  }

  return manuals;
}

export async function getPublishedManuals(): Promise<ManualEntry[]> {
  return (await getManuals()).filter((manual) => manual.data.published);
}
