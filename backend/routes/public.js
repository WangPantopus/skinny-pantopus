const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const geo = require('../services/geo');
const { bucketForCount } = require('../services/place/densityReader');
const {
  geocodeToTractCached,
  fetchCensusACS,
  fetchFloodZone,
} = require('../services/ai/neighborhoodProfileService');
const { readThrough } = require('../services/placeSectionCache');
const nfipPremiumService = require('../services/nfipPremiumService');
const unlistedService = require('../services/unlistedService');
const placeSectionAdapters = require('../services/placeSectionAdapters');
const { encodeGeohash, encodeGeohash6 } = require('../utils/geohash');
const { GeoCache } = require('../utils/geoCache');
const placePreviewService = require('../services/placePreviewService');
const { foundingSlotsOpen } = require('../services/place/foundingWindow');
const { recordFunnelEvent, CLIENT_POSTABLE_EVENT_TYPES } = require('../services/funnelEvents');
const { resolveUsState } = require('../utils/usState');

// ============================================================
// Public Preview Endpoints
// No authentication required. Returns sanitized data only —
// no user IDs, no exact addresses, no PII.
// ============================================================

// ── GET /api/public/gigs/:id ────────────────────────────────
router.get('/gigs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: gig, error } = await supabaseAdmin
      .from('Gig')
      .select('id, title, description, category, price, price_max, city, state, status, created_at')
      .eq('id', id)
      .single();

    if (error || !gig) {
      return res.status(404).json({ error: 'Not found' });
    }

    const isExpired = gig.status === 'completed' || gig.status === 'cancelled' || gig.status === 'expired';

    res.json({
      id: gig.id,
      title: gig.title,
      description: isExpired ? null : (gig.description || '').slice(0, 300),
      category: gig.category,
      price_min: gig.price || null,
      price_max: gig.price_max || null,
      city: gig.city,
      state: gig.state,
      status: gig.status,
      is_expired: isExpired,
      created_at: gig.created_at,
    });
  } catch (err) {
    console.error('[public/gigs] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/public/listings/:id ────────────────────────────
router.get('/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: listing, error } = await supabaseAdmin
      .from('Listing')
      .select('id, title, description, price, currency, condition, city, state, status, photos, created_at')
      .eq('id', id)
      .single();

    if (error || !listing) {
      return res.status(404).json({ error: 'Not found' });
    }

    const isSold = listing.status === 'sold' || listing.status === 'removed' || listing.status === 'expired';

    // Only expose the first photo
    let photoUrl = null;
    if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
      const first = listing.photos[0];
      photoUrl = typeof first === 'string' ? first : first?.url || first?.uri || null;
    }

    res.json({
      id: listing.id,
      title: listing.title,
      description: isSold ? null : (listing.description || '').slice(0, 300),
      price: listing.price,
      currency: listing.currency || 'USD',
      condition: listing.condition,
      city: listing.city,
      state: listing.state,
      status: listing.status,
      is_sold: isSold,
      photo_url: photoUrl,
      created_at: listing.created_at,
    });
  } catch (err) {
    console.error('[public/listings] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/public/posts/:id ───────────────────────────────
router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: post, error } = await supabaseAdmin
      .from('Post')
      .select('id, title, content, post_type, city, state, visibility, created_at')
      .eq('id', id)
      .single();

    if (error || !post) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Only expose publicly visible posts
    const publicVisibilities = ['public', 'neighborhood', 'city', 'global'];
    if (!publicVisibilities.includes(post.visibility)) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({
      id: post.id,
      title: post.title,
      body: (post.content || '').slice(0, 200),
      post_type: post.post_type,
      city: post.city,
      state: post.state,
      created_at: post.created_at,
    });
  } catch (err) {
    console.error('[public/posts] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/public/place — anonymous T0 "Place" preview
//
// The signed-out, one-shot demonstration of "what's true about your
// address." Returns the FULL free Band-A snapshot (Wedge v2, D1):
//   • free      — the original mini-shape native clients decode:
//                 flood (FEMA), density BUCKET (never a count), area teaser
//   • sections  — every Band-A layer as PlaceIntelligence envelopes: today
//                 (weather / air / alerts / sun), risk (flood / seismic /
//                 wildfire), health (radon / water / EPA facilities), block
//                 (density / census), money (HUD rent band), civic
//   • aha       — the one most non-obvious fact for this spot (see
//                 placePreviewService.pickAha)
// Only Band B (ATTOM exact property facts, paid) stays a *locked
// descriptor*. The account's reasons are save / claim / every morning —
// a one-shot snapshot of public data leaks none of them.
//
// Privacy (the §4 anti-leak rule):
//   • No auth.   • No ATTOM (no propertyDataService).   • No PII / exact home record.
//   • The PREVIEW persists nothing: no saved place, no per-user / per-address
//     row, NO DB writes at all — close + reopen still hits the wall.
//
// Caching (anonymous + location-keyed; the typed ADDRESS never persists):
//   • geocode → in-memory ONLY, keyed by the typed address, short TTL —
//     both the §4 anti-leak rule (no per-address trail in the database)
//     and Mapbox's "temporary result" terms forbid persisting it.
//   • flood / census teaser → facts about LAND, not about a search:
//     in-memory L1 (24 h) over the shared PlaceSectionCache L2 (90 d,
//     geohash-keyed DB rows — the same store the authed dashboard uses),
//     with the expired row served when the provider is down.
//   • density → read live (its own job refreshes it every 15 min).
// Each source degrades on its own; only positive results are cached. We call
// the stateless fetchers directly (not getProfile) so the preview neither
// writes the shared profile cache nor triggers the Walk Score dependency.
//
// Statuses: ready | partial | unsupported_region | rate_limited
//   • rate_limited is surfaced by previewLimiter as HTTP 429.
// ============================================================

// Density buckets are floored server-side from the raw verified-home count so
// the response can describe activity qualitatively without ever exposing a
// number (the §4.1 k-anon rule).
//
// This file used to carry its own thresholds ({growing:10, few:3, forming:1}),
// a THIRD implementation of the same primitive — and the loosest of the
// three, on the only UNAUTHENTICATED surface: a public `forming` meant the
// cell held exactly 1–2 verified users. It now shares the audited helper, so
// the floor is genuinely universal rather than merely claimed to be.
//
// This is strictly more conservative than before (cells of 3–9 now read
// `forming` rather than `few`), so nothing that was private became public.
// Preview-facing labels: below the floor the card is an invitation, not
// an absence (Wedge v2: the density card never shows a zero).
const DENSITY_LABELS = placePreviewService.PREVIEW_DENSITY_LABELS;

// Everything outside the free demonstration subset, described so the client
// can render the locked cards + soft-wall. `unlock` is the tier that actually
// opens the section (account = T1, claim = T3); `band` is the §9 sensitivity.
const LOCKED_SECTIONS = [
  {
    id: 'home_details', group: 'your_home', title: 'Home details & value', band: 'B', unlock: 'claim',
    reason: "Claim this address to see the home's exact record and value.",
  },
];

// Coarse US bounding boxes (continental + AK + HI + PR/USVI). The geocoder is
// already locked to country=us, so a non-US address typically returns nothing;
// this is a string-free secondary guard against a fuzzy out-of-coverage hit.
function isLikelyUS(lat, lng) {
  if (lat >= 24.5 && lat <= 49.5 && lng >= -125 && lng <= -66.9) return true; // continental
  if (lat >= 51 && lat <= 71.6 && lng >= -179.5 && lng <= -129) return true;  // Alaska
  if (lat >= 18.9 && lat <= 22.3 && lng >= -160.3 && lng <= -154.7) return true; // Hawaii
  if (lat >= 17.6 && lat <= 18.6 && lng >= -67.4 && lng <= -64.5) return true; // PR / USVI
  return false;
}

function clip(value, max = 120) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

// Dedicated in-memory cache for the preview's free facts. Isolated from the
// shared mapbox-resolve cache (utils/geoCache singleton) so neither evicts the
// other. Holds only anonymous, location-keyed public facts — nothing per-user,
// nothing on disk or in the DB.
const previewCache = new GeoCache(5000);

// Geocode is kept short to respect Mapbox's "temporary result" terms; FEMA
// flood zones and Census tract data change rarely, so they live a day. Flood is
// keyed finely (zones can vary over ~100m near water); the Census teaser is
// area-level by nature, so a coarse key is correct.
const GEO_TTL_MS = 10 * 60 * 1000;       // 10 min — Mapbox temporary results
const AREA_TTL_MS = 24 * 60 * 60 * 1000; // 24 h  — FEMA / Census are stable
const FLOOD_GEOHASH_PRECISION = 8;       // ~38m

const geoKey = (address) => `geo:${address.toLowerCase().replace(/\s+/g, ' ')}`;

// Geocode an address to a US point via services/geo (country=us). Returns a
// sanitized, area-level place identity, or a failure carrying its REASON.
//
// The reason matters. Three of the four failure branches mean "we could not
// place what you typed" and exactly one means "this is not in the United
// States" — and callers that collapse them tell a US resident, confidently,
// that the product is not for them. Every caller must branch on `reason`:
//   'unplaceable' → geocoder down, no key, no result, or nonsense coordinates
//   'outside_us'  → we placed it, and it is genuinely not in the US
async function geocodeUsAddress(address) {
  const key = geoKey(address);
  const cached = previewCache.get(key);
  if (cached) return cached;

  let result;
  try {
    result = await geo.forwardGeocode(address);
  } catch (err) {
    // No-result and infra failures both land here. For an anonymous preview we
    // degrade gracefully rather than 500 — the address simply isn't placeable.
    // Failures are NOT cached: a retry must be able to reach the geocoder again.
    console.warn('[public/place] geocode failed:', err.message);
    return { ok: false, reason: 'unplaceable' };
  }

  if (!result) return { ok: false, reason: 'unplaceable' };

  const lat = Number(result.latitude);
  const lng = Number(result.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, reason: 'unplaceable' };
  // The ONLY branch that means what "unsupported_region" says.
  if (!isLikelyUS(lat, lng)) return { ok: false, reason: 'outside_us' };

  const place = {
    ok: true,
    lat,
    lng,
    line: clip(result.address),
    city: clip(result.city),
    // The geo provider already uppercases the 2-letter US state code; don't
    // re-case it (that would turn a rare full-name fallback into "OREGON").
    state: clip(result.state, 24),
    zipcode: clip(result.zipcode, 12),
  };
  previewCache.set(key, place, GEO_TTL_MS);
  return place;
}

// Flood — FEMA zone for a point. Two cache layers, both anonymous and
// location-keyed (a fact about LAND, never about a search):
//   L1 in-memory (24 h)  → hot path, per instance
//   L2 PlaceSectionCache (90 d, DB) → shared across instances/restarts,
//      with the expired row served if FEMA is down (database-first).
// The typed ADDRESS and its geocode still never touch the database
// (§4 anti-leak + Mapbox temporary-result terms).
async function fetchFloodCached(lat, lng) {
  const gh = encodeGeohash(lat, lng, FLOOD_GEOHASH_PRECISION);
  const key = `flood:${gh}`;
  const cached = previewCache.get(key);
  if (cached) return cached;

  try {
    const { payload } = await readThrough({
      cacheKey: `geo:${gh}`,
      sectionId: '_flood_zone',
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      fetch: async () => {
        const flood = await fetchFloodZone(lat, lng);
        return flood && flood.flood_zone ? flood : null;
      },
    });
    if (payload) previewCache.set(key, payload, AREA_TTL_MS);
    return payload;
  } catch (err) {
    console.warn('[public/place] flood lookup failed:', err.message);
    return null;
  }
}

// Census tract teaser — area-level medians only (NOT an exact home record,
// NOT ATTOM). Same two-layer caching as flood; the tract resolution itself
// is persistently cached too (geocodeToTractCached — effectively permanent).
async function fetchCensusTeaserCached(lat, lng, resolveTract) {
  const key = `census:${encodeGeohash6(lat, lng)}`;
  const cached = previewCache.get(key);
  if (cached) return cached;

  try {
    const { payload } = await readThrough({
      cacheKey: `geo:${encodeGeohash6(lat, lng)}`,
      sectionId: '_census_teaser',
      ttlMs: 90 * 24 * 60 * 60 * 1000,
      fetch: async () => {
        const tract = resolveTract ? await resolveTract() : await geocodeToTractCached(lat, lng);
        if (!tract) return null;
        const { tractId, stateCode, countyCode } = tract;
        const tractCode = tractId.slice(stateCode.length + countyCode.length);
        const acs = await fetchCensusACS(stateCode, countyCode, tractCode);
        if (!acs) return null;
        const teaser = {
          median_year_built: acs.median_year_built ?? null,
          median_home_value: acs.median_home_value ?? null,
        };
        return teaser.median_year_built != null || teaser.median_home_value != null ? teaser : null;
      },
    });
    if (payload) previewCache.set(key, payload, AREA_TTL_MS);
    return payload;
  } catch (err) {
    console.warn('[public/place] census teaser failed:', err.message);
    return null;
  }
}

// ── The money lead (Wave 4) ──────────────────────────────────
//
// The anonymous preview used to open with data tiles — a flood zone
// letter, a census median, a density bucket. Zillow and Ownwell proved
// the highest-converting address ask leads with a DOLLAR figure, so this
// composes the strongest real number available for the address and the
// preview leads with it.
//
// Everything here is free and public: the NFIP tract benchmark (already
// warmed by the background job, read cache-only so the request path
// never waits on OpenFEMA) and HUD's county Fair Market Rent. No ATTOM,
// no account, no persistence — exactly the same promise the rest of the
// preview makes.
//
// Honesty rules, because a dollar figure is the most believable thing on
// a page and the easiest to overclaim:
//   * every figure states its SCOPE (a tract, a county) — never "your
//     home", which we do not know at T0;
//   * a benchmark is never called a quote or a payment;
//   * when nothing is available the preview falls back to the tiles
//     rather than inventing a number.
async function fetchMoneyLeadCached(lat, lng, resolveTract) {
  const key = `money:${encodeGeohash6(lat, lng)}`;
  const cached = previewCache.get(key);
  if (cached !== undefined) return cached;

  let lead = null;
  try {
    const tract = resolveTract ? await resolveTract() : await geocodeToTractCached(lat, lng);
    if (tract) {
      const [nfip, fmr] = await Promise.all([
        // enqueue: false — an anonymous drive-by must not take a slot in
        // the warm queue ahead of a tract someone actually lives in.
        nfipPremiumService.getTractBenchmark(tract.tractId, { enqueue: false }).catch(() => null),
        placeSectionAdapters.hudFmrRow(`${tract.stateCode}${tract.countyCode}`).catch(() => null),
      ]);

      // Flood cost first: it is the most specific to the address (a
      // census tract, not a county) and the most surprising.
      if (nfip && nfip.status === 'ready' && nfip.data && nfip.data.premium_p25 && nfip.data.premium_p75) {
        // WHOLE DOLLARS. The NFIP quantile returns a raw premium straight
        // from OpenFEMA, which carries cents — so this could be 1243.5.
        // Two reasons that must not escape: a headline reading
        // "$1,243.5 a year" is simply wrong typography, and both native
        // clients type money_lead.low/high as Int, so a fractional value
        // fails the decode and takes the ENTIRE preview down with it.
        // (The flood section's own premium fields are Double on both
        // platforms and are unaffected.)
        const low = Math.round(nfip.data.premium_p25);
        const high = Math.round(nfip.data.premium_p75);
        lead = {
          kind: 'flood_premium',
          headline: `Flood policies near here run $${low.toLocaleString('en-US')}–$${high.toLocaleString('en-US')} a year`,
          detail: `Across ${nfip.data.policy_count} real NFIP policies in this census tract. A benchmark, not a quote.`,
          low,
          high,
          scope: 'census tract',
          source: 'FEMA · OpenFEMA NFIP policies',
        };
      } else if (fmr && Array.isArray(fmr.fmr_lo) && fmr.fmr_lo[2]) {
        // Every figure in this headline has to come off the HUD row.
        //
        // HUD prices all but ~14 US counties at a SINGLE 2-bedroom number
        // (fmr_hi[2] === fmr_lo[2] in 3,209 of the 3,223 seeded rows), so
        // the old `Math.max(fmr_hi[2], lo * 1.2)` rendered an upper bound
        // HUD never published — under a bare "HUD Fair Market Rents"
        // attribution — for 99.6% of the country, and discarded HUD's
        // real high for four of the counties that do have one.
        //
        // The T1 dashboard section does extend a single figure by 20%,
        // but it says so in the same sentence. The anonymous lead has no
        // room for that clause, so it states the one number instead.
        const lo = Math.round(fmr.fmr_lo[2]);
        const publishedHi = Math.round(Number(fmr.fmr_hi && fmr.fmr_hi[2]) || 0);
        const hasRange = publishedHi > lo;
        const hi = hasRange ? publishedHi : lo;
        lead = {
          kind: 'rent_band',
          headline: hasRange
            ? `A 2-bedroom here rents for about $${lo.toLocaleString('en-US')}–$${hi.toLocaleString('en-US')} a month`
            : `HUD prices a 2-bedroom here at about $${lo.toLocaleString('en-US')} a month`,
          detail: `HUD's FY ${fmr.fiscal_year} fair market rent for ${fmr.county_name}. A county-wide estimate, not this home.`,
          low: lo,
          high: hi,
          scope: 'county',
          source: 'HUD Fair Market Rents',
        };
      }
    }
  } catch (err) {
    console.warn('[public/place] money lead failed:', err.message);
  }
  // Cached even when null, so a tract with no benchmark yet does not
  // re-run the lookup on every anonymous view.
  previewCache.set(key, lead, AREA_TTL_MS);
  return lead;
}

// Read the verified-homes count for the area and return ONLY its bucket.
// A read, never a write. Any failure degrades to 'none'.
async function readDensityBucket(geohash) {
  try {
    const { data, error } = await supabaseAdmin
      .from('NeighborhoodPreview')
      .select('verified_users_count')
      .eq('geohash', geohash)
      .maybeSingle();
    if (error) {
      console.warn('[public/place] density read error:', error.message);
      return 'none';
    }
    return bucketForCount(data?.verified_users_count ?? 0);
  } catch (err) {
    console.warn('[public/place] density read exception:', err.message);
    return 'none';
  }
}

router.get('/place', async (req, res) => {
  try {
    // Same reason as /unlisted: a 200 with an ETag and no Cache-Control is
    // storable, and the cache key is the full URL — which on this route
    // carries the address someone typed, into their own disk cache.
    res.set('Cache-Control', 'no-store');

    const rawAddress = typeof req.query.address === 'string' ? req.query.address.trim() : '';
    if (!rawAddress) {
      return res.status(400).json({ error: 'An address query parameter is required.' });
    }
    if (rawAddress.length > 200) {
      return res.status(400).json({ error: 'That address is too long.' });
    }

    // 1. Geocode (services/geo, US-only).
    //
    // BRANCH ON THE REASON. `geocodeUsAddress` fails four ways and only
    // one of them means "not in the United States" — the contract this
    // file documents at the helper itself. /api/public/unlisted and
    // /api/scout were both split; this route, the highest-traffic
    // anonymous surface in the product, was left collapsing them, so a
    // geocoder outage still tells every US visitor at once that the
    // product is not for them.
    const place = await geocodeUsAddress(rawAddress);
    if (!place.ok) {
      const unplaceable = place.reason !== 'outside_us';
      return res.json({
        status: unplaceable ? 'could_not_place' : 'unsupported_region',
        tier: 'preview',
        region: unplaceable ? null : null,
        message: unplaceable
          ? 'We could not find that address — try adding the city and state'
          : 'Home features are U.S.-only for now',
      });
    }

    const geohash = encodeGeohash6(place.lat, place.lng);

    // 2. The free Band-A snapshot. Flood, the Census teaser, the density
    //    bucket and the money lead are fetched here; the remaining layers
    //    come from placePreviewService. Each degrades on its own, none
    //    persists the preview (caches are location-keyed), none touches ATTOM.
    // ONE tract resolution, shared, lazy. The census teaser and the money
    // lead both need it, and letting each resolve its own doubled the
    // Census geocoder traffic on every anonymous view.
    //
    // Shared as a THUNK rather than an awaited value, for two reasons the
    // first version got wrong: awaiting it up front serialized a round
    // trip ahead of the parallel fan-out below (~300 ms on a cold cell,
    // paid even when both consumers were about to hit their in-memory
    // caches), and passing the resolved value made `null` — "we tried and
    // could not place it" — indistinguishable from "no hint supplied", so
    // both consumers re-resolved and a failing geocoder was hit three
    // times per request instead of once.
    let tractPromise = null;
    const resolveTract = () => {
      if (!tractPromise) tractPromise = geocodeToTractCached(place.lat, place.lng).catch(() => null);
      return tractPromise;
    };

    const [floodSettled, areaSettled, bucketSettled, moneySettled, remoteSettled, foundingSettled] = await Promise.allSettled([
      fetchFloodCached(place.lat, place.lng),
      fetchCensusTeaserCached(place.lat, place.lng, resolveTract),
      readDensityBucket(geohash),
      fetchMoneyLeadCached(place.lat, place.lng, resolveTract),
      // The rest of Band A (today / seismic / wildfire / health / rent /
      // civic), each on its own time budget — a slow provider degrades
      // only its own section (placePreviewService).
      placePreviewService.composePreviewSections({
        lat: place.lat, lng: place.lng, city: place.city, state: place.state, resolveTract,
      }),
      // Are Founding Neighbor slots genuinely open in this cell? A boolean,
      // never a count — it only chooses the density card's invitation line.
      foundingSlotsOpen(geohash),
    ]);

    const flood = floodSettled.status === 'fulfilled' ? floodSettled.value : null;
    const area = areaSettled.status === 'fulfilled' ? areaSettled.value : null;
    const bucket = bucketSettled.status === 'fulfilled' ? bucketSettled.value : 'none';
    const money = moneySettled.status === 'fulfilled' ? moneySettled.value : null;
    const remote = remoteSettled.status === 'fulfilled' ? remoteSettled.value : [];
    const foundingOpen = foundingSettled.status === 'fulfilled' ? Boolean(foundingSettled.value) : true;

    const sections = placePreviewService.assemblePreviewSections({ remote, flood, area, bucket, foundingOpen });
    const aha = placePreviewService.pickAha(sections);

    const floodSection = flood && flood.flood_zone
      ? {
          status: 'ready',
          zone: flood.flood_zone,
          description: flood.flood_zone_description || null,
          source: 'FEMA National Flood Hazard Layer',
        }
      : { status: 'unavailable', source: 'FEMA National Flood Hazard Layer' };

    const areaSection = area && (area.median_year_built != null || area.median_home_value != null)
      ? {
          status: 'ready',
          median_year_built: area.median_year_built,
          median_home_value: area.median_home_value,
          note: 'Area-level, not your home',
          source: 'U.S. Census · American Community Survey',
        }
      : {
          status: 'unavailable',
          note: 'Area-level, not your home',
          source: 'U.S. Census · American Community Survey',
        };

    // Density always resolves (a bucket, even 'none'); it never gates ready.
    const densitySection = {
      status: 'ready',
      bucket,                       // enum only — NEVER a count
      label: placePreviewService.previewDensityLabel(bucket, foundingOpen),
      source: 'Pantopus verified neighbors',
    };

    const ready = floodSection.status === 'ready' && areaSection.status === 'ready';

    return res.json({
      status: ready ? 'ready' : 'partial',
      tier: 'preview',
      region: 'US',
      place: {
        address: place.line,
        city: place.city,
        state: place.state,
        zipcode: place.zipcode,
      },
      // The lead: a dollar figure when one is genuinely available for
      // this address, else null and the tiles carry the page as before.
      money_lead: money,
      free: {
        flood: floodSection,
        density: densitySection,
        area: areaSection,
      },
      aha,
      sections,
      locked: LOCKED_SECTIONS,
      disclaimer: 'A free, one-time look at what\'s public. Claim this address to save it and get it every morning.',
    });
  } catch (err) {
    console.error('[public/place] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// ── GET /api/public/unlisted?address=… (Wave 4) ─────────────
//
// "Type your address to get it off the internet", for someone with no
// account. The inversion that makes it convert: you hand over an address
// in order to make it LESS visible.
//
// It persists NOTHING, and — unlike every other route in this file — it
// sends NOTHING. The address is resolved to a state locally, by
// `utils/usState`, because the panel above the input on the web page
// tells the reader "we do not send it anywhere else" and that has to be
// literally true. It used to geocode through Mapbox, which put the typed
// address into a third-party query string on a page whose readers are
// disproportionately hiding from a specific person.
//
// Dropping the geocode also removes the timing side-channel the shared
// preview cache created (a repeat lookup of the same string returned in
// ~2 ms instead of ~200 ms, which let anyone probe whether an address
// had recently been looked up).
//
// The answer is identical for everyone in a state, so a state is all it
// ever needed. Looking someone up on a people-search site would disclose
// their address to the exact company they are trying to leave, so we do
// not do that either, and the payload says so in `method_note`.
router.get('/unlisted', async (req, res) => {
  try {
    // NOT CACHEABLE — this is about the reader's own disk, not ours.
    //
    // Express sends a 200 JSON body with an ETag and no Cache-Control,
    // which is storable, so the browser disk cache (and OkHttp's Cache,
    // and iOS's URLCache) writes an entry KEYED ON THE FULL URL — which
    // on this route contains the address someone typed. "We do not save
    // this address" is then false in the one place that matters most for
    // a reader whose threat model is a person with physical access to
    // their device.
    //
    // Nothing is lost: the URL is per-address while the answer is
    // per-state, so the hit rate was already ~0. The real fix is moving
    // this to POST with the address in the body, which also takes it out
    // of the edge access log this header cannot reach — that is a
    // three-client change and belongs in its own wave.
    res.set('Cache-Control', 'no-store');

    const rawAddress = typeof req.query.address === 'string' ? req.query.address.trim() : '';
    if (!rawAddress) {
      return res.status(400).json({ error: 'An address query parameter is required.' });
    }
    if (rawAddress.length > 200) {
      return res.status(400).json({ error: 'That address is too long.' });
    }

    const state = resolveUsState(rawAddress);

    // "We could not place that" and "you are not in the United States"
    // are DIFFERENT ANSWERS and must never be collapsed. The old handler
    // returned the geographic denial for every failure, so an address
    // the geocoder simply could not parse told someone standing in
    // Portland that the product had nothing for them.
    //
    // Everything except the state program is national, and none of it
    // needed the address at all — so an unresolved state still gets the
    // whole verified removal list, with `state_program: null`, which the
    // clients already render as "we have not confirmed one for your
    // state" rather than "your state has none".
    //
    // A genuinely non-US address also lands here now, since the local
    // resolver has no opinion about London. That is the right trade:
    // showing a US removal list to someone abroad wastes their time,
    // whereas the old behaviour told someone standing in Portland the
    // product was not for them. The client copy carries the US scope so
    // the non-US reader is not misled either.
    if (!state) {
      return res.json({
        status: 'could_not_place',
        tier: 'preview',
        message: 'We could not tell which state that is',
        place: { city: null, state: null },
        unlisted: unlistedService.getExposureProfile(null),
        disclaimer: 'We did not save this address. Add the state — "Portland, OR" — and the state program appears too.',
      });
    }

    const profile = unlistedService.getExposureProfile(state);
    return res.json({
      status: 'ready',
      tier: 'preview',
      // No city: resolving one would mean a third-party lookup, and the
      // page promises there isn't one.
      place: { city: null, state },
      unlisted: profile,
      disclaimer: 'We did not save this address. Claim it to keep track of which removals you have sent.',
    });
  } catch (err) {
    console.error('[public/unlisted] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/residency-letters/:code — third-party letter check
//
// Anyone holding a residency letter can confirm it is genuine and not
// revoked. Returns exactly what is printed on the paper — never more.
// The mount-level previewLimiter (60/min/IP) plus the ~78-bit letter
// code keep enumeration impractical. Unknown/malformed codes are a
// uniform { valid: false } (no existence oracle).
// ============================================================
router.get('/residency-letters/:code', async (req, res) => {
  try {
    const residencyLetterService = require('../services/residencyLetterService');
    const result = await residencyLetterService.verifyByCode(req.params.code);
    return res.json(result);
  } catch (err) {
    console.error('[public/residency-letters] Error:', err.message);
    return res.status(500).json({ error: 'Verification failed. Try again.' });
  }
});

// ── POST /api/public/funnel-events ──────────────────────────
// Client-side funnel beacons for the anonymous stretch of the wedge
// ladder. Whitelisted event types only (server-owned events like
// t1_account_created are recorded by their own routes and cannot be
// spoofed here). Rides the /api/public previewLimiter. Always 204 —
// a beacon must never surface an error to the funnel UI.
router.post('/funnel-events', express.json({ limit: '2kb' }), (req, res) => {
  const eventType = typeof req.body?.event_type === 'string' ? req.body.event_type : '';
  if (CLIENT_POSTABLE_EVENT_TYPES.includes(eventType)) {
    recordFunnelEvent(eventType, {
      anonId: typeof req.body?.anon_id === 'string' ? req.body.anon_id : null,
      meta:
        req.body?.meta && typeof req.body.meta === 'object' && !Array.isArray(req.body.meta)
          ? req.body.meta
          : {},
    });
  }
  return res.status(204).end();
});

// ============================================================
// GET /api/public/residency-claims/:code — third-party claim check
//
// The claim sibling of the letter check above, with two differences:
// the status is LIVE (active only while the claim is unrevoked,
// unexpired, and the issuer still holds verified occupancy), and every
// view is logged for the issuer's audit trail. Same protections: the
// mount-level previewLimiter plus the ~78-bit code keep enumeration
// impractical, and unknown/malformed codes are a uniform
// { valid: false } (no existence oracle).
// ============================================================
router.get('/residency-claims/:code', async (req, res) => {
  try {
    const residencyClaimService = require('../services/residencyClaimService');
    const result = await residencyClaimService.verifyClaimByCode(req.params.code, {
      userAgent: req.headers['user-agent'],
    });
    return res.json(result);
  } catch (err) {
    console.error('[public/residency-claims] Error:', err.message);
    return res.status(500).json({ error: 'Verification failed. Try again.' });
  }
});

// ============================================================
// GET /api/public/fridge-cards/:code — the household's 911-ready card
//
// Whoever holds the link (babysitter, house-sitter, the QR by the
// door) sees the frozen card while it is active. A revoked card shows
// its status and NO content — this is health-adjacent data, so
// revocation actually pulls it. Same protections as the other code
// surfaces: previewLimiter + ~78-bit codes, uniform { valid: false }
// on unknown codes.
// ============================================================
router.get('/fridge-cards/:code', async (req, res) => {
  try {
    const fridgeCardService = require('../services/fridgeCardService');
    const result = await fridgeCardService.getCardByCode(req.params.code);
    return res.json(result);
  } catch (err) {
    console.error('[public/fridge-cards] Error:', err.message);
    return res.status(500).json({ error: 'Could not load the card. Try again.' });
  }
});

// ============================================================
// POST /api/public/block-invites/opt-out/:code — the recipient's
// permanent kill switch for Block Founders postcard invites, printed
// on every card. Idempotent; unknown codes return a uniform
// { done: false } (no oracle). POST — the web page confirms with a
// button, so a link prefetcher can never opt someone out.
// ============================================================
router.post('/block-invites/opt-out/:code', async (req, res) => {
  try {
    const blockFoundersService = require('../services/blockFoundersService');
    const result = await blockFoundersService.redeemOptOut(req.params.code);
    return res.json(result);
  } catch (err) {
    console.error('[public/block-invites] Error:', err.message);
    return res.status(500).json({ error: 'Could not process the request. Try again.' });
  }
});

module.exports = router;
// Shared with Scout (routes/scout.js): one geocoder, one cache, one set of
// US-bounds rules. A second copy would drift and double the Mapbox spend.
module.exports.geocodeUsAddress = geocodeUsAddress;
// Test-only hook: reset the in-memory preview caches between cases.
module.exports.__clearPreviewCaches = () => previewCache.clear();
