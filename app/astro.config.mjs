import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import mermaid from 'astro-mermaid';
import compressor from 'astro-compressor';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkFootnotes from 'remark-footnotes';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeCitation from 'rehype-citation';
// Built-in Shiki (dual themes) — no rehype-pretty-code

export default defineConfig({
  output: 'static',
  integrations: [
    mermaid({ theme: 'forest', autoTheme: true }),
    mdx(),
    // Precompress output with Brotli (preferred) and Gzip as fallback
    compressor({ brotli: true, gzip: true })
  ],
  devToolbar: {
    enabled: false
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      defaultColor: false,
      wrap: false,
      langAlias: {
        // Map MDX fences to TSX for better JSX tokenization
        mdx: 'tsx'
      }
    },
    remarkPlugins: [
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


