import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Extract HtmlEmbed components from MDX/Markdown content
 * Simple utility to find <HtmlEmbed> tags and their props
 */

export function extractHtmlEmbeds(content) {
    const embeds = [];

    // First, find all Wide components and mark their content
    // Pattern to match <Wide>...</Wide> blocks
    const widePattern = /<Wide[\s\S]*?>([\s\S]*?)<\/Wide>/gi;
    const wideBlocks = [];
    let wideMatch;
    while ((wideMatch = widePattern.exec(content)) !== null) {
        wideBlocks.push({
            start: wideMatch.index,
            end: wideMatch.index + wideMatch[0].length,
            content: wideMatch[0]
        });
    }

    // Helper to check if an embed is inside a Wide block
    const isInsideWide = (embedStartIndex) => {
        return wideBlocks.some(block =>
            embedStartIndex >= block.start && embedStartIndex < block.end
        );
    };

    // Pattern to match HtmlEmbed opening tags
    const embedPattern = /<HtmlEmbed/gi;
    let embedMatch;

    while ((embedMatch = embedPattern.exec(content)) !== null) {
        const matchIndex = embedMatch.index;

        // Manually find the closing /> while respecting string boundaries
        let pos = matchIndex + 10; // After "<HtmlEmbed"
        let match = '<HtmlEmbed';
        let inString = false;
        let stringDelim = null;
        let inJSXBraces = 0; // Track depth in JSX expressions like config={{...}}

        while (pos < content.length) {
            const char = content[pos];
            const prevChar = pos > 0 ? content[pos - 1] : '';

            match += char;

            // Track string boundaries (template strings, single, double quotes)
            if (!inString) {
                if ((char === '`' || char === '"' || char === "'") && prevChar !== '\\') {
                    inString = true;
                    stringDelim = char;
                }
            } else {
                if (char === stringDelim && prevChar !== '\\') {
                    inString = false;
                    stringDelim = null;
                }
            }

            // Track JSX expression braces (for config={{...}}, data={{...}}, etc.)
            if (!inString) {
                if (char === '{') {
                    inJSXBraces++;
                } else if (char === '}') {
                    inJSXBraces--;
                }
            }

            // Check for closing /> - only valid if not in string AND all JSX braces are closed
            if (!inString && inJSXBraces === 0 && char === '/' && pos + 1 < content.length && content[pos + 1] === '>') {
                match += '>';
                break;
            }

            pos++;
        }

        // If config={{ is present, we need to find the real closing after }}
        // Check if config={{ is there but the match doesn't include the full config (doesn't end with }})
        if (match.includes('config={{') && !match.includes('}}')) {
            // The match was cut off at the first /> it found (probably in desc)
            // We need to find the real closing after }}

            // Find where config={{ starts
            const configStart = match.indexOf('config={{');
            if (configStart >= 0) {
                // Look for the matching }} after this, starting from the content
                let braceCount = 2; // We're inside {{
                let pos = matchIndex + configStart + 9; // After "config={{"
                let foundEnd = false;

                while (pos < content.length) {
                    const char = content[pos];
                    const prevChar = pos > 0 ? content[pos - 1] : '';

                    // Track strings to avoid counting braces inside strings
                    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
                        // We hit a string delimiter - skip the entire string
                        const stringDelim = char;
                        pos++;
                        while (pos < content.length) {
                            if (content[pos] === stringDelim && content[pos - 1] !== '\\') {
                                break;
                            }
                            // Handle template string ${...}
                            if (stringDelim === '`' && content[pos] === '$' && pos + 1 < content.length && content[pos + 1] === '{') {
                                // Skip ${...} without counting
                                pos += 2;
                                let innerBraces = 1;
                                while (pos < content.length && innerBraces > 0) {
                                    if (content[pos] === '{') innerBraces++;
                                    if (content[pos] === '}') innerBraces--;
                                    pos++;
                                }
                                continue;
                            }
                            pos++;
                        }
                        pos++; // Skip the closing quote
                        continue;
                    }

                    if (char === '{') braceCount++;
                    if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            // Found the closing }}
                            // Now look for /> after optional whitespace
                            pos++;
                            while (pos < content.length && /\s/.test(content[pos])) {
                                pos++;
                            }
                            if (pos < content.length && content[pos] === '/' && pos + 1 < content.length && content[pos + 1] === '>') {
                                // Found the real closing
                                match = content.substring(matchIndex, pos + 2);
                                foundEnd = true;
                                break;
                            }
                        }
                    }
                    pos++;
                }

                if (!foundEnd) {
                    // Fallback: try to find }} /> pattern after match
                    const after = content.substring(matchIndex + match.length);
                    const endPattern = after.match(/\}\}\s*\/>/);
                    if (endPattern) {
                        match = content.substring(matchIndex, matchIndex + match.length + endPattern.index + endPattern[0].length);
                    }
                }
            }
        }

        // Helper function to extract attribute value supporting multiline
        const extractAttr = (attrName, content) => {
            // Try JSX template strings first: desc={`...`}
            const templateMatch = content.match(new RegExp(`${attrName}\\s*=\\s*\\{\`([\\s\\S]*?)\`\\}`, 'i'));
            if (templateMatch) return templateMatch[1].trim();

            // Try single quotes: desc='...'
            const singleQuoteMatch = content.match(new RegExp(`${attrName}\\s*=\\s*'([\\s\\S]*?)'`, 'i'));
            if (singleQuoteMatch) return singleQuoteMatch[1].trim();

            // Try double quotes: desc="..."
            const doubleQuoteMatch = content.match(new RegExp(`${attrName}\\s*=\\s*"([\\s\\S]*?)"`, 'i'));
            if (doubleQuoteMatch) return doubleQuoteMatch[1].trim();

            return undefined;
        };

        // Extract src attribute (required)
        const src = extractAttr('src', match);
        if (!src) continue;

        // Extract optional attributes
        const title = extractAttr('title', match);
        const desc = extractAttr('desc', match);
        const id = extractAttr('id', match);
        const data = extractAttr('data', match);
        const frameless = /\bframeless\b/i.test(match);
        const wideAttr = /\bwide\b/i.test(match);
        const skipGallery = /\bskipGallery\b/i.test(match);

        // Extract config attribute - JSX object format: config={{ ... }}
        let config = null;

        // Pattern to match config={{ ... }} with balanced braces
        const jsxConfigRegex = /config\s*=\s*\{\{/i;
        const jsxConfigMatch = match.match(jsxConfigRegex);

        if (jsxConfigMatch) {
            try {
                // Find the start position after config={{ 
                const configStart = jsxConfigMatch.index;
                const startPos = match.indexOf('{{', configStart) + 2;

                // Find matching closing braces with better handling
                let braceCount = 1; // Start at 1 because we're inside {{ 
                let inString = false;
                let stringChar = null;
                let pos = startPos;

                for (; pos < match.length; pos++) {
                    const char = match[pos];
                    const prevChar = pos > 0 ? match[pos - 1] : '';
                    const nextChar = pos < match.length - 1 ? match[pos + 1] : '';

                    // Handle string literals - check for template strings too
                    if (!inString) {
                        if (char === '`') {
                            inString = true;
                            stringChar = '`';
                        } else if (char === '"' && prevChar !== '\\') {
                            inString = true;
                            stringChar = '"';
                        } else if (char === "'" && prevChar !== '\\') {
                            inString = true;
                            stringChar = "'";
                        }
                    } else {
                        // Check for end of string
                        if (char === stringChar && prevChar !== '\\') {
                            inString = false;
                            stringChar = null;
                        }
                        // Template strings can contain ${...} - handle that
                        if (stringChar === '`' && char === '$' && nextChar === '{') {
                            // Skip the ${ but don't count it as a brace yet
                            pos++; // Skip $
                            braceCount++; // Count the { we're about to see
                            continue;
                        }
                    }

                    if (!inString) {
                        if (char === '{') {
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                // Found matching closing }}
                                break;
                            }
                        }
                    }
                }

                if (braceCount !== 0) {
                    throw new Error(`Unbalanced braces: braceCount=${braceCount}`);
                }

                // Extract the JSX object content
                let jsxContent = match.substring(startPos, pos).trim();

                // Instead of converting to JSON, evaluate the JavaScript object directly
                // This is safer in a build context (not in browser)
                try {
                    // Wrap in parentheses and braces to make it a valid expression
                    const jsCode = `({${jsxContent}})`;

                    // Use Function constructor to safely evaluate (no access to local scope)
                    // This is safe because we're in Node.js build time, not browser runtime
                    config = new Function('return ' + jsCode)();
                } catch (evalError) {
                    // If eval fails, try the JSON approach as fallback
                    // Fallback: try JSON parsing
                    let jsonStr = jsxContent;

                    // Add braces around the content
                    jsonStr = '{' + jsonStr + '}';

                    // Quote unquoted keys
                    for (let pass = 0; pass < 5; pass++) {
                        jsonStr = jsonStr.replace(/([{,\[\s])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
                        jsonStr = jsonStr.replace(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm, '"$1":');
                    }

                    // Replace single quotes with double quotes
                    jsonStr = jsonStr.replace(/'/g, '"');

                    // Remove trailing commas
                    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

                    try {
                        config = JSON.parse(jsonStr);
                    } catch (jsonError) {
                        // Both methods failed - log warning but don't throw
                        console.warn('[extract-embeds] Config parsing failed:', jsonError.message);
                    }
                }
            } catch (e) {
                // If parsing fails, keep config as null
                // Component will handle missing config
            }
        }

        // Fallback: try standard attribute extraction (for string-based config)
        if (!config) {
            const configAttr = extractAttr('config', match);
            if (configAttr) {
                try {
                    config = JSON.parse(configAttr);
                } catch (e) {
                    // Keep as string if not valid JSON
                    config = configAttr;
                }
            }
        }

        // Check if this embed is inside a Wide component OR has wide prop
        const isWide = isInsideWide(matchIndex) || wideAttr;

        embeds.push({
            src,
            title,
            desc,
            id,
            frameless,
            data,
            config,
            wide: isWide,
            skipGallery
        });
    }

    return embeds;
}

/**
 * Recursively find all MDX files in a directory
 */
function findMdxFiles(dir, baseDir = dir, files = []) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            findMdxFiles(fullPath, baseDir, files);
        } else if (entry.endsWith('.mdx')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Parse imports and chapter usage order from article.mdx
 */
function parseArticleChapters(articleContent, contentDir) {
    const chapterMap = new Map(); // Component name -> file path
    const chapterOrder = []; // Ordered list of file paths

    // Extract import statements
    const importPattern = /import\s+(\w+)\s+from\s+["'](.\/chapters\/[^"']+)["']/g;
    let match;
    while ((match = importPattern.exec(articleContent)) !== null) {
        const [, componentName, importPath] = match;
        const fullPath = join(contentDir, importPath);
        chapterMap.set(componentName, fullPath);
    }

    // Extract chapter usage order (e.g., <Introduction />)
    const usagePattern = /<(\w+)\s*\/>/g;
    while ((match = usagePattern.exec(articleContent)) !== null) {
        const componentName = match[1];
        if (chapterMap.has(componentName)) {
            const chapterPath = chapterMap.get(componentName);
            if (!chapterOrder.includes(chapterPath)) {
                chapterOrder.push(chapterPath);
            }
        }
    }

    return chapterOrder;
}

/**
 * Load and extract embeds from MDX content files, following article structure
 */
export function loadEmbedsFromMDX() {
    // Get absolute path to content directory
    // In dev: __dirname is app/src/utils, so we go ../content
    // In build: Astro copies files to dist/pages/, but the source files stay in src/
    // So we need to resolve relative to the actual source location
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Try to resolve content directory - works in both dev and build
    // First try relative to current file location (dev)
    let contentDir = join(__dirname, '../content');

    // If that doesn't work, try going up more levels (build scenario)
    if (!statSync(contentDir, { throwIfNoEntry: false })) {
        // dist/pages/../.. -> dist/../src/content
        contentDir = join(__dirname, '../../src/content');
    }

    // If still not found, try one more level (dist/*.mjs)
    if (!statSync(contentDir, { throwIfNoEntry: false })) {
        contentDir = join(__dirname, '../../../src/content');
    }

    const allEmbeds = [];
    const articleFile = join(contentDir, 'article.mdx');

    try {
        // Read main article file
        const articleContent = readFileSync(articleFile, 'utf-8');

        // Extract embeds from main article first
        const articleEmbeds = extractHtmlEmbeds(articleContent);
        articleEmbeds.forEach(embed => {
            embed.sourceFile = 'content/article.mdx';
        });
        allEmbeds.push(...articleEmbeds);

        // Parse chapter order from article
        const chapterOrder = parseArticleChapters(articleContent, contentDir);

        // Extract embeds from chapters in order
        for (const chapterPath of chapterOrder) {
            try {
                const chapterContent = readFileSync(chapterPath, 'utf-8');
                const embeds = extractHtmlEmbeds(chapterContent);

                // Add source file info (relative path)
                const relativePath = relative(contentDir, chapterPath);
                embeds.forEach(embed => {
                    embed.sourceFile = `content/${relativePath}`;
                });

                allEmbeds.push(...embeds);
            } catch (error) {
                console.error(`Error reading chapter ${chapterPath}:`, error);
            }
        }

        // Also include any other MDX files not in chapters (for completeness)
        const allMdxFiles = findMdxFiles(contentDir);
        const processedFiles = new Set([articleFile, ...chapterOrder]);

        for (const filePath of allMdxFiles) {
            if (!processedFiles.has(filePath)) {
                try {
                    const rawContent = readFileSync(filePath, 'utf-8');
                    const embeds = extractHtmlEmbeds(rawContent);
                    const relativePath = relative(contentDir, filePath);
                    embeds.forEach(embed => {
                        embed.sourceFile = `content/${relativePath}`;
                    });
                    allEmbeds.push(...embeds);
                } catch (error) {
                    console.error(`Error reading ${filePath}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error processing article:', error);
        // Fallback to old behavior if article.mdx can't be read
        const mdxFiles = findMdxFiles(contentDir);
        for (const filePath of mdxFiles) {
            try {
                const rawContent = readFileSync(filePath, 'utf-8');
                const embeds = extractHtmlEmbeds(rawContent);
                const relativePath = relative(contentDir, filePath);
                embeds.forEach(embed => {
                    embed.sourceFile = `content/${relativePath}`;
                });
                allEmbeds.push(...embeds);
            } catch (err) {
                console.error(`Error reading ${filePath}:`, err);
            }
        }
    }

    // Remove duplicates based on src (keeping first occurrence = order of appearance)
    const uniqueEmbeds = Array.from(
        new Map(allEmbeds.map(e => [e.src, e])).values()
    );

    return uniqueEmbeds;
}

