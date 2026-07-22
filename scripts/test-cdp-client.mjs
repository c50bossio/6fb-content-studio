import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { CdpClient } from '../take-screenshots.mjs';

async function rejectsPromptly(promise, expected) {
  let timeout;
  const bounded = new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error('Pending CDP command did not reject within 2 seconds')), 2_000);
    promise.then(resolve, reject);
  });
  try {
    await assert.rejects(bounded, expected);
  } finally {
    clearTimeout(timeout);
  }
}

async function probePendingCommand(trigger, expected) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate CDP probe port');

  let client;
  server.once('connection', socket => {
    socket.once('message', () => trigger({ client, socket }));
  });

  try {
    client = new CdpClient(`ws://127.0.0.1:${address.port}`);
    await client.open();
    await rejectsPromptly(client.send('Runtime.evaluate', { expression: '1 + 1' }), expected);
    assert.equal(client.pending.size, 0, 'Rejected CDP commands must be removed from the pending map');
  } finally {
    client?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

await probePendingCommand(
  ({ socket }) => socket.close(1011, 'injected close'),
  /CDP socket closed \(1011\): injected close/,
);
await probePendingCommand(
  ({ client }) => client.socket.emit('error', new Error('injected socket error')),
  /injected socket error/,
);

console.log('CDP client probe passed: pending commands reject on socket close and persistent socket error.');
