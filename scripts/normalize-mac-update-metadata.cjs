#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const [metadataPath, zipPath] = process.argv.slice(2);

if (!metadataPath || !zipPath) {
  console.error('Usage: node scripts/normalize-mac-update-metadata.cjs <latest-mac.yml> <zip>');
  process.exit(2);
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${label}: ${filePath}`);
    process.exit(1);
  }
}

function readYamlScalar(source, key) {
  const match = source.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) {
    return null;
  }

  const value = match[1].trim();
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('base64')));
  });
}

async function main() {
  requireFile(metadataPath, 'macOS update metadata');
  requireFile(zipPath, 'macOS ZIP artifact');

  const original = fs.readFileSync(metadataPath, 'utf8');
  const version = readYamlScalar(original, 'version');
  const releaseDate = readYamlScalar(original, 'releaseDate') || new Date().toISOString();

  if (!version) {
    console.error(`Cannot normalize ${metadataPath}: missing version field.`);
    process.exit(1);
  }

  const zipName = path.basename(zipPath);
  const zipStat = fs.statSync(zipPath);
  const zipSha512 = await hashFile(zipPath);

  const normalized = [
    `version: ${version}`,
    'files:',
    `  - url: ${zipName}`,
    `    sha512: ${zipSha512}`,
    `    size: ${zipStat.size}`,
    `path: ${zipName}`,
    `sha512: ${zipSha512}`,
    `releaseDate: '${releaseDate.replace(/'/g, "''")}'`,
    '',
  ].join('\n');

  fs.writeFileSync(metadataPath, normalized);
  console.log(`Normalized ${path.basename(metadataPath)} for ZIP updates: ${zipName} (${zipStat.size} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
