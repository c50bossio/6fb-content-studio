const { existsSync } = require('node:fs');
const { homedir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = resolve(__dirname, '..');
const configuredSkillDir = process.env.FOLDER_APP_SKILL_DIR;
const skillDir = configuredSkillDir || join(homedir(), '.claude', 'skills', 'folder-app');
const doctorPath = join(skillDir, 'workspace_doctor.py');

if (!existsSync(doctorPath)) {
  console.error([
    `Folder-app validator not found: ${doctorPath}`,
    'Install the folder-app skill, or set FOLDER_APP_SKILL_DIR to the directory containing workspace_doctor.py.',
  ].join('\n'));
  process.exit(2);
}

const requestedPython = process.env.SIXFB_WORKSPACE_PYTHON?.trim();
const candidates = requestedPython
  ? [{ command: requestedPython, args: [] }]
  : process.platform === 'win32'
    ? [{ command: 'py', args: ['-3'] }, { command: 'python', args: [] }]
    : [{ command: 'python3', args: [] }, { command: 'python', args: [] }];

let result;
let selectedCommand;
for (const candidate of candidates) {
  result = spawnSync(candidate.command, [...candidate.args, doctorPath, ...process.argv.slice(2), projectRoot], {
    stdio: 'inherit',
  });
  if (!result.error || result.error.code !== 'ENOENT') {
    selectedCommand = [candidate.command, ...candidate.args].join(' ');
    break;
  }
}

if (!result || result.error) {
  const attempted = selectedCommand || candidates.map(candidate => [candidate.command, ...candidate.args].join(' ')).join(', ');
  console.error(`Could not run the folder-app validator with ${attempted}: ${result?.error?.message || 'no Python interpreter was found'}`);
  process.exit(2);
}

process.exit(result.status ?? 2);
