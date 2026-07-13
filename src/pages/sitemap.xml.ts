import { getPublishedManuals } from '../lib/manuals';

export const prerender = true;

export async function GET({ site }: { site: URL }) {
  const manuals = await getPublishedManuals();
  const urls = [
    new URL('/', site).href,
    ...manuals.map(({ data }) => new URL(`/manuals/${data.slug}/`, site).href),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
