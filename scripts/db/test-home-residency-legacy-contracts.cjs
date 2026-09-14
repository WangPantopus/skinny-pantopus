// Focused old/new admission and review SQL contracts on the populated replay.
// Each raw/pgTAP contract rolls back; temporary candidate is exactly restored.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const [container, project, cli, output, lease] = process.argv.slice(2);
const names = ['home-residency-admission', 'home-residency-review-receipts', 'home-residency-submission',
  'home-residency-legacy-compatibility', 'home-postcard-admission', 'home-postcard-current-recovery',
  'home-postcard-verification-recovery', 'home-claim-review-transactions'];
let fixture;
(async () => {
  fixture = require('./home-residency-legacy-http-fixture.cjs')({ container, project, cli, output, lease, mode: 'candidate' });
  const paths = names.flatMap(name => [`scripts/db/contracts/${name}.sql`, `supabase/tests/${name}.test.sql`]);
  const hashes = () => Object.fromEntries(paths.map(name => [name,
    crypto.createHash('sha256').update(fs.readFileSync(path.join(fixture.root, name))).digest('hex')]));
  const sourceBefore = hashes(), results = [];
  fixture.save('contract-sources-before.json', sourceBefore);
  try {
    await fixture.start();
    const before = fixture.snapshot();
    for (const source of paths) {
      const text = fs.readFileSync(path.join(fixture.root, source), 'utf8');
      assert.equal((text.match(/^BEGIN;$/gm) || []).length, 1); assert.equal((text.match(/^ROLLBACK;$/gm) || []).length, 1);
      let result;
      try { result = fixture.sql(text); }
      catch (error) {
        fixture.save(path.basename(source) + '.failure.json', { message: error.message,
          stderr: String(error.stderr || ''), stdout: String(error.stdout || '') });
        throw new Error('Focused SQL contract failed: ' + source);
      }
      fixture.save(path.basename(source) + '.result.json', { stdout: result });
      assert(!/^\s*not ok\b/m.test(result), 'pgTAP assertion failed: ' + source);
      assert.deepEqual(fixture.snapshot(), before, 'Contract did not roll back its owned-state effects');
      results.push({ source, pass: true });
    }
    assert.deepEqual(hashes(), sourceBefore, 'Contract source changed during run');
    fixture.save('result.json', { pass: true, raw_contracts: names.length, generated_contracts: names.length,
      results, sources: sourceBefore, provider_delivery: false, permanent_adoption: false });
  } finally { await fixture.cleanup(); }
  console.log('PASS: eight raw and eight generated admission/review contracts; exact retained database restored');
})().catch(error => {
  if (fixture) fixture.save('failure.json', { message: error.message, stack: error.stack });
  console.error('FAIL: inspect private R02 focused SQL contract evidence'); process.exitCode = 1;
});
