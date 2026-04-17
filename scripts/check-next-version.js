#!/usr/bin/env node

const { execSync } = require('node:child_process');

const MIN_SAFE_VERSION = [14, 2, 35];
const MIN_SAFE_VERSION_STRING = MIN_SAFE_VERSION.join('.');
const MIN_NODE_MAJOR = 20;
const MAX_NODE_MAJOR_EXCLUSIVE = 24;
const SUPPORTED_NODE_LTS = '20 or 22';

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

function validateNodeVersion() {
  const raw = process.versions.node;
  const parsed = parse(raw);
  const major = parsed[0] || 0;

  if (major < MIN_NODE_MAJOR || major >= MAX_NODE_MAJOR_EXCLUSIVE) {
    console.error(
      `[check-next-version] Detected Node.js ${raw}. This project should be run with Node ${SUPPORTED_NODE_LTS} LTS.\n` +
        'Node 24 is causing broken Next.js build artifacts in this repository on Windows (missing .next chunk modules at runtime).\n' +
        'Fix: switch to Node 20.x or 22.x, then reinstall dependencies and rebuild:\n' +
        '  1. Install Node 20 LTS or Node 22 LTS\n' +
        '  2. Remove node_modules and package-lock.json\n' +
        '  3. Run npm install\n' +
        '  4. Run npm run dev',
    );
    process.exit(1);
  }
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

validateNodeVersion();

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
