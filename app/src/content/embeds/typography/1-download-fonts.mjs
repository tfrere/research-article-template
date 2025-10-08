#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';
import fonteditor from 'fonteditor-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GOOGLE_FONTS_API_KEY = process.env.GOOGLE_FONTS_API_KEY;
const GOOGLE_FONTS_API_URL = 'https://www.googleapis.com/webfonts/v1/webfonts';
const TYPOGRAPHY_BASE = __dirname;
const GENERATED_DIR = path.join(TYPOGRAPHY_BASE, 'generated');
const FONTS_DIR = path.join(GENERATED_DIR, 'fonts');
const SVGS_DIR = path.join(GENERATED_DIR, 'svgs');
const FONT_MANIFEST_PATH = path.join(GENERATED_DIR, 'data', 'font_manifest.json');
const TYPOGRAPHY_DATA_PATH = path.join(GENERATED_DIR, 'data', 'typography_data.json');

/**
 * Downloads the Google Fonts list
 */
async function fetchGoogleFontsList() {
    // 1. Try Google Fonts API with key if available
    if (GOOGLE_FONTS_API_KEY && GOOGLE_FONTS_API_KEY !== 'YOUR_API_KEY_HERE') {
        try {
            console.log('🔍 Fetching from Google Fonts API (with key)...');
            const url = `${GOOGLE_FONTS_API_URL}?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const fonts = data.items || [];
            
            console.log(`✅ ${fonts.length} fonts retrieved from official API`);
            
            return fonts.map(font => ({
                family: font.family,
                category: font.category || 'sans-serif',
                files: font.files || {}
            }));
            
        } catch (error) {
            console.error('❌ Google Fonts API error:', error.message);
        }
    }

    // 2. Try fontsource google-font-metadata (without key)
    try {
        console.log('🔍 Attempting via fontsource google-font-metadata...');

        const metadataUrl = 'https://raw.githubusercontent.com/fontsource/google-font-metadata/main/data/google-fonts-v1.json';

        console.log(`📥 Attempting: ${metadataUrl}`);
        const response = await fetch(metadataUrl, { timeout: 15000 });

        if (response.ok) {
            const data = await response.json();

            // Fontsource data structure: { "font-id": { family: "Font Name", category: "sans-serif", ... }, ... }
            if (data && typeof data === 'object') {
                const fonts = Object.values(data).map(font => ({
                    family: font.family,
                    category: font.category || 'sans-serif',
                    files: {
                        regular: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:wght@400&display=swap`
                    }
                }));

                console.log(`✅ ${fonts.length} fonts retrieved from fontsource metadata`);
                return fonts;
            }
        } else {
            console.log(`⚠️  Failed ${metadataUrl}: HTTP ${response.status}`);
        }

    } catch (error) {
        console.log('⚠️  Fontsource metadata not available:', error.message);
    }

    // 3. Fallback: existing local manifest

    // Fallback: use existing manifest
    try {
        const manifestData = await fs.readFile(FONT_MANIFEST_PATH, 'utf-8');
        const manifest = JSON.parse(manifestData);
        const fontNames = Object.keys(manifest);
        
        console.log(`📚 ${fontNames.length} fonts found in manifest`);
        
        return fontNames.map(name => ({
            family: name,
            files: {
                regular: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400&display=swap`
            }
        }));
    } catch (error) {
        console.error('❌ Error reading manifest:', error.message);

        // Ultimate fallback: use fallback fonts
        console.log('🔄 Using fallback fonts...');
        return getFallbackFonts();
    }
}

// Add function for fallback fonts
function getFallbackFonts() {
    const fallbackFonts = [
        "Roboto", "Open Sans", "Lato", "Montserrat", "Source Sans Pro",
        "Playfair Display", "Lora", "Crimson Text", "Merriweather",
        "Fira Code", "Source Code Pro", "JetBrains Mono", "Roboto Mono",
        "Dancing Script", "Pacifico", "Caveat", "Oswald", "Bebas Neue"
    ];
    
    return fallbackFonts.map(name => ({
        family: name,
        files: {
            regular: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400&display=swap`
        }
    }));
}

/**
 * Extracts WOFF2 URL from Google Fonts CSS response
 */
async function extractWOFF2Url(cssUrl, fontFamily) {
    try {
        console.log(`📥 CSS request for ${fontFamily}...`);
        
        const response = await fetch(cssUrl, {
            headers: {
                // Old User-Agent to force TTF/WOFF instead of WOFF2
                'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)',
                'Accept': 'text/css,*/*;q=0.1'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} - ${response.statusText}`);
        }

        const css = await response.text();
        
        if (!css || css.trim().length === 0) {
            throw new Error('Empty CSS response');
        }
        
        console.log(`📄 CSS received (${css.length} characters)`);
        if (css.includes('font-family')) {
            console.log(`✅ Valid CSS for ${fontFamily}`);
        } else {
            console.log(`⚠️  Suspicious CSS for ${fontFamily} - no font-family found`);
        }

        // Look for TTF first (most compatible)
        const ttfMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
        if (ttfMatch) {
            return { url: ttfMatch[1], format: 'ttf' };
        }

        // Look for WOFF (compatible with opentype.js)
        const woffMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff)\)/);
        if (woffMatch) {
            return { url: woffMatch[1], format: 'woff' };
        }

        // Look for WOFF2 as last resort
        const woff2Match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
        if (woff2Match) {
            return { url: woff2Match[1], format: 'woff2' };
        }

        throw new Error('No font file found in CSS');
    } catch (error) {
        console.error(`❌ Error extracting font URL for ${fontFamily}:`, error.message);
        return null;
    }
}

/**
 * Downloads and converts a Google Font to TTF
 */
async function downloadAndConvertGoogleFont(fontFamily, outputPath) {
    try {
        // Clean and properly encode the family name
        const cleanFontFamily = fontFamily.trim();
        const encodedFamily = encodeURIComponent(cleanFontFamily);
        
        // Build Google Fonts CSS URL with special character handling
        const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@400&display=swap`;

        console.log(`🔍 Extracting font URL from Google Fonts for "${cleanFontFamily}"...`);
        console.log(`🔗 CSS URL: ${cssUrl}`);
        
        const fontInfo = await extractWOFF2Url(cssUrl, cleanFontFamily);

        if (!fontInfo) {
            throw new Error('Font URL not found');
        }

        console.log(`📥 Downloading ${fontInfo.format.toUpperCase()} from Google Fonts...`);
        const response = await fetch(fontInfo.url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const fontBuffer = await response.arrayBuffer();

        if (fontInfo.format === 'ttf') {
            // Already TTF, save directly
            await fs.writeFile(outputPath, Buffer.from(fontBuffer));
            console.log(`✅ TTF font saved directly`);
        } else if (fontInfo.format === 'woff2') {
            // Convert WOFF2 to TTF
            console.log(`🔄 Converting WOFF2 to TTF...`);
            try {
                const font = fonteditor.woff2.decode(Buffer.from(fontBuffer));
                const ttfBuffer = fonteditor.ttf.encode(font);
                await fs.writeFile(outputPath, ttfBuffer);
                console.log(`✅ Font converted and saved as TTF`);
            } catch (conversionError) {
                throw new Error(`WOFF2 conversion failed: ${conversionError.message}`);
            }
        } else if (fontInfo.format === 'woff') {
            // WOFF version 1 - opentype.js can handle it directly
            await fs.writeFile(outputPath, Buffer.from(fontBuffer));
            console.log(`✅ WOFF font saved (opentype.js can read it)`);
        }

        return true;

    } catch (error) {
        console.error(`❌ Error during download/conversion for ${fontFamily}:`, error.message);
        return false;
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

        // Configuration uniforme
        const SVG_SIZE = 80; // Taille fixe 80x80
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
 * Validates that a font name is compatible with Google Fonts
 */
function validateFontName(fontName) {
    if (!fontName || typeof fontName !== 'string') {
        return { valid: false, reason: 'Empty or invalid name' };
    }
    
    const trimmed = fontName.trim();
    if (trimmed.length === 0) {
        return { valid: false, reason: 'Empty name after cleanup' };
    }
    
    if (trimmed.length > 100) {
        return { valid: false, reason: 'Name too long' };
    }
    
    // Problematic characters for Google Fonts URLs
    const problematicChars = /[<>'"&]/;
    if (problematicChars.test(trimmed)) {
        return { valid: false, reason: 'Problematic characters detected' };
    }
    
    return { valid: true, cleaned: trimmed };
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
 * Processes a font: download and SVG generation
 */
async function processFont(fontData, index, total) {
    const fontFamily = fontData.family;
    
    console.log(`\n[${index + 1}/${total}] 🔄 Processing "${fontFamily}"...`);
    
    // Font name validation
    const validation = validateFontName(fontFamily);
    if (!validation.valid) {
        console.error(`❌ Invalid font "${fontFamily}": ${validation.reason}`);
        return {
            fontFamily,
            fontId: fontNameToId(fontFamily),
            status: 'error',
            error: `Invalid name: ${validation.reason}`
        };
    }
    
    const cleanFontFamily = validation.cleaned;
    const fontId = fontNameToId(cleanFontFamily);

    // File paths
    const fontPath = path.join(FONTS_DIR, `${fontId}.ttf`);

    try {
        // Download font directly
        console.log(`⬇️  Downloading ${fontFamily} from Google Fonts...`);
        const downloadSuccess = await downloadAndConvertGoogleFont(fontFamily, fontPath);

        if (!downloadSuccess) {
            throw new Error('Download/conversion from Google Fonts failed');
        }

        console.log(`✅ Font downloaded and ready: ${fontFamily}`);

        return {
            fontFamily,
            fontId,
            status: 'downloaded',
            fontPath: fontPath
        };

    } catch (error) {
        console.error(`❌ Error for ${fontFamily}:`, error.message);
        return {
            fontFamily,
            fontId,
            status: 'error',
            error: error.message
        };
    }
}

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
            typographyData = JSON.parse(typographyDataContent);
        } catch {
            // Use empty array if no data exists
        }

        // Update with new results
        const successfulResults = results.filter(r => r.status === 'downloaded');

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

        // Save updated manifest
        await fs.writeFile(FONT_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

        console.log(`✅ Manifest updated with ${successfulResults.length} fonts`);

    } catch (error) {
        console.error('❌ Error updating manifest:', error.message);
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Generating Google Fonts SVGs\n');

    try {
        // Create necessary directories
        await fs.mkdir(FONTS_DIR, { recursive: true });
        await fs.mkdir(SVGS_DIR, { recursive: true });
        await fs.mkdir(path.dirname(FONT_MANIFEST_PATH), { recursive: true });

        // Get fonts list
        console.log('📋 Fetching fonts list...');
        const fonts = await fetchGoogleFontsList();

        if (fonts.length === 0) {
            console.error('❌ No fonts found');
            process.exit(1);
        }

        console.log(`📊 ${fonts.length} fonts found`);

        // Processing 300 fonts
        const limitedFonts = fonts.slice(0, 300);
        console.log(`🔬 Processing first ${limitedFonts.length} fonts`);

        // Process each font
        const results = [];
        for (let i = 0; i < limitedFonts.length; i++) {
            const result = await processFont(limitedFonts[i], i, limitedFonts.length);
            results.push(result);

            // Pause between requests to avoid rate limiting
            if (i < limitedFonts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Note: Manifest will be updated in later steps when SVGs are available

        // Display final statistics
        const downloaded = results.filter(r => r.status === 'downloaded').length;
        const errors = results.filter(r => r.status === 'error').length;

        console.log('\n📊 Final statistics:');
        console.log(`✅ Downloaded fonts: ${downloaded}`);
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
    main();
}

export { main, generateLetterASVG, fontNameToId };
