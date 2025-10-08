#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { extractAndGenerateNotionFrontmatter } from './notion-metadata-extractor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEFAULT_INPUT = join(__dirname, 'output');
const DEFAULT_OUTPUT = join(__dirname, 'output');

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
        return content.slice(0, frontmatterEnd) + '\n\n' + importBlock + '\n' + content.slice(frontmatterEnd);
    } else {
        // No frontmatter, add at beginning
        return importBlock + '\n\n' + content;
    }
}

/**
 * Transform Notion images to Image components
 * @param {string} content - MDX content
 * @returns {string} - Content with Image components
 */
function transformImages(content) {
    console.log('  🖼️  Transforming images to Image components...');

    let hasImages = false;

    // Helper function to clean source paths
    const cleanSrcPath = (src) => {
        // Convert Notion media paths to relative paths
        return src.replace(/^\/media\//, './media/')
            .replace(/^\.\/media\//, './media/');
    };

    // Helper to clean caption text
    const cleanCaption = (caption) => {
        return caption
            .replace(/<[^>]*>/g, '')          // Remove HTML tags
            .replace(/\n/g, ' ')              // Replace newlines with spaces
            .replace(/\r/g, ' ')              // Replace carriage returns with spaces
            .replace(/\s+/g, ' ')             // Replace multiple spaces with single space
            .replace(/'/g, "\\'")             // Escape quotes
            .trim();                          // Trim whitespace
    };

    // Helper to clean alt text
    const cleanAltText = (alt, maxLength = 100) => {
        const cleaned = alt
            .replace(/<[^>]*>/g, '')          // Remove HTML tags
            .replace(/\n/g, ' ')              // Replace newlines with spaces
            .replace(/\r/g, ' ')              // Replace carriage returns with spaces
            .replace(/\s+/g, ' ')             // Replace multiple spaces with single space
            .trim();                          // Trim whitespace

        return cleaned.length > maxLength
            ? cleaned.substring(0, maxLength) + '...'
            : cleaned;
    };

    // Create Image component with import
    const createImageComponent = (src, alt = '', caption = '') => {
        const cleanSrc = cleanSrcPath(src);

        // Skip PDF URLs and external URLs - they should remain as links only
        if (cleanSrc.includes('.pdf') || cleanSrc.includes('arxiv.org/pdf') ||
            (cleanSrc.startsWith('http') && !cleanSrc.includes('/media/'))) {
            console.log(`    ⚠️  Skipping external/PDF URL: ${cleanSrc}`);
            // Return the original markdown image syntax for external URLs
            return `![${alt}](${src})`;
        }

        const varName = generateImageVarName(cleanSrc);
        imageImports.set(cleanSrc, varName);
        usedComponents.add('Image');

        const props = [];
        props.push(`src={${varName}}`);
        props.push('zoomable');
        props.push('downloadable');
        props.push('layout="fixed"');
        if (alt) props.push(`alt="${alt}"`);
        if (caption) props.push(`caption={'${caption}'}`);

        return `<Image\n  ${props.join('\n  ')}\n/>`;
    };

    // Transform markdown images: ![alt](src)
    content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        const cleanSrc = cleanSrcPath(src);
        const cleanAlt = cleanAltText(alt || 'Image');
        hasImages = true;

        return createImageComponent(cleanSrc, cleanAlt);
    });

    // Transform images with captions (Notion sometimes adds captions as separate text)
    content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)\s*\n\s*([^\n]+)/g, (match, alt, src, caption) => {
        const cleanSrc = cleanSrcPath(src);
        const cleanAlt = cleanAltText(alt || 'Image');
        const cleanCap = cleanCaption(caption);
        hasImages = true;

        return createImageComponent(cleanSrc, cleanAlt, cleanCap);
    });

    if (hasImages) {
        console.log('    ✅ Image components with imports will be created');
    }

    return content;
}

/**
 * Transform Notion callouts to Note components
 * @param {string} content - MDX content
 * @returns {string} - Content with Note components
 */
function transformCallouts(content) {
    console.log('  📝 Transforming callouts to Note components...');

    let transformedCount = 0;

    // Transform blockquotes that look like Notion callouts
    content = content.replace(/^> \*\*([^*]+)\*\*\s*\n> (.+?)(?=\n> \*\*|\n\n|\n$)/gms, (match, title, content) => {
        transformedCount++;
        usedComponents.add('Note');

        const cleanContent = content
            .replace(/^> /gm, '')  // Remove blockquote markers
            .replace(/\n+/g, '\n') // Normalize newlines
            .trim();

        return `<Note type="${title.toLowerCase()}" title="${title}">\n${cleanContent}\n</Note>\n\n`;
    });

    if (transformedCount > 0) {
        console.log(`    ✅ Transformed ${transformedCount} callout(s) to Note components`);
    }

    return content;
}

/**
 * Transform Notion databases/tables to enhanced table components
 * @param {string} content - MDX content
 * @returns {string} - Content with enhanced tables
 */
function transformTables(content) {
    console.log('  📊 Enhancing tables...');

    let enhancedCount = 0;

    // Wrap tables in a container for better styling
    content = content.replace(/^(\|[^|\n]+\|[\s\S]*?)(?=\n\n|\n$)/gm, (match) => {
        if (match.includes('|') && match.split('\n').length > 2) {
            enhancedCount++;
            return `<div class="table-container">\n\n${match}\n\n</div>`;
        }
        return match;
    });

    if (enhancedCount > 0) {
        console.log(`    ✅ Enhanced ${enhancedCount} table(s)`);
    }

    return content;
}

/**
 * Transform Notion code blocks to enhanced code components
 * @param {string} content - MDX content
 * @returns {string} - Content with enhanced code blocks
 */
function transformCodeBlocks(content) {
    console.log('  💻 Enhancing code blocks...');

    let enhancedCount = 0;

    // Add copy functionality to code blocks
    content = content.replace(/^```(\w+)\n([\s\S]*?)\n```$/gm, (match, lang, code) => {
        enhancedCount++;
        return `\`\`\`${lang} copy\n${code}\n\`\`\``;
    });

    if (enhancedCount > 0) {
        console.log(`    ✅ Enhanced ${enhancedCount} code block(s)`);
    }

    return content;
}

/**
 * Fix Notion-specific formatting issues
 * @param {string} content - MDX content
 * @returns {string} - Content with fixed formatting
 */
function fixNotionFormatting(content) {
    console.log('  🔧 Fixing Notion formatting issues...');

    let fixedCount = 0;

    // Fix Notion's toggle lists that don't convert well
    content = content.replace(/^(\s*)•\s*(.+)$/gm, (match, indent, text) => {
        fixedCount++;
        return `${indent}- ${text}`;
    });

    // Fix Notion's numbered lists that might have issues
    content = content.replace(/^(\s*)\d+\.\s*(.+)$/gm, (match, indent, text) => {
        // Only fix if it's not already properly formatted
        if (!text.includes('\n') || text.split('\n').length === 1) {
            return match; // Keep as is
        }
        fixedCount++;
        return `${indent}1. ${text}`;
    });

    // Fix Notion's bold/italic combinations
    content = content.replace(/\*\*([^*]+)\*\*([^*]+)\*\*([^*]+)\*\*/g, (match, part1, part2, part3) => {
        fixedCount++;
        return `**${part1}${part2}${part3}**`;
    });

    if (fixedCount > 0) {
        console.log(`    ✅ Fixed ${fixedCount} formatting issue(s)`);
    }

    return content;
}

/**
 * Ensure proper frontmatter for MDX with Notion metadata
 * @param {string} content - MDX content
 * @param {string} pageId - Notion page ID (optional)
 * @param {string} notionToken - Notion API token (optional)
 * @returns {string} - Content with proper frontmatter
 */
async function ensureFrontmatter(content, pageId = null, notionToken = null) {
    console.log('  📄 Ensuring proper frontmatter...');

    if (!content.startsWith('---')) {
        let frontmatter;

        if (pageId && notionToken) {
            try {
                console.log('    🔍 Extracting Notion metadata...');
                frontmatter = await extractAndGenerateNotionFrontmatter(pageId, notionToken);
                console.log('    ✅ Generated rich frontmatter from Notion');
            } catch (error) {
                console.log('    ⚠️  Failed to extract Notion metadata, using basic frontmatter');
                frontmatter = generateBasicFrontmatter();
            }
        } else {
            frontmatter = generateBasicFrontmatter();
            console.log('    ✅ Generated basic frontmatter');
        }

        return frontmatter + content;
    }

    // Parse existing frontmatter and enhance it
    try {
        const { data, content: body } = matter(content);

        // If we have Notion metadata available, try to enhance the frontmatter
        if (pageId && notionToken && (!data.notion_id || data.notion_id !== pageId)) {
            try {
                console.log('    🔍 Enhancing frontmatter with Notion metadata...');
                const notionFrontmatter = await extractAndGenerateNotionFrontmatter(pageId, notionToken);
                const { data: notionData } = matter(notionFrontmatter);

                // Merge Notion metadata with existing frontmatter
                const enhancedData = { ...data, ...notionData };
                const enhancedContent = matter.stringify(body, enhancedData);
                console.log('    ✅ Enhanced frontmatter with Notion metadata');
                return enhancedContent;
            } catch (error) {
                console.log('    ⚠️  Could not enhance with Notion metadata, keeping existing');
            }
        }

        // Ensure required fields
        if (!data.title) data.title = 'Notion Article';
        if (!data.published) data.published = new Date().toISOString().split('T')[0];
        if (!data.tableOfContentsAutoCollapse) data.tableOfContentsAutoCollapse = true;

        const enhancedContent = matter.stringify(body, data);
        console.log('    ✅ Enhanced existing frontmatter');
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

    // Apply each transformation step sequentially
    processedContent = await ensureFrontmatter(processedContent, pageId, notionToken);
    processedContent = fixNotionFormatting(processedContent);
    processedContent = transformCallouts(processedContent);
    processedContent = transformImages(processedContent);
    processedContent = transformTables(processedContent);
    processedContent = transformCodeBlocks(processedContent);

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
                .filter(file => file.endsWith('.md'))
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
