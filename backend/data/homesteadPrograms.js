/**
 * State homestead-style property-tax relief programs — the CURATED,
 * deliberately conservative table behind the exemption check.
 *
 * Honesty rules (the legal gate from the product docs):
 *   * entries exist ONLY for states where the program's existence and
 *     its filing model are settled, well-known facts; everything else
 *     falls to DEFAULT_PROGRAM ("check your county assessor") rather
 *     than a guess;
 *   * no dollar values, no deadlines — both rot and both vary by
 *     county; the section's copy says "programs you may be eligible
 *     for", never savings claims;
 *   * `filing` is the load-bearing fact: 'application' is the hook
 *     ("this is not automatic — you have to file"), 'none_general'
 *     prevents the worst error (telling a Washington homeowner to go
 *     find a general homestead exemption that does not exist).
 *
 * Refresh cadence: annual review against state DOR pages (statute-level
 * facts; legislatures move slowly, but they move).
 */

// filing: 'application'  — a homeowner must file to get it
//         'varies'       — programs exist but the mechanics vary by county
//         'none_general' — no general homestead exemption; targeted
//                          (senior/disabled/veteran) programs may exist
const STATE_PROGRAMS = {
  TX: {
    label: 'Texas homestead exemption',
    filing: 'application',
    note: 'Not automatic — file the homestead exemption application with your county appraisal district for your primary residence. Filing is free.',
  },
  FL: {
    label: 'Florida homestead exemption',
    filing: 'application',
    note: 'Not automatic — apply with your county property appraiser for your primary residence. Filing is free.',
  },
  GA: {
    label: 'Georgia homestead exemption',
    filing: 'application',
    note: 'Not automatic — apply with your county tax office for your primary residence. Some counties add local homestead exemptions on top of the state one.',
  },
  CA: {
    label: "California homeowners' exemption",
    filing: 'application',
    note: 'A one-time claim filed with your county assessor for your primary residence. Small but permanent, and often missed after a purchase.',
  },
  NY: {
    label: 'New York STAR school-tax relief',
    filing: 'application',
    note: 'Register for STAR with New York State for your primary residence; new homeowners receive it as a credit.',
  },
  IL: {
    label: 'Illinois general homestead exemption',
    filing: 'varies',
    note: 'Available on your primary residence; some counties apply it automatically and others require an application — check your county assessor.',
  },
  MI: {
    label: 'Michigan principal residence exemption',
    filing: 'application',
    note: 'File the principal residence exemption affidavit (usually handled at closing — worth confirming it is actually on file).',
  },
  OH: {
    label: 'Ohio homestead exemption',
    filing: 'application',
    note: 'Income- and age/disability-qualified — homeowners 65+ or permanently disabled apply through the county auditor.',
  },
  PA: {
    label: 'Pennsylvania homestead exclusion',
    filing: 'application',
    note: 'Apply through your county assessment office; the exclusion reduces the assessed value your school and local taxes are computed on.',
  },
  LA: {
    label: 'Louisiana homestead exemption',
    filing: 'application',
    note: 'File with your parish assessor for your primary residence.',
  },
  SC: {
    label: 'South Carolina legal residence assessment',
    filing: 'application',
    note: 'Apply with your county assessor to have your primary residence taxed at the 4% legal-residence ratio instead of 6%.',
  },
  ID: {
    label: "Idaho homeowner's exemption",
    filing: 'application',
    note: 'A one-time application with your county assessor for your primary residence.',
  },
  WA: {
    label: 'Washington property-tax relief',
    filing: 'none_general',
    note: 'Washington has no general homestead exemption for property tax; relief programs target seniors and people with disabilities — check the state Department of Revenue.',
  },
  CO: {
    label: 'Colorado senior & veteran exemptions',
    filing: 'none_general',
    note: 'Colorado has no general homestead exemption; senior (65+, long occupancy) and disabled-veteran exemptions require an application with the county assessor.',
  },
};

const DEFAULT_PROGRAM = {
  label: 'Homeowner exemption programs',
  filing: 'varies',
  note: 'Many states and counties reduce property tax on a primary residence, and most programs require a one-time application. Check your county assessor or state Department of Revenue for what applies where you live.',
};

function programForState(stateAbbr) {
  const key = String(stateAbbr || '').trim().toUpperCase();
  const program = STATE_PROGRAMS[key] || DEFAULT_PROGRAM;
  return { ...program, curated: Boolean(STATE_PROGRAMS[key]) };
}

module.exports = { programForState, STATE_PROGRAMS, DEFAULT_PROGRAM };
