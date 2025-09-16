/**
 * Nettoyeur de bibliographie - Corrige les doubles accolades et problèmes de formatting
 */

export class BibliographyCleaner {
    constructor() {
        this.stats = {
            entriesProcessed: 0,
            doubleAccoladesFixed: 0,
            escapedCharsFixed: 0,
            mathExpressionsFixed: 0
        };
    }

    cleanContent(content) {
        let cleaned = content;

        // Count entries
        this.stats.entriesProcessed = (content.match(/@\w+\{/g) || []).length;

        // Fix double accolades
        cleaned = this.fixDoubleAccolades(cleaned);

        // Fix escaped characters
        cleaned = this.fixEscapedCharacters(cleaned);

        // Fix malformed math expressions
        cleaned = this.fixMathExpressions(cleaned);

        // General cleanup
        cleaned = this.generalCleanup(cleaned);

        return cleaned;
    }

    fixDoubleAccolades(content) {
        let fixed = content;
        let fixCount = 0;

        fixed = fixed.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
            fixCount++;

            // Keep accolades for important terms
            if (/^[A-Z][A-Z0-9]*$/.test(inner) || // Acronyms like "API", "ML"
                /^[A-Z][a-z]*(?:\s+[A-Z][a-z]*)*$/.test(inner) || // Proper nouns
                inner.includes('++') || // Languages like "C++"
                inner.includes('$') // Math
            ) {
                return `{${inner}}`;
            }

            return inner;
        });

        this.stats.doubleAccoladesFixed = fixCount;
        return fixed;
    }

    fixEscapedCharacters(content) {
        let fixed = content;
        let fixCount = 0;

        const replacements = [
            [/\\&/g, '&'],
            [/\\\$/g, '$'],
            [/\\%/g, '%'],
            [/\\#/g, '#'],
            [/\\_/g, '_']
        ];

        for (const [pattern, replacement] of replacements) {
            const matches = fixed.match(pattern);
            if (matches) {
                fixCount += matches.length;
                fixed = fixed.replace(pattern, replacement);
            }
        }

        this.stats.escapedCharsFixed = fixCount;
        return fixed;
    }

    fixMathExpressions(content) {
        let fixed = content;
        let fixCount = 0;

        // Fix specific problematic patterns
        const mathFixes = [
            // ${$\pi_$}0$ → $\pi_0$
            [/\$\{\$\\pi_\$\}([0-9]+)\$/g, '$\\pi_$1$'],
            // ${$something$}text$ → $something_text$
            [/\$\{\$([^}]+)\$\}([^$]*)\$/g, '$$$1_$2$$'],
            // Fix other malformed patterns
            [/\$\{([^}]+)\}\$/g, '$$$1$$'],
            [/\$([^$]*)\\\$([^$]*)\$/g, '$$$1$2$$']
        ];

        for (const [pattern, replacement] of mathFixes) {
            const matches = fixed.match(pattern);
            if (matches) {
                fixCount += matches.length;
                fixed = fixed.replace(pattern, replacement);
            }
        }

        this.stats.mathExpressionsFixed = fixCount;
        return fixed;
    }

    generalCleanup(content) {
        let cleaned = content;

        // Normalize whitespace
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        cleaned = cleaned.trim() + '\n';

        return cleaned;
    }

    getStats() {
        return this.stats;
    }
}
