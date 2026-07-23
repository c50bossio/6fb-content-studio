const { rmSync } = require('node:fs');

const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForExit(child, { timeoutMs = 2_000, pollMs = 25, delayFn = delay } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (!hasExited(child) && Date.now() < deadline) {
    await delayFn(Math.min(pollMs, deadline - Date.now()));
  }
  return hasExited(child);
}

async function terminateChild(child, options = {}) {
  if (hasExited(child)) return true;
  child.kill('SIGTERM');
  if (await waitForExit(child, options)) return true;
  child.kill('SIGKILL');
  return waitForExit(child, options);
}

async function removeFixtureRoot(fixtureRoot, {
  remove = rmSync,
  retries = 10,
  retryDelayMs = 100,
  delayFn = delay,
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      remove(fixtureRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      const retryable = ['EBUSY', 'EMFILE', 'ENFILE', 'ENOTEMPTY', 'EPERM'].includes(error?.code);
      if (!retryable || attempt >= retries) throw error;
      await delayFn(retryDelayMs);
    }
  }
}

async function stopChildAndRemoveFixture(child, fixtureRoot, options = {}) {
  if (!await terminateChild(child, options)) {
    throw new Error('Timed out waiting for the Electron smoke process to exit');
  }
  await removeFixtureRoot(fixtureRoot, options);
}

module.exports = { removeFixtureRoot, stopChildAndRemoveFixture, terminateChild };
