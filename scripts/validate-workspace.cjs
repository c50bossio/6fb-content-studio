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

const result = spawnSync('python3', [doctorPath, ...process.argv.slice(2), projectRoot], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Could not run the folder-app validator: ${result.error.message}`);
  process.exit(2);
}

process.exit(result.status ?? 2);
