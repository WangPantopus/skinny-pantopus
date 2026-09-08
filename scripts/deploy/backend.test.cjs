const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.resolve(__dirname, 'backend.sh');
const image = `example/backend@sha256:${'a'.repeat(64)}`;
// Docker simulator records persistent container state and injects failures at
// actual operational boundaries (pull, stop, port bind and worker readiness).
const docker = `#!/usr/bin/env node
const fs=require('node:fs');
const a=process.argv.slice(2), file=process.env.DOCKER_STATE;
const s=JSON.parse(fs.readFileSync(file));s.calls.push(a);
let code=0,out='';const fail=process.env.FAILURE;
const lookup=n=>s.containers[n];
if(a[0]==='image'&&a[1]==='inspect'){out=process.env.LOCAL_IMAGE_REVISION||'';}
else if(a[0]==='pull'){if(fail==='pull')code=1;}
else if(a[0]==='container'&&a[1]==='inspect'){if(!lookup(a[2]))code=1;}
else if(a[0]==='inspect'){
 const c=lookup(a.at(-1));if(!c)code=1;else out=c.status+' '+c.health;
}else if(a[0]==='run'){
 const name=a[a.indexOf('--name')+1];
 if(lookup(name))code=1;else {
  s.containers[name]={image:process.env.NEW_IMAGE,status:'running',health:'healthy',args:a};
  if((fail==='candidate'&&name.endsWith('-candidate'))||(fail==='worker'&&name.startsWith('pantopus-worker')))s.containers[name].health='unhealthy';
  if(fail==='bind'&&name==='pantopus-backend'){s.containers[name].status='created';code=1;}
 }
}else if(a[0]==='rm'){
 const n=a.at(-1),c=lookup(n);if(!c)code=1;else if(c.status==='running'&&!a.includes('-f'))code=1;else delete s.containers[n];
}else if(a[0]==='rename'){
 if(!lookup(a[1])||lookup(a[2]))code=1;else{s.containers[a[2]]=s.containers[a[1]];delete s.containers[a[1]];}
}else if(a[0]==='stop'){
 const n=a.at(-1);if(!lookup(n))code=1;else if(fail==='stop'&&n==='pantopus-backend-previous')code=1;else lookup(n).status='exited';
}else if(a[0]==='start'){
 const c=lookup(a[1]);if(!c)code=1;else c.status='running';
}else{console.error('Unsupported Docker operation',a);code=2;}
fs.writeFileSync(file,JSON.stringify(s));if(out)console.log(out);
if(a[0]==='run'&&a[a.indexOf('--name')+1]==='pantopus-backend'&&['SIGHUP','SIGTERM'].includes(fail))process.kill(process.ppid,fail);
process.exit(code);
`;
function rollout(failure, first = false, target = 'production', binding, local = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pantopus-rollout-test-'));
  try {
    const state = path.join(dir, 'state.json');
    fs.writeFileSync(state, JSON.stringify({ calls: [], containers: first ? {} : {
      'pantopus-backend': { image: 'previous-api', status: 'running', health: 'healthy' },
      'pantopus-worker': { image: 'previous-worker', status: 'running', health: 'healthy' },
    } }));
    fs.writeFileSync(path.join(dir, 'docker'), docker, { mode: 0o755 });
    fs.writeFileSync(path.join(dir, 'flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const envFile = path.join(dir, 'env'); fs.writeFileSync(envFile, '');
    const args = [script, target, local.image || image];
    if (binding !== undefined) args.push(binding);
    if (local.mode) args.push(local.mode);
    const result = spawnSync('bash', args, { encoding: 'utf8', env: {
      ...process.env, PATH: `${dir}:${process.env.PATH}`, DOCKER_STATE: state,
      NEW_IMAGE: image, FAILURE: failure || '', PANTOPUS_ENV_FILE: envFile,
      PANTOPUS_LOCK_DIR: dir, PANTOPUS_HEALTH_ATTEMPTS: '1', PANTOPUS_HEALTH_INTERVAL: '0',
      PANTOPUS_EXPECTED_REVISION: local.expectedRevision || '',
      LOCAL_IMAGE_REVISION: local.actualRevision || '',
    } });
    return { ...result, state: JSON.parse(fs.readFileSync(state)) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
for (const failure of ['pull', 'candidate', 'bind', 'worker', 'stop', 'SIGHUP', 'SIGTERM']) {
  test(`${failure} failure retains or restores both previous services`, () => {
    const r = rollout(failure); assert.notEqual(r.status, 0, r.stdout+r.stderr);
    for (const [name, original] of [['pantopus-backend', 'previous-api'], ['pantopus-worker', 'previous-worker']]) {
      assert.equal(r.state.containers[name]?.image, original, r.stderr);
      assert.equal(r.state.containers[name]?.status, 'running', r.stderr);
    }
    assert.equal(r.state.containers['pantopus-backend-candidate'], undefined);
  });
}
test('successful rollout pins both services and keeps previous images', () => {
  const r = rollout(); assert.equal(r.status, 0, r.stderr);
  assert.equal(r.state.containers['pantopus-backend'].image, image);
  assert.equal(r.state.containers['pantopus-worker'].image, image);
  assert.equal(r.state.containers['pantopus-backend-previous'].image, 'previous-api');
  const apiArgs = r.state.containers['pantopus-backend'].args;
  assert.ok(apiArgs.includes('CRON_ENABLED=false')); assert.ok(apiArgs.includes('PGBOSS_ENABLED=false'));
  assert.ok(r.state.containers['pantopus-worker'].args.includes('CRON_ENABLED=true'));
});
for (const target of ['staging', 'production']) {
  test(`${target} explicitly sets the runtime environment on candidate, API and worker`, () => {
    const r = rollout(undefined, true, target); assert.equal(r.status, 0, r.stderr);
    const runs = r.state.calls.filter(args => args[0] === 'run');
    assert.equal(runs.length, 3);
    for (const args of runs) {
      assert.ok(args.includes('NODE_ENV=production'));
      assert.ok(args.includes(`APP_ENV=${target}`));
    }
  });
}
test('failed first deployment removes partial new services', () => {
  const r = rollout('worker', true); assert.notEqual(r.status, 0);
  assert.deepEqual(r.state.containers, {});
});

test('staging binds a separate loopback port while retaining running production', () => {
  const r = rollout(undefined, false, 'staging', '127.0.0.1:18001');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.state.containers['pantopus-backend'].image, 'previous-api');
  assert.equal(r.state.containers['pantopus-worker'].image, 'previous-worker');
  const args = r.state.containers['pantopus-backend-staging'].args;
  assert.equal(args[args.indexOf('-p') + 1], '127.0.0.1:18001:8000');
  assert.ok(!r.state.containers['pantopus-worker-staging'].args.includes('-p'));
});

test('default deployment keeps the existing port', () => {
  const r = rollout();
  assert.equal(r.status, 0, r.stderr);
  const args = r.state.containers['pantopus-backend'].args;
  assert.equal(args[args.indexOf('-p') + 1], '8000:8000');
});

for (const binding of ['0', '65536', '127.0.0.1:0', '18001:8000', 'localhost:18001', '18001; touch /tmp/unsafe']) {
  test(`invalid binding is rejected before Docker changes: ${binding}`, () => {
    const r = rollout(undefined, false, 'staging', binding);
    assert.equal(r.status, 2);
    assert.deepEqual(r.state.calls, []);
  });
}

const localImage = { mode: '--local-image', image: `sha256:${'b'.repeat(64)}`,
  expectedRevision: 'c'.repeat(40), actualRevision: 'c'.repeat(40) };

test('local staging rollout verifies the image commit and never contacts a registry', () => {
  const r = rollout(undefined, false, 'staging', '127.0.0.1:18001', localImage);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.state.calls.some(args => args[0] === 'pull' || args[0] === 'push'));
  const runs = r.state.calls.filter(args => args[0] === 'run');
  assert.equal(runs.length, 3);
  assert.ok(runs.every(args => args.includes(localImage.image)));
  assert.equal(r.state.containers['pantopus-backend'].image, 'previous-api');
  assert.equal(r.state.containers['pantopus-worker'].image, 'previous-worker');
});

test('failed local staging worker removes the new services and preserves production', () => {
  const r = rollout('worker', false, 'staging', '127.0.0.1:18001', localImage);
  assert.notEqual(r.status, 0);
  assert.deepEqual(Object.keys(r.state.containers).sort(), ['pantopus-backend', 'pantopus-worker']);
  assert.equal(r.state.containers['pantopus-backend'].status, 'running');
  assert.equal(r.state.containers['pantopus-worker'].status, 'running');
});

for (const [label, changes, target] of [
  ['wrong commit', { actualRevision: 'd'.repeat(40) }, 'staging'],
  ['missing commit', { expectedRevision: '' }, 'staging'],
  ['mutable tag', { image: 'example/backend:latest' }, 'staging'],
  ['production', {}, 'production'],
]) {
  test(`local image mode rejects ${label} before changing containers`, () => {
    const r = rollout(undefined, false, target, '127.0.0.1:18001', { ...localImage, ...changes });
    assert.equal(r.status, 2);
    assert.ok(r.state.calls.every(args => args[0] === 'image' && args[1] === 'inspect'));
  });
}
