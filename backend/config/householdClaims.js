const logger = require('../utils/logger');

function envBool(key, fallback = false) {
  const raw = (process.env[key] || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return fallback;
}

function buildConfig() {
  return {
    flags: {
      v2ReadPaths: envBool('HOUSEHOLD_CLAIM_V2_READ_PATHS', false),
      parallelSubmission: envBool('HOUSEHOLD_CLAIM_PARALLEL_SUBMISSION', false),
      inviteMerge: envBool('HOUSEHOLD_CLAIM_INVITE_MERGE', false),
      challengeFlow: envBool('HOUSEHOLD_CLAIM_CHALLENGE_FLOW', false),
      adminCompare: envBool('HOUSEHOLD_CLAIM_ADMIN_COMPARE', false),
    },
    jobs: {
      dryRun: envBool('HOUSEHOLD_CLAIM_JOBS_DRY_RUN', true),
    },
  };
}

const config = buildConfig();

if (config.flags.parallelSubmission && !config.flags.adminCompare) {
  logger.warn('household_claim.parallel_submission_without_admin_compare');
}

module.exports = config;
module.exports.buildConfig = buildConfig;
module.exports.envBool = envBool;
