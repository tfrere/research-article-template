#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const TYPOGRAPHY_BASE = __dirname;
const GENERATED_DIR = path.join(TYPOGRAPHY_BASE, 'generated');
const SVGS_DIR = path.join(GENERATED_DIR, 'svgs');
const DATA_DIR = path.join(GENERATED_DIR, 'data');
const SPRITES_DIR = path.join(GENERATED_DIR, 'sprites');
const OUTPUT_SPRITE = path.join(SPRITES_DIR, 'font-sprite.svg');

async function generateSvgSprite() {
    console.log('🎨 Generating SVG sprite...');

    try {
        // Read all SVG files
        const files = await fs.readdir(SVGS_DIR);
        const svgFiles = files.filter(file => file.endsWith('.svg'));

        console.log(`📁 Found ${svgFiles.length} SVG files`);

        let sprites = [];
        let processedCount = 0;

        // Process each SVG
        for (const file of svgFiles) {
            try {
                const filePath = path.join(SVGS_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');

                // Extract SVG content (without <svg> tags)
                const match = content.match(/<svg[^>]*>(.*?)<\/svg>/s);
                if (!match) continue;

                const innerContent = match[1].trim();
                if (!innerContent) continue;

                // Create symbol ID from filename
                const symbolId = file.replace('.svg', '');

                // Extract viewBox if present
                const viewBoxMatch = content.match(/viewBox=["']([^"']+)["']/);
                const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 80 80';

                // Create symbol
                sprites.push(`  <symbol id="${symbolId}" viewBox="${viewBox}">
    ${innerContent}
  </symbol>`);

                processedCount++;

                if (processedCount % 100 === 0) {
                    console.log(`⚡ Processed ${processedCount}/${svgFiles.length} SVGs...`);
                }

            } catch (error) {
                console.warn(`⚠️  Error with ${file}:`, error.message);
            }
        }

        // Create final sprite
        const spriteContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: none;">
  <defs>
${sprites.join('\n')}
  </defs>
</svg>`;

        // Create output folder if necessary
        await fs.mkdir(path.dirname(OUTPUT_SPRITE), { recursive: true });

        // Write sprite file
        await fs.writeFile(OUTPUT_SPRITE, spriteContent, 'utf-8');

        console.log(`✅ SVG sprite generated with ${sprites.length} symbols`);
        console.log(`📍 File: ${OUTPUT_SPRITE}`);
        console.log(`📊 Size: ${(spriteContent.length / 1024).toFixed(1)} KB`);

        // Also generate mapping file for easier usage
        const mapping = {};
        svgFiles.forEach(file => {
            const fontName = file.replace('_a.svg', '').replace(/_/g, ' ');
            const symbolId = file.replace('.svg', '');
            mapping[fontName] = symbolId;
        });

        const mappingFile = path.join(DATA_DIR, 'font-sprite-mapping.json');
        await fs.writeFile(mappingFile, JSON.stringify(mapping, null, 2));

        console.log(`🗺️  Mapping generated: ${mappingFile}`);

    } catch (error) {
        console.error('❌ Error during generation:', error);
        process.exit(1);
    }
}

// Execute script
if (import.meta.url === `file://${process.argv[1]}`) {
    generateSvgSprite();
}

export { generateSvgSprite };
