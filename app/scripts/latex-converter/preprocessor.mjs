/**
 * Préprocesseur LaTeX - Nettoie et simplifie le contenu LaTeX
 */

import { COMMAND_MAPPINGS, ENVIRONMENT_MAPPINGS } from './config.mjs';

export class LaTeXPreprocessor {
    constructor() {
        this.stats = {
            commandsReplaced: 0,
            environmentsProcessed: 0,
            figuresFixed: 0
        };
    }

    preprocessContent(content) {
        let processed = content;

        // Remove comments
        processed = processed.replace(/%.*$/gm, '');

        // Apply command mappings
        processed = this.applyCommandMappings(processed);

        // Process custom environments
        processed = this.processCustomEnvironments(processed);

        // Fix figures
        processed = this.fixFigures(processed);

        // General cleanup
        processed = processed.replace(/\n{3,}/g, '\n\n');
        processed = processed.trim();

        return processed;
    }

    applyCommandMappings(content) {
        let processed = content;

        for (const [command, replacement] of Object.entries(COMMAND_MAPPINGS)) {
            const regex = new RegExp(`\\\\${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z])`, 'g');
            const matches = processed.match(regex);
            if (matches) {
                this.stats.commandsReplaced += matches.length;
                processed = processed.replace(regex, replacement);
            }
        }

        return processed;
    }

    processCustomEnvironments(content) {
        let processed = content;

        // Convert tldr environment
        processed = processed.replace(
            /\\begin\{tldr\}(.*?)\\end\{tldr\}/gs,
            (match, content) => {
                this.stats.environmentsProcessed++;
                return `> **TL;DR**\n> ${content.trim()}\n`;
            }
        );

        // Convert callout environment
        processed = processed.replace(
            /\\begin\{callout\}\{([^}]*)\}(.*?)\\end\{callout\}/gs,
            (match, title, content) => {
                this.stats.environmentsProcessed++;
                return `> **${title}**\n> ${content.trim()}\n`;
            }
        );

        // Convert finding environment
        processed = processed.replace(
            /\\finding\{([^}]*)\}\{([^}]*)\}/g,
            (match, number, content) => {
                this.stats.environmentsProcessed++;
                return `> **🔍 Finding ${number}**: ${content}\n`;
            }
        );

        return processed;
    }

    fixFigures(content) {
        let fixed = content;

        // Fix complex figure environments
        const figurePattern = /\\begin\{figure\}[\s\S]*?\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}[\s\S]*?\\caption\{([^}]+)\}[\s\S]*?(?:\\label\{([^}]+)\})?[\s\S]*?\\end\{figure\}/g;

        fixed = fixed.replace(figurePattern, (match, imagePath, caption, label) => {
            this.stats.figuresFixed++;
            const cleanPath = imagePath.replace(/^figures\//, 'assets/image/');
            const labelAttr = label ? ` {#fig-${label}}` : '';
            return `\n![${caption}](${cleanPath})${labelAttr}\n\n*${caption}*\n`;
        });

        // Fix simple includegraphics
        fixed = fixed.replace(
            /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g,
            (match, imagePath) => {
                this.stats.figuresFixed++;
                const cleanPath = imagePath.replace(/^figures\//, 'assets/image/');
                return `![Image](${cleanPath})`;
            }
        );

        return fixed;
    }

    getStats() {
        return this.stats;
    }
}
