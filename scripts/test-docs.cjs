#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];
const requiredFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'PROGRESS.md',
  'package.json',
  'setup/questionnaire.md',
  'product/CONTEXT.md',
  'product/notes.md',
  'engineering/CONTEXT.md',
  'engineering/notes.md',
  'delivery/CONTEXT.md',
  'delivery/notes.md',
  '.github/workflows/release.yml',
  '.github/workflows/release-windows.yml',
];

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const relativePath of requiredFiles) {
  assert(fs.existsSync(path.join(root, relativePath)), `Missing required path: ${relativePath}`);
}

if (failures.length) {
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

const agents = read('AGENTS.md');
const claude = read('CLAUDE.md');
const readme = read('README.md');
const setup = read('setup/questionnaire.md');
const engineeringNotes = read('engineering/notes.md');
const packageJson = JSON.parse(read('package.json'));

for (const workspace of ['product', 'engineering', 'delivery']) {
  assert(agents.includes(`\`/${workspace}\``), `AGENTS.md does not route /${workspace}`);
  assert(fs.existsSync(path.join(root, workspace, 'CONTEXT.md')), `/${workspace} has no CONTEXT.md`);
}

assert(claude.split(/\r?\n/).length <= 10, 'CLAUDE.md is no longer a thin compatibility router');
assert(claude.includes('./AGENTS.md'), 'CLAUDE.md does not route to AGENTS.md');
assert(setup.includes('- Status: approved'), 'Folder-app setup is not approved');
assert(!engineeringNotes.includes('There is no dedicated test script'), 'Engineering notes contain the stale no-test-script claim');

for (const match of readme.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
  assert(Boolean(packageJson.scripts[match[1]]), `README references missing npm script: ${match[1]}`);
}

for (const [name, command] of Object.entries(packageJson.scripts)) {
  const tokens = String(command).split(/\s+/);
  if (!['node', 'bash'].includes(tokens[0])) continue;
  const target = tokens.slice(1).find(token => !token.startsWith('-'));
  if (!target) continue;
  const pathToCheck = target.includes('*') ? path.dirname(target) : target;
  assert(fs.existsSync(path.join(root, pathToCheck)), `npm script ${name} references missing path: ${target}`);
}

const excludedDirectories = new Set([
  '.git',
  'node_modules',
  'out',
  'release',
  'python/build',
  'python/dist',
  'python/runtime',
]);
const markdownFiles = [];
const collectMarkdown = (relativeDirectory = '') => {
  const absoluteDirectory = path.join(root, relativeDirectory);
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (excludedDirectories.has(relativePath) || relativePath.startsWith('python/.build-venv')) continue;
      collectMarkdown(relativePath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      markdownFiles.push(relativePath);
    }
  }
};
collectMarkdown();
markdownFiles.sort();
for (const markdownFile of markdownFiles) {
  const content = read(markdownFile);
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const resolved = path.resolve(root, path.dirname(markdownFile), target);
    assert(fs.existsSync(resolved), `${markdownFile} links to missing path: ${target}`);
  }
}

if (failures.length) {
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Documentation contracts passed: ${requiredFiles.length} required paths, ${markdownFiles.length} source Markdown files, routing, links, and npm command references.`);
