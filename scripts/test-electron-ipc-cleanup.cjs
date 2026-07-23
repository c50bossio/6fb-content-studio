const assert = require('node:assert/strict');
const { removeFixtureRoot, terminateChild } = require('./electron-ipc-cleanup.cjs');

function fixtureChild() {
  return {
    exitCode: null,
    signalCode: null,
    signals: [],
    kill(signal) {
      this.signals.push(signal);
      return true;
    },
  };
}

async function run() {
  const gracefulChild = fixtureChild();
  let polls = 0;
  assert.equal(await terminateChild(gracefulChild, {
    timeoutMs: 50,
    pollMs: 1,
    delayFn: async () => {
      polls += 1;
      if (polls === 2) gracefulChild.exitCode = 0;
    },
  }), true);
  assert.deepEqual(gracefulChild.signals, ['SIGTERM']);

  const stubbornChild = fixtureChild();
  assert.equal(await terminateChild(stubbornChild, { timeoutMs: 0 }), false);
  assert.deepEqual(stubbornChild.signals, ['SIGTERM', 'SIGKILL']);

  let attempts = 0;
  const delays = [];
  await removeFixtureRoot('/tmp/fixture', {
    remove: () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error('fixture is still being written');
        error.code = 'ENOTEMPTY';
        throw error;
      }
    },
    retryDelayMs: 7,
    delayFn: async ms => delays.push(ms),
  });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [7, 7]);

  await assert.rejects(
    removeFixtureRoot('/tmp/fixture', {
      remove: () => {
        const error = new Error('permission denied');
        error.code = 'EACCES';
        throw error;
      },
      delayFn: async () => assert.fail('non-transient errors must not retry'),
    }),
    { code: 'EACCES' },
  );

  console.log('Electron IPC cleanup contract passed: graceful exit, forced exit, bounded transient retry, and non-transient failure.');
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
