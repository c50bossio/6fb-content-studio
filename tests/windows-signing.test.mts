import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const fixtureEnv = {
  AZURE_ARTIFACT_SIGNING_ENDPOINT: 'https://eus.codesigning.azure.net/',
  AZURE_ARTIFACT_SIGNING_ACCOUNT_NAME: 'sixfb-signing',
  AZURE_ARTIFACT_SIGNING_PROFILE_NAME: 'public-release',
  WINDOWS_PUBLISHER_DN: 'CN=Six Figure Barber LLC, O=Six Figure Barber LLC, C=US',
};

Object.assign(process.env, fixtureEnv);
const { createWindowsReleaseConfig } = require('../scripts/create-windows-release-config.cjs');
const { sign, validateSigningRequest, SIGNING_TIMEOUT_MS } = require('../scripts/sign-windows-artifact.cjs');
const { readFileEntries, readPublisherNames, readTopLevelScalar, verifyLatestMetadata } = require('../scripts/verify-windows-release-metadata.cjs');

test('electron-builder accepts the exported Windows release configuration schema', async () => {
  const path = require('node:path');
  const { getConfig, validateConfiguration } = require('app-builder-lib/out/util/config/config');
  const { DebugLogger } = require('builder-util/out/DebugLogger');
  const config = await getConfig(process.cwd(), path.join(process.cwd(), 'electron-builder.windows-release.cjs'), null);
  assert.equal(Object.hasOwn(config, 'createWindowsReleaseConfig'), false);
  assert.equal(Object.hasOwn(config, 'required'), false);
  await validateConfiguration(config, new DebugLogger());
});

test('Windows release config uses the internal OIDC signer and fails closed', () => {
  const config = createWindowsReleaseConfig(fixtureEnv);
  assert.equal(config.forceCodeSigning, true);
  assert.equal(config.win.verifyUpdateCodeSignature, true);
  assert.deepEqual(config.win.signtoolOptions.signingHashAlgorithms, ['sha256']);
  assert.equal(config.win.signtoolOptions.publisherName, fixtureEnv.WINDOWS_PUBLISHER_DN);
  assert.match(config.win.signtoolOptions.sign, /scripts[\\/]sign-windows-artifact\.cjs$/);
  assert.equal(config.win.azureSignOptions, undefined);
});

test('Windows release config rejects missing values and non-Azure endpoints', () => {
  assert.throws(
    () => createWindowsReleaseConfig({ ...fixtureEnv, WINDOWS_PUBLISHER_DN: '' }),
    /Missing required environment variable: WINDOWS_PUBLISHER_DN/,
  );
  assert.throws(
    () => createWindowsReleaseConfig({ ...fixtureEnv, AZURE_ARTIFACT_SIGNING_ENDPOINT: 'https://example.com/' }),
    /codesigning\.azure\.net/,
  );
  assert.throws(
    () => createWindowsReleaseConfig({ ...fixtureEnv, AZURE_ARTIFACT_SIGNING_ENDPOINT: 'https://eus.codesigning.azure.net/path' }),
    /must not contain a path/,
  );
});

test('Azure signing hook passes arguments without a shell and enforces its timeout', () => {
  const directory = mkdtempSync(join(tmpdir(), '6fb-windows-signing-'));
  const artifact = join(directory, 'app.exe');
  writeFileSync(artifact, 'fixture');
  try {
    let invocation: any;
    sign(
      { path: artifact, hash: 'sha256' },
      {
        env: fixtureEnv,
        spawnSync(command: string, args: string[], options: Record<string, unknown>) {
          invocation = { command, args, options };
          return { status: 0, signal: null, error: null };
        },
      },
    );
    assert.equal(invocation.command, 'powershell.exe');
    assert.equal(invocation.options.timeout, SIGNING_TIMEOUT_MS);
    assert.equal(invocation.options.shell, undefined);
    assert.ok(invocation.args.includes(artifact));
    assert.ok(invocation.args.includes(fixtureEnv.AZURE_ARTIFACT_SIGNING_ENDPOINT));
    assert.ok(invocation.args.includes(fixtureEnv.AZURE_ARTIFACT_SIGNING_ACCOUNT_NAME));
    assert.ok(invocation.args.includes(fixtureEnv.AZURE_ARTIFACT_SIGNING_PROFILE_NAME));
    assert.ok(invocation.args.includes(fixtureEnv.WINDOWS_PUBLISHER_DN));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Azure signing hook rejects bad paths, file types, hashes, and signer failures', () => {
  const directory = mkdtempSync(join(tmpdir(), '6fb-windows-signing-'));
  const textFile = join(directory, 'notes.txt');
  const dllFile = join(directory, 'library.dll');
  const artifact = join(directory, 'app.exe');
  writeFileSync(textFile, 'fixture');
  writeFileSync(dllFile, 'fixture');
  writeFileSync(artifact, 'fixture');
  try {
    assert.throws(() => validateSigningRequest({ path: join(directory, 'missing.exe'), hash: 'sha256' }, fixtureEnv), /does not exist/);
    assert.throws(() => validateSigningRequest({ path: textFile, hash: 'sha256' }, fixtureEnv), /unsupported artifact type/);
    assert.throws(() => validateSigningRequest({ path: dllFile, hash: 'sha256' }, fixtureEnv), /unsupported artifact type/);
    assert.throws(() => validateSigningRequest({ path: artifact, hash: 'sha1' }, fixtureEnv), /requires SHA256/);
    assert.throws(
      () => sign({ path: artifact, hash: 'sha256' }, { env: fixtureEnv, spawnSync: () => ({ status: 2, signal: null, error: null }) }),
      /failed with exit code 2/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Windows updater metadata parser extracts exact publisher and top-level values', () => {
  const publisher = fixtureEnv.WINDOWS_PUBLISHER_DN;
  assert.deepEqual(readPublisherNames(`provider: github\npublisherName:\n  - '${publisher}'\n`), [publisher]);
  assert.deepEqual(readPublisherNames(`publisherName: "${publisher}"\n`), [publisher]);
  assert.throws(() => readPublisherNames(`publisherName: "${publisher}"\npublisherName: attacker\n`), /exactly one top-level publisherName/);
  assert.equal(readTopLevelScalar('version: 1.5.46\n  size: 12\npath: setup.exe\n', 'version'), '1.5.46');
  assert.equal(readTopLevelScalar('version: 1.5.46\n  size: 12\npath: setup.exe\n', 'size'), null);
  assert.deepEqual(readFileEntries('files:\n  - url: setup.exe\n    sha512: abc\n    size: 12\npath: setup.exe\n'), [
    { url: 'setup.exe', sha512: 'abc', size: '12' },
  ]);
});

test('Windows updater metadata is bound to the exact signed installer bytes', () => {
  const directory = mkdtempSync(join(tmpdir(), '6fb-windows-metadata-'));
  const installer = join(directory, '6FB-Content-Studio-Setup-1.5.46.exe');
  const metadata = join(directory, 'latest.yml');
  const bytes = Buffer.from('signed-installer-fixture');
  writeFileSync(installer, bytes);
  const sha512 = createHash('sha512').update(bytes).digest('base64');
  writeFileSync(metadata, `version: 1.5.46\npath: 6FB-Content-Studio-Setup-1.5.46.exe\nsha512: ${sha512}\nfiles:\n  - url: 6FB-Content-Studio-Setup-1.5.46.exe\n    sha512: ${sha512}\n    size: ${bytes.length}\n`);
  try {
    verifyLatestMetadata(metadata, installer, '1.5.46');
    const malformed = `version: 1.5.46\npath: 6FB-Content-Studio-Setup-1.5.46.exe\nsha512: ${sha512}\nfiles:\n  - url: attacker.exe\n    sha512: WRONG\n    size: ${bytes.length}\n`;
    writeFileSync(metadata, malformed);
    assert.throws(() => verifyLatestMetadata(metadata, installer, '1.5.46'), /files entry must match/);
    writeFileSync(metadata, malformed.replace('files:\n', `files:\n  - url: duplicate.exe\n    sha512: WRONG\n    size: ${bytes.length}\n`));
    assert.throws(() => verifyLatestMetadata(metadata, installer, '1.5.46'), /exactly one files entry/);
    writeFileSync(metadata, malformed.replace('path: 6FB-Content-Studio-Setup-1.5.46.exe\n', 'path: 6FB-Content-Studio-Setup-1.5.46.exe\npath: attacker.exe\n'));
    assert.throws(() => verifyLatestMetadata(metadata, installer, '1.5.46'), /exactly one top-level path/);
    writeFileSync(metadata, malformed.replace('files:\n', 'files:\nfiles:\n'));
    assert.throws(() => verifyLatestMetadata(metadata, installer, '1.5.46'), /exactly one top-level files block/);
    writeFileSync(metadata, `version: 1.5.46\npath: 6FB-Content-Studio-Setup-1.5.46.exe\nsha512: ${sha512}\nfiles:\n  - url: 6FB-Content-Studio-Setup-1.5.46.exe\n    sha512: ${sha512}\n    size: ${bytes.length}\n`);
    writeFileSync(installer, Buffer.from('tampered-installer-fixture'));
    assert.throws(() => verifyLatestMetadata(metadata, installer, '1.5.46'), /SHA-512 must match/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
