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

// Minimal rehype plugin to wrap code blocks with a copy button and a language label
function rehypeCodeCopyAndLabel() {
  return (tree) => {
    // Walk the tree; lightweight visitor to find <pre><code>
    const visit = (node, parent) => {
      if (!node || typeof node !== 'object') return;
      const children = Array.isArray(node.children) ? node.children : [];
      if (node.tagName === 'pre' && children.some(c => c.tagName === 'code')) {
        // Find code child and guess language
        const code = children.find(c => c.tagName === 'code');
        const collectClasses = (val) => Array.isArray(val) ? val.map(String) : (typeof val === 'string' ? String(val).split(/\s+/) : []);
        const fromClass = (names) => {
          const hit = names.find((n) => /^language-/.test(String(n)));
          return hit ? String(hit).replace(/^language-/, '') : '';
        };
        const codeClasses = collectClasses(code?.properties?.className);
        const preClasses = collectClasses(node?.properties?.className);
        const candidates = [
          code?.properties?.['data-language'],
          fromClass(codeClasses),
          node?.properties?.['data-language'],
          fromClass(preClasses),
        ];
        let lang = candidates.find(Boolean) || '';
        const lower = String(lang).toLowerCase();
        const toExt = (s) => {
          switch (String(s).toLowerCase()) {
            case 'typescript': case 'ts': return 'ts';
            case 'tsx': return 'tsx';
            case 'javascript': case 'js': case 'node': return 'js';
            case 'jsx': return 'jsx';
            case 'python': case 'py': return 'py';
            case 'bash': case 'shell': case 'sh': return 'sh';
            case 'markdown': case 'md': return 'md';
            case 'yaml': case 'yml': return 'yml';
            case 'html': return 'html';
            case 'css': return 'css';
            case 'json': return 'json';
            default: return lower || '';
          }
        };
        const ext = toExt(lower);
        const displayLang = ext ? String(ext).toUpperCase() : '';
        // Determine if single-line block: prefer Shiki lines, then text content
        const countLinesFromShiki = () => {
          const isLineEl = (el) => el && el.type === 'element' && el.tagName === 'span' && Array.isArray(el.properties?.className) && el.properties.className.includes('line');
          const hasNonWhitespaceText = (node) => {
            if (!node) return false;
            if (node.type === 'text') return /\S/.test(String(node.value || ''));
            const kids = Array.isArray(node.children) ? node.children : [];
            return kids.some(hasNonWhitespaceText);
          };
          const collectLines = (node, acc) => {
            if (!node || typeof node !== 'object') return;
            if (isLineEl(node)) acc.push(node);
            const kids = Array.isArray(node.children) ? node.children : [];
            kids.forEach((k) => collectLines(k, acc));
          };
          const lines = [];
          collectLines(code, lines);
          const nonEmpty = lines.filter((ln) => hasNonWhitespaceText(ln)).length;
          return nonEmpty || 0;
        };
        const countLinesFromText = () => {
          // Parse raw text content of the <code> node including nested spans
          const extractText = (node) => {
            if (!node) return '';
            if (node.type === 'text') return String(node.value || '');
            const kids = Array.isArray(node.children) ? node.children : [];
            return kids.map(extractText).join('');
          };
          const raw = extractText(code);
          if (!raw || !/\S/.test(raw)) return 0;
          return raw.split('\n').filter(line => /\S/.test(line)).length;
        };
        const lines = countLinesFromShiki() || countLinesFromText();
        const isSingleLine = lines <= 1;
        // Also treat code blocks shorter than a threshold as single-line (defensive)
        if (!isSingleLine) {
          const approxChars = (() => {
            const extract = (n) => Array.isArray(n?.children) ? n.children.map(extract).join('') : (n?.type === 'text' ? String(n.value||'') : '');
            return extract(code).length;
          })();
          if (approxChars < 6) {
            // e.g., "npm i" alone
            // downgrade to single-line behavior
            node.__forceSingle = true;
          }
        }
        // Ensure CSS-only label works: set data-language on <code> and <pre>, and wrapper
        code.properties = code.properties || {};
        if (ext) code.properties['data-language'] = ext;
        node.properties = node.properties || {};
        if (ext) node.properties['data-language'] = ext;
        // Replace <pre> with wrapper div.code-card containing button + pre
        const wrapper = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['code-card'].concat((isSingleLine || node.__forceSingle) ? ['no-copy'] : []), 'data-language': ext },
          children: (isSingleLine || node.__forceSingle) ? [ node ] : [
            {
              type: 'element',
              tagName: 'button',
              properties: { className: ['code-copy', 'button--ghost'], type: 'button', 'aria-label': 'Copy code' },
              children: [
                {
                  type: 'element',
                  tagName: 'svg',
                  properties: { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
                  children: [
                    { type: 'element', tagName: 'path', properties: { d: 'M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z' }, children: [] }
                  ]
                }
              ]
            },
            node
          ]
        };
        if (parent && Array.isArray(parent.children)) {
          const idx = parent.children.indexOf(node);
          if (idx !== -1) parent.children[idx] = wrapper;
        }
        return; // don't visit nested
      }
      children.forEach((c) => visit(c, node));
    };
    visit(tree, null);
  };
}

export default defineConfig({
  output: 'static',
  integrations: [
    mermaid({ theme: 'forest', autoTheme: true }),
    mdx(),
    // Precompress output with Gzip only (Brotli disabled due to server module mismatch)
    compressor({ brotli: false, gzip: true })
  ],
  devToolbar: {
    enabled: false
  },
  // Expose a public flag to control TOC auto-collapse behavior at runtime
  // This can be overridden via environment variable PUBLIC_TOC_AUTO_COLLAPSE
  // (Vite define provides a default fallback when env is not set.)
  vite: {
    define: {
      'import.meta.env.PUBLIC_TOC_AUTO_COLLAPSE': JSON.stringify(false),
      'import.meta.env.PUBLIC_TABLE_OF_CONTENT_AUTO_COLLAPSE': JSON.stringify(false)
    }
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
      }],
      rehypeCodeCopyAndLabel
    ]
  }
});


