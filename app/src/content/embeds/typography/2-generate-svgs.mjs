#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TYPOGRAPHY_BASE = __dirname;
const GENERATED_DIR = path.join(TYPOGRAPHY_BASE, 'generated');
const FONTS_DIR = path.join(GENERATED_DIR, 'fonts');
const SVGS_DIR = path.join(GENERATED_DIR, 'svgs');
const FONT_MANIFEST_PATH = path.join(GENERATED_DIR, 'data', 'font_manifest.json');
const TYPOGRAPHY_DATA_PATH = path.join(GENERATED_DIR, 'data', 'typography_data.json');

/**
 * Updates font manifest with new SVGs
 */
async function updateFontManifest(results) {
    try {
        console.log('\n📝 Updating font manifest...');

        // Read existing manifest
        let manifest = {};
        try {
            const manifestData = await fs.readFile(FONT_MANIFEST_PATH, 'utf-8');
            manifest = JSON.parse(manifestData);
        } catch {
            // Create new manifest if none exists
        }

        // Read existing typography data
        let typographyData = [];
        try {
            const typographyDataContent = await fs.readFile(TYPOGRAPHY_DATA_PATH, 'utf-8');
            const data = JSON.parse(typographyDataContent);
            typographyData = data.fonts || [];
        } catch {
            // Use empty array if no data exists
        }

        // Update with new results
        const successfulResults = results.filter(r => r.status === 'success');

        for (const result of successfulResults) {
            const { fontFamily, fontId, svgPath, dimensions, fontMetrics } = result;

            // Find corresponding typography data
            const typographyEntry = typographyData.find(entry => entry.name === fontFamily);
            const family = typographyEntry?.family || 'sans-serif';

            // Update manifest
            manifest[fontFamily] = {
                id: fontId,
                family: family,
                images: {
                    A: svgPath,
                    a: svgPath  // Use same SVG for lowercase and uppercase for now
                },
                svg: {
                    A: {
                        path: svgPath,
                        width: dimensions.width,
                        height: dimensions.height,
                        viewBox: `0 0 ${dimensions.width} ${dimensions.height}`
                    }
                },
                fontMetrics: fontMetrics
            };
        }

        // Ensure data directory exists
        await fs.mkdir(path.dirname(FONT_MANIFEST_PATH), { recursive: true });

        // Save updated manifest
        await fs.writeFile(FONT_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

        console.log(`✅ Manifest updated with ${successfulResults.length} fonts`);

    } catch (error) {
        console.error('❌ Error updating manifest:', error.message);
    }
}

/**
 * Generates an SVG of letter A from a font
 */
async function generateLetterASVG(fontPath, fontFamily) {
    try {
        const fontBuffer = await fs.readFile(fontPath);
        const font = opentype.parse(fontBuffer.buffer);

        // Get the glyph for letter 'A'
        const glyph = font.charToGlyph('A');

        if (!glyph || !glyph.path) {
            throw new Error('Glyph A not found or without path');
        }

        // Uniform configuration
        const SVG_SIZE = 80; // Fixed size 80x80
        const fontSize = 60; // Reduced font size to leave margins

        // Get glyph dimensions
        const tempPath = glyph.getPath(0, 0, fontSize);
        const bbox = tempPath.getBoundingBox();

        // Calculate actual glyph dimensions
        const glyphWidth = bbox.x2 - bbox.x1;
        const glyphHeight = bbox.y2 - bbox.y1;

        // Center perfectly in 80x80 canvas
        const centerX = SVG_SIZE / 2;
        const centerY = SVG_SIZE / 2;

        // Position glyph to be centered
        const offsetX = centerX - (bbox.x1 + glyphWidth / 2);
        const offsetY = centerY - (bbox.y1 + glyphHeight / 2);

        // Generate final centered path
        const adjustedPath = glyph.getPath(offsetX, offsetY, fontSize);

        // Generate SVG with fixed dimensions
        const svgPathData = adjustedPath.toPathData(2);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}" width="${SVG_SIZE}" height="${SVG_SIZE}">
  <path d="${svgPathData}" fill="currentColor"/>
</svg>`;

        return {
            svg,
            width: SVG_SIZE,
            height: SVG_SIZE,
            fontMetrics: {
                unitsPerEm: font.unitsPerEm,
                ascender: font.ascender,
                descender: font.descender
            }
        };

    } catch (error) {
        console.error(`❌ Error generating SVG for ${fontFamily}:`, error.message);
        return null;
    }
}

/**
 * Converts a font name to usable ID
 */
function fontNameToId(fontName) {
    return fontName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Generates SVGs for all fonts in the folder
 */
async function generateSVGsForAllFonts() {
    console.log('🎨 Generating SVGs for all downloaded fonts\n');

    try {
        // Create SVG folder if necessary
        await fs.mkdir(SVGS_DIR, { recursive: true });

        // Read all TTF files
        const fontFiles = await fs.readdir(FONTS_DIR);
        const ttfFiles = fontFiles.filter(file => file.endsWith('.ttf'));

        if (ttfFiles.length === 0) {
            console.error('❌ No TTF files found in', FONTS_DIR);
            process.exit(1);
        }

        console.log(`📁 Found ${ttfFiles.length} TTF files`);

        const results = [];

        for (let i = 0; i < ttfFiles.length; i++) {
            const ttfFile = ttfFiles[i];
            const fontPath = path.join(FONTS_DIR, ttfFile);

            // Extract font name from filename
            const fontId = ttfFile.replace('.ttf', '');
            const fontFamily = fontId.replace(/_/g, ' ');

            console.log(`\n[${i + 1}/${ttfFiles.length}] 🔄 Generating SVG for "${fontFamily}"...`);

            try {
                // Generate SVG
                const svgResult = await generateLetterASVG(fontPath, fontFamily);

                if (!svgResult) {
                    results.push({
                        fontFamily,
                        fontId,
                        status: 'error',
                        error: 'SVG generation failed'
                    });
                    continue;
                }

                // Save SVG
                const svgPath = path.join(SVGS_DIR, `${fontId}_a.svg`);
                await fs.writeFile(svgPath, svgResult.svg, 'utf-8');

                console.log(`✅ SVG generated: ${fontFamily} (${svgResult.width}x${svgResult.height})`);

                results.push({
                    fontFamily,
                    fontId,
                    status: 'success',
                    svgPath: `/content/embeds/typography/font_svgs/${fontId}_a.svg`,
                    dimensions: {
                        width: svgResult.width,
                        height: svgResult.height
                    },
                    fontMetrics: svgResult.fontMetrics
                });

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

        // Update font manifest
        await updateFontManifest(results);

        // Display final statistics
        const successful = results.filter(r => r.status === 'success').length;
        const errors = results.filter(r => r.status === 'error').length;

        console.log('\n📊 Final statistics:');
        console.log(`✅ SVGs generated successfully: ${successful}`);
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
    generateSVGsForAllFonts();
}

export { generateSVGsForAllFonts, generateLetterASVG };