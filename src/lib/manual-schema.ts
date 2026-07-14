import { z } from 'astro/zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mediaPathPattern = /^\.\/assets\/[a-z0-9-]+\/[^/]+$/;

const optionalText = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().trim().min(1).optional(),
);

const sectionSchema = z
  .object({
    id: z.string().regex(slugPattern, '章节 ID 只能使用小写英文、数字和连字符'),
    level: z.union([z.literal(2), z.literal(3)]),
    titleZh: optionalText,
    titleEn: optionalText,
    bodyZh: optionalText,
    bodyEn: optionalText,
  })
  .superRefine((section, context) => {
    if (!section.titleZh && !section.bodyZh && !section.titleEn && !section.bodyEn) {
      context.addIssue({
        code: 'custom',
        message: `章节“${section.id}”必须至少提供一种语言的标题或正文`,
      });
    }
  });

export const manualSchema = z
  .object({
    slug: z.string().regex(slugPattern, 'slug 只能使用小写英文、数字和连字符'),
    published: z.boolean(),
    titleZh: z.string().trim().min(1, '中文名称不能为空'),
    titleEn: optionalText,
    contentType: z.enum(['vehicle-manual', 'setup-guide', 'reference']),
    brand: z.string().trim().min(1, '品牌不能为空'),
    vehicleClass: z.enum(['GT3', 'GT4', 'Cup', 'Prototype', 'Touring']),
    platform: z.string().trim().min(1, '模拟平台不能为空'),
    discipline: z.enum([
      'oval',
      'sports-car',
      'formula-car',
      'dirt-oval',
      'legacy-car',
      'other',
    ]),
    cover: z
      .string()
      .regex(mediaPathPattern, '封面必须位于 ./assets/{slug}/ 目录')
      .optional(),
    source: z.object({
      type: z.enum(['synthetic', 'official']),
      title: z.string().trim().min(1, '来源名称不能为空'),
      revision: optionalText,
      publishedAt: z.coerce.date().optional(),
      notice: z.string().trim().min(1, '来源声明不能为空'),
    }),
    sections: z.array(sectionSchema).min(1, '手册必须至少包含一个章节'),
  })
  .superRefine((manual, context) => {
    if (manual.published && !manual.cover) {
      context.addIssue({
        code: 'custom',
        path: ['cover'],
        message: '已发布手册必须设置封面',
      });
    }

    if (manual.cover && !manual.cover.startsWith(`./assets/${manual.slug}/`)) {
      context.addIssue({
        code: 'custom',
        path: ['cover'],
        message: `手册“${manual.slug}”的封面必须位于它自己的媒体目录`,
      });
    }

    const sectionIds = new Set<string>();
    let hasH2 = false;

    manual.sections.forEach((section, index) => {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: 'custom',
          path: ['sections', index, 'id'],
          message: `章节 ID“${section.id}”重复`,
        });
      }
      sectionIds.add(section.id);

      if (section.level === 2) {
        hasH2 = true;
      } else if (!hasH2) {
        context.addIssue({
          code: 'custom',
          path: ['sections', index, 'level'],
          message: `章节“${section.id}”是 H3，但它之前没有 H2`,
        });
      }
    });
  });

export type Manual = z.infer<typeof manualSchema>;

export function assertManualFilename(manual: Manual, entryId: string): void {
  if (manual.slug !== entryId) {
    throw new Error(
      `手册“${manual.slug}”的 slug 必须与文件名“${entryId}.yml”一致`,
    );
  }
}
