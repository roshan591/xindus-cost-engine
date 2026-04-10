#!/usr/bin/env node

const { execSync } = require('node:child_process');

const MIN_SAFE_VERSION = [14, 2, 35];
const MIN_SAFE_VERSION_STRING = MIN_SAFE_VERSION.join('.');

function parse(version) {
  return version.split('.').map((part) => Number.parseInt(part, 10));
}

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function readNpmLsJson() {
  try {
    return execSync('npm ls next --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (error) {
    if (typeof error?.stdout === 'string' && error.stdout.trim()) {
      return error.stdout;
    }
    throw error;
  }
}

function getInstalledNextVersion() {
  const raw = readNpmLsJson();
  const parsed = JSON.parse(raw);
  return parsed.dependencies?.next?.version;
}

const installed = getInstalledNextVersion();

if (!installed) {
  console.error('[check-next-version] Unable to determine installed next version.');
  process.exit(1);
}

const installedParsed = parse(installed);

if (installedParsed[0] === 14 && compare(installedParsed, MIN_SAFE_VERSION) < 0) {
  console.error(
    `[check-next-version] Installed next@${installed} is below the minimum safe version ${MIN_SAFE_VERSION_STRING}.\n` +
      'Your repository already pins the safe version in package.json, so this usually means your local node_modules is stale.\n' +
      'Fix: remove node_modules + lockfile and reinstall dependencies:\n' +
      '  rm -rf node_modules package-lock.json\n' +
      '  npm install\n' +
      `Then verify with: npm ls next (expected ${MIN_SAFE_VERSION_STRING} or newer).`,
  );
  process.exit(1);
}

console.log(`[check-next-version] Installed next@${installed} passed security gate.`);
