// Run inside the disposable production image. No hosted services or secrets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { spawn } = require('node:child_process');
const probe = name => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [`/app/scripts/${name}.js`], { stdio: 'inherit' });
  child.on('error', reject); child.on('exit', resolve);
});
(async () => {
  for (const name of Object.keys(require('/app/package.json').dependencies)) {
    require.resolve(name, { paths: ['/app'] });
  }
  assert.ok(require('/app/node_modules/sharp').versions.vips);
  let databaseStatus = 503;
  const server = http.createServer((request, response) => {
    response.statusCode = request.url === '/health' ? databaseStatus : 200;
    response.end();
  });
  await new Promise(resolve => server.listen(8000, '127.0.0.1', resolve));
  try {
    assert.equal(await probe('healthcheck'), 1, 'Root liveness must not hide a disconnected database');
    databaseStatus = 200;
    assert.equal(await probe('healthcheck'), 0);
  } finally { server.close(); }
  const heartbeat = '/tmp/pantopus-worker-ready';
  fs.rmSync(heartbeat, { force: true });
  assert.equal(await probe('worker-healthcheck'), 1, 'Uninitialized worker must be unready');
  fs.writeFileSync(heartbeat, 'ready');
  assert.equal(await probe('worker-healthcheck'), 0);
  fs.utimesSync(heartbeat, new Date(0), new Date(0));
  assert.equal(await probe('worker-healthcheck'), 1, 'A stale worker must be unready');
  console.log('Production dependency, API readiness and worker heartbeat checks passed');
})().catch(error => { console.error(error); process.exit(1); });
