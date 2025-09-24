#!/usr/bin/env node

import { config } from 'dotenv';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { convertNotionToMarkdown } from './notion-converter.mjs';
import { convertToMdx } from './mdx-converter.mjs';

// Load environment variables from .env file
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default configuration
const DEFAULT_INPUT = join(__dirname, 'input', 'pages.json');
const DEFAULT_OUTPUT = join(__dirname, 'output');
const ASTRO_CONTENT_PATH = join(__dirname, '..', '..', 'src', 'content', 'article.mdx');
const ASTRO_ASSETS_PATH = join(__dirname, '..', '..', 'src', 'content', 'assets', 'image');
const ASTRO_BIB_PATH = join(__dirname, '..', '..', 'src', 'content', 'bibliography.bib');

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        input: DEFAULT_INPUT,
        output: DEFAULT_OUTPUT,
        clean: false,
        notionOnly: false,
        mdxOnly: false,
        token: process.env.NOTION_TOKEN
    };

    for (const arg of args) {
        if (arg.startsWith('--input=')) {
            config.input = arg.split('=')[1];
        } else if (arg.startsWith('--output=')) {
            config.output = arg.split('=')[1];
        } else if (arg.startsWith('--token=')) {
            config.token = arg.split('=')[1];
        } else if (arg === '--clean') {
            config.clean = true;
        } else if (arg === '--notion-only') {
            config.notionOnly = true;
        } else if (arg === '--mdx-only') {
            config.mdxOnly = true;
        }
    }

    return config;
}

function showHelp() {
    console.log(`
🚀 Notion to MDX Toolkit

Usage:
  node index.mjs [options]

Options:
  --input=PATH      Input pages configuration file (default: input/pages.json)
  --output=PATH     Output directory (default: output/)
  --token=TOKEN     Notion API token (or set NOTION_TOKEN env var)
  --clean           Clean output directory before processing
  --notion-only     Only convert Notion to Markdown (skip MDX conversion)
  --mdx-only        Only convert existing Markdown to MDX
  --help, -h        Show this help

Environment Variables:
  NOTION_TOKEN      Your Notion integration token

Examples:
  # Full conversion workflow
  NOTION_TOKEN=your_token node index.mjs --clean

  # Only convert Notion pages to Markdown
  node index.mjs --notion-only --token=your_token

  # Only convert existing Markdown to MDX
  node index.mjs --mdx-only

  # Custom paths
  node index.mjs --input=my-pages.json --output=converted/ --token=your_token

Configuration File Format (pages.json):
{
  "pages": [
    {
      "id": "your-notion-page-id",
      "title": "Page Title",
      "slug": "page-slug"
    }
  ]
}

Workflow:
  1. Notion → Markdown (with media download)
  2. Markdown → MDX (with Astro components)
  3. Copy to Astro content directory
`);
}

function ensureDirectory(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

async function cleanDirectory(dir) {
    if (existsSync(dir)) {
        const { execSync } = await import('child_process');
        execSync(`rm -rf "${dir}"/*`, { stdio: 'inherit' });
    }
}

function readPagesConfig(inputFile) {
    try {
        const content = readFileSync(inputFile, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`❌ Error reading pages config: ${error.message}`);
        return { pages: [] };
    }
}

function copyToAstroContent(outputDir) {
    console.log('📋 Copying MDX files to Astro content directory...');

    try {
        // Ensure Astro directories exist
        mkdirSync(dirname(ASTRO_CONTENT_PATH), { recursive: true });
        mkdirSync(ASTRO_ASSETS_PATH, { recursive: true });

        // Copy MDX file
        const files = readdirSync(outputDir);
        const mdxFiles = files.filter(file => file.endsWith('.mdx'));
        if (mdxFiles.length > 0) {
            const mdxFile = join(outputDir, mdxFiles[0]); // Take the first MDX file
            copyFileSync(mdxFile, ASTRO_CONTENT_PATH);
            console.log(`    ✅ Copied MDX to ${ASTRO_CONTENT_PATH}`);
        }

        // Copy images
        const mediaDir = join(outputDir, 'media');
        if (existsSync(mediaDir)) {
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
            let imageCount = 0;

            function copyImagesRecursively(dir) {
                const files = readdirSync(dir);
                for (const file of files) {
                    const filePath = join(dir, file);
                    const stat = statSync(filePath);

                    if (stat.isDirectory()) {
                        copyImagesRecursively(filePath);
                    } else if (imageExtensions.some(ext => file.toLowerCase().endsWith(ext))) {
                        const filename = basename(filePath);
                        const destPath = join(ASTRO_ASSETS_PATH, filename);
                        copyFileSync(filePath, destPath);
                        imageCount++;
                    }
                }
            }

            copyImagesRecursively(mediaDir);
            console.log(`    ✅ Copied ${imageCount} image(s) to ${ASTRO_ASSETS_PATH}`);

            // Update image paths in MDX file
            const mdxContent = readFileSync(ASTRO_CONTENT_PATH, 'utf8');
            let updatedContent = mdxContent.replace(/\.\/media\//g, './assets/image/');
            // Remove the subdirectory from image paths since we copy images directly to assets/image/
            updatedContent = updatedContent.replace(/\.\/assets\/image\/[^\/]+\//g, './assets/image/');
            writeFileSync(ASTRO_CONTENT_PATH, updatedContent);
            console.log(`    ✅ Updated image paths in MDX file`);
        }

        // Create empty bibliography.bib
        writeFileSync(ASTRO_BIB_PATH, '');
        console.log(`    ✅ Created empty bibliography at ${ASTRO_BIB_PATH}`);

    } catch (error) {
        console.warn(`    ⚠️  Failed to copy to Astro: ${error.message}`);
    }
}


async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    const config = parseArgs();

    console.log('🚀 Notion to MDX Toolkit');
    console.log('========================');

    try {
        if (config.clean) {
            console.log('🧹 Cleaning output directory...');
            await cleanDirectory(config.output);
        }

        if (config.mdxOnly) {
            // Only convert existing Markdown to MDX
            console.log('📝 MDX conversion only mode');
            await convertToMdx(config.output, config.output);
            copyToAstroContent(config.output);

        } else if (config.notionOnly) {
            // Only convert Notion to Markdown
            console.log('📄 Notion conversion only mode');
            await convertNotionToMarkdown(config.input, config.output, config.token);

        } else {
            // Full workflow
            console.log('🔄 Full conversion workflow');

            // Step 1: Convert Notion to Markdown
            console.log('\n📄 Step 1: Converting Notion pages to Markdown...');
            await convertNotionToMarkdown(config.input, config.output, config.token);

            // Step 2: Convert Markdown to MDX with Notion metadata
            console.log('\n📝 Step 2: Converting Markdown to MDX...');
            const pagesConfig = readPagesConfig(config.input);
            const firstPage = pagesConfig.pages && pagesConfig.pages.length > 0 ? pagesConfig.pages[0] : null;
            const pageId = firstPage ? firstPage.id : null;
            await convertToMdx(config.output, config.output, pageId, config.token);

            // Step 3: Copy to Astro content directory
            console.log('\n📋 Step 3: Copying to Astro content directory...');
            copyToAstroContent(config.output);
        }

        console.log('\n🎉 Conversion completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Export functions for use as module
export { convertNotionToMarkdown, convertToMdx };

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
