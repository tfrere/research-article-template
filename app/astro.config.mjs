import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkToc from 'remark-toc';
import remarkFootnotes from 'remark-footnotes';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeCitation from 'rehype-citation';

export default defineConfig({
  output: 'static',
  integrations: [mdx()]
  ,
  markdown: {
    remarkPlugins: [
      [remarkToc, { heading: 'Table of Contents', maxDepth: 3 }],
      remarkMath,
      [remarkFootnotes, { inlineNotes: true }]
    ],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
      rehypeKatex,
      [rehypeCitation, {
        bibliography: 'src/content/bibliography.bib',
        linkCitations: true
      }]
    ]
  }
});


