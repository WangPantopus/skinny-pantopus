const { test } = require('node:test');
const assert = require('node:assert/strict');
const requireCi = require('./require-ci.cjs');
const sha = 'a'.repeat(40);
function fixture(overrides = {}) {
  const output = {};
  return {
    core: { setOutput: (k, v) => { output[k] = v; } }, output,
    context: { repo: { owner: 'example', repo: 'app' }, ref: 'refs/heads/master', sha, payload: {}, ...overrides.context },
    github: { rest: {
      repos: { getBranch: async () => ({ data: { commit: { sha: overrides.head || sha } } }) },
      actions: { listWorkflowRuns: async () => ({ data: { workflow_runs: overrides.runs || [{ id: 1, event: 'push', status: 'completed', conclusion: 'success' }] } }) },
    } },
  };
}
test('manual deployment requires green CI on the exact current commit', async () => {
  const f = fixture(); await requireCi(f); assert.equal(f.output.sha, sha); assert.equal(f.output.target, 'production');
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
test('superseded commits and feature branches cannot release', async () => {
  await assert.rejects(requireCi(fixture({ head: 'b'.repeat(40) })), /Superseded/);
  await assert.rejects(requireCi(fixture({ context: { ref: 'refs/heads/topic' } })), /master or dev/);
});
test('workflow_run from a fork or pull request cannot release', async () => {
  for (const run of [
    { head_branch: 'master', head_sha: sha, event: 'pull_request', conclusion: 'success', head_repository: { full_name: 'example/app' } },
    { head_branch: 'master', head_sha: sha, event: 'push', conclusion: 'success', head_repository: { full_name: 'stranger/app' } },
  ]) await assert.rejects(requireCi(fixture({ context: { payload: { workflow_run: run } } })), /this repository branch/);
});
