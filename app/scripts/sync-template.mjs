#!/usr/bin/env node

/**
 * Template synchronization script for research-article-template
 * 
 * This script:
 * 1. Clones or updates the template repo in a temporary directory
 * 2. Copies all files EXCEPT those in ./src/content which contain specific content
 * 3. Preserves important local configuration files
 * 4. Creates backups of files that will be overwritten
 * 
 * Usage: npm run sync:template [--dry-run] [--backup] [--force]
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(APP_ROOT, '..');
const TEMP_DIR = path.join(PROJECT_ROOT, '.temp-template-sync');
const TEMPLATE_REPO = 'https://huggingface.co/spaces/tfrere/research-article-template';

// Files and directories to PRESERVE (do not overwrite)
const PRESERVE_PATHS = [
    // Project-specific content
    'app/src/content',

    // Public data (symlink to our data)
    'app/public/data',

    // Local configuration
    'app/package-lock.json',
    'app/node_modules',

    // Project-specific scripts (preserve our sync script)
    'app/scripts/sync-template.mjs',

    // Project configuration files
    'README.md',
    'tools',

    // Backup and temporary files
    '.backup-*',
    '.temp-*',

    // Git
    '.git',
    '.gitignore'
];

// Files to handle with caution (require confirmation)
const SENSITIVE_FILES = [
    'app/package.json',
    'app/astro.config.mjs',
    'Dockerfile',
    'nginx.conf'
];

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldBackup = args.includes('--backup'); // Disabled by default, use --backup to enable
const isForce = args.includes('--force');

console.log('🔄 Template synchronization script for research-article-template');
console.log(`📁 Working directory: ${PROJECT_ROOT}`);
console.log(`🎯 Template source: ${TEMPLATE_REPO}`);
if (isDryRun) console.log('🔍 DRY-RUN mode enabled - no files will be modified');
if (shouldBackup) console.log('💾 Backup enabled');
if (!shouldBackup) console.log('🚫 Backup disabled (use --backup to enable)');
console.log('');

async function executeCommand(command, options = {}) {
    try {
        if (isDryRun && !options.allowInDryRun) {
            console.log(`[DRY-RUN] Commande: ${command}`);
            return '';
        }
        console.log(`$ ${command}`);
        const result = execSync(command, {
            encoding: 'utf8',
            cwd: options.cwd || PROJECT_ROOT,
            stdio: options.quiet ? 'pipe' : 'inherit'
        });
        return result;
    } catch (error) {
        console.error(`❌ Error during execution: ${command}`);
        console.error(error.message);
        throw error;
    }
}

async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function isPathPreserved(relativePath) {
    return PRESERVE_PATHS.some(preserve =>
        relativePath === preserve ||
        relativePath.startsWith(preserve + '/')
    );
}

async function createBackup(filePath) {
    if (!shouldBackup || isDryRun) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;

    try {
        await fs.copyFile(filePath, backupPath);
        console.log(`💾 Backup created: ${path.relative(PROJECT_ROOT, backupPath)}`);
    } catch (error) {
        console.warn(`⚠️  Unable to create backup for ${filePath}: ${error.message}`);
    }
}

async function syncFile(sourcePath, targetPath) {
    const relativeTarget = path.relative(PROJECT_ROOT, targetPath);

    // Check if the file should be preserved
    if (await isPathPreserved(relativeTarget)) {
        console.log(`🔒 PRESERVED: ${relativeTarget}`);
        return;
    }

    // Check if it's a sensitive file
    if (SENSITIVE_FILES.includes(relativeTarget)) {
        if (!isForce) {
            console.log(`⚠️  SENSITIVE (ignored): ${relativeTarget} (use --force to overwrite)`);
            return;
        } else {
            console.log(`⚠️  SENSITIVE (forced): ${relativeTarget}`);
        }
    }

    // Créer un backup si le fichier existe déjà (et que ce n'est pas un lien symbolique)
    if (await pathExists(targetPath)) {
        try {
            const stats = await fs.lstat(targetPath);
            if (!stats.isSymbolicLink()) {
                await createBackup(targetPath);
            }
        } catch (error) {
            console.warn(`⚠️  Impossible de vérifier ${targetPath}: ${error.message}`);
        }
    }

    if (isDryRun) {
        console.log(`[DRY-RUN] COPY: ${relativeTarget}`);
        return;
    }

    // Assurer que le répertoire parent existe
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Vérifier si la source est un lien symbolique
    try {
        const sourceStats = await fs.lstat(sourcePath);
        if (sourceStats.isSymbolicLink()) {
            console.log(`🔗 SYMLINK (ignored): ${relativeTarget}`);
            return;
        }
    } catch (error) {
        console.warn(`⚠️  Unable to check source ${sourcePath}: ${error.message}`);
        return;
    }

    // Supprimer le fichier cible s'il existe (pour gérer les liens symboliques)
    if (await pathExists(targetPath)) {
        await fs.rm(targetPath, { recursive: true, force: true });
    }

    // Copier le fichier
    await fs.copyFile(sourcePath, targetPath);
    console.log(`✅ COPIED: ${relativeTarget}`);
}

async function syncDirectory(sourceDir, targetDir) {
    const items = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const item of items) {
        const sourcePath = path.join(sourceDir, item.name);
        const targetPath = path.join(targetDir, item.name);
        const relativeTarget = path.relative(PROJECT_ROOT, targetPath);

        if (await isPathPreserved(relativeTarget)) {
            console.log(`🔒 DOSSIER PRÉSERVÉ: ${relativeTarget}/`);
            continue;
        }

        if (item.isDirectory()) {
            if (!isDryRun) {
                await fs.mkdir(targetPath, { recursive: true });
            }
            await syncDirectory(sourcePath, targetPath);
        } else {
            await syncFile(sourcePath, targetPath);
        }
    }
}

async function cloneOrUpdateTemplate() {
    console.log('📥 Fetching template...');

    // Nettoyer le dossier temporaire s'il existe
    if (await pathExists(TEMP_DIR)) {
        if (!isDryRun) {
            await fs.rm(TEMP_DIR, { recursive: true, force: true });
        } else {
            console.log(`[DRY-RUN] Suppression: ${TEMP_DIR}`);
        }
    }

    // Cloner le repo template (même en dry-run pour pouvoir comparer)
    await executeCommand(`git clone ${TEMPLATE_REPO} "${TEMP_DIR}"`, { allowInDryRun: true });

    return TEMP_DIR;
}

async function showSummary(templateDir) {
    console.log('\n📊 SYNCHRONIZATION SUMMARY');
    console.log('================================');

    console.log('\n🔒 Preserved files/directories:');
    for (const preserve of PRESERVE_PATHS) {
        const fullPath = path.join(PROJECT_ROOT, preserve);
        if (await pathExists(fullPath)) {
            console.log(`   ✓ ${preserve}`);
        } else {
            console.log(`   - ${preserve} (n'existe pas)`);
        }
    }

    console.log('\n⚠️  Sensitive files (require --force):');
    for (const sensitive of SENSITIVE_FILES) {
        const fullPath = path.join(PROJECT_ROOT, sensitive);
        if (await pathExists(fullPath)) {
            console.log(`   ! ${sensitive}`);
        }
    }

    if (isDryRun) {
        console.log('\n🔍 To execute for real: npm run sync:template');
        console.log('🔧 To force sensitive files: npm run sync:template -- --force');
    }
}

async function cleanup() {
    console.log('\n🧹 Cleaning up...');
    if (await pathExists(TEMP_DIR)) {
        if (!isDryRun) {
            await fs.rm(TEMP_DIR, { recursive: true, force: true });
        }
        console.log(`🗑️  Temporary directory removed: ${TEMP_DIR}`);
    }
}

async function main() {
    try {
        // Vérifier qu'on est dans le bon répertoire
        const packageJsonPath = path.join(APP_ROOT, 'package.json');
        if (!(await pathExists(packageJsonPath))) {
            throw new Error(`Package.json non trouvé dans ${APP_ROOT}. Êtes-vous dans le bon répertoire ?`);
        }

        // Cloner le template
        const templateDir = await cloneOrUpdateTemplate();

        // Synchroniser
        console.log('\n🔄 Synchronisation en cours...');
        await syncDirectory(templateDir, PROJECT_ROOT);

        // Afficher le résumé
        await showSummary(templateDir);

        console.log('\n✅ Synchronization completed!');

    } catch (error) {
        console.error('\n❌ Error during synchronization:');
        console.error(error.message);
        process.exit(1);
    } finally {
        await cleanup();
    }
}

// Gestion des signaux pour nettoyer en cas d'interruption
process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Interruption detected, cleaning up...');
    await cleanup();
    process.exit(1);
});

process.on('SIGTERM', async () => {
    console.log('\n\n⚠️  Shutdown requested, cleaning up...');
    await cleanup();
    process.exit(1);
});

main();
