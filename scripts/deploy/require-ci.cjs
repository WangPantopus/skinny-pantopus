// Used by actions/github-script; never checks out code from a workflow_run PR.
module.exports = async ({ github, context, core }) => {
  const { owner, repo } = context.repo;
  const upstream = context.payload.workflow_run;
  const branch = upstream ? upstream.head_branch : context.ref.replace('refs/heads/', '');
  if (!['master', 'dev'].includes(branch)) throw new Error('Deploy only from master or dev');
  const sha = upstream ? upstream.head_sha : context.sha;
  if (upstream && (!['push', 'workflow_dispatch'].includes(upstream.event) ||
      upstream.conclusion !== 'success' || upstream.head_repository.full_name !== `${owner}/${repo}`)) {
    throw new Error('Deployment requires a successful CI run from this repository branch');
  }
  const { data: head } = await github.rest.repos.getBranch({ owner, repo, branch });
  if (head.commit.sha !== sha) throw new Error('Superseded commit: deploy the current branch head');
  const { data } = await github.rest.actions.listWorkflowRuns({
    owner, repo, workflow_id: 'ci.yml', branch, head_sha: sha, per_page: 100,
  });
  // A newer failed/cancelled attempt must not be bypassed by an older green run.
  const latest = data.workflow_runs.filter(run => ['push', 'workflow_dispatch'].includes(run.event))
    .sort((a, b) => b.id - a.id)[0];
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error(`CI must succeed on ${branch} at ${sha} before deployment`);
  }
  core.setOutput('sha', sha);
  core.setOutput('target', branch === 'master' ? 'production' : 'staging');
  return { sha, branch };
};
