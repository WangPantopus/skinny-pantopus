/**
 * Before-You-Sign Scout (Wave 4) — the address you are ABOUT to commit to.
 *
 * THE TENSION THE ROADMAP FLAGGED, AND HOW IT RESOLVES.
 * Scout looked like it fought the locked-teaser economics: give it away
 * and you lose the conversion lever, lock it and you gate the product.
 * The resolution falls out of noticing who the user is — someone
 * considering an address they do NOT live at. They cannot be a verified
 * resident of it; verification is impossible by definition, so gating
 * Scout behind T4 would make it unusable by exactly the audience it
 * exists for.
 *
 * So Scout runs at T1: an account, no address claim, no postcard. That
 * is a genuinely different ask from the rest of the product, which is
 * the point — it reaches people who are not ready to claim an address
 * but are about to sign a lease or an offer, which is the moment they
 * care most.
 *
 * WHAT IT IS. Not another dashboard. The dashboard answers "what is true
 * about my home"; Scout answers "what should I ask before I sign", and
 * the derived question list IS the product. Every question is generated
 * from a fact we actually have and carries the fact that produced it, so
 * it can be checked rather than trusted.
 *
 * THE PRIVACY CONSTRAINT THAT SHAPES THE WHOLE THING. Someone scouting an
 * address is looking up a place where SOMEBODY ELSE currently lives.
 * That makes this the one surface in the product where the person asking
 * is not the person the data is about. So Scout is restricted to facts
 * about LAND AND BUILDINGS that are already public — flood zone,
 * environmental risk and county rent bands — and never
 * touches anything derived from the people there:
 *   * no resident or owner names, no occupancy, no household record;
 *   * no Band B property valuation (that is the owner's record);
 *   * no Band D real-rent band (that is the block's residents' data,
 *     contributed for each other, not for someone shopping);
 *   * no verified-neighbour count and no density bucket — the payload
 *     carries no density field at all, which is stricter than the
 *     anonymous preview and is the right default for a reader with no
 *     claim on the address.
 * A prospective tenant learning the flood zone is fair. A prospective
 * anything learning about the current occupants is not.
 *
 * NEVER ADVICE. Every generated line is a QUESTION TO ASK or a fact,
 * never an instruction. "Ask whether it has been tested" — not "demand a
 * test", and never anything that reads as legal or financial advice.
 */

const logger = require('../utils/logger');
const placeSectionAdapters = require('./placeSectionAdapters');
const nfipPremiumService = require('./nfipPremiumService');

// Federal lead-paint disclosure applies to housing built before 1978.
const LEAD_DISCLOSURE_YEAR = 1978;

/**
 * Is this FEMA zone a Special Flood Hazard Area?
 *
 * NOT `startsWith('A')`. FEMA's S_FLD_HAZ_AR FLD_ZONE domain contains the
 * literal string "AREA NOT INCLUDED" — an unmapped area, which a prefix
 * test reads as high-risk and which then generates "a federally backed
 * mortgage requires flood insurance here". That is a false statement
 * about a legal requirement, told to someone deciding whether to sign,
 * and it points the opposite way from the truth: an unmapped area is one
 * where the risk is UNKNOWN, not established.
 *
 * SFHA is the 1%-annual-chance floodplain: A, AE, AH, AO, AR, A99, the
 * numbered A1-A30, and the coastal V, VE, V1-V30. Everything else — X,
 * B, C, D (undetermined), open water, unmapped — is not.
 */
function isSpecialFloodHazardArea(zone) {
  const z = String(zone || '').trim().toUpperCase();
  // The AR DUAL ZONES are SFHAs and are written with a slash: AR/AE,
  // AR/AO, AR/AH, AR/A, AR/A1-A30 (FEMA's own flood-zone glossary lists
  // them alongside A and V). The first version of this function missed
  // every one of them — a FALSE NEGATIVE on genuinely high-risk land,
  // which is the worse direction to fail than the "AREA NOT INCLUDED"
  // bug it was written to fix: it suppresses the question about who pays
  // for the insurance a federally backed mortgage actually requires.
  if (/^AR\/(A|AE|AH|AO|A99|A\d{1,2})$/.test(z)) return true;
  return /^(A|AE|AH|AO|AR|A99|A\d{1,2}|V|VE|V\d{1,2})$/.test(z);
}

/**
 * FEMA's answer has THREE values, not two, and the third is the one that
 * keeps getting lost.
 *
 *   'high_risk'    — the 1%-annual-chance floodplain. Insurance required
 *                    with a federally backed mortgage.
 *   'low_risk'     — FEMA looked and it is outside that floodplain.
 *   'undetermined' — FEMA has NOT made a determination here: zone D, an
 *                    unmapped area, open water, or a code we do not know.
 *
 * `in_sfha: false` collapses the last two, and every client that renders
 * a boolean then says "outside the high-risk area" about land nobody has
 * assessed — a confident safety claim, made for exactly the places where
 * no one can make it. That is the same defect as the AREA-NOT-INCLUDED
 * bug this file already fixed, one layer up, so the determination is
 * resolved HERE rather than re-derived by three clients.
 */
function floodDetermination(zone) {
  const z = String(zone || '').trim().toUpperCase();
  if (isSpecialFloodHazardArea(z)) return 'high_risk';
  // The zones that ARE a finding of lower risk. X500 and "SHADED X" are
  // the 0.2%-chance band; B and C are their pre-1986 equivalents.
  if (/^(X|X500|B|C|SHADED X|AREA OF MINIMAL FLOOD HAZARD)$/.test(z)) return 'low_risk';
  // D, AREA NOT INCLUDED, OPEN WATER, and anything unrecognised.
  return 'undetermined';
}

/**
 * How to name a HUD bedroom band in prose.
 *
 * Never omit it. `rent.position` is the single personalised judgement in
 * the whole report, and it is only meaningful against a stated unit size:
 * a studio asking $1,400 against the county's 2-bedroom band of
 * $1,600–$1,920 is `below_band`, which reads as "a good deal" and is not
 * one. If the count is unknown we say so rather than implying a default.
 */
function bedroomsLabel(bedrooms) {
  if (bedrooms == null) return 'units of an unstated size';
  if (bedrooms === 0) return 'studios';
  return `${bedrooms}-bedroom units`;
}

/**
 * The determination for a flood object, derived when it is missing.
 *
 * Callers build this object in several places, and one that omits
 * `determination` must not silently fall through to the "outside the
 * high-risk zone" branch — that is the false-reassurance bug, reachable
 * by nothing more than forgetting a field. Deriving from the zone means
 * there is exactly one way to be right.
 */
function determinationOf(flood) {
  return flood.determination || floodDetermination(flood.zone);
}

/**
 * The question list — the actual product.
 *
 * Each entry carries `because`: the fact that generated it. A question
 * without its reason is just a checklist someone found on the internet;
 * with it, the reader can judge whether it applies to them.
 */
function askBeforeYouSign({ flood, nfip, radon, water, rentBand, askingRent }) {
  const asks = [];

  if (flood && flood.in_sfha) {
    asks.push({
      id: 'flood_insurance_required',
      question: 'Who pays for flood insurance here, and what does it cost this year?',
      because: `This address sits in FEMA flood zone ${flood.zone}, where a federally backed mortgage requires flood insurance.`,
      source: 'FEMA National Flood Hazard Layer',
    });
    if (nfip && nfip.premium_median) {
      asks.push({
        id: 'flood_premium_benchmark',
        question: 'Ask to see the current flood policy and its declarations page.',
        because: `Real NFIP policies in this census tract run a median of $${nfip.premium_median.toLocaleString('en-US')} a year. A quote for this address could differ, but a number far below that is worth asking about.`,
        source: 'FEMA · OpenFEMA NFIP policies',
      });
    }
  } else if (flood && flood.zone && determinationOf(flood) === 'undetermined') {
    // FEMA has NOT assessed here — zone D, an unmapped area, or a code we
    // do not know. "Outside the high-risk zone" is as false for this as
    // "requires flood insurance" was, and it is the more tempting error
    // because it sounds like reassurance. The honest answer is that
    // nobody has made a finding, which makes the history question MORE
    // worth asking, not less.
    asks.push({
      id: 'flood_undetermined',
      question: 'Has this property ever flooded, and has anyone assessed its flood risk?',
      because: `FEMA has not made a flood-risk determination for this location (zone ${flood.zone}). That is not the same as low risk — it means no one has published a finding either way, so the building's own history is the best evidence available.`,
      source: 'FEMA National Flood Hazard Layer',
    });
  } else if (flood && flood.zone) {
    asks.push({
      id: 'flood_history',
      question: 'Has this property ever flooded, and is there a flood policy on it now?',
      because: `The address is outside the high-risk zone (${flood.zone}), where flood insurance is usually optional — which also means it is often absent.`,
      source: 'FEMA National Flood Hazard Layer',
    });
  }

  if (radon && radon.radon_zone === 1) {
    asks.push({
      id: 'radon_tested',
      question: 'Has this home been tested for radon, and can you see the result?',
      because: 'This county is EPA Radon Zone 1 — the highest predicted indoor level. A test is inexpensive and the result is specific to the building.',
      source: 'EPA radon zones',
    });
  }

  if (radon && radon.year_built != null && radon.year_built < LEAD_DISCLOSURE_YEAR) {
    asks.push({
      id: 'lead_disclosure',
      question: 'Ask for the lead-paint disclosure and any inspection records.',
      // Attributed to the reader, because they supplied the year. We do
      // not look up a build year for an address we have no claim on.
      because: `You told us the building dates to ${radon.year_built}. Federal law requires sellers and landlords of most pre-1978 housing to give you a lead-paint disclosure before you sign.`,
      source: 'HUD / EPA lead disclosure rule',
    });
  }

  if (water && water.violation_count > 0) {
    asks.push({
      id: 'water_violations',
      question: 'Which water system serves this address, and has it had recent violations?',
      because: `The system serving this area has ${water.violation_count} recorded violation${water.violation_count === 1 ? '' : 's'} in the EPA's database.`,
      source: 'EPA SDWIS',
    });
  }

  if (rentBand && askingRent != null) {
    if (askingRent > rentBand.band_high) {
      asks.push({
        id: 'rent_above_band',
        question: 'What does this rent include that comparable units do not?',
        because: `The asking rent is above HUD's fair market rent band for ${bedroomsLabel(rentBand.bedrooms)} in this county ($${rentBand.band_low.toLocaleString('en-US')}–$${rentBand.band_high.toLocaleString('en-US')}). That is common in desirable buildings and is not by itself a problem — it is a thing to have an answer for.`,
        source: 'HUD Fair Market Rents',
      });
    }
    asks.push({
      id: 'utilities_included',
      question: 'Which utilities are included, and what did they run last winter?',
      because: 'A rent that looks competitive can be undone by utilities, and last winter\'s bills are a fact the current occupant can produce.',
      source: null,
    });
  }

  // Always asked. It costs nothing and it is the question people most
  // regret not asking.
  asks.push({
    id: 'whats_changed',
    question: 'What has been repaired or replaced in the last five years, and is there paperwork?',
    because: 'Roof, heating, water heater and electrical panel are the expensive four, and their age predicts what you will spend.',
    source: null,
  });

  return asks;
}

/**
 * Compose a Scout report for an address the caller does NOT occupy.
 *
 * @param {{lat:number, lng:number, line:string, city:string, state:string, zipcode:string}} place
 * @param {{askingRent?: number, yearBuilt?: number, bedrooms?: number}} [options]
 *   `yearBuilt` comes from the CALLER — a listing states it, and we do
 *   not know it without the owner's property record (Band B, excluded
 *   here on purpose). Questions derived from it say so, because a fact
 *   the reader supplied and a fact we looked up are not the same kind of
 *   thing and should not be presented as one.
 */
async function getScoutReport(place, { askingRent, yearBuilt, bedrooms } = {}) {
  // A synthetic, occupant-free "home" for the composers. It deliberately
  // carries no id, no owner and no household fields — nothing here may
  // resolve to a real Home row, so no composer can reach occupancy,
  // ownership, or any resident-contributed data even by accident.
  const synthetic = {
    id: null,
    address: place.line,
    city: place.city,
    state: place.state,
    zipcode: place.zipcode,
    map_center_lat: place.lat,
    map_center_lng: place.lng,
    // The CALLER's number, off the listing — like year_built, not something
    // we looked up. `composeRentBand` treats a studio (0) as a real value
    // and only defaults to 2 when this is null.
    bedrooms: bedrooms ?? null,
    // Only ever the caller's own number; never resolved from a record.
    year_built: Number.isFinite(Number(yearBuilt)) && Number(yearBuilt) > 1500 ? Number(yearBuilt) : null,
  };

  // `civic` was here and is deliberately gone. It was the most expensive
  // fetch in the report (live Census geographies plus two representative
  // sources), the ONLY field passed through unprojected — so a composer
  // change silently changed Scout's wire shape — and askBeforeYouSign
  // generates no question from it, so it would have rendered as a bare
  // district list on a page whose entire product is questions. If
  // school-district-before-you-sign is wanted, it comes back as a
  // generated ask with its own `because`, not as a raw list.
  const [radonSettled, waterSettled, rentSettled] = await Promise.allSettled([
    placeSectionAdapters.composeLeadRadon(synthetic),
    placeSectionAdapters.composeDrinkingWater(synthetic),
    placeSectionAdapters.composeRentBand(synthetic),
  ]);

  const dataOf = (settled) => {
    if (settled.status !== 'fulfilled') return null;
    const [section] = settled.value || [];
    return section && (section.status === 'ready' || section.status === 'stale') ? section.data : null;
  };

  // PROJECT THE FACTS DOWN, DROP THE COMPOSED SENTENCES.
  //
  // The composers write for the dashboard, whose reader lives there:
  // "Your county has the highest radon potential (zone 1) — test before
  // renovating." Forwarded whole into Scout that becomes a possessive
  // and an instruction aimed at someone who explicitly does NOT live
  // there, and it slips past the never-advice rules, which are enforced
  // on `askBeforeYouSign` and nowhere else.
  //
  // So Scout takes the numbers and lets askBeforeYouSign own every
  // sentence it emits. `summary` and `disclaimer` do not cross over.
  // The radon section ALSO accepts 'partial'.
  //
  // `composeLeadRadon` returns 'partial' when it has one of its two
  // inputs rather than both — and the EPA county radon zone does not
  // depend on the build year at all: it is a county fact we looked up.
  // Dropping it because the reader could not state a year withheld an
  // EPA Zone 1 classification on the one surface built for people about
  // to sign, and made an "optional" form field effectively mandatory.
  //
  // Deliberately NOT done by loosening the shared `dataOf`: that is safe
  // only by accident today, because composeDrinkingWater and
  // composeRentBand happen never to emit 'partial'. Widening the shared
  // helper would make Scout's wire contract depend on an unenforced
  // property of two other composers.
  const radonRaw = (() => {
    if (radonSettled.status !== 'fulfilled') return null;
    const [section] = radonSettled.value || [];
    if (!section) return null;
    return ['ready', 'stale', 'partial'].includes(section.status) ? section.data : null;
  })();
  const waterRaw = dataOf(waterSettled);
  //
  // `year_built` is the CALLER's number, off a listing — it is not
  // something the composer looked up, and it must not disappear because
  // the composer did. Radon coverage is county-by-county, and when a
  // county has none `composeLeadRadon` degrades to `partial`, which
  // `dataOf` drops; that silently took the federal lead-paint disclosure
  // question with it, on the one surface built for people about to sign.
  const radon = (radonRaw || synthetic.year_built != null)
    ? {
      radon_zone: (radonRaw && radonRaw.radon_zone) ?? null,
      lead_paint_risk: (radonRaw && radonRaw.lead_paint_risk) ?? null,
      year_built: synthetic.year_built,
    }
    : null;
  const water = waterRaw
    ? {
      utility_name: waterRaw.utility_name ?? null,
      pws_id: waterRaw.pws_id ?? null,
      violation_count: waterRaw.violation_count ?? 0,
      recent_health_violations: waterRaw.recent_health_violations ?? false,
    }
    : null;
  const rentBand = dataOf(rentSettled);

  // Flood + what insurance actually costs there: the pair that changes a
  // decision more than anything else on the page.
  //
  // Fetched DIRECTLY rather than via neighborhoodProfileService.getProfile,
  // which would have sent the typed address STRING to WalkScore
  // (fetchWalkScore puts it in a query string to api.walkscore.com).
  // Scout wants only the zone and the tract id, and both are reachable
  // from coordinates alone — getProfile was over-fetching anyway.
  //
  // The invariant this buys is narrow, and worth stating precisely: this
  // function makes no outbound call carrying the address string. It is NOT
  // "the address never leaves this process" — the route geocodes through
  // Mapbox before calling here, and the coordinates below go to FEMA and
  // the Census Bureau. See the scope_note at the bottom of this file for
  // what the reader is actually told, and why it has been wrong twice.
  let flood = null;
  let nfip = null;
  try {
    const neighborhood = require('./ai/neighborhoodProfileService');
    const [zoneSettled, tractSettled] = await Promise.allSettled([
      neighborhood.fetchFloodZone(place.lat, place.lng),
      neighborhood.geocodeToTractCached(place.lat, place.lng),
    ]);

    const zoneRow = zoneSettled.status === 'fulfilled' ? zoneSettled.value : null;
    const rawZone = zoneRow && (zoneRow.flood_zone || zoneRow.zone || zoneRow.FLD_ZONE);
    if (rawZone) {
      const zone = String(rawZone).toUpperCase();
      flood = {
        zone: rawZone,
        in_sfha: isSpecialFloodHazardArea(zone),
        // Kept alongside `in_sfha` rather than replacing it: the boolean
        // still drives the question generator, but a client rendering
        // prose must branch on all three answers. See floodDetermination.
        determination: floodDetermination(zone),
        plain_meaning: (zoneRow && (zoneRow.flood_zone_description || zoneRow.description)) || null,
      };
    }

    const tract = tractSettled.status === 'fulfilled' ? tractSettled.value : null;
    if (tract && tract.tractId) {
      // enqueue left ON, deliberately — unlike the anonymous preview,
      // which passes { enqueue: false } (routes/public.js). Someone about
      // to sign a lease at this address is the best available signal that
      // a tract will matter to a resident soon, and Scout is capped at
      // 30/hour/account so the volume is bounded.
      //
      // Flip this to false the moment Scout becomes reachable without an
      // account: at that point it is drive-by traffic again, and it would
      // sit in the same FIFO warm queue ahead of tracts people live in.
      const benchmark = await nfipPremiumService.getTractBenchmark(tract.tractId, { enqueue: true });
      if (benchmark && benchmark.status === 'ready') nfip = benchmark.data;
    }
  } catch (err) {
    logger.warn('scout: flood/nfip failed', { error: err.message });
  }

  const asks = askBeforeYouSign({
    flood,
    nfip,
    radon,
    water,
    rentBand,
    askingRent,
  });

  return {
    place: {
      address: place.line,
      city: place.city,
      state: place.state,
      zipcode: place.zipcode,
    },
    flood,
    flood_cost: nfip
      ? {
        premium_p25: nfip.premium_p25,
        premium_median: nfip.premium_median,
        premium_p75: nfip.premium_p75,
        policy_count: nfip.policy_count,
        scope: 'census tract',
        note: 'Real policies near this address. A benchmark, not a quote.',
      }
      : null,
    environment: { radon, water },
    rent: rentBand
      ? {
        band_low: rentBand.band_low,
        band_high: rentBand.band_high,
        period: rentBand.period,
        asking_rent: askingRent ?? null,
        // THE UNIT SIZE TRAVELS WITH THE VERDICT, ALWAYS.
        //
        // `position` is the only personalised judgement in the report, and
        // it is meaningless without the band's bedroom count. This used to
        // be dropped here while composeRentBand silently defaulted to 2,
        // so a studio at $1,400 came back `below_band` against a
        // 2-bedroom band — a client has no way to render that as anything
        // but "a good deal", and it is not one.
        //
        // `bedrooms_stated` says whether the reader chose this or we
        // defaulted it, so a client can label the difference rather than
        // presenting an assumption as their input.
        bedrooms: rentBand.bedrooms,
        bedrooms_stated: bedrooms != null,
        // Stated as a position against a public band, never as a verdict
        // on whether the price is fair — we do not know the unit.
        position: askingRent == null
          ? null
          : askingRent > rentBand.band_high
            ? 'above_band'
            : askingRent < rentBand.band_low
              ? 'below_band'
              : 'in_band',
        scope: 'county',
      }
      : null,
    ask_before_you_sign: asks,
    // Rendered verbatim by every client. Scout is about land and
    // buildings; the people currently living there are not our subject.
    // THIS SENTENCE HAS NOW BEEN WRONG TWICE. Read the history before
    // editing it, because both errors were the same error.
    //
    //   v1 "we did not tell anyone you looked" — false: the route geocodes
    //      the typed address through Mapbox before this function runs.
    //   v2 "our mapping provider — that is the one company that sees it" —
    //      also false, and written while fixing v1. Mapbox is the only one
    //      that sees the address STRING, but the coordinates it returns go
    //      to hazards.fema.gov (neighborhoodProfileService.js:264) and to
    //      geocoding.geo.census.gov (neighborhoodProfileService.js:79),
    //      and a coordinate IS the address to anyone who can reverse it.
    //
    // The lesson both times: an assurance phrased as an exclusive ("the
    // one company", "nobody") is a promise about everything the code does
    // not do, which is the hardest kind to keep and the easiest kind to
    // falsify. So this states the shape rather than a count, and the test
    // asserts the absence of exclusivity claims rather than the presence
    // of any particular wording.
    scope_note: 'Everything here describes the property and the area from public records. '
      + 'Nothing about the people who live there is shown, and nobody at the address is told you looked. '
      + 'Answering means looking the address up with our mapping provider, then asking public agencies '
      + '— FEMA, the Census Bureau and the EPA — what they publish about that location.',
  };
}

module.exports = {
  getScoutReport,
  // Exported for testing.
  askBeforeYouSign,
  isSpecialFloodHazardArea,
  floodDetermination,
  LEAD_DISCLOSURE_YEAR,
};
