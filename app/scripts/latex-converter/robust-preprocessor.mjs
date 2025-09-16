/**
 * Préprocesseur LaTeX Ultra-Robuste
 * Gère les cas complexes qui font planter Pandoc
 */

export class RobustLaTeXPreprocessor {
    constructor() {
        this.stats = {
            figuresProcessed: 0,
            citationsFixed: 0,
            mathExpressionsFixed: 0,
            environmentsProcessed: 0,
            commandsReplaced: 0
        };
        this.debugMode = false;
    }

    preprocessContent(content, filename = 'unknown') {
        if (this.debugMode) {
            console.log(`    🔍 [DEBUG] Processing ${filename}...`);
        }

        let processed = content;

        // Phase 1: Structure cleanup (most important first)
        processed = this.phase1_StructureCleanup(processed);

        // Phase 2: Content transformation
        processed = this.phase2_ContentTransformation(processed);

        // Phase 3: Final polish
        processed = this.phase3_FinalPolish(processed);

        return processed;
    }

    phase1_StructureCleanup(content) {
        let cleaned = content;

        // Remove comments (but preserve structure)
        cleaned = cleaned.replace(/%.*$/gm, '');

        // Fix broken line breaks that split words
        cleaned = this.fixBrokenLineBreaks(cleaned);

        // Fix broken equation environments
        cleaned = this.fixBrokenEquations(cleaned);

        // Fix broken figure environments BEFORE processing
        cleaned = this.fixComplexFigures(cleaned);

        // Handle problematic environments early
        cleaned = this.handleProblematicEnvironments(cleaned);

        return cleaned;
    }

    fixBrokenLineBreaks(content) {
        let fixed = content;

        // Fix hyphenated words broken across lines
        // "length-\nT\nT" → "length-T"
        fixed = fixed.replace(/([a-zA-Z])-\s*\n\s*([A-Z])\s*\n\s*\2/g, '$1-$2');

        // Fix broken compound words
        // "some-\nword" → "some-word"  
        fixed = fixed.replace(/([a-zA-Z])-\s*\n\s*([a-z])/g, '$1-$2');

        // Fix sentences that got broken inappropriately
        // "word.Sentence" → "word. Sentence"
        fixed = fixed.replace(/([a-z])\.([A-Z])/g, '$1. $2');

        return fixed;
    }

    fixBrokenEquations(content) {
        let fixed = content;

        // Fix mixed equation environments
        // "\end{equation}$" → "$$"
        fixed = fixed.replace(/\\end\{equation\}\$/g, '$$');
        fixed = fixed.replace(/\$\\begin\{equation\}/g, '$$');

        // Fix broken align environments  
        fixed = fixed.replace(/([^$])\s*&=\s*/g, '$1 &= ');

        // Fix multiline math that lost structure
        fixed = fixed.replace(/\$([^$]*?)&=([^$]*?)\$/g, '$$\\begin{align}\n$1 &= $2\n\\end{align}$$');

        return fixed;
    }

    fixComplexFigures(content) {
        let fixed = content;

        // Strategy: Convert complex figures to simple markdown BEFORE Pandoc sees them
        const figurePattern = /\\begin\{figure\*?\}([\s\S]*?)\\end\{figure\*?\}/g;
        const wrapfigurePattern = /\\begin\{wrapfigure\}(?:\[[^\]]*\])?\{[^}]*\}\{[^}]*\}([\s\S]*?)\\end\{wrapfigure\}/g;

        fixed = fixed.replace(figurePattern, (match, figureContent) => {
            this.stats.figuresProcessed++;

            // Extract components safely
            const imageMatch = figureContent.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
            const captionMatch = figureContent.match(/\\caption\{([\s\S]*?)\}(?=\s*(?:\\label|\\end|\}|$))/);
            const labelMatch = figureContent.match(/\\label\{([^}]+)\}/);

            if (!imageMatch) {
                return match; // Keep original if we can't parse it
            }

            const imagePath = imageMatch[1].replace(/^figures\//, 'assets/image/');
            let caption = captionMatch ? captionMatch[1].trim() : 'Figure';
            const label = labelMatch ? labelMatch[1] : '';

            // Clean caption thoroughly
            caption = this.cleanCaption(caption);

            // Generate clean markdown
            const labelAttr = label ? ` {#fig-${label}}` : '';

            return `\n\n![${caption}](${imagePath})${labelAttr}\n\n*${caption}*\n\n`;
        });

        // Also handle wrapfigure environments
        fixed = fixed.replace(wrapfigurePattern, (match, figureContent) => {
            this.stats.figuresProcessed++;

            // Extract components safely
            const imageMatch = figureContent.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
            const captionMatch = figureContent.match(/\\caption\{([\s\S]*?)\}(?=\s*(?:\\label|\\end|\}|$))/);
            const labelMatch = figureContent.match(/\\label\{([^}]+)\}/);

            if (!imageMatch) {
                return match; // Keep original if we can't parse it
            }

            const imagePath = imageMatch[1].replace(/^figures\//, 'assets/image/');
            let caption = captionMatch ? captionMatch[1].trim() : 'Figure';
            const label = labelMatch ? labelMatch[1] : '';

            // Clean caption thoroughly
            caption = this.cleanCaption(caption);

            // Generate clean markdown (simpler for wrapfigure)
            const labelAttr = label ? ` {#fig-${label}}` : '';

            return `\n\n![${caption}](${imagePath})${labelAttr}\n\n`;
        });

        return fixed;
    }

    cleanCaption(caption) {
        let cleaned = caption;

        // Handle citations in captions properly
        cleaned = cleaned.replace(/~\\cite[tp]?\{([^}]+)\}/g, ' [@$1]');
        cleaned = cleaned.replace(/\\cite[tp]?\{([^}]+)\}/g, '[@$1]');

        // Remove problematic LaTeX commands
        cleaned = cleaned.replace(/\\textit\{([^}]+)\}/g, '*$1*');
        cleaned = cleaned.replace(/\\textbf\{([^}]+)\}/g, '**$1**');
        cleaned = cleaned.replace(/\\emph\{([^}]+)\}/g, '*$1*');

        // Fix \textsc with complex content
        cleaned = cleaned.replace(/\\textsc\{([^}]*\([^)]*\)[^}]*)\}/g, '**$1**');

        // Handle nested braces safely
        let depth = 0;
        let result = '';
        for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned[i];
            if (char === '{') {
                depth++;
                if (depth === 1) continue; // Skip opening brace
            } else if (char === '}') {
                depth--;
                if (depth === 0) continue; // Skip closing brace
            } else {
                result += char;
            }
        }

        return result.trim();
    }

    handleProblematicEnvironments(content) {
        let fixed = content;

        // Handle algorithm environments
        fixed = fixed.replace(/\\begin\{algorithm\}([\s\S]*?)\\end\{algorithm\}/g, (match, algContent) => {
            return '\n```\nAlgorithm:\n' + algContent.replace(/\\[a-zA-Z]+/g, '') + '\n```\n';
        });

        // Handle complex math environments
        fixed = fixed.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (match, mathContent) => {
            const cleaned = mathContent.replace(/\\&/g, '').replace(/\\\\/g, '\n');
            return '\n$$\n' + cleaned + '\n$$\n';
        });

        return fixed;
    }

    phase2_ContentTransformation(content) {
        let transformed = content;

        // Apply command mappings (safer order)
        transformed = this.applyCommandMappings(transformed);

        // Process custom environments
        transformed = this.processCustomEnvironments(transformed);

        // Handle remaining citations
        transformed = this.processCitations(transformed);

        return transformed;
    }

    applyCommandMappings(content) {
        let processed = content;

        // Safe command replacements (most common first)
        const safeCommands = {
            'eg': 'e.g.,',
            'ie': 'i.e.,',
            'versus': 'vs.',
            'wrt': 'w.r.t.',
            'etc': 'etc.',
            'lerobot': '**LeRobot**',
            'lerobotdataset': '`LeRobotDataset`',
            'huggingface': '🤗 **Hugging Face**',
            'qfunction': 'Q-function',
            'qopt': 'Q^*',
            // Robotics-specific commands from handles.tex
            'actionchunk': '\\mathbf{A}',
            'actionexpert': '\\mathbf{v}_\\theta',
            'pizero': '\\pi_0',
            'statespace': '\\mathcal{S}',
            'actionspace': '\\mathcal{A}',
            'obsspace': '\\mathcal{O}',
            'dynamics': '\\mathcal{D}',
            'stateplusone': 's_{t+1}',
            'state': 's_t',
            'action': 'a_t',
            'transition': '(s_t, a_t, s_{t+1})',
            'sars': '(s_t, a_t, r_t, s_{t+1})',
            'transitiongiven': '(s_{t+1} | s_t, a_t)',
            'transitionprob': '\\mathbb{P}(s_{t+1} | s_t, a_t)',
            'trajectory': '(s_0, a_0, r_0, s_1, a_1, r_1, \\dots, s_{T-1}, a_{T-1}, r_{T-1}, s_T)',
            'Jpi': 'J(\\pi_\\theta)',
            'supp': '\\text{supp}',
            'DKL': '\\text{D}_{\\text{KL}}',
            'FK': '\\text{FK}',
            'targetvel': '\\dot{p}^*',
            'targetpos': 'p^*'
        };

        for (const [command, replacement] of Object.entries(safeCommands)) {
            const regex = new RegExp(`\\\\${command}(?![a-zA-Z])`, 'g');
            const matches = processed.match(regex);
            if (matches) {
                this.stats.commandsReplaced += matches.length;
                processed = processed.replace(regex, replacement);
            }
        }

        // Math commands (more careful)
        const mathCommands = ['X', 'Z', 'G', 'D', 'F', 'R', 'S', 'T', 'U', 'Y'];
        mathCommands.forEach(letter => {
            const regex = new RegExp(`\\\\${letter}(?![a-zA-Z])`, 'g');
            processed = processed.replace(regex, `\\mathcal{${letter}}`);
        });

        // Handle commands with subscripts (like \actionchunk_t)
        processed = processed.replace(/\\actionchunk_t/g, '\\mathbf{A}_t');
        processed = processed.replace(/\\actionexpert_([a-zA-Z0-9]+)/g, '\\mathbf{v}_{\\theta_$1}');
        processed = processed.replace(/\\state_([a-zA-Z0-9]+)/g, 's_{$1}');
        processed = processed.replace(/\\action_([a-zA-Z0-9]+)/g, 'a_{$1}');

        // Fix problematic \textsc commands with complex content
        processed = processed.replace(/\\textsc\{([^{}]*\([^)]*\)[^{}]*)\}/g, '**$1**');
        processed = processed.replace(/\\textsc\{([^}]+)\}/g, '**$1**');

        // Fix \url commands to make them MDX-compatible
        processed = processed.replace(/\\textbf\{\\url\{([^}]+)\}\}/g, '**[$1]($1)**');
        processed = processed.replace(/\\url\{([^}]+)\}/g, '[$1]($1)');

        return processed;
    }

    processCustomEnvironments(content) {
        let processed = content;

        // TL;DR environment
        processed = processed.replace(
            /\\begin\{tldr\}([\s\S]*?)\\end\{tldr\}/g,
            (match, content) => {
                this.stats.environmentsProcessed++;
                return `\n> **TL;DR**\n> ${content.trim()}\n\n`;
            }
        );

        // Callout environment
        processed = processed.replace(
            /\\begin\{callout\}\{([^}]*)\}([\s\S]*?)\\end\{callout\}/g,
            (match, title, content) => {
                this.stats.environmentsProcessed++;
                return `\n> **${title}**\n> ${content.trim()}\n\n`;
            }
        );

        // Finding command
        processed = processed.replace(
            /\\finding\{([^}]*)\}\{([^}]*)\}/g,
            (match, number, content) => {
                this.stats.environmentsProcessed++;
                return `\n> **🔍 Finding ${number}**: ${content}\n\n`;
            }
        );

        return processed;
    }

    processCitations(content) {
        let processed = content;

        // Handle different citation types
        processed = processed.replace(/\\citep\{([^}]+)\}/g, '[@$1]');
        processed = processed.replace(/\\citet\{([^}]+)\}/g, '@$1');
        processed = processed.replace(/\\cite\{([^}]+)\}/g, '[@$1]');

        // Handle spaced citations (common issue)
        processed = processed.replace(/~\\cite/g, ' \\cite');
        processed = processed.replace(/~\[@/g, ' [@');

        // Count citations
        const citations = processed.match(/\[@[^\]]+\]/g) || [];
        this.stats.citationsFixed += citations.length;

        return processed;
    }

    phase3_FinalPolish(content) {
        let polished = content;

        // Fix math expressions
        polished = this.fixMathExpressions(polished);

        // Clean up whitespace and structure
        polished = this.finalCleanup(polished);

        return polished;
    }

    fixMathExpressions(content) {
        let fixed = content;

        // Fix common problematic patterns
        fixed = fixed.replace(/\$\{([^}]+)\}\$/g, '$$$1$$'); // ${...}$ -> $...$
        fixed = fixed.replace(/\$([^$]*)\\\$([^$]*)\$/g, '$$$1$2$$'); // $...\$...$ -> $...$

        // Fix pi expressions specifically
        fixed = fixed.replace(/\$\\pi_\$([0-9]+)\$/g, '$\\pi_$1$');
        fixed = fixed.replace(/\$\{\\pi_\}([0-9]+)\$/g, '$\\pi_$1$');

        // Fix malformed math delimiters
        fixed = fixed.replace(/\$\$\$+/g, '$$');

        this.stats.mathExpressionsFixed++;

        return fixed;
    }

    finalCleanup(content) {
        let cleaned = content;

        // Normalize whitespace
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        cleaned = cleaned.replace(/[ \t]+$/gm, ''); // Trailing spaces

        // Fix MDX-incompatible angle bracket URLs
        cleaned = cleaned.replace(/\*\*<(https?:\/\/[^>]+)>\*\*/g, '**[$1]($1)**');
        cleaned = cleaned.replace(/<(https?:\/\/[^>]+)>/g, '[$1]($1)');

        // Ensure proper spacing around elements
        cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');

        return cleaned.trim();
    }

    getStats() {
        return this.stats;
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
}
