#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TYPOGRAPHY_BASE = __dirname;
const GENERATED_DIR = path.join(TYPOGRAPHY_BASE, 'generated');
const SVGS_DIR = path.join(GENERATED_DIR, 'svgs');
const PNGS_DIR = path.join(GENERATED_DIR, 'pngs');
const PNG_SIZE = 40; // Final size 40x40 pixels

/**
 * Converts an SVG to PNG
 */
async function convertSvgToPng(svgPath, pngPath) {
    try {
        const svgBuffer = await fs.readFile(svgPath);

        await sharp(svgBuffer)
            .resize(PNG_SIZE, PNG_SIZE, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
            })
            .flatten({ background: { r: 255, g: 255, b: 255 } }) // Force white background
            .png()
            .toFile(pngPath);

        return true;
    } catch (error) {
        console.error(`❌ Error during conversion ${svgPath}:`, error.message);
        return false;
    }
}

/**
 * Generates PNGs for all SVGs
 */
async function generatePNGsForAllSVGs() {
    console.log(`🖼️  Generating ${PNG_SIZE}x${PNG_SIZE} PNGs for all SVGs\n`);

    try {
        // Create PNG folder if necessary
        await fs.mkdir(PNGS_DIR, { recursive: true });

        // Read all SVG files
        const svgFiles = await fs.readdir(SVGS_DIR);
        const svgFilesFiltered = svgFiles.filter(file => file.endsWith('.svg'));

        if (svgFilesFiltered.length === 0) {
            console.error('❌ No SVG files found in', SVGS_DIR);
            process.exit(1);
        }

        console.log(`📁 Found ${svgFilesFiltered.length} SVG files`);

        const results = [];

        for (let i = 0; i < svgFilesFiltered.length; i++) {
            const svgFile = svgFilesFiltered[i];
            const svgPath = path.join(SVGS_DIR, svgFile);

            // Create PNG filename
            const pngFile = svgFile.replace('.svg', '.png');
            const pngPath = path.join(PNGS_DIR, pngFile);

            // Extract font name from filename
            const fontId = svgFile.replace('_a.svg', '');
            const fontFamily = fontId.replace(/_/g, ' ');

            console.log(`[${i + 1}/${svgFilesFiltered.length}] 🔄 Converting "${fontFamily}"...`);

            try {
                const success = await convertSvgToPng(svgPath, pngPath);

                if (success) {
                    console.log(`✅ PNG generated: ${fontFamily} (${PNG_SIZE}x${PNG_SIZE})`);
                    results.push({
                        fontFamily,
                        fontId,
                        status: 'success',
                        pngPath: `/content/embeds/typography/font_pngs/${pngFile}`,
                        dimensions: {
                            width: PNG_SIZE,
                            height: PNG_SIZE
                        }
                    });
                } else {
                    results.push({
                        fontFamily,
                        fontId,
                        status: 'error',
                        error: 'SVG to PNG conversion failed'
                    });
                }

            } catch (error) {
                console.error(`❌ Error for ${fontFamily}:`, error.message);
                results.push({
                    fontFamily,
                    fontId,
                    status: 'error',
                    error: error.message
                });
            }
        }

        // Display final statistics
        const successful = results.filter(r => r.status === 'success').length;
        const errors = results.filter(r => r.status === 'error').length;

        console.log('\n📊 Final statistics:');
        console.log(`✅ PNGs generated successfully: ${successful}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📋 Total processed: ${results.length}`);

        if (errors > 0) {
            console.log('\n❌ Fonts with errors:');
            results
                .filter(r => r.status === 'error')
                .forEach(r => console.log(`  - ${r.fontFamily}: ${r.error}`));
        }

    } catch (error) {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    }
}

// Execute script if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generatePNGsForAllSVGs();
}

export { generatePNGsForAllSVGs };