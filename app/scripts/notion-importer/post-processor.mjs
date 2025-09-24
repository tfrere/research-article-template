#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Post-process Notion-generated Markdown for better MDX compatibility
 * @param {string} content - Raw markdown content from Notion
 * @returns {string} - Processed markdown content
 */
export function postProcessMarkdown(content) {
    console.log('🔧 Post-processing Notion Markdown for MDX compatibility...');

    let processedContent = content;

    // Apply each transformation step
    processedContent = cleanNotionArtifacts(processedContent);
    processedContent = fixNotionLinks(processedContent);
    processedContent = optimizeImages(processedContent);
    processedContent = shiftHeadingLevels(processedContent);
    processedContent = cleanEmptyLines(processedContent);
    processedContent = fixCodeBlocks(processedContent);
    processedContent = fixCodeBlockEndings(processedContent);
    processedContent = optimizeTables(processedContent);

    return processedContent;
}

/**
 * Clean Notion-specific artifacts and formatting
 * @param {string} content - Markdown content
 * @returns {string} - Cleaned content
 */
function cleanNotionArtifacts(content) {
    console.log('  🧹 Cleaning Notion artifacts...');

    let cleanedCount = 0;

    // Remove Notion's internal page references that don't convert well
    content = content.replace(/\[([^\]]+)\]\(https:\/\/www\.notion\.so\/[^)]+\)/g, (match, text) => {
        cleanedCount++;
        return text; // Keep just the text, remove the broken link
    });

    // Clean up Notion's callout blocks that might not render properly
    content = content.replace(/^> \*\*([^*]+)\*\*\s*\n/gm, '> **$1**\n\n');

    // Remove Notion's page dividers that don't have markdown equivalents
    content = content.replace(/^---+\s*$/gm, '');

    // Clean up empty blockquotes
    content = content.replace(/^>\s*$/gm, '');

    if (cleanedCount > 0) {
        console.log(`    ✅ Cleaned ${cleanedCount} Notion artifact(s)`);
    }

    return content;
}

/**
 * Fix Notion internal links to be more MDX-friendly
 * @param {string} content - Markdown content
 * @returns {string} - Content with fixed links
 */
function fixNotionLinks(content) {
    console.log('  🔗 Fixing Notion internal links...');

    let fixedCount = 0;

    // Convert Notion page links to relative links (assuming they'll be converted to MDX)
    content = content.replace(/\[([^\]]+)\]\(https:\/\/www\.notion\.so\/[^/]+\/([^?#)]+)\)/g, (match, text, pageId) => {
        fixedCount++;
        // Convert to relative link - this will need to be updated based on your routing
        return `[${text}](#${pageId})`;
    });

    // Fix broken notion.so links that might be malformed
    content = content.replace(/\[([^\]]+)\]\(https:\/\/www\.notion\.so\/[^)]*\)/g, (match, text) => {
        fixedCount++;
        return text; // Remove broken links, keep text
    });

    if (fixedCount > 0) {
        console.log(`    ✅ Fixed ${fixedCount} Notion link(s)`);
    }

    return content;
}

/**
 * Optimize images for better MDX compatibility
 * @param {string} content - Markdown content
 * @returns {string} - Content with optimized images
 */
function optimizeImages(content) {
    console.log('  🖼️  Optimizing images...');

    let optimizedCount = 0;

    // Ensure images have proper alt text
    content = content.replace(/!\[\]\(([^)]+)\)/g, (match, src) => {
        optimizedCount++;
        const filename = basename(src);
        return `![${filename}](${src})`;
    });

    // Clean up image paths that might have query parameters
    content = content.replace(/!\[([^\]]*)\]\(([^)]+)\?[^)]*\)/g, (match, alt, src) => {
        optimizedCount++;
        return `![${alt}](${src})`;
    });

    if (optimizedCount > 0) {
        console.log(`    ✅ Optimized ${optimizedCount} image(s)`);
    }

    return content;
}

/**
 * Shift all heading levels down by one (H1 → H2, H2 → H3, etc.)
 * @param {string} content - Markdown content
 * @returns {string} - Content with shifted heading levels
 */
function shiftHeadingLevels(content) {
    console.log('  📝 Shifting heading levels down by one...');

    let shiftedCount = 0;

    // Shift heading levels: H1 → H2, H2 → H3, H3 → H4, H4 → H5, H5 → H6
    // Process from highest to lowest to avoid conflicts
    content = content.replace(/^##### (.*$)/gim, '###### $1');
    content = content.replace(/^#### (.*$)/gim, '##### $1');
    content = content.replace(/^### (.*$)/gim, '#### $1');
    content = content.replace(/^## (.*$)/gim, '### $1');
    content = content.replace(/^# (.*$)/gim, '## $1');

    // Count the number of headings shifted
    const headingMatches = content.match(/^#{1,6} /gm);
    if (headingMatches) {
        shiftedCount = headingMatches.length;
    }

    console.log(`    ✅ Shifted ${shiftedCount} heading level(s)`);
    return content;
}

/**
 * Fix code block endings that end with "text" instead of proper closing
 * @param {string} content - Markdown content
 * @returns {string} - Content with fixed code block endings
 */
function fixCodeBlockEndings(content) {
    console.log('  💻 Fixing code block endings...');

    let fixedCount = 0;

    // Fix code blocks that end with ```text instead of ```
    content = content.replace(/```text\n/g, '```\n');

    // Count the number of fixes
    const textEndingMatches = content.match(/```text\n/g);
    if (textEndingMatches) {
        fixedCount = textEndingMatches.length;
    }

    if (fixedCount > 0) {
        console.log(`    ✅ Fixed ${fixedCount} code block ending(s)`);
    }

    return content;
}

/**
 * Clean up excessive empty lines
 * @param {string} content - Markdown content
 * @returns {string} - Content with cleaned spacing
 */
function cleanEmptyLines(content) {
    console.log('  📝 Cleaning excessive empty lines...');

    // Replace 3+ consecutive newlines with 2 newlines
    const cleanedContent = content.replace(/\n{3,}/g, '\n\n');

    const originalLines = content.split('\n').length;
    const cleanedLines = cleanedContent.split('\n').length;
    const removedLines = originalLines - cleanedLines;

    if (removedLines > 0) {
        console.log(`    ✅ Removed ${removedLines} excessive empty line(s)`);
    }

    return cleanedContent;
}

/**
 * Fix code blocks for better MDX compatibility
 * @param {string} content - Markdown content
 * @returns {string} - Content with fixed code blocks
 */
function fixCodeBlocks(content) {
    console.log('  💻 Fixing code blocks...');

    let fixedCount = 0;

    // Ensure code blocks have proper language identifiers
    content = content.replace(/^```\s*$/gm, '```text');

    // Fix code blocks that might have Notion-specific formatting
    content = content.replace(/^```(\w+)\s*\n([\s\S]*?)\n```$/gm, (match, lang, code) => {
        // Clean up any Notion artifacts in code
        const cleanCode = code.replace(/\u00A0/g, ' '); // Replace non-breaking spaces
        return `\`\`\`${lang}\n${cleanCode}\n\`\`\``;
    });

    if (fixedCount > 0) {
        console.log(`    ✅ Fixed ${fixedCount} code block(s)`);
    }

    return content;
}

/**
 * Optimize tables for better MDX rendering
 * @param {string} content - Markdown content
 * @returns {string} - Content with optimized tables
 */
function optimizeTables(content) {
    console.log('  📊 Optimizing tables...');

    let optimizedCount = 0;

    // Fix tables that might have inconsistent column counts
    content = content.replace(/^\|(.+)\|\s*$/gm, (match, row) => {
        const cells = row.split('|').map(cell => cell.trim());
        const cleanCells = cells.filter(cell => cell.length > 0);

        if (cleanCells.length > 0) {
            optimizedCount++;
            return `| ${cleanCells.join(' | ')} |`;
        }
        return match;
    });

    // Ensure table headers are properly formatted
    content = content.replace(/^\|(.+)\|\s*\n\|([-:\s|]+)\|\s*$/gm, (match, header, separator) => {
        const headerCells = header.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
        const separatorCells = separator.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);

        if (headerCells.length !== separatorCells.length) {
            optimizedCount++;
            const newSeparator = headerCells.map(() => '---').join(' | ');
            return `| ${headerCells.join(' | ')} |\n| ${newSeparator} |`;
        }
        return match;
    });

    if (optimizedCount > 0) {
        console.log(`    ✅ Optimized ${optimizedCount} table(s)`);
    }

    return content;
}

/**
 * Extract frontmatter from Notion page properties
 * @param {Object} pageProperties - Notion page properties
 * @returns {string} - YAML frontmatter
 */
export function generateFrontmatter(pageProperties) {
    console.log('  📄 Generating frontmatter from Notion properties...');

    const frontmatter = {
        title: pageProperties.title || 'Untitled',
        published: new Date().toISOString().split('T')[0],
        tableOfContentsAutoCollapse: true
    };

    // Add other properties if they exist
    if (pageProperties.description) {
        frontmatter.description = pageProperties.description;
    }
    if (pageProperties.tags) {
        frontmatter.tags = pageProperties.tags;
    }
    if (pageProperties.author) {
        frontmatter.author = pageProperties.author;
    }

    // Convert to YAML string
    const yamlLines = Object.entries(frontmatter)
        .map(([key, value]) => {
            if (Array.isArray(value)) {
                return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
            }
            return `${key}: "${value}"`;
        });

    return `---\n${yamlLines.join('\n')}\n---\n\n`;
}

function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🔧 Notion Markdown Post-Processor

Usage:
  node post-processor.mjs [options] [input-file] [output-file]

Options:
  --verbose        Show detailed processing information
  --help, -h       Show this help

Examples:
  # Process a single file
  node post-processor.mjs input.md output.md

  # Process with verbose output
  node post-processor.mjs --verbose input.md output.md
`);
        process.exit(0);
    }

    const verbose = args.includes('--verbose');
    const inputFile = args.find(arg => !arg.startsWith('--') && arg.endsWith('.md'));
    const outputFile = args.find(arg => !arg.startsWith('--') && arg !== inputFile && arg.endsWith('.md'));

    if (!inputFile) {
        console.error('❌ Please provide an input markdown file');
        process.exit(1);
    }

    if (!existsSync(inputFile)) {
        console.error(`❌ Input file not found: ${inputFile}`);
        process.exit(1);
    }

    try {
        console.log(`📖 Reading: ${inputFile}`);
        const content = readFileSync(inputFile, 'utf8');

        const processedContent = postProcessMarkdown(content);

        const finalOutputFile = outputFile || inputFile.replace('.md', '.processed.md');
        writeFileSync(finalOutputFile, processedContent);

        console.log(`✅ Processed: ${finalOutputFile}`);

        if (verbose) {
            console.log(`📊 Input: ${content.length} chars → Output: ${processedContent.length} chars`);
        }

    } catch (error) {
        console.error('❌ Processing failed:', error.message);
        process.exit(1);
    }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
