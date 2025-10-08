# Changelog

All notable changes to the Research Article Template will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial open source release
- Comprehensive documentation
- Contributing guidelines
- License file

## [1.0.0] - 2024-12-19

### Added
- **Core Features**:
  - Markdown/MDX-based writing system
  - KaTeX mathematical notation support
  - Syntax highlighting for code blocks
  - Academic citations with BibTeX integration
  - Footnotes and sidenotes system
  - Auto-generated table of contents
  - Interactive Mermaid diagrams
  - Plotly.js and D3.js integration
  - HTML embed support
  - Gradio app embedding
  - Dataviz color palettes
  - Image optimization
  - SEO-friendly structure
  - Automatic PDF export
  - Dark/light theme toggle
  - Mobile-responsive design
  - LaTeX import functionality
  - Template synchronization system

- **Components**:
  - Figure component with captions
  - MultiFigure for image galleries
  - Note component with variants
  - Quote component
  - Accordion for collapsible content
  - Sidenote component
  - Table of Contents
  - Theme Toggle
  - HTML Embed
  - Raw HTML support
  - SEO component
  - Hero section
  - Footer
  - Full-width and wide layouts

- **Build System**:
  - Astro 4.10.0 integration
  - PostCSS with custom media queries
  - Automatic compression
  - Docker support
  - Nginx configuration
  - Git LFS support

- **Scripts**:
  - PDF export functionality
  - LaTeX to MDX conversion
  - Template synchronization
  - Font SVG generation
  - TrackIO data generation

- **Documentation**:
  - Getting started guide
  - Writing best practices
  - Component reference
  - LaTeX conversion guide
  - Interactive examples

### Technical Details
- **Framework**: Astro 4.10.0
- **Styling**: PostCSS with custom properties
- **Math**: KaTeX 0.16.22
- **Charts**: Plotly.js 3.1.0, D3.js 7.9.0
- **Diagrams**: Mermaid 11.10.1
- **Node.js**: >=20.0.0
- **License**: CC-BY-4.0

### Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## Version History

- **1.0.0**: Initial stable release with full feature set
- **0.0.1**: Development version (pre-release)

## Migration Guide

### From 0.0.1 to 1.0.0

This is the first stable release. No breaking changes from the development version.

### Updating Your Project

Use the template synchronization system to update:

```bash
npm run sync:template -- --dry-run  # Preview changes
npm run sync:template               # Apply updates
```

## Support

- **Documentation**: [Hugging Face Space](https://huggingface.co/spaces/tfrere/research-article-template)
- **Issues**: [Community Discussions](https://huggingface.co/spaces/tfrere/research-article-template/discussions)
- **Contact**: [@tfrere](https://huggingface.co/tfrere)
