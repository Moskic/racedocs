import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import { manualSchema } from './lib/manual-schema';

const manuals = defineCollection({
  loader: glob({
    base: './src/data/manuals',
    pattern: '**/*.{yml,yaml}',
  }),
  schema: manualSchema,
});

export const collections = { manuals };
