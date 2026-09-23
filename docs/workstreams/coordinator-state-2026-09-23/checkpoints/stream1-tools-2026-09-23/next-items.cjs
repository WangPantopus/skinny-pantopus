// Private launcher (Stream 1, 2026-09-23, items check; web worktree at origin/master): the existing web app (unchanged source) on 127.0.0.1:18133, proxying /api to the
// Stream 1 harness on 18132 (never :8000). Pattern of the sealed 20260922-stream1-tip-age-discovery-r1/next-p02.cjs.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const root = '/private/tmp/pantopus-stream1-acctdel';
const e = require(root + '/backend/node_modules/dotenv').parse(fs.readFileSync('/Users/yingpengwang/skinny-pantopus/backend/.env'));
if (!e.STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')) throw new Error('publishable key is not TEST');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '18133', '--hostname', '127.0.0.1'], {
  cwd: root + '/frontend/apps/web', stdio: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: '.next-stream1-items-r1', NEXT_PUBLIC_API_URL: 'http://127.0.0.1:18132', NEXT_PUBLIC_APP_URL: 'http://localhost:18133', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: e.STRIPE_PUBLISHABLE_KEY },
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', code => process.exit(code ?? 0));
