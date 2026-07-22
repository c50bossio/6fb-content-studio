const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SIGNING_TIMEOUT_MS = 600_000;
const ALLOWED_EXTENSIONS = new Set(['.exe']);

function required(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  if (/\0|\r|\n/.test(value)) throw new Error(`Invalid control character in environment variable: ${name}`);
  return value;
}

function validateSigningRequest(configuration, env = process.env) {
  if (!configuration || typeof configuration.path !== 'string') {
    throw new Error('Azure signing requires an artifact path');
  }
  const artifactPath = path.resolve(configuration.path);
  if (!path.isAbsolute(artifactPath) || !fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    throw new Error(`Azure signing artifact does not exist: ${artifactPath}`);
  }
  if (!ALLOWED_EXTENSIONS.has(path.extname(artifactPath).toLowerCase())) {
    throw new Error(`Azure signing rejected unsupported artifact type: ${path.basename(artifactPath)}`);
  }
  if (configuration.hash?.toLowerCase() !== 'sha256') {
    throw new Error(`Azure signing requires SHA256, received: ${configuration.hash || 'missing'}`);
  }

  const endpoint = required('AZURE_ARTIFACT_SIGNING_ENDPOINT', env);
  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol !== 'https:' || !endpointUrl.hostname.endsWith('.codesigning.azure.net')) {
    throw new Error('AZURE_ARTIFACT_SIGNING_ENDPOINT must be an HTTPS codesigning.azure.net endpoint');
  }

  return {
    artifactPath,
    endpoint: endpointUrl.toString(),
    accountName: required('AZURE_ARTIFACT_SIGNING_ACCOUNT_NAME', env),
    profileName: required('AZURE_ARTIFACT_SIGNING_PROFILE_NAME', env),
    publisherDn: required('WINDOWS_PUBLISHER_DN', env),
  };
}

function sign(configuration, dependencies = {}) {
  const request = validateSigningRequest(configuration, dependencies.env || process.env);
  const spawn = dependencies.spawnSync || spawnSync;
  const scriptPath = path.join(__dirname, 'invoke-azure-signing.ps1');
  const result = spawn(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-ArtifactPath',
      request.artifactPath,
      '-Endpoint',
      request.endpoint,
      '-AccountName',
      request.accountName,
      '-ProfileName',
      request.profileName,
      '-ExpectedPublisherDn',
      request.publisherDn,
    ],
    {
      cwd: path.dirname(request.artifactPath),
      env: dependencies.env || process.env,
      stdio: 'inherit',
      timeout: SIGNING_TIMEOUT_MS,
      windowsHide: true,
    },
  );

  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Azure Artifact Signing terminated by signal: ${result.signal}`);
  if (result.status !== 0) throw new Error(`Azure Artifact Signing failed with exit code ${result.status}`);
}

module.exports = sign;
module.exports.sign = sign;
module.exports.validateSigningRequest = validateSigningRequest;
module.exports.SIGNING_TIMEOUT_MS = SIGNING_TIMEOUT_MS;
