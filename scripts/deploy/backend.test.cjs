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
if(a[0]==='pull'){if(fail==='pull')code=1;}
else if(a[0]==='container'&&a[1]==='inspect'){if(!lookup(a[2]))code=1;}
else if(a[0]==='inspect'){
 const c=lookup(a.at(-1));if(!c)code=1;else out=c.status+' '+c.health;
}else if(a[0]==='run'){
 const name=a[a.indexOf('--name')+1];
 if(lookup(name))code=1;else {
  s.containers[name]={image:process.env.NEW_IMAGE,status:'running',health:'healthy',args:a};
  if((fail==='candidate'&&name.endsWith('-candidate'))||(fail==='worker'&&name==='pantopus-worker'))s.containers[name].health='unhealthy';
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
fs.writeFileSync(file,JSON.stringify(s));if(out)console.log(out);process.exit(code);
`;
function rollout(failure, first = false) {
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
    const result = spawnSync('bash', [script, 'production', image], { encoding: 'utf8', env: {
      ...process.env, PATH: `${dir}:${process.env.PATH}`, DOCKER_STATE: state,
      NEW_IMAGE: image, FAILURE: failure || '', PANTOPUS_ENV_FILE: envFile,
      PANTOPUS_LOCK_DIR: dir, PANTOPUS_HEALTH_ATTEMPTS: '1', PANTOPUS_HEALTH_INTERVAL: '0',
    } });
    return { ...result, state: JSON.parse(fs.readFileSync(state)) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
for (const failure of ['pull', 'candidate', 'bind', 'worker', 'stop']) {
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
test('failed first deployment removes partial new services', () => {
  const r = rollout('worker', true); assert.notEqual(r.status, 0);
  assert.deepEqual(r.state.containers, {});
});
