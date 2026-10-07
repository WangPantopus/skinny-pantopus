const { test } = require('node:test');
const assert = require('node:assert/strict');
const requireCi = require('./require-ci.cjs');
const sha = 'a'.repeat(40);
function fixture(overrides = {}) {
  const output = {};
  return {
    core: { setOutput: (k, v) => { output[k] = v; }, notice: () => {} }, output,
    context: { repo: { owner: 'example', repo: 'app' }, ref: 'refs/heads/master', sha, payload: {}, ...overrides.context },
    github: { rest: {
      repos: {
        getBranch: async () => ({ data: { commit: { sha: overrides.head || sha } } }),
        listDeployments: async () => ({ data: (overrides.deployments || []).map((deployment) => ({
          performed_via_github_app: { slug: 'github-actions' }, ...deployment })) }),
        listDeploymentStatuses: async () => ({ data: [{ state: 'success', log_url: 'https://github.com/example/app/actions/runs/5/job/6' }] }),
        compareCommitsWithBasehead: async () => ({ data: { status: 'ahead', files: (overrides.changed || []).map((filename) => ({ filename })) } }),
      },
      actions: {
        listWorkflowRuns: async () => ({ data: { workflow_runs: overrides.runs || [{ id: 1, event: 'push', status: 'completed', conclusion: 'success' }] } }),
        getJobForWorkflowRun: async () => ({ data: { steps: [{ name: 'Deploy API and worker', conclusion: 'success' }] } }),
        getWorkflowRun: async () => ({ data: { path: '.github/workflows/deploy-backend.yml',
          display_title: `Deploy Backend to production (master ${'c'.repeat(40)})` } }),
      },
    } },
  };
}
test('manual deployment requires green CI on the exact current commit', async () => {
  const f = fixture(); await requireCi(f); assert.equal(f.output.sha, sha); assert.equal(f.output.target, 'production');
  assert.equal(f.output.deploy, 'true');
});
test('failed or missing CI cannot release', async () => {
  for (const runs of [[], [{ id: 1, event: 'push', status: 'completed', conclusion: 'failure' }], [{ id: 1, event: 'pull_request', status: 'completed', conclusion: 'success' }]]) {
    await assert.rejects(requireCi(fixture({ runs })), /CI must succeed/);
  }
});
test('older green runs do not override a newer failed run', async () => {
  await assert.rejects(requireCi(fixture({ runs: [
    { id: 1, event: 'push', status: 'completed', conclusion: 'success' },
    { id: 2, event: 'workflow_dispatch', status: 'completed', conclusion: 'failure' },
  ] })), /CI must succeed/);
});
test('a superseded commit skips quietly; feature branches cannot release', async () => {
  const f = fixture({ head: 'b'.repeat(40) });
  assert.equal((await requireCi(f)).skipped, 'superseded');
  assert.equal(f.output.deploy, 'false');
  await assert.rejects(requireCi(fixture({ context: { ref: 'refs/heads/topic' } })), /master or dev/);
});
const pushRun = { head_branch: 'master', head_sha: sha, event: 'push', conclusion: 'success', head_repository: { full_name: 'example/app' } };
test('an automatic deploy skips when no backend file changed since the last deployment', async () => {
  const f = fixture({ context: { payload: { workflow_run: pushRun } }, deployments: [{ id: 7 }],
    changed: ['docs/release/notes.md', 'frontend/apps/web/src/app/page.tsx'] });
  assert.equal((await requireCi(f)).skipped, 'unchanged');
  assert.equal(f.output.deploy, 'false');
});
test('an automatic deploy proceeds after a backend change or without an earlier deployment', async () => {
  for (const changed of [['backend/app.js'], ['pnpm-lock.yaml'], ['scripts/deploy/backend.sh']]) {
    const f = fixture({ context: { payload: { workflow_run: pushRun } }, deployments: [{ id: 7 }], changed });
    await requireCi(f); assert.equal(f.output.deploy, 'true');
  }
  const first = fixture({ context: { payload: { workflow_run: pushRun } } });
  await requireCi(first); assert.equal(first.output.deploy, 'true');
});
test('workflow_run from a fork or pull request cannot release', async () => {
  for (const run of [
    { head_branch: 'master', head_sha: sha, event: 'pull_request', conclusion: 'success', head_repository: { full_name: 'example/app' } },
    { head_branch: 'master', head_sha: sha, event: 'push', conclusion: 'success', head_repository: { full_name: 'stranger/app' } },
  ]) await assert.rejects(requireCi(fixture({ context: { payload: { workflow_run: run } } })), /this repository branch/);
});
