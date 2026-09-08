const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../backend/worker.js'), 'utf8');

async function boot({ nodeEnv = 'production', enabled = 'true', result = {}, initError, registerError } = {}) {
  const events = [];
  const logger = Object.fromEntries(['info', 'warn', 'error'].map(level => [level, () => {}]));
  const modules = {
    fs: { existsSync: () => false, rmSync: () => events.push('clear-ready'), writeFileSync: () => events.push('ready') },
    dotenv: { config() {} },
    './config/stagingRuntime': { validateStagingRuntime() {} },
    './utils/logger': logger,
    './jobs/pgBossManager': { initPgBoss: async () => { events.push('init'); if (initError) throw initError; return result; }, stopPgBoss: async () => {} },
    './jobs/pgBossJobs': { registerPgBossJobs: async () => { events.push('register'); if (registerError) throw registerError; } },
    './jobs': { startJobs: options => events.push(['cron', options.skipPgBossBackedJobs]) },
  };
  vm.runInNewContext(source, {
    require: name => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; },
    process: { env: { NODE_ENV: nodeEnv, PGBOSS_ENABLED: enabled }, on() {}, exit: code => events.push(['exit', code]) },
    setInterval: () => ({ unref() {} }),
  });
  await new Promise(resolve => setImmediate(resolve));
  return events;
}

test('hosted worker fails before readiness or cron when the queue cannot initialize', async () => {
  assert.deepEqual(await boot({ initError: new Error('connection refused') }), ['clear-ready', 'init', ['exit', 1]]);
  assert.deepEqual(await boot({ result: null }), ['clear-ready', 'init', ['exit', 1]]);
});
test('partial queue registration cannot publish hosted worker readiness', async () => {
  assert.deepEqual(await boot({ registerError: new Error('schedule rejected') }), ['clear-ready', 'init', 'register', ['exit', 1]]);
});
test('ready worker registers queue consumers before cron and skips duplicate cron jobs', async () => {
  assert.deepEqual(await boot(), ['clear-ready', 'init', 'register', ['cron', true], 'ready']);
});
test('explicit queue disable and development fallback remain available', async () => {
  assert.deepEqual(await boot({ enabled: 'false' }), ['clear-ready', ['cron', false], 'ready']);
  assert.deepEqual(await boot({ nodeEnv: 'development', initError: new Error('local database offline') }), ['clear-ready', 'init', ['cron', false], 'ready']);
});
