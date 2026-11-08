// Options for rehype-autolink-headings: append a link icon after the heading
// text (h2-h4). The copy-to-clipboard behaviour lives in
// src/scripts/layout/heading-anchors.ts.

const path = (d) => ({ type: 'element', tagName: 'path', properties: { d }, children: [] });

const linkIcon = {
  type: 'element',
  tagName: 'svg',
  properties: {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.6',
    strokeLinecap: 'round',
    ariaHidden: 'true',
    focusable: 'false',
  },
  children: [
    path('M6.8 9.2a2.8 2.8 0 0 0 4 0l2.2-2.2a2.8 2.8 0 0 0-4-4l-.9.9'),
    path('M9.2 6.8a2.8 2.8 0 0 0-4 0L3 9a2.8 2.8 0 0 0 4 4l.9-.9'),
  ],
};

export const headingAnchorOptions = {
  behavior: 'append',
  test: ['h2', 'h3', 'h4'],
  properties: { className: ['h-anchor'], ariaLabel: 'Link to this section' },
  content: linkIcon,
};
