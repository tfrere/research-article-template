import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkToc from 'remark-toc';
import remarkFootnotes from 'remark-footnotes';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeCitation from 'rehype-citation';
import rehypePrettyCode from 'rehype-pretty-code';

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
      [rehypePrettyCode, {
        theme: {
          light: 'github-light',
          dark: 'github-dark'
        },
        keepBackground: false,
        defaultLang: 'text'
      }],
      [rehypeCitation, {
        bibliography: 'src/content/bibliography.bib',
        linkCitations: true
      }]
    ]
  }
});


