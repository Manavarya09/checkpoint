#!/usr/bin/env node
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { homedir } from 'os';

const CHECKPOINTS_ROOT = join(homedir(), '.claude-checkpoints');

function getSessionDir(sessionId) {
  return join(CHECKPOINTS_ROOT, sessionId);
}

function getManifestPath(sessionId) {
  return join(getSessionDir(sessionId), 'manifest.json');
}

function getTrackedFilesPath(sessionId) {
  return join(getSessionDir(sessionId), 'tracked-files.json');
}

function loadManifest(sessionId) {
  const p = getManifestPath(sessionId);
  if (!existsSync(p)) {
    return {
      session: sessionId,
      created: new Date().toISOString(),
      projectRoot: process.cwd(),
      checkpoints: []
    };
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveManifest(sessionId, manifest) {
  const dir = getSessionDir(sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(getManifestPath(sessionId), JSON.stringify(manifest, null, 2));
}

function loadTrackedFiles(sessionId) {
  const p = getTrackedFilesPath(sessionId);
  if (!existsSync(p)) return { files: {}, newFiles: {} };
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveTrackedFiles(sessionId, tracked) {
  const dir = getSessionDir(sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(getTrackedFilesPath(sessionId), JSON.stringify(tracked, null, 2));
}

// Register a file that Claude is about to modify
export function trackFile(sessionId, filePath, projectRoot) {
  const absPath = resolve(projectRoot, filePath);
  const relPath = relative(projectRoot, absPath);
  const tracked = loadTrackedFiles(sessionId);

  const isNew = !existsSync(absPath);
  if (isNew) {
    if (!tracked.newFiles) tracked.newFiles = {};
    tracked.newFiles[relPath] = true;
  }

  tracked.files[relPath] = {
    absPath,
    trackedAt: new Date().toISOString()
  };

  saveTrackedFiles(sessionId, tracked);
  return { relPath, isNew };
}

// Create a checkpoint by snapshotting all tracked files
export function createCheckpoint(sessionId, projectRoot, promptPreview = '') {
  const manifest = loadManifest(sessionId);
  const tracked = loadTrackedFiles(sessionId);
  const id = manifest.checkpoints.length + 1;
  const cpDir = join(getSessionDir(sessionId), String(id));
  const files = [];
  const newFiles = [];

  manifest.projectRoot = projectRoot;

  for (const [relPath, info] of Object.entries(tracked.files)) {
    const srcPath = resolve(projectRoot, relPath);
    if (existsSync(srcPath)) {
      const destPath = join(cpDir, relPath);
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
      files.push(relPath);
    }
  }

  // Track which files were newly created (so undo can delete them)
  if (tracked.newFiles) {
    for (const relPath of Object.keys(tracked.newFiles)) {
      newFiles.push(relPath);
    }
  }

  manifest.checkpoints.push({
    id,
    timestamp: new Date().toISOString(),
    files,
    newFiles,
    promptPreview: promptPreview.slice(0, 100)
  });

  saveManifest(sessionId, manifest);

  // Reset new files tracking for next checkpoint
  tracked.newFiles = {};
  saveTrackedFiles(sessionId, tracked);

  return { id, files: files.length, newFiles: newFiles.length };
}

// List all checkpoints
export function listCheckpoints(sessionId) {
  const manifest = loadManifest(sessionId);
  return manifest.checkpoints;
}

// Restore files from a specific checkpoint
export function restoreCheckpoint(sessionId, targetId) {
  const manifest = loadManifest(sessionId);
  const projectRoot = manifest.projectRoot;

  if (!projectRoot) {
    return { error: 'No project root found in manifest' };
  }

  const target = manifest.checkpoints.find(cp => cp.id === targetId);
  if (!target) {
    return { error: `Checkpoint ${targetId} not found` };
  }

  // First, create a safety checkpoint of current state
  const safetyResult = createCheckpoint(sessionId, projectRoot, `[auto] before undo to #${targetId}`);

  const cpDir = join(getSessionDir(sessionId), String(targetId));
  const restored = [];
  const deleted = [];

  // Restore files from checkpoint
  for (const relPath of target.files) {
    const srcPath = join(cpDir, relPath);
    const destPath = resolve(projectRoot, relPath);
    if (existsSync(srcPath)) {
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
      restored.push(relPath);
    }
  }

  // Delete files that were newly created AFTER this checkpoint
  for (let i = manifest.checkpoints.length - 1; i >= 0; i--) {
    const cp = manifest.checkpoints[i];
    if (cp.id <= targetId) break;
    if (cp.newFiles) {
      for (const relPath of cp.newFiles) {
        const absPath = resolve(projectRoot, relPath);
        if (existsSync(absPath)) {
          rmSync(absPath);
          deleted.push(relPath);
        }
      }
    }
  }

  return {
    restoredTo: targetId,
    safetyCheckpoint: safetyResult.id,
    restored: restored.length,
    deleted: deleted.length,
    restoredFiles: restored,
    deletedFiles: deleted
  };
}

// Undo last prompt's changes (restore to most recent checkpoint before current state)
export function undoLast(sessionId) {
  const manifest = loadManifest(sessionId);
  const checkpoints = manifest.checkpoints;

  if (checkpoints.length === 0) {
    return { error: 'No checkpoints to undo to' };
  }

  // Find the last real checkpoint (skip auto-safety ones)
  let targetId = checkpoints[checkpoints.length - 1].id;

  return restoreCheckpoint(sessionId, targetId);
}

// Show diff between checkpoint and current state
export function diffCheckpoint(sessionId, targetId) {
  const manifest = loadManifest(sessionId);
  const projectRoot = manifest.projectRoot;
  const target = manifest.checkpoints.find(cp => cp.id === targetId);

  if (!target) {
    return { error: `Checkpoint ${targetId} not found` };
  }

  const cpDir = join(getSessionDir(sessionId), String(targetId));
  const diffs = [];

  for (const relPath of target.files) {
    const cpPath = join(cpDir, relPath);
    const currentPath = resolve(projectRoot, relPath);

    const cpContent = existsSync(cpPath) ? readFileSync(cpPath, 'utf8') : null;
    const currentContent = existsSync(currentPath) ? readFileSync(currentPath, 'utf8') : null;

    if (cpContent !== currentContent) {
      diffs.push({
        file: relPath,
        cpLines: cpContent ? cpContent.split('\n').length : 0,
        currentLines: currentContent ? currentContent.split('\n').length : 0,
        changed: true
      });
    }
  }

  return { checkpointId: targetId, diffs, totalChanged: diffs.length };
}

// Get status
export function getStatus(sessionId) {
  const manifest = loadManifest(sessionId);
  const tracked = loadTrackedFiles(sessionId);
  const sessionDir = getSessionDir(sessionId);

  let totalSize = 0;
  if (existsSync(sessionDir)) {
    const calcSize = (dir) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        const stat = statSync(p);
        if (stat.isDirectory()) calcSize(p);
        else totalSize += stat.size;
      }
    };
    calcSize(sessionDir);
  }

  return {
    session: sessionId,
    checkpoints: manifest.checkpoints.length,
    trackedFiles: Object.keys(tracked.files).length,
    storageBytes: totalSize,
    storageMB: (totalSize / 1024 / 1024).toFixed(2)
  };
}

// Cleanup session
export function cleanupSession(sessionId) {
  const dir = getSessionDir(sessionId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true });
    return { cleaned: true };
  }
  return { cleaned: false, reason: 'session not found' };
}

// CLI interface
const [,, command, ...args] = process.argv;
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
const projectRoot = process.env.PROJECT_ROOT || process.cwd();

switch (command) {
  case 'track': {
    const filePath = args[0];
    if (!filePath) { console.error('Usage: store.js track <file>'); process.exit(1); }
    const result = trackFile(sessionId, filePath, projectRoot);
    console.log(JSON.stringify(result));
    break;
  }
  case 'create': {
    const preview = args.join(' ') || '';
    const result = createCheckpoint(sessionId, projectRoot, preview);
    console.log(JSON.stringify(result));
    break;
  }
  case 'list': {
    const result = listCheckpoints(sessionId);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'restore': {
    const id = parseInt(args[0]);
    if (isNaN(id)) { console.error('Usage: store.js restore <id>'); process.exit(1); }
    const result = restoreCheckpoint(sessionId, id);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'undo': {
    const result = undoLast(sessionId);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'diff': {
    const id = parseInt(args[0]);
    if (isNaN(id)) { console.error('Usage: store.js diff <id>'); process.exit(1); }
    const result = diffCheckpoint(sessionId, id);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'status': {
    const result = getStatus(sessionId);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'cleanup': {
    const result = cleanupSession(sessionId);
    console.log(JSON.stringify(result));
    break;
  }
  default:
    console.error('Commands: track, create, list, restore, undo, diff, status, cleanup');
    process.exit(1);
}
