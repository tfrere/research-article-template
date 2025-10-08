#!/usr/bin/env node

import { config } from 'dotenv';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { convertNotionToMarkdown } from './notion-converter.mjs';
import { convertToMdx } from './mdx-converter.mjs';
import { Client } from '@notionhq/client';

// Load environment variables from .env file (but don't override existing ones)
config({ override: false });

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
        token: process.env.NOTION_TOKEN,
        pageId: process.env.NOTION_PAGE_ID
    };

    for (const arg of args) {
        if (arg.startsWith('--input=')) {
            config.input = arg.split('=')[1];
        } else if (arg.startsWith('--output=')) {
            config.output = arg.split('=')[1];
        } else if (arg.startsWith('--token=')) {
            config.token = arg.split('=')[1];
        } else if (arg.startsWith('--page-id=')) {
            config.pageId = arg.split('=')[1];
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

/**
 * Create a temporary pages.json from NOTION_PAGE_ID environment variable
 * Extracts title and generates slug from the Notion page
 */
async function createPagesConfigFromEnv(pageId, token, outputPath) {
    try {
        console.log('🔍 Fetching page info from Notion API...');
        const notion = new Client({ auth: token });
        const page = await notion.pages.retrieve({ page_id: pageId });

        // Extract title
        let title = 'Article';
        if (page.properties.title && page.properties.title.title && page.properties.title.title.length > 0) {
            title = page.properties.title.title[0].plain_text;
        } else if (page.properties.Name && page.properties.Name.title && page.properties.Name.title.length > 0) {
            title = page.properties.Name.title[0].plain_text;
        }

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();

        console.log(`    ✅ Found page: "${title}" (slug: ${slug})`);

        // Create pages config
        const pagesConfig = {
            pages: [{
                id: pageId,
                title: title,
                slug: slug
            }]
        };

        // Write to temporary file
        writeFileSync(outputPath, JSON.stringify(pagesConfig, null, 4));
        console.log(`    ✅ Created temporary pages config`);

        return pagesConfig;
    } catch (error) {
        console.error(`❌ Error fetching page from Notion: ${error.message}`);
        throw error;
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
            // Read and write instead of copy to avoid EPERM issues
            const mdxContent = readFileSync(mdxFile, 'utf8');
            writeFileSync(ASTRO_CONTENT_PATH, mdxContent);
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
        // Prepare input config file
        let inputConfigFile = config.input;
        let pageIdFromEnv = null;

        // If NOTION_PAGE_ID is provided via env var, create temporary pages.json
        if (config.pageId && config.token) {
            console.log('✨ Using NOTION_PAGE_ID from environment variable');
            const tempConfigPath = join(config.output, '.temp-pages.json');
            ensureDirectory(config.output);
            await createPagesConfigFromEnv(config.pageId, config.token, tempConfigPath);
            inputConfigFile = tempConfigPath;
            pageIdFromEnv = config.pageId;
        } else if (!existsSync(config.input)) {
            console.error(`❌ No NOTION_PAGE_ID environment variable and no pages.json found at: ${config.input}`);
            console.log('💡 Either set NOTION_PAGE_ID env var or create input/pages.json');
            process.exit(1);
        }

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
            await convertNotionToMarkdown(inputConfigFile, config.output, config.token);

        } else {
            // Full workflow
            console.log('🔄 Full conversion workflow');

            // Step 1: Convert Notion to Markdown
            console.log('\n📄 Step 1: Converting Notion pages to Markdown...');
            await convertNotionToMarkdown(inputConfigFile, config.output, config.token);

            // Step 2: Convert Markdown to MDX with Notion metadata
            console.log('\n📝 Step 2: Converting Markdown to MDX...');
            const pagesConfig = readPagesConfig(inputConfigFile);
            const firstPage = pagesConfig.pages && pagesConfig.pages.length > 0 ? pagesConfig.pages[0] : null;
            const pageId = pageIdFromEnv || (firstPage ? firstPage.id : null);
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
