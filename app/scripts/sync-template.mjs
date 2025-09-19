#!/usr/bin/env node

/**
 * Script de synchronisation avec le template de base research-article-template
 * 
 * Ce script :
 * 1. Clone ou update le repo template dans un dossier temporaire
 * 2. Copie tous les fichiers SAUF ceux dans ./src/content qui contiennent le contenu spécifique
 * 3. Préserve les fichiers de configuration locaux importants
 * 4. Fait un backup des fichiers qui vont être écrasés
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

// Fichiers et dossiers à PRÉSERVER (ne pas écraser)
const PRESERVE_PATHS = [
    // Contenu spécifique au projet SmolLM
    'app/src/content',

    // Données publiques (lien symbolique vers nos données)
    'app/public/data',

    // Configuration locale
    'app/package-lock.json',
    'app/node_modules',

    // Scripts spécifiques (préserver notre script de sync)
    'app/scripts/sync-template.mjs',

    // Fichiers de configuration du projet
    'README.md',
    'tools',

    // Fichiers de backup et temporaires
    '.backup-*',
    '.temp-*',

    // Git
    '.git',
    '.gitignore'
];

// Fichiers à traiter avec précaution (demander confirmation)
const SENSITIVE_FILES = [
    'app/package.json',
    'app/astro.config.mjs',
    'Dockerfile',
    'nginx.conf'
];

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldBackup = args.includes('--backup'); // Désactivé par défaut, utiliser --backup pour l'activer
const isForce = args.includes('--force');

console.log('🔄 Script de synchronisation avec le template research-article-template');
console.log(`📁 Répertoire de travail: ${PROJECT_ROOT}`);
console.log(`🎯 Template source: ${TEMPLATE_REPO}`);
if (isDryRun) console.log('🔍 Mode DRY-RUN activé - aucun fichier ne sera modifié');
if (shouldBackup) console.log('💾 Backup activé');
if (!shouldBackup) console.log('🚫 Backup désactivé (utilisez --backup pour l\'activer)');
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
        console.error(`❌ Erreur lors de l'exécution: ${command}`);
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
        console.log(`💾 Backup créé: ${path.relative(PROJECT_ROOT, backupPath)}`);
    } catch (error) {
        console.warn(`⚠️  Impossible de créer le backup de ${filePath}: ${error.message}`);
    }
}

async function syncFile(sourcePath, targetPath) {
    const relativeTarget = path.relative(PROJECT_ROOT, targetPath);

    // Vérifier si le fichier doit être préservé
    if (await isPathPreserved(relativeTarget)) {
        console.log(`🔒 PRÉSERVÉ: ${relativeTarget}`);
        return;
    }

    // Vérifier si c'est un fichier sensible
    if (SENSITIVE_FILES.includes(relativeTarget)) {
        if (!isForce) {
            console.log(`⚠️  SENSIBLE (ignoré): ${relativeTarget} (utilisez --force pour écraser)`);
            return;
        } else {
            console.log(`⚠️  SENSIBLE (forcé): ${relativeTarget}`);
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
        console.log(`[DRY-RUN] COPIE: ${relativeTarget}`);
        return;
    }

    // Assurer que le répertoire parent existe
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    // Vérifier si la source est un lien symbolique
    try {
        const sourceStats = await fs.lstat(sourcePath);
        if (sourceStats.isSymbolicLink()) {
            console.log(`🔗 LIEN SYMBOLIQUE (ignoré): ${relativeTarget}`);
            return;
        }
    } catch (error) {
        console.warn(`⚠️  Impossible de vérifier la source ${sourcePath}: ${error.message}`);
        return;
    }

    // Supprimer le fichier cible s'il existe (pour gérer les liens symboliques)
    if (await pathExists(targetPath)) {
        await fs.rm(targetPath, { recursive: true, force: true });
    }

    // Copier le fichier
    await fs.copyFile(sourcePath, targetPath);
    console.log(`✅ COPIÉ: ${relativeTarget}`);
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
    console.log('📥 Récupération du template...');

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
    console.log('\n📊 RÉSUMÉ DE LA SYNCHRONISATION');
    console.log('================================');

    console.log('\n🔒 Fichiers/dossiers préservés:');
    for (const preserve of PRESERVE_PATHS) {
        const fullPath = path.join(PROJECT_ROOT, preserve);
        if (await pathExists(fullPath)) {
            console.log(`   ✓ ${preserve}`);
        } else {
            console.log(`   - ${preserve} (n'existe pas)`);
        }
    }

    console.log('\n⚠️  Fichiers sensibles (nécessitent --force):');
    for (const sensitive of SENSITIVE_FILES) {
        const fullPath = path.join(PROJECT_ROOT, sensitive);
        if (await pathExists(fullPath)) {
            console.log(`   ! ${sensitive}`);
        }
    }

    if (isDryRun) {
        console.log('\n🔍 Pour exécuter réellement: npm run sync:template');
        console.log('🔧 Pour forcer les fichiers sensibles: npm run sync:template -- --force');
    }
}

async function cleanup() {
    console.log('\n🧹 Nettoyage...');
    if (await pathExists(TEMP_DIR)) {
        if (!isDryRun) {
            await fs.rm(TEMP_DIR, { recursive: true, force: true });
        }
        console.log(`🗑️  Dossier temporaire supprimé: ${TEMP_DIR}`);
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

        console.log('\n✅ Synchronisation terminée !');

    } catch (error) {
        console.error('\n❌ Erreur durant la synchronisation:');
        console.error(error.message);
        process.exit(1);
    } finally {
        await cleanup();
    }
}

// Gestion des signaux pour nettoyer en cas d'interruption
process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Interruption détectée, nettoyage...');
    await cleanup();
    process.exit(1);
});

process.on('SIGTERM', async () => {
    console.log('\n\n⚠️  Arrêt demandé, nettoyage...');
    await cleanup();
    process.exit(1);
});

main();
