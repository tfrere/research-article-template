/**
 * Convertisseur principal LaTeX vers Markdown
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';

import { LaTeXPreprocessor } from './preprocessor.mjs';
import { RobustLaTeXPreprocessor } from './robust-preprocessor.mjs';
import { BibliographyCleaner } from './bibliography-cleaner.mjs';
import { DEFAULT_PATHS, PANDOC_OPTIONS } from './config.mjs';

export class LaTeXConverter {
    constructor() {
        this.preprocessor = new LaTeXPreprocessor();
        this.robustPreprocessor = new RobustLaTeXPreprocessor();
        this.bibCleaner = new BibliographyCleaner();
        this.stats = {
            totalFiles: 0,
            totalFigures: 0,
            totalCitations: 0,
            conversionTime: 0
        };
        this.warnings = [];
        this.errors = [];
    }

    async convert(inputDir, outputDir, options = {}) {
        const startTime = Date.now();

        console.log('🚀 LaTeX to Markdown Converter');
        console.log(`📁 Input:  ${inputDir}`);
        console.log(`📁 Output: ${outputDir}`);

        try {
            // Setup
            await this.setupOutput(outputDir, options.clean);

            // Convert sections
            await this.convertSections(inputDir, outputDir);

            // Handle assets
            await this.handleAssets(inputDir, outputDir);

            // Create main article
            await this.createMainArticle(outputDir);

            // Generate report
            this.stats.conversionTime = Date.now() - startTime;
            this.generateReport();

            console.log('🎉 Conversion completed successfully!');
            return true;

        } catch (error) {
            this.errors.push(`Conversion failed: ${error.message}`);
            throw error;
        }
    }

    async setupOutput(outputDir, clean = false) {
        if (clean) {
            console.log('🧹 Cleaning output directory...');
            await fs.rm(outputDir, { recursive: true, force: true });
        }

        await fs.mkdir(outputDir, { recursive: true });
        await fs.mkdir(join(outputDir, 'chapters'), { recursive: true });
        await fs.mkdir(join(outputDir, 'assets', 'image'), { recursive: true });
    }

    async convertSections(inputDir, outputDir) {
        console.log('\n📄 Converting sections...');

        const sectionsDir = join(inputDir, 'sections');
        const outputChaptersDir = join(outputDir, 'chapters');

        try {
            const files = await fs.readdir(sectionsDir);
            const texFiles = files.filter(f => f.endsWith('.tex'));

            for (const file of texFiles) {
                const inputPath = join(sectionsDir, file);
                const outputPath = join(outputChaptersDir, file.replace('.tex', '.mdx'));

                console.log(`   Converting ${file}...`);
                await this.convertSingleFile(inputPath, outputPath);
            }

            this.stats.totalFiles = texFiles.length;

        } catch (error) {
            this.errors.push(`Section conversion failed: ${error.message}`);
        }
    }

    async convertSingleFile(inputPath, outputPath) {
        try {
            // Read and preprocess with robust preprocessor
            let content = await fs.readFile(inputPath, 'utf-8');
            content = this.robustPreprocessor.preprocessContent(content, basename(inputPath));

            // Create temp file for Pandoc
            const tempPath = inputPath + '.temp';
            await fs.writeFile(tempPath, content);

            // Convert with Pandoc
            const pandocArgs = [tempPath, '-o', outputPath, ...PANDOC_OPTIONS];
            await this.runPandoc(pandocArgs);

            // Cleanup
            await fs.unlink(tempPath);

            // Post-process
            await this.postProcessFile(outputPath);

        } catch (error) {
            this.warnings.push(`Failed to convert ${basename(inputPath)}: ${error.message}`);
        }
    }

    async runPandoc(args) {
        return new Promise((resolve, reject) => {
            const child = spawn('pandoc', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false
            });

            let stderr = '';
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', reject);
            child.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Pandoc failed: ${stderr}`));
                }
            });
        });
    }

    fixMalformedMath(content) {
        let fixed = content;

        // Fix problematic expressions like ${$\pi_$}0$
        fixed = fixed.replace(/\$\{\$([^$}]+)\$\}([^$]*)\$/g, '$$$1_{$2}$$');

        // Fix nested math delimiters
        fixed = fixed.replace(/\$\$([^$]*)\$([^$]*)\$([^$]*)\$\$/g, '$$$1 $2 $3$$');

        // Fix incomplete math expressions
        fixed = fixed.replace(/\$([^$]*)\{([^}]*)\$([^$]*)\$/g, '$$$1\\{$2\\}$3$$');

        // Fix math with unescaped braces
        fixed = fixed.replace(/\$([^$]*)\{([^}]*)\}([^$]*)\$/g, '$$$1\\{$2\\}$3$$');

        // Fix common pi expressions
        fixed = fixed.replace(/\$\\pi_\$([0-9]+)\$/g, '$\\pi_$1$');
        fixed = fixed.replace(/\$\{\\pi_\}([0-9]+)\$/g, '$\\pi_$1$');

        // Fix doubled dollar signs (but preserve display math)
        fixed = fixed.replace(/\$\$\$+/g, '$$');

        // Ensure proper spacing around math
        fixed = fixed.replace(/([a-zA-Z])\$([^$]+)\$([a-zA-Z])/g, '$1 $$$2$$ $3');

        return fixed;
    }

    fixMDXUrls(content) {
        let fixed = content;

        // Fix all escaped markdown that should be unescaped for MDX
        fixed = fixed.replace(/\\\*/g, '*');
        fixed = fixed.replace(/\\\[/g, '[');
        fixed = fixed.replace(/\\\]/g, ']');
        fixed = fixed.replace(/\\\(/g, '(');
        fixed = fixed.replace(/\\\)/g, ')');
        fixed = fixed.replace(/\\>/g, '>');
        fixed = fixed.replace(/\\!/g, '!');

        // Fix angle bracket URLs that are MDX-incompatible  
        fixed = fixed.replace(/\*\*<(https?:\/\/[^>]+)>\*\*/g, '**[$1]($1)**');
        fixed = fixed.replace(/<(https?:\/\/[^>]+)>/g, '[$1]($1)');

        // Fix malformed math expressions with escaped braces 
        fixed = fixed.replace(/\\\{/g, '{');
        fixed = fixed.replace(/\\\}/g, '}');

        // Escape all braces in math expressions for MDX compatibility
        fixed = fixed.replace(/\$([^$]*)\$/g, (match, mathContent) => {
            const escaped = mathContent.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
            return `$${escaped}$`;
        });

        fixed = fixed.replace(/\$\$([^$]*)\$\$/g, (match, mathContent) => {
            const escaped = mathContent.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
            return `$$${escaped}$$`;
        });

        // Fix Section references that are malformed
        fixed = fixed.replace(/Section\s+([a-zA-Z-]+:[a-zA-Z0-9-]+)\\/g, 'the referenced figure');
        fixed = fixed.replace(/Figure\s+Section\s+([a-zA-Z-]+:[a-zA-Z0-9-]+)\\/g, 'the referenced figure');

        return fixed;
    }

    async postProcessFile(filePath) {
        try {
            let content = await fs.readFile(filePath, 'utf-8');

            // Fix common issues
            content = content.replace(/\\\\#/g, '#');
            content = content.replace(/\\\\!/g, '!');
            content = content.replace(/\\\\\*/g, '*');

            // Fix citations
            content = content.replace(/\\citep\{([^}]+)\}/g, '[@$1]');
            content = content.replace(/\\citet\{([^}]+)\}/g, '@$1');
            content = content.replace(/\\cite\{([^}]+)\}/g, '[@$1]');

            // Remove section labels from headers
            content = content.replace(/^(#{1,6}.*?)\s*\{#[^}]+\}/gm, '$1');

            // Fix complex LaTeX references like [\[sec:xxx\]](#sec:xxx){reference-type="ref" reference="sec:xxx"}
            content = content.replace(/\[\\?\[([^\]]+)\\?\]\]\(#[^)]+\)\{[^}]*reference[^}]*\}/g, 'Section $1');

            // Fix simple references [\[ref\]](#ref)
            content = content.replace(/\[\\?\[([^\]]+)\\?\]\]\(#[^)]+\)/g, '$1');

            // Fix remaining malformed references like "Section Section sec:classical\"
            content = content.replace(/Section\s+Section\s+([^\\]+)\\/g, 'Section $1');
            content = content.replace(/Section\s+Section\s+([^\\]+)/g, 'Section $1');

            // Remove remaining LaTeX labels and references
            content = content.replace(/\\label\{[^}]+\}/g, '');
            content = content.replace(/\\ref\{[^}]+\}/g, '[Reference]');

            // Clean up section references with colons (be more specific)
            content = content.replace(/Section\s+sec:([a-zA-Z-]+)/g, 'the following section');

            // Fix broken section references that got mangled
            content = content.replace(/Section\s+secs[a-zA-Z]*\s+/g, 'The following section ');
            content = content.replace(/Section\s+sec[a-zA-Z]*\s+/g, 'The following section ');

            // Count citations
            const citations = content.match(/\[@[^\]]+\]/g) || [];
            this.stats.totalCitations += citations.length;

            // Fix malformed math expressions
            content = this.fixMalformedMath(content);

            // Fix MDX-incompatible URLs (post-pandoc)
            content = this.fixMDXUrls(content);

            // Final cleanup
            content = content.replace(/\n{3,}/g, '\n\n');
            content = content.replace(/\\texttt\{([^}]+)\}/g, '`$1`');
            content = content.replace(/\\textbf\{([^}]+)\}/g, '**$1**');
            content = content.replace(/\\emph\{([^}]+)\}/g, '*$1*');
            content = content.trim();

            await fs.writeFile(filePath, content);

        } catch (error) {
            this.warnings.push(`Post-processing failed for ${basename(filePath)}: ${error.message}`);
        }
    }

    async handleAssets(inputDir, outputDir) {
        console.log('\n🖼️  Handling assets...');

        // Copy figures
        try {
            const figuresInputDir = join(inputDir, 'figures');
            const assetsOutputDir = join(outputDir, 'assets', 'image');

            await this.copyDirectoryRecursive(figuresInputDir, assetsOutputDir);
            this.stats.totalFigures = await this.countFiles(assetsOutputDir, /\.(png|jpg|jpeg|pdf|svg)$/i);

            console.log(`   📊 Copied ${this.stats.totalFigures} figures`);
        } catch (error) {
            this.warnings.push(`Could not copy figures: ${error.message}`);
        }

        // Handle bibliography
        try {
            const bibPath = join(inputDir, 'main.bib');
            const outputBibPath = join(outputDir, 'bibliography.bib');

            // Copy and clean bibliography
            let bibContent = await fs.readFile(bibPath, 'utf-8');
            bibContent = this.bibCleaner.cleanContent(bibContent);
            await fs.writeFile(outputBibPath, bibContent);

            const bibStats = this.bibCleaner.getStats();
            console.log(`   📚 Bibliography: ${bibStats.entriesProcessed} entries, ${bibStats.doubleAccoladesFixed} fixes, ${bibStats.mathExpressionsFixed} math fixes`);

        } catch (error) {
            this.warnings.push(`Could not handle bibliography: ${error.message}`);
        }
    }

    async copyDirectoryRecursive(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = join(src, entry.name);
            const destPath = join(dest, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectoryRecursive(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    async countFiles(dir, pattern) {
        let count = 0;
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    count += await this.countFiles(join(dir, entry.name), pattern);
                } else if (pattern.test(entry.name)) {
                    count++;
                }
            }
        } catch {
            // Directory doesn't exist
        }

        return count;
    }

    async createMainArticle(outputDir) {
        console.log('\n📝 Creating main article...');

        try {
            const chaptersDir = join(outputDir, 'chapters');
            const files = await fs.readdir(chaptersDir);
            const mdxFiles = files.filter(f => f.endsWith('.mdx')).sort();

            const frontmatter = this.generateFrontmatter();
            const { imports, components } = this.generateChapterImports(mdxFiles);

            const articleContent = frontmatter + imports + '\n\n' + components;

            const articlePath = join(outputDir, 'article.mdx');
            await fs.writeFile(articlePath, articleContent);

            console.log(`   📄 Created article.mdx with ${mdxFiles.length} chapters`);

        } catch (error) {
            this.errors.push(`Failed to create main article: ${error.message}`);
        }
    }

    generateFrontmatter() {
        const now = new Date().toISOString().split('T')[0];

        return `---
title: "Robot Learning: A Tutorial"
subtitle: "From Classical Robotics to Foundation Models"
description: "A comprehensive guide to modern robot learning techniques"
date: "${now}"
authors:
  - name: "Francesco Capuano"
    affiliations: [1, 2]
  - name: "Adil Zouitine"
    affiliations: [2]
  - name: "Pepijn Kooijmans"
    affiliations: [2]
  - name: "Thomas Wolf"
    affiliations: [2]
  - name: "Michel Aractingi"
    affiliations: [2]
affiliations:
  - name: "École Normale Supérieure Paris-Saclay"
    url: "https://ens-paris-saclay.fr"
  - name: "Hugging Face"
    url: "https://huggingface.co"
tags:
  - robotics
  - machine-learning
  - tutorial
bibliography: bibliography.bib
converted_from: "LaTeX"
---

`;
    }

    generateChapterImports(mdxFiles) {
        let imports = '';
        let components = '';

        mdxFiles.forEach(file => {
            const sectionName = basename(file, '.mdx');
            const componentName = this.formatComponentName(sectionName);

            imports += `import ${componentName} from "./chapters/${sectionName}.mdx";\n`;
            components += `<${componentName} />\n\n`;
        });

        return { imports, components };
    }

    formatComponentName(sectionName) {
        let componentName = sectionName
            .split(/[_-]/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');

        if (/^\d/.test(componentName)) {
            componentName = 'Chapter' + componentName;
        }

        if (componentName === 'AForword') componentName = 'Foreword';
        if (componentName === 'Chapter00Abstract') componentName = 'Abstract';

        return componentName;
    }

    generateReport() {
        console.log('\n📊 Conversion Report:');
        console.log('=====================');
        console.log(`⏱️  Time: ${(this.stats.conversionTime / 1000).toFixed(2)}s`);
        console.log(`📄 Files: ${this.stats.totalFiles}`);
        console.log(`🖼️  Figures: ${this.stats.totalFigures}`);
        console.log(`📚 Citations: ${this.stats.totalCitations}`);
        console.log(`⚠️  Warnings: ${this.warnings.length}`);
        console.log(`❌ Errors: ${this.errors.length}`);

        const robustStats = this.robustPreprocessor.getStats();
        console.log(`🔧 Commands replaced: ${robustStats.commandsReplaced}`);
        console.log(`📦 Environments processed: ${robustStats.environmentsProcessed}`);
        console.log(`🖼️  Figures processed: ${robustStats.figuresProcessed}`);
        console.log(`📐 Math expressions fixed: ${robustStats.mathExpressionsFixed}`);

        if (this.warnings.length > 0 && this.warnings.length <= 3) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach(w => console.log(`   - ${w}`));
        } else if (this.warnings.length > 3) {
            console.log(`\n⚠️  ${this.warnings.length} warnings:`);
            this.warnings.forEach(w => console.log(`   - ${w.substring(0, 150)}...`));
        }
    }
}
