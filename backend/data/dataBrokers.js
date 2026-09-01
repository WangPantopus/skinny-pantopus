/**
 * Unlisted (Wave 4) — the data-broker registry.
 *
 * WHAT THIS IS: the sites that republish US county property records, and
 * the exact, verified path to remove yourself from each. It is the
 * actionable half of Unlisted — the value was never confirming that
 * you are listed, it is the removal path.
 *
 * WHY WE DO NOT SCAN: the obvious build is querying ~30 people-search
 * sites with the user's address and reporting what comes back. We
 * deliberately do not, for a reason that outranks the others: querying
 * a people-search site with someone's address DISCLOSES that address to
 * that broker. A scan meant to reduce exposure would create it. (It is
 * also legally grey, brittle against blocking, slow enough to kill the
 * conversion it exists to drive, and needs the permanent scraper
 * staffing that is the stated reason the erase tier waits.)
 *
 * THEREFORE THE COPY RULE, enforced by the shape of this file: nothing
 * here asserts that a given person IS listed anywhere. There is no
 * `found` field and there never should be. Every entry describes what a
 * site publishes and how to leave it — both true without querying
 * anyone.
 *
 * EVERY FIELD MUST BE VERIFIED. A wrong opt-out URL is worse than no
 * entry: it sends someone frightened enough to be doing this to a dead
 * end, or to a form that harvests more data than it removes. Each entry
 * carries `source_url` (the page that was actually fetched) and
 * `verified_at`. An entry that cannot be verified is omitted, not
 * guessed — a short accurate list beats a long invented one.
 *
 * MAINTENANCE: brokers move their opt-out pages. `verified_at` is the
 * honesty marker; the UI should say when the list was last checked, and
 * entries should be re-verified on a schedule rather than assumed good
 * forever.
 */

/**
 * @typedef {object} DataBroker
 * @property {string}   id          kebab-case slug, stable — UnlistedRemoval rows key on it
 * @property {string}   name
 * @property {'people_search'|'background_check'|'property_records'|'marketing'} category
 * @property {string[]} exposes     what the site publishes
 * @property {string}   opt_out_url the exact page a person should start at
 * @property {'web_form'|'email'|'phone'|'mail'|'account_required'} method
 * @property {boolean}  requires_id does it demand a government ID or photo?
 * @property {boolean}  requires_email
 * @property {number}   typical_days stated processing time; 0 when unstated
 * @property {string}   note        one honest sentence the person needs
 * @property {string}   source_url  the page this was verified against
 * @property {string}   verified_at ISO date
 */

/** @type {DataBroker[]} */
const DATA_BROKERS = [
  // Every entry below was fetched and quoted by a researcher, then the
  // links were re-checked independently. Sites that could not be
  // verified were DROPPED rather than guessed — see the commit for the
  // list. `note` carries the caveat a person actually needs, including
  // where only part of a multi-step flow could be confirmed.
  {
    id: "beenverified",
    name: "BeenVerified",
    category: "background_check",
    exposes: ["home_address", "phone", "email", "relatives", "prior_addresses"],
    opt_out_url: "https://www.beenverified.com/privacy/",
    method: "email",
    requires_id: false,
    requires_email: true,
    typical_days: 0,
    note: "BeenVerified also runs a self-serve opt-out form, but that form could not be loaded to verify it, so the route given here is the email one its own privacy policy states. Operated by The Lifetime Value Co. Email privacy@beenverified.com. No processing time is stated for opt-outs.",
    source_url: "https://www.beenverified.com/privacy/",
    verified_at: "2026-08-27",
  },
  {
    id: "infotracer",
    name: "InfoTracer",
    category: "background_check",
    exposes: ["home_address", "phone", "email", "relatives", "prior_addresses", "property_value"],
    opt_out_url: "https://infotracer.com/optout/",
    method: "web_form",
    requires_id: false,
    requires_email: false,
    typical_days: 0,
    note: "The form only asks first name, last name and state (city optional) and publishes no processing time at all, so keep a screenshot of your submission and re-search yourself later to confirm it actually took; judges, prosecutors and law enforcement use a separate route via privacy@infotracer.com, and residents of states with privacy laws can file a fuller deletion request at https://members.infotracer.com/privacyform.",
    source_url: "https://infotracer.com/optout/",
    verified_at: "2026-08-27",
  },
  {
    id: "intelius",
    name: "Intelius",
    category: "background_check",
    exposes: ["home_address", "phone", "email"],
    opt_out_url: "https://suppression.peopleconnect.us",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 0,
    note: "intelius.com/opt-out/ redirects here; one request covers all PeopleConnect sites (Intelius, TruthFinder, Instant Checkmate, US Search). Only the email-entry step was verified — later steps were not exercised. No processing time is stated, and your name can still surface in phone, address or email reports.",
    source_url: "https://suppression.peopleconnect.us",
    verified_at: "2026-08-27",
  },
  {
    id: "acxiom",
    name: "Acxiom",
    category: "marketing",
    exposes: ["home_address", "phone", "email"],
    opt_out_url: "https://www.acxiom.com/optout/",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 14,
    note: "You must give a working email address and click the confirmation email or the request never starts, and Acxiom says the opt-out does not pull back data it already handed to marketers before you submitted.",
    source_url: "https://www.acxiom.com/optout/",
    verified_at: "2026-08-27",
  },
  {
    id: "epsilon",
    name: "Epsilon",
    category: "marketing",
    exposes: ["email", "phone", "age", "property_value"],
    opt_out_url: "https://legal.epsilon.com/dsr",
    method: "web_form",
    requires_id: false,
    requires_email: false,
    typical_days: 0,
    note: "The form only renders its fields after you pick a country, so I could not confirm what it asks for — assume you will need an email; US callers can use +1-866-267-3861 instead, and the form itself states no processing deadline.",
    source_url: "https://legal.epsilon.com/dsr",
    verified_at: "2026-08-27",
  },
  {
    id: "melissa",
    name: "Melissa (Melissa Corporation)",
    category: "marketing",
    exposes: ["home_address", "phone", "email", "property_value"],
    opt_out_url: "https://apps.melissa.com/user/consumerprivacy.aspx",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 0,
    note: "melissa.com/user/ccpa.aspx redirects to this live form, which requires email, name and full postal address and lets you tick delete, opt out of sale/sharing, know, and correct separately; no processing time is stated on the form.",
    source_url: "https://apps.melissa.com/user/consumerprivacy.aspx",
    verified_at: "2026-08-27",
  },
  {
    id: "addresses-com",
    name: "Addresses.com (powered by Intelius / PeopleConnect)",
    category: "people_search",
    exposes: ["home_address", "phone", "age"],
    opt_out_url: "https://suppression.peopleconnect.us/?brand=Intelius",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 0,
    note: "Addresses.com's own 'Exercise My Data Privacy Rights' link routes here via the Intelius privacy center; it asks for name, date of birth and a verifiable phone or email, but no government ID. Two honest caveats: the tool lists TruthFinder, InstantCheckmate, Intelius and USSearch but does not name Addresses.com, and it only blocks name searches, so phone or address lookups can still return you. No processing time is stated.",
    source_url: "https://suppression.peopleconnect.us/?brand=Intelius",
    verified_at: "2026-08-27",
  },
  {
    id: "anywho",
    name: "AnyWho (operated on Spokeo's platform)",
    category: "people_search",
    // Declared, not just stated in prose, so the test can enforce it: a
    // brand running on another entry's platform cannot publish a field
    // the platform itself does not. AnyWho once declared `relatives` and
    // `prior_addresses` while the Spokeo card omitted both, which left
    // two cards on one screen contradicting each other about the same
    // company — and the understated card was the better-known one.
    same_platform_as: "spokeo",
    exposes: ["home_address", "phone", "email", "relatives", "prior_addresses"],
    opt_out_url: "https://www.spokeo.com/optout",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 2,
    note: "AnyWho has no opt-out of its own: anywho.com/optout and anywho.com/privacy both redirect to Spokeo, and the page source loads Spokeo components. The form wants a profile URL, and each listing must be opted out separately; I could not verify that a Spokeo opt-out also clears the AnyWho listing.",
    source_url: "https://www.spokeo.com/optout",
    verified_at: "2026-08-27",
  },
  {
    id: "cocofinder",
    name: "CocoFinder",
    category: "people_search",
    exposes: ["home_address", "phone", "age", "relatives", "prior_addresses"],
    opt_out_url: "https://cocofinder.com/remove-my-info",
    method: "email",
    requires_id: false,
    requires_email: true,
    typical_days: 2,
    note: "The web form CocoFinder links from this page is dead: it is a Google Form that Google has taken down for a Terms of Service violation, returning HTTP 403. Emailing support@cocofinder.com, also given on the page, is currently the only working route. No account or payment is required, and opting out for someone else requires their written authorization.",
    source_url: "https://cocofinder.com/remove-my-info",
    verified_at: "2026-08-27",
  },
  {
    id: "fastpeoplesearch",
    name: "FastPeopleSearch",
    category: "people_search",
    exposes: ["home_address", "prior_addresses", "phone"],
    opt_out_url: "https://www.fastpeoplesearch.com/optout",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 3,
    note: "You must solve a CAPTCHA yourself, then click a link emailed to you — the link expires after 24 hours and you have to request a new one if you miss it.",
    source_url: "https://www.fastpeoplesearch.com/optout",
    verified_at: "2026-08-27",
  },
  {
    id: "lexisnexis",
    name: "LexisNexis (Information Suppression)",
    category: "people_search",
    exposes: [],
    opt_out_url: "https://optout.lexisnexis.com",
    method: "web_form",
    requires_id: false,
    requires_email: false,
    typical_days: 0,
    note: "This route is open only to public officials, people facing a substantial risk of physical harm, and identity-theft victims, and each category must attach supporting proof such as a police report, court protective order, or a letter from a supervisor or shelter — a general resident has no verified opt-out here.",
    source_url: "https://www.lexisnexis.com/en-us/privacy/for-consumers/opt-out-of-lexisnexis.page",
    verified_at: "2026-08-27",
  },
  {
    id: "mylife",
    name: "MyLife",
    category: "people_search",
    exposes: ["home_address", "phone", "email", "age"],
    opt_out_url: "https://www.mylife.com/privacyrequest",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 0,
    note: "No processing time is promised — only 'legally required time frames'. The form requires your birth year, city and ZIP, and asks for your profile URL; the site is now operated by InsightBridge LLC.",
    source_url: "https://www.mylife.com/privacyrequest",
    verified_at: "2026-08-27",
  },
  {
    id: "radaris",
    name: "Radaris",
    category: "people_search",
    exposes: ["home_address", "phone", "email", "relatives", "age", "property_value"],
    opt_out_url: "https://radaris.com/control-privacy",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 1,
    note: "The online form removes only ONE record — Radaris says new records it cannot match to your old one can appear later, and you must email customer-service@radaris.com to clear duplicates or re-listings.",
    source_url: "https://radaris.com/data_privacy_center",
    verified_at: "2026-08-27",
  },
  {
    id: "searchpeoplefree",
    name: "SearchPeopleFree",
    category: "people_search",
    exposes: ["home_address", "phone", "email", "relatives", "age", "prior_addresses"],
    opt_out_url: "https://www.searchpeoplefree.com/opt-out",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 3,
    note: "Two-step and time-limited: you submit name plus email, then must click a link they send, and the page states that if you wait more than 24 hours to click it you have to request a new one. No government ID is asked for. The site is explicit that removal is local only, so the same data can resurface from the public records it was pulled from.",
    source_url: "https://www.searchpeoplefree.com/opt-out",
    verified_at: "2026-08-27",
  },
  {
    id: "spokeo",
    name: "Spokeo",
    category: "people_search",
    // Spokeo's own product pages list Address History, Family and
    // Associates, and Property Data — and the AnyWho entry below, which
    // runs on this same platform and cites this same source_url, already
    // declared relatives and prior addresses. Understating the most
    // sensitive field ("Relatives and household members") on the larger
    // of two cards describing one website is the wrong way to be wrong.
    exposes: ["home_address", "phone", "email", "age", "relatives", "prior_addresses", "property_value"],
    opt_out_url: "https://www.spokeo.com/optout",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 2,
    note: "Each listing has its own URL and must be opted out separately, and Spokeo states outright that your information may reappear later without notice — so this needs re-checking, not one visit.",
    source_url: "https://www.spokeo.com/optout",
    verified_at: "2026-08-27",
  },
  {
    id: "thatsthem",
    name: "ThatsThem",
    category: "people_search",
    exposes: ["home_address", "phone", "email", "relatives"],
    opt_out_url: "https://thatsthem.com/optout",
    method: "web_form",
    requires_id: false,
    requires_email: true,
    typical_days: 3,
    note: "The form makes every field mandatory, so you must hand over your full name, street address, city, state, ZIP, email AND phone to get removed; the footer link 'Do Not Sell My Personal Information' points to this same page, and removal only clears ThatsThem's own results.",
    source_url: "https://thatsthem.com/optout",
    verified_at: "2026-08-27",
  },
  {
    id: "whitepages",
    name: "Whitepages",
    category: "people_search",
    exposes: ["home_address", "phone", "email", "relatives", "age", "prior_addresses"],
    opt_out_url: "https://www.whitepages.com/suppression-requests",
    method: "web_form",
    requires_id: false,
    requires_email: false,
    typical_days: 0,
    note: "A 5-step wizard that starts by pasting your own profile URL. IMPORTANT CAVEAT: only step 1 of 5 was verified — the later steps were not exercised, so they may still ask for email or phone verification. No processing time is published.",
    source_url: "https://www.whitepages.com/suppression-requests",
    verified_at: "2026-08-27",
  },
  {
    id: "corelogic-cotality",
    name: "CoreLogic (now Cotality)",
    category: "property_records",
    exposes: ["home_address", "phone", "age"],
    opt_out_url: "https://www.cotality.com/legal/online-privacy-portal",
    method: "web_form",
    requires_id: false,
    requires_email: false,
    typical_days: 0,
    note: "CoreLogic now trades as Cotality and corelogic.com/privacy redirects there; the policy frames these rights around residents of states with privacy laws and says identity is verified by matching data points against their own records, and no response deadline is stated.",
    source_url: "https://www.cotality.com/legal/product-privacy-policy",
    verified_at: "2026-08-27",
  },
  {
    id: "ownerly",
    name: "Ownerly",
    category: "property_records",
    exposes: ["home_address", "property_value"],
    opt_out_url: "https://www.ownerly.com/svc/optout/search/optouts/",
    method: "web_form",
    requires_id: false,
    requires_email: false,
    typical_days: 45,
    note: "Honest caveat: I verified this opt-out URL and the 45-day window from Ownerly's own privacy policy, but the opt-out form itself sits behind bot protection and would not load for me, so I have not seen what it asks for on screen. Their policy describes an identity-verification step and also offers email (privacy@ownerly.com), phone and postal mail as alternative channels, so email is not the only route. Expect to be asked to verify before removal completes.",
    source_url: "https://www.ownerly.com/privacy/",
    verified_at: "2026-08-27",
  },
];

/** Sites grouped for the UI: the order a person should work through them. */
const CATEGORY_ORDER = ['people_search', 'background_check', 'property_records', 'marketing'];

const CATEGORY_LABELS = {
  people_search: 'People-search sites',
  background_check: 'Background-check sites',
  property_records: 'Property-record aggregators',
  marketing: 'Marketing data brokers',
};

/** What each `exposes` token means, in the person's own terms. */
const EXPOSURE_LABELS = {
  home_address: 'Home address',
  phone: 'Phone number',
  email: 'Email address',
  relatives: 'Relatives and household members',
  age: 'Age or date of birth',
  prior_addresses: 'Previous addresses',
  property_value: 'What your home is worth',
};

module.exports = {
  DATA_BROKERS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  EXPOSURE_LABELS,
};
