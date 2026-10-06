// Used by actions/github-script; never checks out code from a workflow_run PR.
// Sets `deploy` to 'true' or 'false'. Automatic deploys skip quietly when the
// green commit is no longer the branch head, or when nothing that goes into the
// backend image or its rollout changed since the last successful deployment
// (each rollout restarts the API). A manual run always deploys the head.
const BACKEND_PATHS = [/^backend\//, /^scripts\/deploy\//, /^package\.json$/, /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/, /^\.dockerignore$/, /^\.github\/workflows\/deploy-backend\.yml$/];
const touchesBackend = (file) => BACKEND_PATHS.some((pattern) => pattern.test(file));

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
  if (head.commit.sha !== sha) {
    // A newer merge's CI run is pending and will deploy that head instead.
    core.notice(`Skipped: ${sha} is superseded by ${head.commit.sha} on ${branch}`);
    core.setOutput('deploy', 'false');
    return { sha, branch, skipped: 'superseded' };
  }
  const { data } = await github.rest.actions.listWorkflowRuns({
    owner, repo, workflow_id: 'ci.yml', branch, head_sha: sha, per_page: 100,
  });
  // A newer failed/cancelled attempt must not be bypassed by an older green run.
  const latest = data.workflow_runs.filter(run => ['push', 'workflow_dispatch'].includes(run.event))
    .sort((a, b) => b.id - a.id)[0];
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error(`CI must succeed on ${branch} at ${sha} before deployment`);
  }
  const target = branch === 'master' ? 'production' : 'staging';
  core.setOutput('sha', sha);
  core.setOutput('target', target);
  if (upstream) {
    const unchanged = await backendUnchangedSinceLastDeploy({ github, owner, repo, target, sha });
    if (unchanged) {
      core.notice(`Skipped: no backend change since ${unchanged} was deployed to ${target}`);
      core.setOutput('deploy', 'false');
      return { sha, branch, skipped: 'unchanged' };
    }
  }
  core.setOutput('deploy', 'true');
  return { sha, branch };
};

// Returns the last successfully deployed commit when nothing backend-relevant
// changed between it and `sha`; null (deploy) when there is no earlier
// deployment, the comparison is incomplete, or anything is unclear.
async function backendUnchangedSinceLastDeploy({ github, owner, repo, target, sha }) {
  const { data: deployments } = await github.rest.repos.listDeployments({ owner, repo, environment: target, per_page: 30 });
  let deployed = null;
  for (const deployment of deployments) {
    const { data: statuses } = await github.rest.repos.listDeploymentStatuses({
      owner, repo, deployment_id: deployment.id, per_page: 10,
    });
    if (statuses.some((status) => status.state === 'success')) { deployed = deployment.sha; break; }
  }
  if (!deployed) return null;
  if (deployed === sha) return deployed;
  const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
    owner, repo, basehead: `${deployed}...${sha}`,
  });
  const files = comparison.files || [];
  // The compare API lists at most 300 files; a bigger or diverged range deploys.
  if (comparison.status !== 'ahead' || files.length === 0 || files.length >= 300) return null;
  return files.some((file) => touchesBackend(file.filename)) ? null : deployed;
}
