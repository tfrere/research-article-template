#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEFAULT_INPUT = join(__dirname, 'output');
const DEFAULT_OUTPUT = join(__dirname, 'output');
const STATIC_FRONTMATTER_PATH = join(__dirname, 'static', 'frontmatter.mdx');

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        input: DEFAULT_INPUT,
        output: DEFAULT_OUTPUT,
    };

    for (const arg of args) {
        if (arg.startsWith('--input=')) {
            config.input = arg.substring('--input='.length);
        } else if (arg.startsWith('--output=')) {
            config.output = arg.substring('--output='.length);
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
📝 Notion Markdown to MDX Converter

Usage:
  node mdx-converter.mjs [options]

Options:
  --input=PATH     Input directory or file (default: ${DEFAULT_INPUT})
  --output=PATH    Output directory (default: ${DEFAULT_OUTPUT})
  --help, -h       Show this help

Examples:
  # Convert all markdown files in output directory
  node mdx-converter.mjs

  # Convert specific file
  node mdx-converter.mjs --input=article.md --output=converted/

  # Convert directory
  node mdx-converter.mjs --input=markdown-files/ --output=mdx-files/
            `);
            process.exit(0);
        } else if (!config.input) {
            config.input = arg;
        } else if (!config.output) {
            config.output = arg;
        }
    }
    return config;
}

/**
 * Track which Astro components are used during transformations
 */
const usedComponents = new Set();

/**
 * Track individual image imports needed
 */
const imageImports = new Map(); // src -> varName

/**
 * Generate a variable name from image path
 * @param {string} src - Image source path
 * @returns {string} - Valid variable name
 */
function generateImageVarName(src) {
    // Extract filename without extension and make it a valid JS variable
    const filename = src.split('/').pop().replace(/\.[^.]+$/, '');
    return filename.replace(/[^a-zA-Z0-9]/g, '_').replace(/^[0-9]/, 'img_$&');
}

/**
 * Detect and track Astro components used in the content
 * @param {string} content - MDX content
 */
function detectAstroComponents(content) {
    console.log('  🔍 Detecting Astro components in content...');

    let detectedCount = 0;

    // Known Astro components that should be auto-imported
    const knownComponents = [
        'HtmlEmbed', 'Image', 'Note', 'Sidenote', 'Wide', 'FullWidth',
        'Accordion', 'Quote', 'Reference', 'Glossary', 'Stack', 'ThemeToggle',
        'RawHtml', 'HfUser'
    ];

    // Find all JSX elements that look like Astro components
    // Pattern: <ComponentName ... />
    const componentMatches = content.match(/<([A-Z][a-zA-Z0-9]*)\s*[^>]*\/?>/g);

    if (componentMatches) {
        for (const match of componentMatches) {
            // Extract component name from the JSX element
            const componentMatch = match.match(/<([A-Z][a-zA-Z0-9]*)/);
            if (componentMatch) {
                const componentName = componentMatch[1];

                // Only track known Astro components (skip HTML elements)
                if (knownComponents.includes(componentName) && !usedComponents.has(componentName)) {
                    usedComponents.add(componentName);
                    detectedCount++;
                    console.log(`    📦 Found component: ${componentName}`);
                }
            }
        }
    }

    if (detectedCount > 0) {
        console.log(`    ✅ Detected ${detectedCount} new Astro component(s)`);
    } else {
        console.log(`    ℹ️  No new Astro components detected`);
    }
}

/**
 * Add required component imports to the frontmatter
 * @param {string} content - MDX content
 * @returns {string} - Content with component imports
 */
function addComponentImports(content) {
    console.log('  📦 Adding component and image imports...');

    let imports = [];

    // Add component imports
    if (usedComponents.size > 0) {
        const componentImports = Array.from(usedComponents)
            .map(component => `import ${component} from '../components/${component}.astro';`);
        imports.push(...componentImports);
        console.log(`    ✅ Importing components: ${Array.from(usedComponents).join(', ')}`);
    }

    // Add image imports
    if (imageImports.size > 0) {
        const imageImportStatements = Array.from(imageImports.entries())
            .map(([src, varName]) => `import ${varName} from '${src}';`);
        imports.push(...imageImportStatements);
        console.log(`    ✅ Importing ${imageImports.size} image(s)`);
    }

    if (imports.length === 0) {
        console.log('    ℹ️  No imports needed');
        return content;
    }

    const importBlock = imports.join('\n');

    // Insert imports after frontmatter
    const frontmatterEnd = content.indexOf('---', 3) + 3;
    if (frontmatterEnd > 2) {
        return content.slice(0, frontmatterEnd) + '\n\n' + importBlock + '\n\n' + content.slice(frontmatterEnd);
    } else {
        // No frontmatter, add at beginning
        return importBlock + '\n\n' + content;
    }
}


/**
 * Load static frontmatter from file
 * @returns {object} - Static frontmatter data
 */
function loadStaticFrontmatter() {
    try {
        if (existsSync(STATIC_FRONTMATTER_PATH)) {
            const staticContent = readFileSync(STATIC_FRONTMATTER_PATH, 'utf8');
            const { data } = matter(staticContent);
            console.log('    ✅ Loaded static frontmatter from file');
            return data;
        }
        console.log('    ℹ️  No static frontmatter file found');
        return {};
    } catch (error) {
        console.log(`    ⚠️  Failed to load static frontmatter: ${error.message}`);
        return {};
    }
}

/**
 * Ensure proper frontmatter for MDX using static file first, then existing data
 * @param {string} content - MDX content
 * @param {string} pageId - Notion page ID (optional, kept for compatibility but ignored)
 * @param {string} notionToken - Notion API token (optional, kept for compatibility but ignored)
 * @returns {string} - Content with proper frontmatter
 */
async function ensureFrontmatter(content, pageId = null, notionToken = null) {
    console.log('  📄 Ensuring proper frontmatter...');

    // Load static frontmatter first (highest priority)
    const staticData = loadStaticFrontmatter();

    if (!content.startsWith('---')) {
        // No frontmatter in content, use static + basic defaults
        let baseData = { ...staticData };

        // Add basic defaults for required fields if not in static
        if (!baseData.title) baseData.title = 'Article';
        if (!baseData.published) {
            baseData.published = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
            });
        }
        if (baseData.tableOfContentsAutoCollapse === undefined) {
            baseData.tableOfContentsAutoCollapse = true;
        }

        const frontmatter = matter.stringify('', baseData);
        console.log('    ✅ Applied static frontmatter to content without frontmatter');
        return frontmatter + content;
    }

    // Parse existing frontmatter and merge with static (static takes priority)
    try {
        const { data: existingData, content: body } = matter(content);

        // Merge: existing data first, then static data overrides
        const mergedData = { ...existingData, ...staticData };

        // Ensure required fields if still missing after merge
        if (!mergedData.title) mergedData.title = 'Article';
        if (!mergedData.published) {
            mergedData.published = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
            });
        }
        if (mergedData.tableOfContentsAutoCollapse === undefined) {
            mergedData.tableOfContentsAutoCollapse = true;
        }

        const enhancedContent = matter.stringify(body, mergedData);
        console.log('    ✅ Merged static and existing frontmatter');
        return enhancedContent;
    } catch (error) {
        console.log('    ⚠️  Could not parse frontmatter, keeping as is');
        return content;
    }
}

/**
 * Generate basic frontmatter
 * @returns {string} - Basic frontmatter
 */
function generateBasicFrontmatter() {
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });
    return `---
title: "Notion Article"
published: "${currentDate}"
tableOfContentsAutoCollapse: true
---

`;
}


/**
 * Add a blank line after each markdown table
 * @param {string} content - MDX content
 * @returns {string} - Content with blank lines after tables
 */
function addBlankLineAfterTables(content) {
    console.log('  📋 Adding blank lines after tables...');

    let addedCount = 0;
    const lines = content.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
        result.push(lines[i]);

        // Check if current line is the end of a table
        if (lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
            // Look ahead to see if this is the last line of a table
            let isLastTableLine = false;

            // Check if next line is empty or doesn't start with |
            if (i + 1 >= lines.length ||
                lines[i + 1].trim() === '' ||
                !lines[i + 1].trim().startsWith('|')) {

                // Look back to find if we're actually inside a table
                let tableLineCount = 0;
                for (let j = i; j >= 0 && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|'); j--) {
                    tableLineCount++;
                }

                // Only add blank line if we found at least 2 table lines (making it a real table)
                if (tableLineCount >= 2) {
                    isLastTableLine = true;
                }
            }

            if (isLastTableLine) {
                addedCount++;
                result.push(''); // Add blank line
            }
        }
    }

    if (addedCount > 0) {
        console.log(`    ✅ Added blank line after ${addedCount} table(s)`);
    } else {
        console.log('    ℹ️  No tables found to process');
    }

    return result.join('\n');
}

/**
 * Transform markdown images to Image components
 * @param {string} content - Markdown content
 * @returns {string} - Content with Image components
 */
function transformMarkdownImages(content) {
    console.log('  🖼️  Transforming markdown images to Image components...');

    let transformedCount = 0;

    // Transform markdown images: ![alt](src) -> <Image src={varName} alt="alt" />
    content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        transformedCount++;

        // Clean up the src path - remove /media/ prefix and use relative path
        let cleanSrc = src;
        if (src.startsWith('/media/')) {
            cleanSrc = src.replace('/media/', './assets/image/');
        }

        // Generate variable name for the image import
        const varName = generateImageVarName(cleanSrc);

        // Add to imageImports if not already present
        if (!imageImports.has(cleanSrc)) {
            imageImports.set(cleanSrc, varName);
        }

        // Extract filename for alt text if none provided
        const finalAlt = alt || src.split('/').pop().split('.')[0];

        return `<Image src={${varName}} alt="${finalAlt}" />`;
    });

    if (transformedCount > 0) {
        console.log(`    ✅ Transformed ${transformedCount} markdown image(s) to Image components with imports`);
    } else {
        console.log('    ℹ️  No markdown images found to transform');
    }

    return content;
}

/**
 * Fix smart quotes (curly quotes) and replace them with straight quotes
 * @param {string} content - Markdown content
 * @returns {string} - Content with fixed quotes
 */
function fixSmartQuotes(content) {
    console.log('  ✏️  Fixing smart quotes (curly quotes)...');

    let fixedCount = 0;
    const originalContent = content;

    // Replace opening smart double quotes (\u201C) with straight quotes (")
    content = content.replace(/\u201C/g, '"');

    // Replace closing smart double quotes (\u201D) with straight quotes (")
    content = content.replace(/\u201D/g, '"');

    // Replace opening smart single quotes (\u2018) with straight quotes (')
    content = content.replace(/\u2018/g, "'");

    // Replace closing smart single quotes (\u2019) with straight quotes (')
    content = content.replace(/\u2019/g, "'");

    // Count the number of replacements made
    fixedCount = 0;
    for (let i = 0; i < originalContent.length; i++) {
        const char = originalContent[i];
        if (char === '\u201C' || char === '\u201D' || char === '\u2018' || char === '\u2019') {
            fixedCount++;
        }
    }

    if (fixedCount > 0) {
        console.log(`    ✅ Fixed ${fixedCount} smart quote(s)`);
    } else {
        console.log('    ℹ️  No smart quotes found');
    }

    return content;
}

/**
 * Main MDX processing function that applies all transformations
 * @param {string} content - Raw Markdown content
 * @param {string} pageId - Notion page ID (optional)
 * @param {string} notionToken - Notion API token (optional)
 * @returns {string} - Processed MDX content compatible with Astro
 */
async function processMdxContent(content, pageId = null, notionToken = null) {
    console.log('🔧 Processing for Astro MDX compatibility...');

    // Clear previous tracking
    usedComponents.clear();
    imageImports.clear();

    let processedContent = content;

    // Fix smart quotes first
    processedContent = fixSmartQuotes(processedContent);

    // Apply essential steps only
    processedContent = await ensureFrontmatter(processedContent, pageId, notionToken);

    // Add blank lines after tables
    processedContent = addBlankLineAfterTables(processedContent);

    // Transform markdown images to Image components
    processedContent = transformMarkdownImages(processedContent);

    // Detect Astro components used in the content before adding imports
    detectAstroComponents(processedContent);

    // Add component imports at the end
    processedContent = addComponentImports(processedContent);

    return processedContent;
}

/**
 * Convert a single markdown file to MDX
 * @param {string} inputFile - Input markdown file
 * @param {string} outputDir - Output directory
 * @param {string} pageId - Notion page ID (optional)
 * @param {string} notionToken - Notion API token (optional)
 */
async function convertFileToMdx(inputFile, outputDir, pageId = null, notionToken = null) {
    const filename = basename(inputFile, '.md');
    const outputFile = join(outputDir, `${filename}.mdx`);

    console.log(`📝 Converting: ${basename(inputFile)} → ${basename(outputFile)}`);

    try {
        const markdownContent = readFileSync(inputFile, 'utf8');
        const mdxContent = await processMdxContent(markdownContent, pageId, notionToken);
        writeFileSync(outputFile, mdxContent);

        console.log(`    ✅ Converted: ${outputFile}`);

        // Show file size
        const inputSize = Math.round(markdownContent.length / 1024);
        const outputSize = Math.round(mdxContent.length / 1024);
        console.log(`    📊 Input: ${inputSize}KB → Output: ${outputSize}KB`);

    } catch (error) {
        console.error(`    ❌ Failed to convert ${inputFile}: ${error.message}`);
    }
}

/**
 * Convert all markdown files in a directory to MDX
 * @param {string} inputPath - Input path (file or directory)
 * @param {string} outputDir - Output directory
 * @param {string} pageId - Notion page ID (optional)
 * @param {string} notionToken - Notion API token (optional)
 */
async function convertToMdx(inputPath, outputDir, pageId = null, notionToken = null) {
    console.log('📝 Notion Markdown to Astro MDX Converter');
    console.log(`📁 Input:  ${inputPath}`);
    console.log(`📁 Output: ${outputDir}`);

    // Check if input exists
    if (!existsSync(inputPath)) {
        console.error(`❌ Input not found: ${inputPath}`);
        process.exit(1);
    }

    try {
        // Ensure output directory exists
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }

        let filesToConvert = [];

        if (statSync(inputPath).isDirectory()) {
            // Convert all .md files in directory
            const files = readdirSync(inputPath);
            filesToConvert = files
                .filter(file => file.endsWith('.md') && !file.includes('.raw.md'))
                .map(file => join(inputPath, file));
        } else if (inputPath.endsWith('.md')) {
            // Convert single file
            filesToConvert = [inputPath];
        } else {
            console.error('❌ Input must be a .md file or directory containing .md files');
            process.exit(1);
        }

        if (filesToConvert.length === 0) {
            console.log('ℹ️  No .md files found to convert');
            return;
        }

        console.log(`🔄 Found ${filesToConvert.length} file(s) to convert`);

        // Convert each file
        for (const file of filesToConvert) {
            await convertFileToMdx(file, outputDir, pageId, notionToken);
        }

        console.log(`✅ Conversion completed! ${filesToConvert.length} file(s) processed`);

    } catch (error) {
        console.error('❌ Conversion failed:', error.message);
        process.exit(1);
    }
}

export { convertToMdx };

function main() {
    const config = parseArgs();
    convertToMdx(config.input, config.output);
    console.log('🎉 MDX conversion completed!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
