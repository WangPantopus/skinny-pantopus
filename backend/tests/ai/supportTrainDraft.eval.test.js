/**
 * Support Train Draft — LLM evaluation tests.
 *
 * These tests call the real OpenAI API and validate that the AI draft service
 * produces structurally valid, semantically correct drafts from free-text
 * stories. They are a regression guard, not deterministic unit tests.
 *
 * Skip automatically when OPENAI_API_KEY is not set (CI-safe).
 *
 * Run manually:
 *   OPENAI_API_KEY=sk-... npx jest backend/tests/ai/supportTrainDraft.eval.test.js --testTimeout=60000
 */

const fixtures = require('./fixtures/supportTrainStories.json');

const HAS_API_KEY = !!process.env.OPENAI_API_KEY;

// Conditionally load to avoid import errors when mocks interfere
let draftSupportTrain;
let validateSupportTrainDraft;

if (HAS_API_KEY) {
  // Bypass Jest module mocks — load the real modules directly
  jest.unmock('../../config/supabaseAdmin');
  jest.unmock('../../utils/logger');

  // We need the real OpenAI client but can stub Supabase for logging
  const realSchemas = jest.requireActual('../../services/ai/schemas');
  validateSupportTrainDraft = realSchemas.validateSupportTrainDraft;
}

const describeIfKey = HAS_API_KEY ? describe : describe.skip;

describeIfKey('Support Train Draft — LLM Eval', () => {
  const results = [];

  beforeAll(() => {
    // Load the real service (needs OPENAI_API_KEY in env)
    // We require it here so the top-level skip works correctly
    const service = jest.requireActual('../../services/ai/supportTrainDraftService');
    draftSupportTrain = service.draftSupportTrain;
  });

  afterAll(() => {
    // Print summary table
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log('\n── Support Train Draft Eval Summary ──');
    console.log(`  Total: ${results.length}  Passed: ${passed}  Failed: ${failed}`);
    results.forEach(r => {
      const status = r.pass ? '✓' : '✗';
      console.log(`  ${status} ${r.name} (${r.latencyMs}ms)${r.error ? ' — ' + r.error : ''}`);
    });
    console.log('');
  });

  test.each(fixtures)('$name', async (fixture) => {
    const start = Date.now();
    const { input, expectations } = fixture;
    let result;

    try {
      result = await draftSupportTrain({
        story: input.story,
        supportModesRequested: input.support_modes_requested || undefined,
        userId: '00000000-0000-0000-0000-000000000000',
      });
    } catch (err) {
      results.push({ name: fixture.name, pass: false, latencyMs: Date.now() - start, error: err.message });
      throw err;
    }

    const latencyMs = Date.now() - start;

    // Must not return an error
    if (result.error) {
      results.push({ name: fixture.name, pass: false, latencyMs, error: result.error });
      throw new Error(`Draft returned error: ${result.error} — ${result.message || ''}`);
    }

    const draft = result.draft;

    // Schema validity
    const valid = validateSupportTrainDraft(draft);
    if (!valid) {
      const errors = JSON.stringify(validateSupportTrainDraft.errors);
      results.push({ name: fixture.name, pass: false, latencyMs, error: `Schema invalid: ${errors}` });
    }
    expect(valid).toBe(true);

    // Check summary_chips contain expected substrings (case-insensitive)
    const chipsLower = (result.summary_chips || []).map(c => c.toLowerCase());
    for (const expected of expectations.must_include_chips) {
      const found = chipsLower.some(chip => chip.includes(expected.toLowerCase()));
      if (!found) {
        results.push({ name: fixture.name, pass: false, latencyMs, error: `Missing chip: "${expected}" in [${result.summary_chips}]` });
      }
      expect(found).toBe(true);
    }

    // Check dietary_restrictions (strict: must be in restrictions)
    if (expectations.must_extract_restrictions) {
      for (const restriction of expectations.must_extract_restrictions) {
        expect(draft.dietary_restrictions).toContain(restriction);
      }
    }

    // Check dietary_restrictions_or_preferences (lenient: may appear in either)
    if (expectations.must_extract_restrictions_or_preferences) {
      for (const term of expectations.must_extract_restrictions_or_preferences) {
        const inRestrictions = (draft.dietary_restrictions || []).includes(term);
        const inPreferences = (draft.dietary_preferences || []).includes(term);
        expect(inRestrictions || inPreferences).toBe(true);
      }
    }

    // Check household_size
    if (expectations.must_set_household_size_one_of) {
      // Accept any of the listed values (handles LLM inference variance)
      expect(expectations.must_set_household_size_one_of).toContain(draft.household_size);
    } else if (expectations.must_set_household_size !== undefined && expectations.must_set_household_size !== null) {
      expect(draft.household_size).toBe(expectations.must_set_household_size);
    } else if (expectations.must_set_household_size === null) {
      // null expectation means we accept null or undefined
      expect([null, undefined]).toContain(draft.household_size);
    }

    // Check missing_required_fields
    const missingFields = result.missing_required_fields || [];
    for (const field of expectations.must_flag_missing) {
      expect(missingFields).toContain(field);
    }

    results.push({ name: fixture.name, pass: true, latencyMs });
  }, 45000);
});
