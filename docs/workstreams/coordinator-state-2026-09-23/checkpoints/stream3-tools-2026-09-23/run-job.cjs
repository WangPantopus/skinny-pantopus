// run-job.cjs <backendDir> <jobName>: run one scheduled job once against the owned local stack (env from the private launch file; nothing printed).
const [backendDir, jobName] = process.argv.slice(2);
const src = require('/private/tmp/pantopus-stream3-20260920-r1/transient-private-api-launch.json');
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET', 'APP_URL', 'EMAIL_DELIVERY_MODE', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'NODE_ENV', 'APP_ENV']) if (src.env[k] !== undefined) process.env[k] = src.env[k];
process.chdir(backendDir);
const job = require(`${backendDir}/jobs/${jobName}`);
(async () => {
  const started = new Date().toISOString();
  await job();
  console.log(JSON.stringify({ job: jobName, backendDir, started, finished: new Date().toISOString() }));
  setTimeout(() => process.exit(0), 1500);
})().catch((e) => { console.log(JSON.stringify({ job: jobName, error: e.message })); process.exit(1); });
