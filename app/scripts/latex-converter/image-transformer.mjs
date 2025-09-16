/**
 * Transformateur d'images : Markdown → ResponsiveImage Astro
 * Convertit les images markdown en composants ResponsiveImage optimisés
 */

import { promises as fs } from 'node:fs';
import { dirname, basename, extname, resolve, relative } from 'node:path';

export class ImageTransformer {
    constructor() {
        this.stats = {
            filesProcessed: 0,
            imagesTransformed: 0,
            importsAdded: 0
        };
    }

    async transformImagesInDirectory(contentDir) {
        const chaptersDir = resolve(contentDir, 'chapters');

        try {
            const files = await fs.readdir(chaptersDir);
            const mdxFiles = files.filter(file => file.endsWith('.mdx'));

            for (const file of mdxFiles) {
                const filePath = resolve(chaptersDir, file);
                await this.transformImagesInFile(filePath, contentDir);
                this.stats.filesProcessed++;
            }

            console.log(`📸 Image transformation completed:`);
            console.log(`   📄 Files processed: ${this.stats.filesProcessed}`);
            console.log(`   🖼️  Images transformed: ${this.stats.imagesTransformed}`);
            console.log(`   📦 Imports added: ${this.stats.importsAdded}`);

        } catch (error) {
            console.error('Error transforming images:', error.message);
        }
    }

    async transformImagesInFile(filePath, contentDir) {
        try {
            let content = await fs.readFile(filePath, 'utf-8');

            const imageInfo = this.extractImageInfo(content);
            if (imageInfo.length === 0) {
                return; // No images to transform
            }

            const imports = this.generateImports(imageInfo, filePath, contentDir);
            const transformedContent = this.transformImageReferences(content, imageInfo);

            // Add imports at the top of the file
            const finalContent = this.addImportsToFile(transformedContent, imports);

            await fs.writeFile(filePath, finalContent);

            this.stats.imagesTransformed += imageInfo.length;
            this.stats.importsAdded += imports.length;

        } catch (error) {
            console.error(`Error processing ${filePath}:`, error.message);
        }
    }

    extractImageInfo(content) {
        // More robust regex that handles complex alt text with brackets and parentheses
        const imageRegex = /!\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]\(([^)]+)\)(?:\s*(#[^\s]+))?/g;
        const images = [];
        let match;

        while ((match = imageRegex.exec(content)) !== null) {
            const [fullMatch, alt, src, id] = match;

            // Only process relative image paths (not external URLs)
            if (!src.startsWith('http') && !src.startsWith('//')) {
                images.push({
                    fullMatch,
                    alt: alt || 'Figure',
                    src,
                    id: id ? id.substring(1) : null, // Remove # from id
                    variableName: this.generateVariableName(src)
                });
            }
        }

        return images;
    }

    generateVariableName(imagePath) {
        // Convert path to valid variable name
        // assets/image/ch4/ch4-bc-trajectories.png → ch4BcTrajectories
        const filename = basename(imagePath, extname(imagePath));

        return filename
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/\s/g, '')
            .replace(/^\d+/, 'Fig$&'); // Prefix with Fig if starts with number
    }

    generateImports(imageInfo, filePath, contentDir) {
        const imports = [];

        // Add ResponsiveImage import
        imports.push("import ResponsiveImage from '../../components/ResponsiveImage.astro'");

        // Add image imports
        for (const image of imageInfo) {
            const relativePath = this.getRelativeImagePath(image.src, filePath, contentDir);
            imports.push(`import ${image.variableName} from '${relativePath}'`);
        }

        return imports;
    }

    getRelativeImagePath(imageSrc, filePath, contentDir) {
        // Convert absolute image path to relative from chapter file
        // From: chapters/04_imitation_learning.mdx
        // To: ../assets/image/ch4/ch4-bc-trajectories.png

        const chapterDir = dirname(filePath);
        const imageAbsolutePath = resolve(contentDir, imageSrc);
        const relativePath = relative(chapterDir, imageAbsolutePath);

        return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
    }

    transformImageReferences(content, imageInfo) {
        let transformed = content;

        for (const image of imageInfo) {
            const componentTag = this.generateResponsiveImageTag(image);
            transformed = transformed.replace(image.fullMatch, componentTag);
        }

        return transformed;
    }

    generateResponsiveImageTag(image) {
        const props = [
            `src={${image.variableName}}`,
            `alt="${image.alt}"`
        ];

        if (image.id) {
            props.push(`id="${image.id}"`);
        }

        return `<ResponsiveImage ${props.join(' ')} />`;
    }

    addImportsToFile(content, imports) {
        if (imports.length === 0) {
            return content;
        }

        // Check if there are already imports at the top
        const lines = content.split('\n');
        let insertIndex = 0;

        // Skip existing imports
        while (insertIndex < lines.length &&
            (lines[insertIndex].startsWith('import ') ||
                lines[insertIndex].trim() === '')) {
            insertIndex++;
        }

        // Insert imports
        const importBlock = imports.join('\n') + '\n\n';
        lines.splice(insertIndex, 0, importBlock);

        return lines.join('\n');
    }

    getStats() {
        return this.stats;
    }
}
