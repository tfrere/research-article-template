#!/usr/bin/env node
/**
 * Point d'entrée principal pour la conversion LaTeX vers Markdown
 * 
 * Usage: node scripts/latex-converter/index.mjs [--input=path] [--output=path] [--clean]
 */

import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

import { LaTeXConverter } from './converter.mjs';
import { ImageTransformer } from './image-transformer.mjs';
import { DEFAULT_PATHS } from './config.mjs';

function parseArgs(argv) {
    const out = {};
    for (const arg of argv.slice(2)) {
        if (!arg.startsWith('--')) continue;
        const [k, v] = arg.replace(/^--/, '').split('=');
        out[k] = v === undefined ? true : v;
    }
    return out;
}

async function checkPandoc() {
    try {
        const child = spawn('pandoc', ['--version'], { stdio: 'pipe' });
        return new Promise((resolve) => {
            child.on('exit', (code) => resolve(code === 0));
            child.on('error', () => resolve(false));
        });
    } catch {
        return false;
    }
}

async function main() {
    const cwd = process.cwd();
    const args = parseArgs(process.argv);

    // Vérifier Pandoc
    const hasPandoc = await checkPandoc();
    if (!hasPandoc) {
        console.error('❌ Pandoc n\'est pas installé.');
        console.error('   macOS: brew install pandoc');
        console.error('   Ubuntu: apt-get install pandoc');
        process.exit(1);
    }

    // Chemins
    const inputDir = resolve(cwd, args.input || DEFAULT_PATHS.input);
    const outputDir = resolve(cwd, args.output || DEFAULT_PATHS.output);

    try {
        const converter = new LaTeXConverter();
        await converter.convert(inputDir, outputDir, {
            clean: args.clean || false
        });

        // Transform images to ResponsiveImage components
        console.log('\n📸 Transforming images to ResponsiveImage components...');
        const imageTransformer = new ImageTransformer();
        await imageTransformer.transformImagesInDirectory(outputDir);

    } catch (error) {
        console.error('❌ Conversion échouée:', error.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
});
