/**
 * Unlisted (Wave 4) — what each state exposes, and its escape hatch.
 *
 * The most valuable thing on the Unlisted page is not the broker list.
 * It is this: most US states run an ADDRESS CONFIDENTIALITY PROGRAM —
 * a legal substitute address for survivors of domestic violence, sexual
 * assault, stalking or trafficking, so the real one stays out of public
 * records at the source rather than being chased across thirty sites
 * forever.
 *
 * Someone typing their address into a page called "get my address off
 * the internet" is disproportionately likely to be doing it because of
 * a specific person. For that reader this is the single highest-value
 * fact we can surface, and the broker list is the consolation prize.
 * It is placed first for that reason.
 *
 * ACCURACY IS NOT OPTIONAL HERE. A wrong program name or a dead link
 * fails someone at the worst possible moment. Every entry carries the
 * official source it was verified against; an unverifiable entry is
 * omitted rather than guessed, and the UI must degrade to "we could not
 * confirm a program for your state" rather than inventing one.
 *
 * We do NOT ask why someone is here. The T0 endpoint persists nothing
 * about the lookup, though the shared request logger does record the
 * caller's IP and user-agent like every other route — pre-existing, and
 * worth suppressing on this path separately.
 *
 * SOURCING A NEGATIVE. `acp_exists: false` is the most dangerous cell in
 * this file: it tells someone their state has nothing. It must be
 * sourced as carefully as a positive, and to a .gov / .us page or a
 * program operator's own directory — never a secondary summary. The
 * three no-program states cited a law-review article until an audit
 * caught it; that article's own list is wrong about Arkansas and South
 * Carolina, both of which this file correctly contradicts with the
 * states' own pages, so it was demonstrably not what they were verified
 * against. `unlisted.test.js` now enforces the domain rule.
 */

/**
 * @typedef {object} StateDisclosure
 * @property {string}  state           two-letter code
 * @property {boolean} acp_exists
 * @property {string}  acp_name        the program's official name
 * @property {string}  acp_url         official state URL
 * @property {string}  acp_eligibility one sentence: who qualifies
 * @property {string}  source_url      the page this was verified against
 * @property {string}  verified_at     ISO date
 */

/** @type {Record<string, StateDisclosure>} */
const STATE_DISCLOSURE = {
  AK: {
    state: "AK",
    acp_exists: false,
    acp_name: "",
    acp_url: "",
    acp_eligibility: "No program is operating. Legislation to create one (HB 104, 34th Legislature) is still pending in the House Finance Committee, so there is nothing to apply to.",
    source_url: "https://www.akleg.gov/basis/Bill/Detail/34?Root=HB%20104",
    verified_at: "2026-08-27",
  },
  AL: {
    state: "AL",
    acp_exists: false,
    acp_name: "",
    acp_url: "",
    acp_eligibility: "Alabama operates no substitute-address confidentiality program; its only address protection for domestic violence victims is a Domestic Violence Voter Affirmation that omits the address from public voter lists.",
    source_url: "https://www.sos.alabama.gov/sites/default/files/voter-pdfs/Domestic_Violence_Affidavit.pdf",
    verified_at: "2026-08-27",
  },
  AR: {
    state: "AR",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (Office of Driver Services)",
    acp_url: "https://www.dfa.arkansas.gov/office/driver-services/address-confidentiality-program/",
    acp_eligibility: "Victims of domestic violence and their dependents who present a valid order of protection and an affidavit; note this Arkansas program is narrower than most states' — it substitutes a P.O. box on the driver's license or state ID rather than across all public records.",
    source_url: "https://www.dfa.arkansas.gov/office/driver-services/address-confidentiality-program/",
    verified_at: "2026-08-27",
  },
  AZ: {
    state: "AZ",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://azsos.gov/services/acp",
    acp_eligibility: "Victims of domestic violence, a sexual offense, or stalking who fear for their safety, have documentation of victimization, and have moved within the past 90 days (or plan to move) to a place unknown to the perpetrator; run by the Secretary of State.",
    source_url: "https://azsos.gov/services/address-confidentiality-program/eligibility-enrollment",
    verified_at: "2026-08-27",
  },
  CA: {
    state: "CA",
    acp_exists: true,
    acp_name: "Safe at Home",
    acp_url: "https://www.sos.ca.gov/registries/safe-home",
    acp_eligibility: "Victims of domestic violence, sexual assault, stalking, human trafficking, child abduction, and elder or dependent adult abuse, plus reproductive health care workers and public entity employees in fear for their safety.",
    source_url: "https://www.sos.ca.gov/registries/safe-home",
    verified_at: "2026-08-27",
  },
  CO: {
    state: "CO",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://dcs.colorado.gov/acp",
    acp_eligibility: "Colorado survivors of stalking, sexual assault, or domestic violence (plus certain protected healthcare workers) who need a legal substitute address and mail forwarding.",
    source_url: "https://dcs.colorado.gov/acp",
    verified_at: "2026-08-27",
  },
  CT: {
    state: "CT",
    acp_exists: true,
    acp_name: "Safe at Home: Address Confidentiality Program (ACP)",
    acp_url: "https://portal.ct.gov/sots/business-services/acp/address-confidentiality-program",
    acp_eligibility: "Connecticut residents who are victims of family violence, injury or risk of injury to a child, kidnapping, sexual assault, stalking, trafficking in persons, or substantiated child abuse or neglect underlying a protective order.",
    source_url: "https://portal.ct.gov/sots/business-services/acp/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  DC: {
    state: "DC",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://ovsjg.dc.gov/acp",
    acp_eligibility: "People who fear for their safety, currently live in (or will soon move to) the District, and have experienced domestic violence, sexual assault, stalking, or human trafficking — or who work for an organization serving such victims or focused on reproductive healthcare; adults and children may qualify.",
    source_url: "https://ovsjg.dc.gov/acp",
    verified_at: "2026-08-27",
  },
  DE: {
    state: "DE",
    acp_exists: true,
    acp_name: "Address Confidentiality Program",
    acp_url: "https://delcode.delaware.gov/title11/c096/sc02/index.html",
    acp_eligibility: "Victims of domestic violence, sexual assault, human trafficking, kidnapping, or stalking who have filed for a protection-from-abuse order or are named as a victim in a criminal/delinquency proceeding and fear future violence; also household members of a participant, people getting help from a domestic violence program, and reproductive health service providers/employees who fear for their safety.",
    source_url: "https://delcode.delaware.gov/title11/c096/sc02/index.html",
    verified_at: "2026-08-27",
  },
  FL: {
    state: "FL",
    acp_exists: true,
    acp_name: "Address Confidentiality Program",
    acp_url: "https://www.myfloridalegal.com/victim-programs",
    acp_eligibility: "An adult, or a parent/guardian applying on behalf of a minor or incapacitated person, who swears they are a victim of domestic violence or dating violence and fear for their safety.",
    source_url: "http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799/0741/Sections/0741.403.html",
    verified_at: "2026-08-27",
  },
  GA: {
    state: "GA",
    acp_exists: true,
    acp_name: "Safe at Home",
    acp_url: "https://sos.ga.gov/safeathome",
    acp_eligibility: "Survivors of domestic violence, sexual assault, human trafficking, or stalking, and others whose safety may be compromised by public disclosure of their residential address.",
    source_url: "https://sos.ga.gov/safeathome",
    verified_at: "2026-08-27",
  },
  HI: {
    state: "HI",
    acp_exists: true,
    acp_name: "Hawaii Address Confidentiality Program (ACP)",
    acp_url: "https://law.hawaii.gov/resources/hawaii-address-confidentiality-program-acp/",
    acp_eligibility: "Survivors of domestic abuse, a sexual offense or stalking who reside, or will reside within 30 days, in Hawaii at an address unknown to their assailants; apply via a designated application assistant at a certified victim services organization.",
    source_url: "https://law.hawaii.gov/resources/hawaii-address-confidentiality-program-acp/",
    verified_at: "2026-08-27",
  },
  IA: {
    state: "IA",
    acp_exists: true,
    acp_name: "Iowa Safe at Home",
    acp_url: "https://safeathome.iowa.gov/",
    acp_eligibility: "Iowa survivors of domestic violence, sexual assault, trafficking, stalking and assault, who receive a substitute address, mail forwarding and confidential voter registration.",
    source_url: "https://safeathome.iowa.gov/",
    verified_at: "2026-08-27",
  },
  ID: {
    state: "ID",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://sos.idaho.gov/acp/",
    acp_eligibility: "Survivors of domestic violence, sexual assault, stalking, human trafficking or malicious harassment who move to a new location to escape; state and local agencies must accept the substitute address under Idaho Code Title 19, Chapter 57.",
    source_url: "https://sos.idaho.gov/acp/",
    verified_at: "2026-08-27",
  },
  IL: {
    state: "IL",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://illinoisattorneygeneral.gov/safer-communities/supporting-victims-of-crime/address-confidentiality-program/",
    acp_eligibility: "Adults in (or soon moving to) Illinois with good reason to believe they are victims of domestic violence, sexual assault, human trafficking, or stalking and who fear for their safety; no police report or protective order required.",
    source_url: "https://illinoisattorneygeneral.gov/safer-communities/supporting-victims-of-crime/address-confidentiality-program/",
    verified_at: "2026-08-27",
  },
  IN: {
    state: "IN",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.in.gov/attorneygeneral/about-the-office/appeals/victim-services/address-confidentiality-program/",
    acp_eligibility: "Victims of domestic violence, sexual assault, stalking, human trafficking, harassment, intimidation or invasion of privacy; the application must be signed by a trained victim advocate, and the program is run by the Indiana Attorney General.",
    source_url: "https://www.in.gov/attorneygeneral/about-the-office/appeals/victim-services/address-confidentiality-program/",
    verified_at: "2026-08-27",
  },
  KS: {
    state: "KS",
    acp_exists: true,
    acp_name: "Safe at Home",
    acp_url: "https://www.ag.ks.gov/divisions/victim-services/safe-at-home",
    acp_eligibility: "Victims of domestic violence, sexual assault, stalking and/or human trafficking who have moved to a location unknown to their abuser; enrollment is through a trained enrolling agent.",
    source_url: "https://www.dcf.ks.gov/services/ees/Pages/Safe_at_Home/SafeatHome.aspx",
    verified_at: "2026-08-27",
  },
  KY: {
    state: "KY",
    acp_exists: true,
    acp_name: "Safe at Home",
    acp_url: "https://www.sos.ky.gov/safe-at-home/Pages/About-Safe-At-Home.aspx",
    acp_eligibility: "Kentucky survivors of sexual assault, domestic violence, human trafficking, stalking and certain other crimes; since 2023 a sworn statement replaces the former requirement of an emergency protective order.",
    source_url: "https://www.sos.ky.gov/safe-at-home/Pages/About-Safe-At-Home.aspx",
    verified_at: "2026-08-27",
  },
  LA: {
    state: "LA",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.sos.la.gov/our-office/address-confidentiality-program",
    acp_eligibility: "Anyone attempting to escape actual or threatened abuse, sexual assault, or stalking who is a Louisiana resident (or relocating to an address unknown to the abuser) and is 18+ or a parent/guardian of a minor.",
    source_url: "https://www.sos.la.gov/our-office/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  MA: {
    state: "MA",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.sec.state.ma.us/divisions/acp/address-confidentiality-program.htm",
    acp_eligibility: "Survivors of domestic violence, sexual assault, rape and stalking, plus some legally protected healthcare providers, who have recently relocated; administered by the Secretary of the Commonwealth.",
    source_url: "https://www.sec.state.ma.us/divisions/acp/address-confidentiality-program.htm",
    verified_at: "2026-08-27",
  },
  MD: {
    state: "MD",
    acp_exists: true,
    acp_name: "Maryland Safe at Home Address Confidentiality Program (ACP)",
    acp_url: "https://sos.maryland.gov/ACP/Pages/default.aspx",
    acp_eligibility: "Individuals and families fleeing threatened, attempted or actual domestic violence, human trafficking, sexual assault, stalking or harassment who have recently relocated or intend to relocate; administered by the Office of the Secretary of State.",
    source_url: "https://sos.maryland.gov/ACP/Pages/default.aspx",
    verified_at: "2026-08-27",
  },
  ME: {
    state: "ME",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.maine.gov/sos/about-us/address-confidentiality-program",
    acp_eligibility: "Maine residents who are victims of domestic violence, sexual assault, or stalking; applications are made on the recommendation of a victim-services professional (counseling, referral, or shelter provider) rather than by self-referral.",
    source_url: "https://www.maine.gov/sos/about-us/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  MI: {
    state: "MI",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.michigan.gov/ag/initiatives/address-confidentiality-program",
    acp_eligibility: "Victims of domestic violence, sexual assault, stalking or human trafficking, and others who fear that disclosure of their physical address will increase the risk of harm; administered by the Michigan Department of Attorney General.",
    source_url: "https://www.michigan.gov/ag/initiatives/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  MN: {
    state: "MN",
    acp_exists: true,
    acp_name: "Safe at Home",
    acp_url: "https://www.sos.mn.gov/safe-at-home/",
    acp_eligibility: "Minnesotans who are survivors of domestic violence, sexual assault, or stalking, or others who fear for their safety and need their home address kept confidential.",
    source_url: "https://www.sos.mn.gov/safe-at-home/",
    verified_at: "2026-08-27",
  },
  MO: {
    state: "MO",
    acp_exists: true,
    acp_name: "Safe at Home (address confidentiality program)",
    acp_url: "https://www.sos.mo.gov/business/safeathome",
    acp_eligibility: "Survivors of domestic violence, sexual assault, rape, human trafficking, stalking or other crimes who fear future harm; administered by the Missouri Secretary of State since 2007.",
    source_url: "https://www.sos.mo.gov/business/safeathome",
    verified_at: "2026-08-27",
  },
  MS: {
    state: "MS",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://attorneygenerallynnfitch.com/divisions/bureau-of-victim-assistance/",
    acp_eligibility: "Mississippi residents who have moved, or are moving, to escape domestic violence, sexual assault/abuse or stalking; apply free through the Attorney General's Bureau of Victim Assistance at 601.359.6766 or 800.829.6766.",
    source_url: "https://attorneygenerallynnfitch.com/wp-content/uploads/2020/07/Walking-Away-brochure-ACP.pdf",
    verified_at: "2026-08-27",
  },
  MT: {
    state: "MT",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://dojmt.gov/victim-services/address-confidentiality-program/",
    acp_eligibility: "Montana residents who are victims of partner or family member assault, sexual assault, stalking, or human trafficking, or who are eligible to apply for an order of protection, and who have moved to a Montana location unknown to the abuser.",
    source_url: "https://dojmt.gov/victim-services/address-confidentiality-program/",
    verified_at: "2026-08-27",
  },
  NC: {
    state: "NC",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://ncdoj.gov/public-protection/acp/",
    acp_eligibility: "Survivors of domestic violence, sexual assault, stalking, or human trafficking who have moved or are moving to a new address and sign a statement that they fear for their safety; run by the NC Department of Justice / Attorney General.",
    source_url: "https://ncdoj.gov/public-protection/acp/",
    verified_at: "2026-08-27",
  },
  ND: {
    state: "ND",
    acp_exists: false,
    acp_name: "",
    acp_url: "",
    acp_eligibility: "No state address confidentiality program exists; North Dakota has not enacted one.",
    source_url: "https://sos.mn.gov/safe-at-home/resources-for-safety/other-states-with-programs-like-safe-at-home/",
    verified_at: "2026-08-27",
  },
  NE: {
    state: "NE",
    acp_exists: true,
    acp_name: "Nebraska Address Confidentiality Program (ACP)",
    acp_url: "https://sos.nebraska.gov/business-services/address-confidentiality-program",
    acp_eligibility: "Nebraska residents who are victims of domestic violence, sexual assault or stalking, fear for their safety, and have recently moved or plan to move to a location unknown to the abuser; apply in person at a designated victim assistance center.",
    source_url: "https://sos.nebraska.gov/business-services/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  NH: {
    state: "NH",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.doj.nh.gov/bureaus/office-victimwitness-assistance/address-confidentiality-program",
    acp_eligibility: "Any New Hampshire resident who is a victim of domestic violence, sexual assault or stalking (or a parent/guardian applying for a minor or incapacitated person) and who has recently moved, or is about to move, to an address the abuser does not know; no restraining order or police report is required.",
    source_url: "https://www.doj.nh.gov/bureaus/office-victimwitness-assistance/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  NJ: {
    state: "NJ",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.nj.gov/dcf/divisions-offices/dow/acp.shtml",
    acp_eligibility: "Victims and survivors of domestic violence, stalking and sexual violence (plus reproductive health patients and providers) who have experienced fear or threat of abuse and are relocating; run by the Department of Children and Families, Division on Women.",
    source_url: "https://www.nj.gov/dcf/divisions-offices/dow/acp.shtml",
    verified_at: "2026-08-27",
  },
  NM: {
    state: "NM",
    acp_exists: true,
    acp_name: "Safe at Home (formerly the Confidential Address Program)",
    acp_url: "https://www.sos.nm.gov/safe-at-home/",
    acp_eligibility: "New Mexico residents who are survivors of domestic violence, sexual assault, attempted sexual assault or stalking and have recently relocated, or plan to relocate, to a place unknown to their abuser.",
    source_url: "https://www.sos.nm.gov/safe-at-home/",
    verified_at: "2026-08-27",
  },
  NV: {
    state: "NV",
    acp_exists: true,
    acp_name: "Nevada Confidential Address Program (CAP)",
    acp_url: "https://dcfs.nv.gov/Programs/CAP/ConfidentialAddressProgram/",
    acp_eligibility: "Adults (or a parent/guardian applying on someone's behalf) who are victims of domestic violence, sexual assault, human trafficking and/or stalking, with documented evidence of victimization; applications are made through a CAP Certified Advocate, not directly.",
    source_url: "https://dcfs.nv.gov/Programs/CAP/ConfidentialAddressProgram/",
    verified_at: "2026-08-27",
  },
  NY: {
    state: "NY",
    acp_exists: true,
    acp_name: "Address Confidentiality Program",
    acp_url: "https://dos.ny.gov/address-confidentiality-program",
    acp_eligibility: "Victims of domestic violence and their household members who have relocated to an address unknown to their abuser; administered by the NY Department of State.",
    source_url: "https://dos.ny.gov/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  OH: {
    state: "OH",
    acp_exists: true,
    acp_name: "Safe at Home",
    acp_url: "https://www.ohiosos.gov/secretary-office/office-initiatives/safe-at-home/",
    acp_eligibility: "Survivors of domestic violence, human trafficking, rape or sexual battery, or menacing by stalking, and members of their household, who fear for their safety.",
    source_url: "https://www.ohiosos.gov/secretary-office/office-initiatives/safe-at-home/",
    verified_at: "2026-08-27",
  },
  OK: {
    state: "OK",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://oklahoma.gov/oag/about/divisions/victim-advocacy-and-services-unit/acp.html",
    acp_eligibility: "Oklahoma residents who are victims of domestic violence, sexual assault, or stalking (or an adult residing with such a victim) who fear for their safety and have moved or plan to move to a location unknown to the abuser.",
    source_url: "https://oklahoma.gov/oag/about/divisions/victim-advocacy-and-services-unit/acp.html",
    verified_at: "2026-08-27",
  },
  OR: {
    state: "OR",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.doj.state.or.us/crime-victims/victims-services/address-confidentiality-program-acp/",
    acp_eligibility: "Oregon residents who survived domestic violence, sexual assault, stalking, human trafficking, or bias crimes/incidents; also health care providers offering reproductive and gender-affirming care.",
    source_url: "https://www.doj.state.or.us/crime-victims/victims-services/address-confidentiality-program-acp/",
    verified_at: "2026-08-27",
  },
  PA: {
    state: "PA",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.pa.gov/agencies/ova/address-confidentiality",
    acp_eligibility: "Victims of domestic violence, sexual assault, stalking, human trafficking, or child abduction; administered by the Pennsylvania Office of Victim Advocate.",
    source_url: "https://www.pa.gov/agencies/ova/address-confidentiality",
    verified_at: "2026-08-27",
  },
  RI: {
    state: "RI",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.sos.ri.gov/AddressConfidentialityProgram",
    acp_eligibility: "Rhode Island residents who are victims of domestic violence and/or abuse (including stalking, sexual assault, and trafficking under RI Gen. Laws 42-164-2), who fear for their own or their child's/ward's safety and live at a location the abuser does not know.",
    source_url: "https://www.sos.ri.gov/AddressConfidentialityProgram",
    verified_at: "2026-08-27",
  },
  SC: {
    state: "SC",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.scag.gov/crime-victim-services/address-confidentiality-program-acp/",
    acp_eligibility: "South Carolina residents 18 or older (or a parent/guardian applying for a minor or incapacitated person) who are victims of domestic violence, human trafficking, stalking, harassment, or sexual offenses.",
    source_url: "https://www.scag.gov/crime-victim-services/address-confidentiality-program-acp/",
    verified_at: "2026-08-27",
  },
  SD: {
    state: "SD",
    acp_exists: false,
    acp_name: "",
    acp_url: "",
    acp_eligibility: "No state address confidentiality program exists; South Dakota has not enacted one.",
    source_url: "https://sos.mn.gov/safe-at-home/resources-for-safety/other-states-with-programs-like-safe-at-home/",
    verified_at: "2026-08-27",
  },
  TN: {
    state: "TN",
    acp_exists: true,
    acp_name: "Safe at Home Address Confidentiality Program",
    acp_url: "https://sos.tn.gov/safeathome",
    acp_eligibility: "Victims of domestic abuse, stalking, human trafficking, rape, sexual battery or any other sexual offense who meet the application requirements; administered by the Tennessee Secretary of State.",
    source_url: "https://sos.tn.gov/safeathome/faqs/who-can-apply-to-the-safe-at-home-program",
    verified_at: "2026-08-27",
  },
  TX: {
    state: "TX",
    acp_exists: true,
    acp_name: "Address Confidentiality Program",
    acp_url: "https://www.texasattorneygeneral.gov/crime-victims/victims-violent-crime/address-confidentiality-program",
    acp_eligibility: "Victims of family violence, sexual assault, human trafficking, stalking, or child abduction who have a protective order or documentation of the crime.",
    source_url: "https://www.texasattorneygeneral.gov/crime-victims/victims-violent-crime/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  UT: {
    state: "UT",
    acp_exists: true,
    acp_name: "Safe at Home",
    acp_url: "https://safeathome.utah.gov/",
    acp_eligibility: "Survivors living in Utah of abuse, child abuse, domestic violence, stalking, human trafficking, or sexual assault who fear physical danger if their perpetrator learns where they live.",
    source_url: "https://safeathome.utah.gov/",
    verified_at: "2026-08-27",
  },
  VA: {
    state: "VA",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.oag.state.va.us/programs-outreach/domestic-violence/address-confidentiality-program",
    acp_eligibility: "Survivors of domestic violence, stalking, sexual violence, child abduction and/or human trafficking who have recently relocated to a location unknown to their abuser or stalker; administered by the Office of the Attorney General.",
    source_url: "https://www.oag.state.va.us/programs-outreach/domestic-violence/address-confidentiality-program",
    verified_at: "2026-08-27",
  },
  VT: {
    state: "VT",
    acp_exists: true,
    acp_name: "Safe at Home Address Confidentiality Program",
    acp_url: "https://sos.vermont.gov/secretary-of-state-services/safe-at-home/",
    acp_eligibility: "Vermont residents who are survivors of domestic violence, sexual assault, stalking, or human trafficking, or who provide or are seeking reproductive or gender-affirming health care services; adults, emancipated minors, or a parent/guardian applying for a minor or incapacitated person.",
    source_url: "https://sos.vermont.gov/secretary-of-state-services/safe-at-home/",
    verified_at: "2026-08-27",
  },
  WA: {
    state: "WA",
    acp_exists: true,
    acp_name: "Address Confidentiality Program (ACP)",
    acp_url: "https://www.sos.wa.gov/statewide-programs/address-confidentiality-program-acp",
    acp_eligibility: "Survivors of domestic violence, sexual assault, stalking or trafficking, plus criminal justice affiliates, election officials, and protected health care workers targeted for threats or harassment.",
    source_url: "https://www.sos.wa.gov/statewide-programs/address-confidentiality-program-acp",
    verified_at: "2026-08-27",
  },
  WI: {
    state: "WI",
    acp_exists: true,
    acp_name: "Safe at Home Address Confidentiality Program",
    acp_url: "https://www.wisdoj.gov/Pages/CrimeVictimServices/safe-at-home-address-confidentiality-program.aspx",
    acp_eligibility: "Wisconsin residents who are victims of abuse (or a parent/guardian or household member of one), or who fear for their physical safety, and whose address is unknown to the person they fear.",
    source_url: "https://www.wisdoj.gov/Pages/CrimeVictimServices/safe-at-home-address-confidentiality-program.aspx",
    verified_at: "2026-08-27",
  },
  WV: {
    state: "WV",
    acp_exists: true,
    acp_name: "West Virginia Address Confidentiality Program (ACP)",
    acp_url: "https://sos.wv.gov/about-us/address-confidentiality-program-acp",
    acp_eligibility: "Adults (or parents/guardians of minors) who are victims of domestic violence, sexual assault, stalking or human trafficking, are or will be WV residents, and have relocated or plan to relocate to an address unknown to the perpetrator; apply in person through an approved application assistant.",
    source_url: "https://sos.wv.gov/about-us/address-confidentiality-program-acp",
    verified_at: "2026-08-27",
  },
  WY: {
    state: "WY",
    acp_exists: false,
    acp_name: "",
    acp_url: "",
    acp_eligibility: "No state address confidentiality program exists; Wyoming has not enacted one. Address protection is available only case-by-case through a court order in a domestic-abuse proceeding.",
    source_url: "https://sos.mn.gov/safe-at-home/resources-for-safety/other-states-with-programs-like-safe-at-home/",
    verified_at: "2026-08-27",
  },
};

/**
 * The disclosure facts for a state, or null when we have not verified
 * that state. Null must render as "we could not confirm", never as
 * "your state has no program" — those are different claims and only one
 * of them is ours to make.
 */
function forState(stateCode) {
  const key = String(stateCode || '').trim().toUpperCase();
  if (!key) return null;
  return STATE_DISCLOSURE[key] || null;
}

module.exports = {
  STATE_DISCLOSURE,
  forState,
};
