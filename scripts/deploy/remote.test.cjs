const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const image = `example/backend@sha256:${'a'.repeat(64)}`;

function invoke(binding) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pantopus-remote-test-'));
  try {
    const log = path.join(dir, 'ssh.jsonl');
    fs.writeFileSync(path.join(dir, 'ssh'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.readFileSync(0);
fs.appendFileSync(process.env.SSH_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
`, { mode: 0o755 });
    const result = spawnSync('bash', ['scripts/deploy/remote.sh'], {
      cwd: root, encoding: 'utf8', env: {
        ...process.env, PATH: `${dir}:${process.env.PATH}`, SSH_LOG: log,
        EC2_HOST: 'host.example.invalid', EC2_USERNAME: 'ec2-user',
        EC2_SSH_KEY: 'synthetic-key', EC2_KNOWN_HOSTS: 'synthetic-host-key',
        DOCKERHUB_USERNAME: 'example', DOCKERHUB_TOKEN: 'synthetic-token',
        DEPLOY_IMAGE: image, DEPLOY_TARGET: 'staging', DEPLOY_API_BIND: binding,
      },
    });
    const calls = fs.existsSync(log)
      ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [];
    return { ...result, calls };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('remote rollout forwards the validated staging bind and pins the host key', () => {
  const result = invoke('127.0.0.1:18001');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 2);
  assert.equal(result.calls[1].at(-1), `bash -s -- staging ${image} 127.0.0.1:18001`);
  for (const args of result.calls) assert.ok(args.includes('StrictHostKeyChecking=yes'));
});

test('remote rollout retains the default port when the environment variable is unset', () => {
  const result = invoke('');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls[1].at(-1), `bash -s -- staging ${image} 8000`);
});

for (const binding of ['65536', '127.0.0.1:0', '18001; false', '$(false)', 'localhost:18001']) {
  test(`remote rollout rejects unsafe binding before SSH: ${binding}`, () => {
    const result = invoke(binding);
    assert.equal(result.status, 2);
    assert.deepEqual(result.calls, []);
  });
}
