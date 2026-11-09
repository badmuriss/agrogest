import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalEndpoint } from './container.mjs';

test('local Docker sockets are allowed, remote engines are refused before build or execution', () => {
  for (const endpoint of ['unix:///var/run/docker.sock', 'unix:///home/user/.docker/desktop/docker.sock', 'npipe:////./pipe/docker_engine']) {
    assert.doesNotThrow(() => assertLocalEndpoint(endpoint));
  }
  for (const endpoint of [undefined, '', 'ssh://user@host', 'tcp://cloud.example:2376', 'https://cloud.example', 'tcp://127.0.0.1:2375']) {
    assert.throws(() => assertLocalEndpoint(endpoint), /daemon Docker local/);
  }
});
