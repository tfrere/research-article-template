#!/usr/bin/env node

import { Client } from '@notionhq/client';

/**
 * Notion Metadata Extractor
 * Extracts document metadata from Notion pages for frontmatter generation
 */

/**
 * Extract metadata from Notion page
 * @param {string} pageId - Notion page ID
 * @param {string} notionToken - Notion API token
 * @returns {object} - Extracted metadata object
 */
export async function extractNotionMetadata(pageId, notionToken) {
    const notion = new Client({
        auth: notionToken,
    });

    const metadata = {};

    try {
        // Get page information
        const page = await notion.pages.retrieve({ page_id: pageId });

        // Extract title from page properties
        if (page.properties.title && page.properties.title.title && page.properties.title.title.length > 0) {
            metadata.title = page.properties.title.title[0].plain_text;
        }

        // Extract creation date
        if (page.created_time) {
            metadata.published = new Date(page.created_time).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
            });
            metadata.created_time = page.created_time;
        }

        // Extract last edited date
        if (page.last_edited_time) {
            metadata.last_edited_time = page.last_edited_time;
        }

        // Extract created by
        if (page.created_by && page.created_by.id) {
            metadata.created_by = page.created_by.id;
        }

        // Extract last edited by
        if (page.last_edited_by && page.last_edited_by.id) {
            metadata.last_edited_by = page.last_edited_by.id;
        }

        // Extract page URL
        metadata.notion_url = page.url;

        // Extract page ID
        metadata.notion_id = page.id;

        // Extract parent information
        if (page.parent) {
            metadata.parent = {
                type: page.parent.type,
                id: page.parent[page.parent.type]?.id || page.parent[page.parent.type]
            };
        }

        // Extract cover image if available
        if (page.cover) {
            metadata.cover = {
                type: page.cover.type,
                url: page.cover[page.cover.type]?.url || page.cover[page.cover.type]
            };
        }

        // Extract icon if available
        if (page.icon) {
            metadata.icon = {
                type: page.icon.type,
                emoji: page.icon.emoji,
                url: page.icon.external?.url || page.icon.file?.url
            };
        }

        // Extract authors and custom properties
        const customProperties = {};
        for (const [key, value] of Object.entries(page.properties)) {
            if (key !== 'title') { // Skip title as it's handled separately
                const extractedValue = extractPropertyValue(value);

                // Check for author-related properties
                if (key.toLowerCase().includes('author') ||
                    key.toLowerCase().includes('writer') ||
                    key.toLowerCase().includes('creator') ||
                    value.type === 'people') {
                    metadata.authors = extractedValue;
                } else {
                    customProperties[key] = extractedValue;
                }
            }
        }

        // If no authors found in properties, try to get from created_by
        if (!metadata.authors && page.created_by) {
            try {
                const user = await notion.users.retrieve({ user_id: page.created_by.id });
                metadata.authors = [{
                    name: user.name || user.id,
                    id: user.id
                }];
            } catch (error) {
                console.log('    ⚠️  Could not fetch author from created_by:', error.message);
                // Fallback to basic info
                metadata.authors = [{
                    name: page.created_by.name || page.created_by.id,
                    id: page.created_by.id
                }];
            }
        }

        if (Object.keys(customProperties).length > 0) {
            metadata.properties = customProperties;
        }

        // Try to extract description from page content (first paragraph)
        try {
            const blocks = await notion.blocks.children.list({ block_id: pageId });
            const firstParagraph = blocks.results.find(block =>
                block.type === 'paragraph' &&
                block.paragraph.rich_text &&
                block.paragraph.rich_text.length > 0
            );

            if (firstParagraph) {
                const description = firstParagraph.paragraph.rich_text
                    .map(text => text.plain_text)
                    .join('')
                    .trim();

                if (description && description.length > 0) {
                    metadata.description = description.substring(0, 200) + (description.length > 200 ? '...' : '');
                }
            }
        } catch (error) {
            console.log('  ⚠️  Could not extract description from page content');
        }

        // Generate tags from page properties
        const tags = [];
        for (const [key, value] of Object.entries(page.properties)) {
            if (value.type === 'multi_select' && value.multi_select) {
                value.multi_select.forEach(option => {
                    tags.push(option.name);
                });
            } else if (value.type === 'select' && value.select) {
                tags.push(value.select.name);
            }
        }

        if (tags.length > 0) {
            metadata.tags = tags;
        }

    } catch (error) {
        console.error('Error extracting Notion metadata:', error.message);
        // Return basic metadata if extraction fails
        metadata.title = "Notion Article";
        metadata.published = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        });
    }

    return metadata;
}

/**
 * Extract value from Notion property
 * @param {object} property - Notion property object
 * @returns {any} - Extracted value
 */
function extractPropertyValue(property) {
    switch (property.type) {
        case 'rich_text':
            return property.rich_text.map(text => text.plain_text).join('');
        case 'title':
            return property.title.map(text => text.plain_text).join('');
        case 'number':
            return property.number;
        case 'select':
            return property.select?.name || null;
        case 'multi_select':
            return property.multi_select.map(option => option.name);
        case 'date':
            return property.date?.start || null;
        case 'checkbox':
            return property.checkbox;
        case 'url':
            return property.url;
        case 'email':
            return property.email;
        case 'phone_number':
            return property.phone_number;
        case 'created_time':
            return property.created_time;
        case 'created_by':
            return property.created_by?.id || null;
        case 'last_edited_time':
            return property.last_edited_time;
        case 'last_edited_by':
            return property.last_edited_by?.id || null;
        case 'people':
            return property.people.map(person => ({
                name: person.name || person.id,
                id: person.id
            }));
        default:
            return null;
    }
}

/**
 * Generate YAML frontmatter from metadata object
 * @param {object} metadata - Metadata object
 * @returns {string} - YAML frontmatter string
 */
export function generateNotionFrontmatter(metadata) {
    let frontmatter = '---\n';

    // Title
    if (metadata.title) {
        frontmatter += `title: "${metadata.title}"\n`;
    }

    // Description
    if (metadata.description) {
        frontmatter += `description: "${metadata.description}"\n`;
    }

    // Publication date
    if (metadata.published) {
        frontmatter += `published: "${metadata.published}"\n`;
    }

    // Authors
    if (metadata.authors && metadata.authors.length > 0) {
        frontmatter += 'authors:\n';
        metadata.authors.forEach(author => {
            if (typeof author === 'string') {
                frontmatter += `  - name: "${author}"\n`;
            } else if (author.name) {
                frontmatter += `  - name: "${author.name}"\n`;
            }
        });
    }

    // Tags
    if (metadata.tags && metadata.tags.length > 0) {
        frontmatter += 'tags:\n';
        metadata.tags.forEach(tag => {
            frontmatter += `  - "${tag}"\n`;
        });
    }

    // Notion metadata removed - keeping only standard frontmatter fields

    // Cover image
    if (metadata.cover && metadata.cover.url) {
        frontmatter += `cover: "${metadata.cover.url}"\n`;
    }

    // Icon
    if (metadata.icon) {
        if (metadata.icon.emoji) {
            frontmatter += `icon: "${metadata.icon.emoji}"\n`;
        } else if (metadata.icon.url) {
            frontmatter += `icon: "${metadata.icon.url}"\n`;
        }
    }

    // Custom properties removed - keeping frontmatter clean and standard

    // Default Astro configuration
    frontmatter += 'tableOfContentsAutoCollapse: true\n';
    frontmatter += '---\n\n';

    return frontmatter;
}

/**
 * Extract and generate frontmatter from Notion page
 * @param {string} pageId - Notion page ID
 * @param {string} notionToken - Notion API token
 * @returns {string} - Complete YAML frontmatter
 */
export async function extractAndGenerateNotionFrontmatter(pageId, notionToken) {
    const metadata = await extractNotionMetadata(pageId, notionToken);
    return generateNotionFrontmatter(metadata);
}
