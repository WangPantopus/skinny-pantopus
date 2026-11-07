const { test } = require('node:test');
const assert = require('node:assert/strict');
const requireCi = require('./require-ci.cjs');
const sha = 'a'.repeat(40);
const ROLLOUT = 'Deploy API and worker';
// A finished rollout step, as the jobs API reports it.
function rollout(hoursAgo, conclusion = 'success') {
  const at = new Date(Date.now() - hoursAgo * 3600000).toISOString();
  return { name: ROLLOUT, status: 'completed', conclusion, started_at: at, completed_at: at };
}
function fixture(overrides = {}) {
  const output = {};
  return {
    core: { setOutput: (k, v) => { output[k] = v; }, notice: () => {}, info: () => {} }, output,
    context: { repo: { owner: 'example', repo: 'app' }, ref: 'refs/heads/master', sha, payload: {}, ...overrides.context },
    github: { rest: {
      repos: {
        getBranch: async () => ({ data: { commit: { sha: overrides.head || sha } } }),
        listDeployments: async () => ({ data: (overrides.deployments || []).map((deployment) => ({
          performed_via_github_app: { slug: 'github-actions' }, ...deployment })) }),
        listDeploymentStatuses: async ({ deployment_id: id }) => ({ data: [{ state: 'success', log_url: `https://github.com/example/app/actions/runs/5/job/${id}` }] }),
        compareCommitsWithBasehead: async ({ basehead }) => ({ data: { status: overrides.comparison?.(basehead) || 'ahead', files: (overrides.changed || []).map((filename) => ({ filename })) } }),
      },
      actions: {
        listWorkflowRuns: async () => ({ data: { workflow_runs: overrides.runs || [{ id: 1, event: 'push', status: 'completed', conclusion: 'success' }] } }),
        getJobForWorkflowRun: async ({ job_id: id }) => ({ data: { steps: [overrides.rollouts?.[id] || rollout(1)] } }),
        getWorkflowRun: async () => ({ data: { path: overrides.releasedBy || '.github/workflows/deploy-backend.yml',
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
    await assert.rejects(requireCi(fixture({ runs }), { rereadSeconds: [0, 0, 0] }), /CI must succeed/);
  }
});
test('older green runs do not override a newer failed run', async () => {
  await assert.rejects(requireCi(fixture({ runs: [
    { id: 1, event: 'push', status: 'completed', conclusion: 'success' },
    { id: 2, event: 'workflow_dispatch', status: 'completed', conclusion: 'failure' },
  ] })), /CI must succeed/);
});
const pushRun = { head_branch: 'master', head_sha: sha, event: 'push', conclusion: 'success', head_repository: { full_name: 'example/app' } };
test('a superseded commit skips quietly until the release is overdue; feature branches cannot release', async () => {
  const overdue = { head: 'b'.repeat(40), context: { payload: { workflow_run: pushRun } }, deployments: [{ id: 7 }],
    rollouts: { 7: rollout(3) }, changed: ['backend/app.js'] };
  for (const notOverdue of [
    { deployments: [] }, { rollouts: { 7: rollout(1) } }, { rollouts: { 7: rollout(3, 'failure') } },
    { releasedBy: '.github/workflows/rollback-backend.yml' },
    { comparison: () => 'behind' }, { comparison: () => 'identical' }, { comparison: () => 'diverged' },
    { comparison: (basehead) => (basehead.startsWith(sha) ? 'diverged' : 'ahead') }, // No longer on the branch.
  ]) {
    const f = fixture({ ...overdue, ...notOverdue });
    assert.equal((await requireCi(f)).skipped, 'superseded');
    assert.equal(f.output.deploy, 'false');
  }
  const preflight = fixture(overdue);
  await requireCi(preflight);
  assert.deepEqual([preflight.output.deploy, preflight.output.sha, preflight.output.target], ['true', sha, 'production']);
  // During the recheck the newest job is the release job itself, with its rollout step still pending.
  const pending = { name: ROLLOUT, status: 'pending', conclusion: null, started_at: null, completed_at: null };
  const cutover = fixture({ ...overdue, deployments: [{ id: 8 }, { id: 7 }], rollouts: { 8: pending, 7: rollout(3) } });
  await requireCi(cutover, { recheck: true });
  assert.equal(cutover.output.deploy, 'true');
  // The other gates still apply to an overdue release.
  const runs = [{ id: 1, event: 'push', status: 'completed', conclusion: 'failure' }];
  await assert.rejects(requireCi(fixture({ ...overdue, runs })), /CI must succeed/);
  assert.equal((await requireCi(fixture({ ...overdue, changed: ['docs/release/notes.md'] }))).skipped, 'unchanged');
  await assert.rejects(requireCi(fixture({ context: { ref: 'refs/heads/topic' } })), /master or dev/);
});
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
