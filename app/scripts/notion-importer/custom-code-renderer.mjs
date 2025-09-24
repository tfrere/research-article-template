#!/usr/bin/env node

/**
 * Custom Code Block Renderer for notion-to-md
 * Fixes the issue where code blocks end with "text" instead of proper closing
 */

export function createCustomCodeRenderer() {
    return {
        name: 'custom-code-renderer',
        type: 'renderer',

        /**
         * Custom renderer for code blocks
         * @param {Object} block - Notion code block
         * @returns {string} - Properly formatted markdown code block
         */
        code: (block) => {
            const { language, rich_text } = block.code;

            // Extract the actual code content from rich_text
            const codeContent = rich_text
                .map(text => text.plain_text)
                .join('');

            // Determine the language (default to empty string if not specified)
            const lang = language || '';

            // Return properly formatted markdown code block
            return `\`\`\`${lang}\n${codeContent}\n\`\`\``;
        }
    };
}
