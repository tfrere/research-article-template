import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import mermaid from 'astro-mermaid';
import compressor from 'astro-compressor';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkFootnotes from 'remark-footnotes';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeCitation from 'rehype-citation';
import rehypeCodeCopy from './plugins/rehype/code-copy.mjs';
import rehypeReferencesAndFootnotes from './plugins/rehype/post-citation.mjs';
import remarkIgnoreCitationsInCode from './plugins/remark/ignore-citations-in-code.mjs';
import remarkDirective from 'remark-directive';
import remarkOutputContainer from './plugins/remark/output-container.mjs';
import rehypeRestoreAtInCode from './plugins/rehype/restore-at-in-code.mjs';
import rehypeWrapTables from './plugins/rehype/wrap-tables.mjs';
import rehypeWrapOutput from './plugins/rehype/wrap-outputs.mjs';
// Built-in Shiki (dual themes) — no rehype-pretty-code

// Plugins moved to app/plugins/*

export default defineConfig({
  output: 'static',
  integrations: [
    mermaid({ theme: 'neutral', autoTheme: true }),
    mdx(),
    svelte(),
    // Precompress output with Gzip only (Brotli disabled due to server module mismatch)
    compressor({ brotli: false, gzip: true })
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
      remarkIgnoreCitationsInCode,
      remarkMath,
      [remarkFootnotes, { inlineNotes: true }],
      remarkDirective,
      remarkOutputContainer
    ],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
      [rehypeKatex, {
        trust: true,
      }],
      [rehypeCitation, {
        bibliography: 'src/content/bibliography.bib',
        linkCitations: true,
        csl: "apa",
      }],
      rehypeReferencesAndFootnotes,
      rehypeRestoreAtInCode,
      rehypeCodeCopy,
      rehypeWrapOutput,
      rehypeWrapTables
    ]
  }
});


