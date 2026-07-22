const path = require('node:path');

const base = require('../package.json').build;

function required(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  if (/\0|\r|\n/.test(value)) throw new Error(`Invalid control character in environment variable: ${name}`);
  return value;
}

function createWindowsReleaseConfig(env = process.env) {
  const endpoint = required('AZURE_ARTIFACT_SIGNING_ENDPOINT', env);
  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol !== 'https:' || !endpointUrl.hostname.endsWith('.codesigning.azure.net')) {
    throw new Error('AZURE_ARTIFACT_SIGNING_ENDPOINT must be an HTTPS codesigning.azure.net endpoint');
  }
  if (endpointUrl.pathname !== '/' || endpointUrl.search || endpointUrl.hash) {
    throw new Error('AZURE_ARTIFACT_SIGNING_ENDPOINT must not contain a path, query, or fragment');
  }

  return {
    ...base,
    forceCodeSigning: true,
    win: {
      ...base.win,
      verifyUpdateCodeSignature: true,
      signtoolOptions: {
        sign: path.join(__dirname, 'sign-windows-artifact.cjs'),
        signingHashAlgorithms: ['sha256'],
        publisherName: required('WINDOWS_PUBLISHER_DN', env),
      },
    },
  };
}

module.exports = { createWindowsReleaseConfig, required };
