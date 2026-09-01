jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('householdClaims config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.HOUSEHOLD_CLAIM_V2_READ_PATHS;
    delete process.env.HOUSEHOLD_CLAIM_PARALLEL_SUBMISSION;
    delete process.env.HOUSEHOLD_CLAIM_INVITE_MERGE;
    delete process.env.HOUSEHOLD_CLAIM_CHALLENGE_FLOW;
    delete process.env.HOUSEHOLD_CLAIM_ADMIN_COMPARE;
    delete process.env.HOUSEHOLD_CLAIM_JOBS_DRY_RUN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('defaults all rollout flags off and jobs dry-run on', () => {
    const config = require('../../config/householdClaims');

    expect(config.flags).toEqual({
      v2ReadPaths: false,
      parallelSubmission: false,
      inviteMerge: false,
      challengeFlow: false,
      adminCompare: false,
    });
    expect(config.jobs.dryRun).toBe(true);
  });

  test('parses env overrides', () => {
    process.env.HOUSEHOLD_CLAIM_V2_READ_PATHS = 'true';
    process.env.HOUSEHOLD_CLAIM_PARALLEL_SUBMISSION = 'true';
    process.env.HOUSEHOLD_CLAIM_INVITE_MERGE = '1';
    process.env.HOUSEHOLD_CLAIM_CHALLENGE_FLOW = 'yes';
    process.env.HOUSEHOLD_CLAIM_ADMIN_COMPARE = 'on';
    process.env.HOUSEHOLD_CLAIM_JOBS_DRY_RUN = 'false';

    const config = require('../../config/householdClaims');

    expect(config.flags).toEqual({
      v2ReadPaths: true,
      parallelSubmission: true,
      inviteMerge: true,
      challengeFlow: true,
      adminCompare: true,
    });
    expect(config.jobs.dryRun).toBe(false);
  });
});
