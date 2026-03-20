#!/usr/bin/env node
/**
 * Asset Backup Utility
 * 
 * Creates timestamped backups of generated assets before regeneration.
 * Run this before using any generator scripts to preserve originals.
 * 
 * Usage:
 *   node tools/backup-assets.js              # Backup all generated assets
 *   node tools/backup-assets.js scenes       # Backup only scenes
 *   node tools/backup-assets.js sprites      # Backup only sprites
 *   node tools/backup-assets.js --list       # List existing backups
 *   node tools/backup-assets.js --restore <backup-name>  # Restore a backup
 */

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const BACKUPS_DIR = path.join(ASSETS_DIR, 'backups');

// Asset categories to backup
const ASSET_CATEGORIES = {
  scenes: 'scenes',
  sprites: 'sprites',
  audio: 'audio'
};

/**
 * Create timestamp string for backup folder names
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
}

/**
 * Copy directory recursively
 */
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  ⚠️  Source not found: ${src}`);
    return 0;
  }

  fs.mkdirSync(dest, { recursive: true });
  let fileCount = 0;

  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fileCount += copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      fileCount++;
    }
  }

  return fileCount;
}

/**
 * Get size of directory in bytes
 */
function getDirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  
  let size = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  
  return size;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Backup specified asset categories
 */
function backupAssets(categories) {
  const timestamp = getTimestamp();
  const backupName = `backup_${timestamp}`;
  const backupPath = path.join(BACKUPS_DIR, backupName);

  console.log('\n📦 Asset Backup Utility\n');
  console.log(`Creating backup: ${backupName}`);
  console.log('─'.repeat(50));

  fs.mkdirSync(backupPath, { recursive: true });

  let totalFiles = 0;
  let totalSize = 0;

  for (const category of categories) {
    const srcDir = path.join(ASSETS_DIR, category);
    const destDir = path.join(backupPath, category);

    if (!fs.existsSync(srcDir)) {
      console.log(`\n⚠️  Skipping ${category}/ (not found)`);
      continue;
    }

    console.log(`\n📁 Backing up ${category}/...`);
    const fileCount = copyDirSync(srcDir, destDir);
    const size = getDirSize(destDir);
    
    console.log(`   ✅ ${fileCount} files (${formatBytes(size)})`);
    totalFiles += fileCount;
    totalSize += size;
  }

  // Write backup manifest
  const manifest = {
    created: new Date().toISOString(),
    categories: categories,
    totalFiles: totalFiles,
    totalSize: totalSize
  };
  
  fs.writeFileSync(
    path.join(backupPath, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Backup complete!`);
  console.log(`   Location: assets/backups/${backupName}/`);
  console.log(`   Total: ${totalFiles} files (${formatBytes(totalSize)})`);
  console.log('');

  return backupName;
}

/**
 * List existing backups
 */
function listBackups() {
  console.log('\n📦 Existing Backups\n');
  console.log('─'.repeat(60));

  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log('No backups found.\n');
    return;
  }

  const backups = fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('backup_'))
    .sort((a, b) => b.name.localeCompare(a.name)); // Newest first

  if (backups.length === 0) {
    console.log('No backups found.\n');
    return;
  }

  for (const backup of backups) {
    const backupPath = path.join(BACKUPS_DIR, backup.name);
    const manifestPath = path.join(backupPath, 'manifest.json');
    
    let info = '';
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      info = `${manifest.totalFiles} files, ${formatBytes(manifest.totalSize)}, ${manifest.categories.join('/')}`;
    } else {
      const size = getDirSize(backupPath);
      info = formatBytes(size);
    }

    console.log(`  📁 ${backup.name}`);
    console.log(`     ${info}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Total: ${backups.length} backup(s)\n`);
  console.log('To restore: node tools/backup-assets.js --restore <backup-name>\n');
}

/**
 * Restore a backup
 */
function restoreBackup(backupName) {
  const backupPath = path.join(BACKUPS_DIR, backupName);

  if (!fs.existsSync(backupPath)) {
    console.log(`\n❌ Backup not found: ${backupName}`);
    console.log('Use --list to see available backups.\n');
    return;
  }

  console.log('\n📦 Restoring Backup\n');
  console.log(`Source: ${backupName}`);
  console.log('─'.repeat(50));

  // Read manifest to get categories
  const manifestPath = path.join(backupPath, 'manifest.json');
  let categories = Object.keys(ASSET_CATEGORIES);
  
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    categories = manifest.categories;
  }

  let totalFiles = 0;

  for (const category of categories) {
    const srcDir = path.join(backupPath, category);
    const destDir = path.join(ASSETS_DIR, category);

    if (!fs.existsSync(srcDir)) {
      continue;
    }

    console.log(`\n📁 Restoring ${category}/...`);
    const fileCount = copyDirSync(srcDir, destDir);
    console.log(`   ✅ ${fileCount} files restored`);
    totalFiles += fileCount;
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Restore complete! ${totalFiles} files restored.\n`);
}

// Main
function main() {
  const args = process.argv.slice(2);

  // Ensure backups directory exists
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  if (args.includes('--list')) {
    listBackups();
    return;
  }

  if (args.includes('--restore')) {
    const restoreIndex = args.indexOf('--restore');
    const backupName = args[restoreIndex + 1];
    if (!backupName) {
      console.log('\n❌ Please specify a backup name to restore.\n');
      console.log('Usage: node tools/backup-assets.js --restore <backup-name>\n');
      return;
    }
    restoreBackup(backupName);
    return;
  }

  // Determine which categories to backup
  let categories = [];
  
  if (args.length === 0 || args.includes('--all')) {
    categories = Object.keys(ASSET_CATEGORIES);
  } else {
    for (const arg of args) {
      if (ASSET_CATEGORIES[arg]) {
        categories.push(arg);
      }
    }
  }

  if (categories.length === 0) {
    console.log('\n📦 Asset Backup Utility\n');
    console.log('Usage:');
    console.log('  node tools/backup-assets.js              # Backup all assets');
    console.log('  node tools/backup-assets.js scenes       # Backup scenes only');
    console.log('  node tools/backup-assets.js sprites      # Backup sprites only');
    console.log('  node tools/backup-assets.js --list       # List backups');
    console.log('  node tools/backup-assets.js --restore <name>  # Restore backup');
    console.log('');
    return;
  }

  backupAssets(categories);
}

main();


