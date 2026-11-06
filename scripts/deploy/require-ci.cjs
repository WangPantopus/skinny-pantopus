// Used by actions/github-script; never checks out code from a workflow_run PR.
// Sets `deploy` to 'true' or 'false'. Automatic deploys skip quietly when the green commit is no longer
// the branch head and the environment's release isn't overdue, or when nothing that goes into the
// backend image, database migrations or rollout changed since the environment's last release
// (each rollout restarts the API). A manual run always deploys the head. The
// release job rechecks with { recheck: true }: CI and the branch head only, so a
// commit superseded during the build sets `deploy` to 'false' before cutover,
// unless the release is overdue by then.
const { setTimeout: sleep } = require('node:timers/promises');
const BACKEND_PATHS = [/^backend\//, /^supabase\/migrations\//, /^scripts\/deploy\//, /^package\.json$/, /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/, /^\.dockerignore$/, /^\.github\/workflows\/deploy-backend\.yml$/];
const touchesBackend = (file) => BACKEND_PATHS.some((pattern) => pattern.test(file));
// deploy-backend.yml's run-name ends with "(<branch> <commit>)". A workflow_run job runs in the
// default branch's context, so nothing else on the run says which commit it released.
const RELEASE_TITLE = /\((?:master|dev) ([0-9a-f]{40})\)$/;
const ROLLOUT_STEP = 'Deploy API and worker';
// CI takes longer than the gap between merges on a busy branch, so its head is rarely still the head when
// its run goes green. Once the environment's last rollout is this old, a green commit releases even though
// newer merges have superseded it. See "Deployment sequence" in docs/ci-cd.md for what that allows.
const RELEASE_OVERDUE_MS = 2 * 60 * 60 * 1000;

module.exports = async ({ github, context, core }, { recheck = false, rereadSeconds = [5, 10, 20] } = {}) => {
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
  const target = branch === 'master' ? 'production' : 'staging';
  const superseded = head.commit.sha !== sha;
  const released = superseded || (upstream && !recheck) ? await lastRelease({ github, owner, repo, target }) : null;
  if (superseded && !(await releaseOverdue({ github, owner, repo, released, sha, head: head.commit.sha }))) {
    // A newer merge's CI run is pending. It deploys that head, or a later green commit once this is overdue.
    core.notice(`Skipped: ${sha} is superseded by ${head.commit.sha} on ${branch}; ` +
      `${target}'s last rollout: ${released ? `${released.sha} at ${released.at}` : 'unknown'}`);
    core.setOutput('deploy', 'false');
    return { sha, branch, skipped: 'superseded' };
  }
  await requireGreenCi({ github, core, owner, repo, branch, sha, rereadSeconds });
  core.setOutput('sha', sha);
  core.setOutput('target', target);
  if (upstream && !recheck) {
    const unchanged = await backendUnchangedSinceLastRelease({ github, owner, repo, released: released?.sha, sha });
    if (unchanged) {
      core.notice(`Skipped: no backend change since ${unchanged} was released to ${target}`);
      core.setOutput('deploy', 'false');
      return { sha, branch, skipped: 'unchanged' };
    }
  }
  if (superseded) {
    core.notice(`Releasing superseded ${sha} (${branch} is at ${head.commit.sha}): ${target}'s last rollout, ` +
      `${released.sha}, finished at ${released.at}, over ${RELEASE_OVERDUE_MS / 3600000} hours ago`);
  }
  core.setOutput('deploy', 'true');
  return { sha, branch };
};

// Throws unless the newest push or manual CI run of `sha` succeeded: a newer
// failed/cancelled attempt must not be bypassed by an older green run. GitHub's
// runs list can come back empty or behind for a while (during the 2026-10-22
// Actions incident about half the reads listed no run for a green commit), so a
// read without a finished newest run is repeated after each wait in
// `rereadSeconds`. A finished run decides at once. A read whose runs are all
// older than one an earlier read listed is behind as well, so it is read again.
async function requireGreenCi({ github, core, owner, repo, branch, sha, rereadSeconds }) {
  let newestSeen = 0;
  for (let read = 0; ; read += 1) {
    const { data } = await github.rest.actions.listWorkflowRuns({
      owner, repo, workflow_id: 'ci.yml', branch, head_sha: sha, per_page: 100,
    });
    const latest = data.workflow_runs.filter(run => ['push', 'workflow_dispatch'].includes(run.event))
      .sort((a, b) => b.id - a.id)[0];
    const finished = latest && latest.id >= newestSeen && latest.status === 'completed';
    if (finished && latest.conclusion === 'success') return;
    if (finished || read === rereadSeconds.length) {
      throw new Error(`CI must succeed on ${branch} at ${sha} before deployment`);
    }
    newestSeen = Math.max(newestSeen, latest ? latest.id : 0);
    core.info(`GitHub listed ${latest ? `CI run ${latest.id} as ${latest.status}` : 'no CI run'} for ${sha}; ` +
      `reading again in ${rereadSeconds[read]} s`);
    await sleep(rereadSeconds[read] * 1000);
  }
}

// Whether a superseded `sha` may release anyway: the last rollout is old enough, `sha` is a descendant of the
// commit it released, so a release never goes backwards, and `sha` is still on the branch, which only a head
// used to guarantee. An unknown last release (a rollback, a failed rollout) or an unreadable time keeps the
// skip, because then nothing says what `sha` would replace.
async function releaseOverdue({ github, owner, repo, released, sha, head }) {
  if (!released || !(Date.now() - Date.parse(released.at) >= RELEASE_OVERDUE_MS)) return false;
  for (const basehead of [`${released.sha}...${sha}`, `${sha}...${head}`]) {
    const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({ owner, repo, basehead });
    if (comparison.status !== 'ahead') return false;
  }
  return true;
}

// Returns the last released commit when nothing backend-relevant changed
// between it and `sha`; null (deploy) when there is no known release, the
// comparison is incomplete, or anything is unclear.
async function backendUnchangedSinceLastRelease({ github, owner, repo, released, sha }) {
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
// those whose rollout step didn't run or hasn't started (during the release job's
// rechecks the newest job is that job itself, its rollout step still pending), and
// read the first real rollout's commit from its run name and its finish time from
// the step. null when that rollout was a rollback or failed, or when its run
// predates commit run names.
async function lastRelease({ github, owner, repo, target }) {
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
    if (!rollout || rollout.conclusion === 'skipped' || !rollout.started_at) continue;
    if (rollout.conclusion !== 'success') return null;
    const { data: run } = await github.rest.actions.getWorkflowRun({ owner, repo, run_id: Number(link[1]) });
    const title = run.path === '.github/workflows/deploy-backend.yml' && RELEASE_TITLE.exec(run.display_title || '');
    return title ? { sha: title[1], at: rollout.completed_at } : null;
  }
  return null;
}
