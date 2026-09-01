// ============================================================
// TEST: Exemption Check (Wave 2 — Exemption Left on the Table)
//
// The invariants are the honesty ladder:
//   * exemption entries present → on_file with labels;
//   * an exemption container that is EMPTY → none_on_file (the hook);
//   * no exemption structure in the county feed → unknown — NEVER
//     presented as "no exemption on file";
//   * the state table is conservative: curated states carry their
//     filing model, everything else gets the check-your-county
//     default, and no-general-homestead states (WA, CO) never tell a
//     homeowner to go find one.
// ============================================================

jest.mock('../services/ai/propertyIntelligenceService', () => ({
  getHomeAttomPropertyDetail: jest.fn(),
}));

const propertyIntelligenceService = require('../services/ai/propertyIntelligenceService');
const { getExemptionCheck, extractExemptions, assessmentSignal } = require('../services/exemptionCheckService');
const { programForState } = require('../data/homesteadPrograms');

const HOME = { id: 'home-ex-1', state: 'TX', address: '1 Main St' };

beforeEach(() => {
  process.env.ATTOM_API_KEY = 'test-key';
});
afterEach(() => {
  delete process.env.ATTOM_API_KEY;
});

// ── extractExemptions (pure, defensive across ATTOM shapes) ──

describe('extractExemptions', () => {
  test('reads array, object, and tax-nested shapes', () => {
    expect(extractExemptions({ tax: { exemption: [{ exemptionType: 'Homestead', exemptionAmount: 25000 }] } }))
      .toEqual({ reported: true, labels: ['Homestead'], homestead: true });
    expect(extractExemptions({ exemptions: { type: 'Senior citizen' } }))
      .toEqual({ reported: true, labels: ['Senior citizen'], homestead: false });
    expect(extractExemptions({ tax: { exemptiontype: 'HMSTD' } }))
      .toEqual({ reported: true, labels: ['HMSTD'], homestead: true });
    expect(extractExemptions({ exemption: 7000 }))
      .toEqual({ reported: true, labels: ['Exemption amount 7000'], homestead: false });
  });

  test('an empty container is reported-but-empty; a missing one is not reported', () => {
    expect(extractExemptions({ tax: { exemption: [] } })).toEqual({ reported: true, labels: [], homestead: false });
    expect(extractExemptions({ tax: { taxAmt: 5000 } })).toEqual({ reported: false, labels: [], homestead: false });
    expect(extractExemptions(null)).toEqual({ reported: false, labels: [], homestead: false });
  });
});

// ── The Over-Assessment Radar signal (Wave 2b, pure) ─────────

describe('assessmentSignal', () => {
  test('assessed vs the county market value with ±5% stance bands', () => {
    expect(assessmentSignal({ assessed: { assdTtlValue: 550000 }, market: { mktTtlValue: 500000 } }))
      .toEqual({ assessed_value: 550000, market_value: 500000, ratio_pct: 10, stance: 'above' });
    expect(assessmentSignal({ assessed: { assdTtlValue: 490000 }, market: { mktTtlValue: 500000 } }).stance)
      .toBe('near');
    expect(assessmentSignal({ assessed: { assdTtlValue: 400000 }, market: { mktTtlValue: 500000 } }).stance)
      .toBe('below');
  });

  test('null unless BOTH totals are present — half a comparison is no comparison', () => {
    expect(assessmentSignal({ assessed: { assdTtlValue: 550000 } })).toBeNull();
    expect(assessmentSignal({ market: { mktTtlValue: 500000 } })).toBeNull();
    expect(assessmentSignal(null)).toBeNull();
  });
});

// ── The state program table ──────────────────────────────────

describe('programForState', () => {
  test('curated states carry their filing model', () => {
    expect(programForState('TX')).toMatchObject({ filing: 'application', curated: true });
    expect(programForState('ca').curated).toBe(true);
  });

  test('no-general-homestead states never point at a general homestead', () => {
    expect(programForState('WA').filing).toBe('none_general');
    expect(programForState('CO').filing).toBe('none_general');
  });

  test('everything else gets the conservative default', () => {
    const p = programForState('VT');
    expect(p.curated).toBe(false);
    expect(p.filing).toBe('varies');
    expect(p.note).toContain('county assessor');
  });
});

// ── The honesty ladder end-to-end ────────────────────────────

describe('getExemptionCheck', () => {
  const detailMock = propertyIntelligenceService.getHomeAttomPropertyDetail;

  function mockParcel(assessment) {
    detailMock.mockResolvedValue({ attomPayload: { property: [{ assessment }] }, source: 'cache', unavailableReason: null });
  }

  test('exemptions on file', async () => {
    mockParcel({ tax: { exemption: [{ exemptionType: 'Homestead' }, { exemptionType: 'Over 65' }] } });
    const res = await getExemptionCheck(HOME);
    expect(res.status).toBe('ready');
    expect(res.data.filing_status).toBe('on_file');
    expect(res.data.exemptions).toEqual(['Homestead', 'Over 65']);
    expect(res.data.homestead_on_file).toBe(true);
    expect(res.data.state_program.state).toBe('TX');
  });

  test('an empty exemption container is the none_on_file hook', async () => {
    mockParcel({ tax: { exemption: [] } });
    const res = await getExemptionCheck(HOME);
    expect(res.data.filing_status).toBe('none_on_file');
    expect(res.data.homestead_on_file).toBe(false);
  });

  test('no exemption structure reads unknown, never none_on_file', async () => {
    mockParcel({ tax: { taxAmt: 8200 }, assessed: { assdTtlValue: 410000 } });
    const res = await getExemptionCheck(HOME);
    expect(res.data.filing_status).toBe('unknown');
  });

  test('the assessment signal rides along when both county totals exist', async () => {
    mockParcel({
      tax: { exemption: [] },
      assessed: { assdTtlValue: 550000 },
      market: { mktTtlValue: 500000 },
    });
    const res = await getExemptionCheck(HOME);
    expect(res.data.assessment_signal).toEqual({
      assessed_value: 550000, market_value: 500000, ratio_pct: 10, stance: 'above',
    });

    mockParcel({ tax: { exemption: [] } });
    expect((await getExemptionCheck(HOME)).data.assessment_signal).toBeNull();
  });

  test('no parcel match and no key degrade honestly', async () => {
    detailMock.mockResolvedValue({ attomPayload: null, source: 'unavailable', unavailableReason: 'ATTOM_UNAVAILABLE' });
    expect((await getExemptionCheck(HOME))).toMatchObject({ status: 'unavailable', unavailableReason: 'ATTOM_UNAVAILABLE' });

    delete process.env.ATTOM_API_KEY;
    expect((await getExemptionCheck(HOME))).toMatchObject({ status: 'unavailable', unavailableReason: 'ATTOM_NOT_CONFIGURED' });
    // Without a key the service must not even try the provider.
    expect(detailMock).toHaveBeenCalledTimes(1);
  });

  test('the stored full_response payload shape also resolves', async () => {
    detailMock.mockResolvedValue({
      attomPayload: { full_response: { property: [{ assessment: { tax: { exemptiontype: 'Principal Residence' } } }] } },
      source: 'home',
      unavailableReason: null,
    });
    const res = await getExemptionCheck({ ...HOME, state: 'MI' });
    expect(res.data.filing_status).toBe('on_file');
    expect(res.data.homestead_on_file).toBe(true);
    expect(res.data.state_program.label).toContain('Michigan');
  });
});
