/**
 * State homestead-style property-tax relief programs — the CURATED,
 * deliberately conservative table behind the exemption check.
 *
 * Honesty rules (the legal gate from the product docs):
 *   * every entry states only what its state's own page says (revenue
 *     department, assessor guidance or statute, `source`), checked on
 *     CHECKED_AT; anything without a state (territories, missing data)
 *     falls to DEFAULT_PROGRAM ("check your county assessor");
 *   * no dollar values, no deadlines — both rot and both vary by
 *     county; the section's copy says "programs you may be eligible
 *     for", never savings claims;
 *   * `filing` is the load-bearing fact: 'application' is the hook
 *     ("this is not automatic — you have to file"), 'automatic' says what
 *     to check instead, and 'none_general' prevents the worst error
 *     (telling a Washington homeowner to go find a general homestead
 *     exemption that does not exist).
 *
 * Refresh cadence: annual review against each `source` (statute-level
 * facts; legislatures move slowly, but they move). Known to watch as of
 * CHECKED_AT: Missouri's county tax freezes (in court), Utah's 2027
 * declaration rule, Wyoming's November 2026 ballot measure.
 */

const CHECKED_AT = '2026-10-15';

// filing: 'application'  — a homeowner must file to get it
//         'automatic'    — applied to a primary residence without filing
//         'varies'       — programs exist but the mechanics vary by county or town
//         'none_general' — no general homestead exemption; targeted
//                          (senior/disabled/veteran/income) programs may exist
const STATE_PROGRAMS = {
  AL: {
    label: 'Alabama homestead exemption',
    filing: 'application',
    note: 'Owners who live in their home as their primary residence apply at their county property tax office. Larger exemptions exist for owners who are 65+, disabled or blind.',
    source: { name: 'Alabama Department of Revenue', url: 'https://www.revenue.alabama.gov/property-tax/homestead-exemptions/' },
  },
  AK: {
    label: 'Alaska property-tax relief',
    filing: 'varies',
    note: 'Only boroughs and cities tax homes, and each sets its own relief; some offer a residential exemption by application. Owners 65+ and disabled veterans apply to the local assessor for a required exemption.',
    source: { name: 'Alaska Stat. §§ 29.45.030, 29.45.050', url: 'https://www.akleg.gov/basis/statutes.asp?media=print&secStart=29.45.030&secEnd=29.45.050' },
  },
  AZ: {
    label: 'Arizona homeowner school-tax rebate',
    filing: 'automatic',
    note: "A home classified as the owner's primary residence gets a state-paid cut in school taxes on the bill without filing. Check that your county assessor's Notice of Value shows the primary-residence class.",
    source: { name: 'Arizona Department of Revenue', url: 'https://azdor.gov/sites/default/files/2023-03/PROPERTY_AZPropertyTaxation.pdf' },
  },
  AR: {
    label: 'Arkansas homestead property tax credit',
    filing: 'application',
    note: 'A credit on the home you live in as your principal residence: apply with your county assessor. Owners 65+ or disabled can also apply there to freeze the assessed value.',
    source: { name: 'Arkansas DFA Assessment Coordination Division', url: 'https://www.dfa.arkansas.gov/office/arkansas-assessment-coordination-division/real-property/property-tax-relief/' },
  },
  CA: {
    label: "California homeowners' exemption",
    filing: 'application',
    note: 'A one-time claim filed with your county assessor for your primary residence. Small but permanent, and often missed after a purchase.',
    source: { name: 'California State Board of Equalization', url: 'https://www.boe.ca.gov/proptaxes/homeowners_exemption.htm' },
  },
  CO: {
    label: 'Colorado senior & veteran exemptions',
    filing: 'none_general',
    note: 'Colorado has no general homestead exemption; senior (65+, long occupancy) and disabled-veteran exemptions require an application with the county assessor.',
    source: { name: 'Colorado Division of Property Taxation', url: 'https://dpt.colorado.gov/senior-property-tax-exemption' },
  },
  CT: {
    label: 'Connecticut elderly and disabled tax relief',
    filing: 'none_general',
    note: 'Connecticut has no general homestead exemption. Owner-occupants 65+ or totally disabled, within income limits, can apply to their town assessor for a credit on the tax bill.',
    source: { name: 'Connecticut Office of Policy and Management', url: 'https://portal.ct.gov/opm/igpp/grants/tax-relief-grants/homeowners--elderlydisabled-circuit-breaker-tax-relief-program' },
  },
  DE: {
    label: 'Delaware senior school tax credit',
    filing: 'none_general',
    note: 'Delaware has no general homestead exemption. Homeowners 65+ can apply to their county for a state credit on school taxes on their primary residence; some counties add income-limited senior exemptions.',
    source: { name: 'Delaware Department of Finance', url: 'https://finance.delaware.gov/senior-relief/commonly-asked-questions/' },
  },
  DC: {
    label: 'District of Columbia homestead deduction',
    filing: 'application',
    note: 'Owners who live in the home as their principal residence apply once to the Office of Tax and Revenue (MyTax.DC.gov). Seniors and disabled owners can claim more relief.',
    source: { name: 'DC Office of Tax and Revenue', url: 'https://otr.cfo.dc.gov/page/real-property-tax-reliefs-credits-and-deductions' },
  },
  FL: {
    label: 'Florida homestead exemption',
    filing: 'application',
    note: 'Not automatic — apply with your county property appraiser for your permanent residence; approval also caps yearly assessment increases (Save Our Homes). Filing is free.',
    source: { name: 'Florida Department of Revenue', url: 'https://floridarevenue.com/property/Pages/Taxpayers_Exemptions.aspx' },
  },
  GA: {
    label: 'Georgia homestead exemption',
    filing: 'application',
    note: 'Not automatic — apply with your county tax commissioner (the tax assessor in some counties) for your legal residence. Some counties add local homestead exemptions on top of the state one.',
    source: { name: 'Georgia Department of Revenue', url: 'https://dor.georgia.gov/property-tax-homestead-exemptions' },
  },
  HI: {
    label: 'Hawaii home exemption',
    filing: 'application',
    note: "Each county runs its own home exemption: owner-occupants file a claim with the county's real property assessment office, and it generally continues while ownership and use stay the same.",
    source: { name: 'City and County of Honolulu Real Property Assessment', url: 'https://realproperty.honolulu.gov/tax-relief-and-forms/exemptions/home-exemption/' },
  },
  ID: {
    label: "Idaho homeowner's exemption",
    filing: 'application',
    note: 'A one-time application with your county assessor for your primary residence; it lasts until ownership changes or the home is no longer your primary residence.',
    source: { name: 'Idaho State Tax Commission', url: 'https://tax.idaho.gov/taxes/property/homeowners/exemption/' },
  },
  IL: {
    label: 'Illinois general homestead exemption',
    filing: 'varies',
    note: 'Available on your primary residence. Outside Cook County it is often applied automatically, but your county assessor may require an application; in Cook County new owners must apply.',
    source: { name: '35 ILCS 200/15-175', url: 'https://www.ilga.gov/documents/legislation/ilcs/documents/003502000K15-175.htm' },
  },
  IN: {
    label: 'Indiana homestead deduction',
    filing: 'application',
    note: 'Lowers the assessed value of your primary residence. Apply with your county auditor; you reapply only if the home is sold or retitled.',
    source: { name: 'Indiana Department of Local Government Finance', url: 'https://www.in.gov/dlgf/deductions-and-credits/' },
  },
  IA: {
    label: 'Iowa homestead exemption',
    filing: 'application',
    note: "Lowers the taxable value of your primary residence. New owners apply once with their city or county assessor; owners who had the old homestead credit don't need to refile.",
    source: { name: 'Iowa Department of Revenue', url: 'https://revenue.iowa.gov/taxes/tax-guidance/property-tax/homestead-tax-credit-and-exemption' },
  },
  KS: {
    label: 'Kansas homestead refund',
    filing: 'none_general',
    note: 'Kansas has no general homestead exemption. Owners with limited income who are 55+, disabled, disabled veterans or raising a dependent child can claim a Homestead Refund from the Kansas Department of Revenue.',
    source: { name: 'Kansas Department of Revenue', url: 'https://www.ksrevenue.gov/perstaxtypeshs.html' },
  },
  KY: {
    label: 'Kentucky homestead exemption',
    filing: 'none_general',
    note: "Kentucky's homestead exemption is only for owners 65 or older or totally disabled; apply with your county Property Valuation Administrator (PVA).",
    source: { name: 'Kentucky Department of Revenue', url: 'https://revenue.ky.gov/Property/Residential-Farm-Commercial-Property/Pages/Homestead-Exemption.aspx' },
  },
  LA: {
    label: 'Louisiana homestead exemption',
    filing: 'application',
    note: 'Register once with your parish assessor for the home you own and live in; it stays in place while you keep owning and living there.',
    source: { name: 'La. R.S. 47:1703.1', url: 'https://legis.la.gov/Legis/LawPrint.aspx?d=101334' },
  },
  ME: {
    label: 'Maine homestead exemption',
    filing: 'application',
    note: "Reduces the taxable value of a permanent Maine resident's primary residence. Apply with your town or city assessor once you've owned a Maine home for 12 months; it stays while ownership and residency are unchanged.",
    source: { name: 'Maine Revenue Services', url: 'https://www.maine.gov/revenue/faq/homestead-exemption-program' },
  },
  MD: {
    label: 'Maryland homestead tax credit',
    filing: 'application',
    note: 'Limits how fast the taxable assessment on your principal residence can rise. Apply once with the State Department of Assessments and Taxation (SDAT); its property search shows whether one is on file.',
    source: { name: 'Maryland State Department of Assessments and Taxation', url: 'https://dat.maryland.gov/realproperty/pages/maryland-homestead-tax-credit.aspx' },
  },
  MA: {
    label: 'Massachusetts residential exemption',
    filing: 'varies',
    note: 'A local option: only cities and towns that adopt it offer it, for owner-occupied primary residences. Ask your city or town assessors whether yours has it and how to apply.',
    source: { name: 'Mass. Gen. Laws c. 59, § 5C', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter59/Section5C' },
  },
  MI: {
    label: 'Michigan principal residence exemption',
    filing: 'application',
    note: "File a Principal Residence Exemption affidavit with your city or township assessor — usually done at closing, but worth confirming it's actually on file.",
    source: { name: 'Michigan Department of Treasury', url: 'https://www.michigan.gov/taxes/property/principal/principal-residence-exemption-pre-guidelines-and-faqs/claim-requirement' },
  },
  MN: {
    label: 'Minnesota homestead classification',
    filing: 'application',
    note: 'Classifying your owner-occupied home as a homestead lowers its tax and unlocks other relief. Apply once with your county assessor.',
    source: { name: 'Minnesota Department of Revenue', url: 'https://www.revenue.state.mn.us/homestead-classification' },
  },
  MS: {
    label: 'Mississippi homestead exemption',
    filing: 'application',
    note: 'Lowers property tax on the home you own and live in, with more relief at 65+ or if totally disabled. Apply with your county tax assessor; it carries over unless ownership or use changes.',
    source: { name: 'Mississippi Department of Revenue', url: 'https://www.dor.ms.gov/county-services/homestead-exemption' },
  },
  MO: {
    label: 'Missouri property tax credit',
    filing: 'none_general',
    note: 'Missouri has no general homestead exemption. Seniors and fully disabled owners with limited income can claim the Property Tax Credit from the Missouri Department of Revenue.',
    source: { name: 'Missouri Department of Revenue', url: 'https://dor.mo.gov/taxation/individual/tax-types/property-tax-credit/' },
  },
  MT: {
    label: 'Montana homestead tax rate',
    filing: 'application',
    note: 'Owners who live in their Montana home as a principal residence must enroll with the Montana Department of Revenue to get the lower homestead tax rate; you can check your enrollment online.',
    source: { name: 'Montana Department of Revenue', url: 'https://revenue.mt.gov/property/property-tax-changes/homesteads-and-long-term-rentals' },
  },
  NE: {
    label: 'Nebraska homestead exemption',
    filing: 'none_general',
    note: "Nebraska's homestead exemption covers only owners 65+, certain people with disabilities, and qualifying disabled veterans or surviving spouses, some income-limited; most file each year with the county assessor.",
    source: { name: 'Nebraska Department of Revenue', url: 'https://revenue.nebraska.gov/sites/default/files/doc/pad/homestead/Homestead%20Exemption%20Information%20Guide.pdf' },
  },
  NV: {
    label: 'Nevada primary residence tax cap',
    filing: 'application',
    note: 'Nevada has no homestead exemption, but a primary residence gets a lower cap on yearly tax increases when claimed with the county assessor (or on the declaration of value at purchase).',
    source: { name: 'Nev. Rev. Stat. 361.4723', url: 'https://www.leg.state.nv.us/nrs/nrs-361.html#NRS361Sec4723' },
  },
  NH: {
    label: 'New Hampshire local exemptions and credits',
    filing: 'none_general',
    note: 'New Hampshire has no general homestead exemption. Towns grant exemptions and credits to qualifying elderly, disabled, blind and veteran owners; apply with your town or city assessors.',
    source: { name: 'N.H. RSA 72:33', url: 'https://gc.nh.gov/rsa/html/V/72/72-33.htm' },
  },
  NJ: {
    label: 'New Jersey ANCHOR property tax relief',
    filing: 'application',
    note: 'Income-limited relief for your main home from the NJ Division of Taxation. The state files for many returning owners under 65; if you got no confirmation letter, or are 65+ or on disability benefits, apply yourself.',
    source: { name: 'New Jersey Division of Taxation', url: 'https://www.nj.gov/treasury/taxation/anchor/' },
  },
  NM: {
    label: 'New Mexico head-of-family exemption',
    filing: 'application',
    note: 'Residents can claim it on the home they live in by filing proof of eligibility with the county assessor (no dependents needed); once allowed it carries forward until ownership or eligibility changes.',
    source: { name: 'New Mexico Taxation and Revenue, 3.6.6.11 NMAC', url: 'https://www.srca.nm.gov/wp-content/uploads/attachments/03.006.0006.pdf' },
  },
  NY: {
    label: 'New York STAR school-tax relief',
    filing: 'application',
    note: 'Register once with New York State (Department of Taxation and Finance) when the home becomes your primary residence; new homeowners receive STAR as a yearly credit, and income limits apply.',
    source: { name: 'NYS Department of Taxation and Finance', url: 'https://www.tax.ny.gov/pit/property/star/' },
  },
  NC: {
    label: 'North Carolina elderly or disabled exclusion',
    filing: 'none_general',
    note: 'North Carolina has no general homestead exemption. Owners 65+ or totally and permanently disabled with limited income, and disabled veterans, can apply to the county tax assessor for an exclusion or a deferral.',
    source: { name: 'North Carolina Department of Revenue (Form AV-9)', url: 'https://www.ncdor.gov/2027-av-9-securedpdf/open' },
  },
  ND: {
    label: 'North Dakota primary residence credit',
    filing: 'application',
    note: 'A state property tax credit for owners who live in their home as a primary residence, with no age or income limits. Apply online each year with the Office of State Tax Commissioner.',
    source: { name: 'North Dakota Office of State Tax Commissioner', url: 'https://www.tax.nd.gov/prc' },
  },
  OH: {
    label: 'Ohio owner-occupancy reduction',
    filing: 'application',
    note: 'Owner-occupied homes get a property tax reduction by applying to the county auditor, often at purchase. The separate homestead exemption is for owners 65+ or permanently disabled, income-limited for new applicants.',
    source: { name: 'Ohio Rev. Code 323.153', url: 'https://codes.ohio.gov/ohio-revised-code/section-323.153' },
  },
  OK: {
    label: 'Oklahoma homestead exemption',
    filing: 'application',
    note: 'Apply to your county assessor for the home you own and live in; it continues without reapplying while you own and occupy it, and new owners must apply.',
    source: { name: 'Oklahoma Tax Commission (Form 921)', url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/ad-valorem/current/921.pdf' },
  },
  OR: {
    label: 'Oregon property-tax relief',
    filing: 'none_general',
    note: 'Oregon has no general homestead exemption. Senior and disabled homeowners may qualify to defer property taxes, and disabled veterans or surviving spouses can claim a partial exemption with the county assessor.',
    source: { name: 'Oregon Department of Revenue', url: 'https://www.oregon.gov/dor/programs/property/Pages/exemptions.aspx' },
  },
  PA: {
    label: 'Pennsylvania homestead exclusion',
    filing: 'application',
    note: 'Owner-occupied primary residences can get a school property tax reduction through the homestead exclusion — file the application with your county assessment office.',
    source: { name: 'Pennsylvania Department of Community and Economic Development', url: 'https://dced.pa.gov/local-government/property-tax-relief-homestead-exclusion/' },
  },
  RI: {
    label: 'Rhode Island homestead exemption',
    filing: 'varies',
    note: 'Each city or town decides whether to offer a homestead exemption (or a lower owner-occupied tax rate) and sets its own rules — ask your city or town assessor what applies and how to apply.',
    source: { name: 'R.I. Gen. Laws § 44-5-11.8', url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-5/44-5-11.8.htm' },
  },
  SC: {
    label: 'South Carolina legal residence assessment',
    filing: 'application',
    note: 'Apply once with your county assessor to have your primary residence taxed at the 4% legal-residence ratio instead of 6%; a new owner must apply again.',
    source: { name: 'S.C. Code § 12-43-220', url: 'https://www.scstatehouse.gov/code/t12c043.php' },
  },
  SD: {
    label: 'South Dakota owner-occupied classification',
    filing: 'application',
    note: 'Owners whose home is their primary residence apply once with the county director of equalization (or online with the Department of Revenue); it stays until the home is sold or its use changes.',
    source: { name: 'South Dakota Department of Revenue', url: 'https://dor.sd.gov/media/3tvdp2wl/owner-occupied.pdf' },
  },
  TN: {
    label: 'Tennessee property tax relief',
    filing: 'none_general',
    note: 'Tennessee has no general homestead exemption. Low-income seniors and homeowners with disabilities, and disabled veterans or their surviving spouses, can apply with the county trustee for state tax relief.',
    source: { name: 'Tennessee Comptroller of the Treasury', url: 'https://www.comptroller.tn.gov/office-functions/pa/property-taxes/property-tax-programs/tax-relief.html' },
  },
  TX: {
    label: 'Texas homestead exemption',
    filing: 'application',
    note: 'Not automatic — file the homestead exemption application with your county appraisal district for your primary residence. Filing is free.',
    source: { name: 'Texas Comptroller of Public Accounts', url: 'https://comptroller.texas.gov/taxes/property-tax/exemptions/' },
  },
  UT: {
    label: 'Utah primary residential exemption',
    filing: 'application',
    note: "Counties apply it to primary residences, but new owners (or homes that weren't a primary residence the year before) must file a declaration, Form TC-473A, with the county.",
    source: { name: 'Utah State Tax Commission', url: 'https://tax.utah.gov/propertytax/tax-relief/primary-residential-exemption/' },
  },
  VT: {
    label: 'Vermont homestead declaration',
    filing: 'application',
    note: 'File a Homestead Declaration with the Vermont Department of Taxes every year so your home is taxed at the homestead education rate.',
    source: { name: 'Vermont Department of Taxes', url: 'https://tax.vermont.gov/property/homestead-declaration' },
  },
  VA: {
    label: 'Virginia real estate tax relief',
    filing: 'none_general',
    note: 'Virginia has no general homestead exemption. Many cities and counties offer tax relief or deferral for owners 65+ or permanently and totally disabled, often income-limited — ask your local commissioner of the revenue.',
    source: { name: 'Code of Virginia § 58.1-3210', url: 'https://law.lis.virginia.gov/vacode/title58.1/chapter32/section58.1-3210/' },
  },
  WA: {
    label: 'Washington property-tax relief',
    filing: 'none_general',
    note: 'Washington has no general homestead exemption. Income-limited seniors, people with disabilities and some disabled veterans can get an exemption or a deferral — apply through your county assessor.',
    source: { name: 'Washington Department of Revenue', url: 'https://dor.wa.gov/taxes-rates/property-tax/property-tax-exemptions-and-deferrals' },
  },
  WV: {
    label: 'West Virginia homestead exemption',
    filing: 'none_general',
    note: "West Virginia's homestead exemption is for owners 65+ or permanently and totally disabled — file a one-time claim with your county assessor.",
    source: { name: 'W. Va. Code § 11-6B-4', url: 'https://code.wvlegislature.gov/11-6B-4/' },
  },
  WI: {
    label: 'Wisconsin lottery and gaming credit',
    filing: 'application',
    note: 'Wisconsin has no homestead exemption on the tax bill; owners whose home is their primary residence can claim the lottery and gaming credit with the county (or city) treasurer.',
    source: { name: 'Wisconsin Department of Revenue', url: 'https://www.revenue.wi.gov/Pages/FAQS/slf-lottcr.aspx' },
  },
  WY: {
    label: "Wyoming homeowner's exemption",
    filing: 'application',
    note: "Owners living in their single-family home as a primary residence file the state's online owner-occupied affidavit, which the county assessor reviews; long-time Wyoming taxpayers 65+ may get more.",
    source: { name: 'Wyoming Department of Revenue', url: 'https://ptd.wyo.gov/OWNEROCC/pages/home' },
  },
};

const DEFAULT_PROGRAM = {
  label: 'Homeowner exemption programs',
  filing: 'varies',
  note: 'Many states and counties reduce property tax on a primary residence, and most programs require a one-time application. Check your county assessor or state Department of Revenue for what applies where you live.',
};

function programForState(stateAbbr) {
  const key = String(stateAbbr || '').trim().toUpperCase();
  const curated = STATE_PROGRAMS[key];
  const program = curated || DEFAULT_PROGRAM;
  return {
    label: program.label,
    filing: program.filing,
    note: program.note,
    curated: Boolean(curated),
    source_name: curated ? curated.source.name : null,
    source_url: curated ? curated.source.url : null,
  };
}

module.exports = { programForState, STATE_PROGRAMS, DEFAULT_PROGRAM, CHECKED_AT };
