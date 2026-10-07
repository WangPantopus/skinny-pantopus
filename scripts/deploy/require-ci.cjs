// Used by actions/github-script; never checks out code from a workflow_run PR.
// Sets `deploy` to 'true' or 'false'. Automatic deploys skip quietly when the
// green commit is no longer the branch head, or when nothing that goes into the
// backend image or its rollout changed since the environment's last release
// (each rollout restarts the API). A manual run always deploys the head. The
// release job rechecks with { recheck: true }: CI and the branch head only, so a
// commit superseded during the build sets `deploy` to 'false' before cutover.
const BACKEND_PATHS = [/^backend\//, /^scripts\/deploy\//, /^package\.json$/, /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/, /^\.dockerignore$/, /^\.github\/workflows\/deploy-backend\.yml$/];
const touchesBackend = (file) => BACKEND_PATHS.some((pattern) => pattern.test(file));
// deploy-backend.yml's run-name ends with "(<branch> <commit>)". A workflow_run job runs in the
// default branch's context, so nothing else on the run says which commit it released.
const RELEASE_TITLE = /\((?:master|dev) ([0-9a-f]{40})\)$/;
const ROLLOUT_STEP = 'Deploy API and worker';

module.exports = async ({ github, context, core }, { recheck = false } = {}) => {
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
  if (upstream && !recheck) {
    const unchanged = await backendUnchangedSinceLastRelease({ github, owner, repo, target, sha });
    if (unchanged) {
      core.notice(`Skipped: no backend change since ${unchanged} was released to ${target}`);
      core.setOutput('deploy', 'false');
      return { sha, branch, skipped: 'unchanged' };
    }
  }
  core.setOutput('deploy', 'true');
  return { sha, branch };
};

// Returns the last released commit when nothing backend-relevant changed
// between it and `sha`; null (deploy) when there is no known release, the
// comparison is incomplete, or anything is unclear.
async function backendUnchangedSinceLastRelease({ github, owner, repo, target, sha }) {
  const released = await lastReleasedCommit({ github, owner, repo, target });
  if (!released) return null;
  if (released === sha) return released;
  const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
    owner, repo, basehead: `${released}...${sha}`,
  });
  const files = comparison.files || [];
  // The compare API lists at most 300 files; a bigger or diverged range deploys.
  if (comparison.status !== 'ahead' || files.length === 0 || files.length >= 300) return null;
  return files.some((file) => touchesBackend(file.filename)) ? null : released;
}

// GitHub's deployment records don't say what an environment runs: a workflow_run
// job records the default branch head, not the dev commit it released; a job
// that stopped before the rollout (deployment disabled, a failed migration, a
// superseded commit) still records a deployment, often a successful one; and
// Vercel files the web's deployments under "Production", which GitHub treats as
// `production`. So take this environment's Actions jobs newest first, pass over
// those whose rollout step didn't run, and read the first real rollout's commit
// from its run name. null when that rollout was a rollback or failed, or when
// its run predates commit run names.
async function lastReleasedCommit({ github, owner, repo, target }) {
  const { data: deployments } = await github.rest.repos.listDeployments({ owner, repo, environment: target, per_page: 30 });
  const jobs = deployments.filter((deployment) => deployment.performed_via_github_app?.slug === 'github-actions');
  for (const deployment of jobs.slice(0, 10)) {
    const { data: statuses } = await github.rest.repos.listDeploymentStatuses({
      owner, repo, deployment_id: deployment.id, per_page: 10,
    });
    const link = statuses.map((status) => /\/actions\/runs\/(\d+)\/job\/(\d+)/.exec(status.log_url || status.target_url || ''))
      .find(Boolean);
    if (!link) return null;
    const { data: job } = await github.rest.actions.getJobForWorkflowRun({ owner, repo, job_id: Number(link[2]) });
    const rollout = (job.steps || []).find((step) => step.name === ROLLOUT_STEP);
    if (!rollout || rollout.conclusion === 'skipped') continue;
    if (rollout.conclusion !== 'success') return null;
    const { data: run } = await github.rest.actions.getWorkflowRun({ owner, repo, run_id: Number(link[1]) });
    const title = run.path === '.github/workflows/deploy-backend.yml' && RELEASE_TITLE.exec(run.display_title || '');
    return title ? title[1] : null;
  }
  return null;
}
