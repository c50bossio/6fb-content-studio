#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function unquoteYamlScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return JSON.parse(trimmed);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replace(/''/g, "'");
  return trimmed;
}

function readPublisherNames(source) {
  const lines = source.split(/\r?\n/);
  const indices = lines.flatMap((line, index) => (/^publisherName\s*:/.test(line) ? [index] : []));
  if (indices.length === 0) return [];
  if (indices.length !== 1) throw new Error('app-update.yml must contain exactly one top-level publisherName');
  const index = indices[0];
  const inline = lines[index].replace(/^publisherName\s*:\s*/, '');
  if (inline) return [unquoteYamlScalar(inline)];
  const names = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    const match = line.match(/^\s+-\s+(.+)$/);
    if (!match) {
      if (line.trim()) break;
      continue;
    }
    names.push(unquoteYamlScalar(match[1]));
  }
  return names;
}

function readTopLevelScalar(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...source.matchAll(new RegExp(`^${escapedKey}\\s*:\\s*(.+)$`, 'gm'))];
  if (matches.length > 1) throw new Error(`latest.yml must contain exactly one top-level ${key}`);
  return matches.length === 1 ? unquoteYamlScalar(matches[0][1]) : null;
}

function readFileEntries(source) {
  const lines = source.split(/\r?\n/);
  const filesIndices = lines.flatMap((line, index) => (/^files\s*:\s*$/.test(line) ? [index] : []));
  if (filesIndices.length === 0) return [];
  if (filesIndices.length !== 1) throw new Error('latest.yml must contain exactly one top-level files block');
  const filesIndex = filesIndices[0];
  const entries = [];
  let current = null;
  for (let cursor = filesIndex + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim()) continue;
    if (/^\S/.test(line)) break;
    const start = line.match(/^\s{2}-\s+([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    const field = line.match(/^\s{4}([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (start) {
      current = {};
      entries.push(current);
      current[start[1]] = unquoteYamlScalar(start[2]);
    } else if (field && current) {
      if (Object.hasOwn(current, field[1])) throw new Error(`Duplicate files entry field: ${field[1]}`);
      current[field[1]] = unquoteYamlScalar(field[2]);
    } else {
      throw new Error(`Unsupported latest.yml files entry: ${line.trim()}`);
    }
  }
  return entries;
}

function verifyLatestMetadata(latestPath, installerPath, expectedVersion) {
  const latest = fs.readFileSync(latestPath, 'utf8');
  const expectedName = path.basename(installerPath);
  const installer = fs.readFileSync(installerPath);
  const expectedSha512 = crypto.createHash('sha512').update(installer).digest('base64');
  assert.equal(readTopLevelScalar(latest, 'version'), expectedVersion, 'latest.yml version must match the release version');
  assert.equal(readTopLevelScalar(latest, 'path'), expectedName, 'latest.yml path must reference the signed installer');
  assert.equal(readTopLevelScalar(latest, 'sha512'), expectedSha512, 'latest.yml SHA-512 must match the signed installer');
  const files = readFileEntries(latest);
  assert.equal(files.length, 1, 'latest.yml must contain exactly one files entry');
  assert.deepEqual(
    files[0],
    { url: expectedName, sha512: expectedSha512, size: String(installer.length) },
    'latest.yml files entry must match the exact signed installer',
  );

  return { installerName: expectedName, installerSize: installer.length, sha512: expectedSha512 };
}

function verifyWindowsReleaseMetadata(appUpdatePath, latestPath, installerPath, expectedVersion, expectedPublisherDn) {
  const appUpdate = fs.readFileSync(appUpdatePath, 'utf8');
  const publisherNames = readPublisherNames(appUpdate);
  assert.deepEqual(publisherNames, [expectedPublisherDn], 'app-update.yml must pin the exact Azure signer subject DN');
  return { publisherNames, ...verifyLatestMetadata(latestPath, installerPath, expectedVersion) };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--latest-only' && args.length === 4) {
    const result = verifyLatestMetadata(...args.slice(1));
    console.log(`Windows updater metadata verified: ${result.installerName} (${result.installerSize} bytes)`);
  } else if (args.length === 5) {
    const result = verifyWindowsReleaseMetadata(...args);
    console.log(`Windows updater metadata verified: ${result.installerName} (${result.installerSize} bytes)`);
  } else {
    console.error('Usage: verify-windows-release-metadata.cjs [--latest-only] <app-update.yml?> <latest.yml> <installer.exe> <version> <publisher-dn?>');
    process.exit(2);
  }
}

module.exports = { readFileEntries, readPublisherNames, readTopLevelScalar, unquoteYamlScalar, verifyLatestMetadata, verifyWindowsReleaseMetadata };
