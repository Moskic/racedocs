import {
  createSatteriMarkdownProcessor,
  type SatteriMarkdownProcessorOptions,
} from '@astrojs/markdown-satteri';
import sanitizeHtml from 'sanitize-html';

export interface RenderedManualImage {
  src: string;
  srcset?: string;
  sizes?: string;
  width: number;
  height: number;
  loading: 'lazy';
  decoding: 'async';
}

export type ManualImageResolver = (reference: string) => Promise<RenderedManualImage>;

interface ManualMarkdownOptions {
  manualSlug: string;
  resolveImage: ManualImageResolver;
}

interface ManualImageContext extends ManualMarkdownOptions {
  allowedSources: Set<string>;
}

type HastPlugin = NonNullable<SatteriMarkdownProcessorOptions['hastPlugins']>[number];

const imageContextKey = '__racedocsManualImageContext';
const manualImagePlugin: HastPlugin = {
  name: 'manual-images',
  element: {
    filter: ['img'],
    async visit(node, context) {
      const rawSrc = node.properties?.src;
      if (typeof rawSrc !== 'string' || !rawSrc.startsWith('./assets/')) return;

      const imageContext = context.data.astro?.frontmatter[imageContextKey] as
        | ManualImageContext
        | undefined;
      if (!imageContext) throw new Error('手册 Markdown 图片缺少构建上下文');

      const image = await imageContext.resolveImage(rawSrc);
      imageContext.allowedSources.add(image.src);

      const alt = typeof node.properties?.alt === 'string' ? node.properties.alt : '';
      const title =
        typeof node.properties?.title === 'string' ? node.properties.title : undefined;
      context.replaceNode(node, {
        type: 'element',
        tagName: 'img',
        properties: {
          src: image.src,
          alt,
          ...(title ? { title } : {}),
          ...(image.srcset ? { srcSet: image.srcset } : {}),
          ...(image.sizes ? { sizes: image.sizes } : {}),
          width: image.width,
          height: image.height,
          loading: image.loading,
          decoding: image.decoding,
        },
        children: [],
      });
    },
  },
};

const renderer = await createSatteriMarkdownProcessor({
  syntaxHighlight: false,
  hastPlugins: [manualImagePlugin],
});

const allowedTags = [
  'p',
  'br',
  'strong',
  'em',
  'del',
  'a',
  'img',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'hr',
  'h2',
  'h3',
  'h4',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

export async function renderManualMarkdown(
  markdown: string,
  options: ManualMarkdownOptions,
): Promise<string> {
  const allowedSources = new Set<string>();
  const imageContext: ManualImageContext = { ...options, allowedSources };
  const { code } = await renderer.render(markdown, {
    frontmatter: { [imageContextKey]: imageContext },
  });

  const safeHtml = sanitizeHtml(code, {
    allowedTags,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: [
        'src',
        'srcset',
        'sizes',
        'alt',
        'title',
        'width',
        'height',
        'loading',
        'decoding',
      ],
      th: ['align'],
      td: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    exclusiveFilter: (frame) =>
      frame.tag === 'img' && !allowedSources.has(frame.attribs.src ?? ''),
    transformTags: {
      a: (_tagName, attributes) => {
        if (/^https?:\/\//i.test(attributes.href ?? '')) {
          return {
            tagName: 'a',
            attribs: {
              ...attributes,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          };
        }
        return { tagName: 'a', attribs: attributes };
      },
    },
  });

  return safeHtml.replaceAll('<table>', '<div class="table-scroll"><table>').replaceAll(
    '</table>',
    '</table></div>',
  );
}
