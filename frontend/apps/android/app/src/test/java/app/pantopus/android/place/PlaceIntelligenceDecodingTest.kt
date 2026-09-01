package app.pantopus.android.place

import app.pantopus.android.data.api.models.geo.GeoAutocompleteResponse
import app.pantopus.android.data.api.models.place.GoodDayVerdict
import app.pantopus.android.data.api.models.place.NeighborMessageTemplates
import app.pantopus.android.data.api.models.place.NeighborhoodPulse
import app.pantopus.android.data.api.models.place.PlaceBand
import app.pantopus.android.data.api.models.place.PlaceCoverage
import app.pantopus.android.data.api.models.place.PlaceDensityBucket
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceGroup
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlacePreviewSectionStatus
import app.pantopus.android.data.api.models.place.PlacePreviewStatus
import app.pantopus.android.data.api.models.place.PlacePreviewUnlock
import app.pantopus.android.data.api.models.place.PlaceSectionAccess
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.data.api.models.place.PlaceTier
import app.pantopus.android.data.api.models.place.ResidencyLetterResponse
import app.pantopus.android.data.api.models.place.ResidencyLetterStatus
import app.pantopus.android.data.api.models.place.ResidencyLetterVerification
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Contract tests for the Place Intelligence DTOs against REAL captured
 * backend responses (`src/test/resources/place/[*].json`, captured
 * 2026-06-12 from the dev backend — test home `4008 Northeast Tacoma
 * Court, Camas` at T3). The drift alarm for the section-envelope
 * contract: production decoding degrades gracefully, these fail loudly.
 *
 * Parity: mirrors iOS `PlaceIntelligenceDecodingTests.swift`.
 */
class PlaceIntelligenceDecodingTest {
    // Mirrors NetworkModule.provideMoshi() — the Place-relevant parts.
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private fun fixture(name: String): String =
        checkNotNull(javaClass.classLoader?.getResource("place/$name")) {
            "missing fixture place/$name"
        }.readText()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json)) { "decoded null" }

    // ── The three sections added after the launch set ────────
    // good_day_to / heat_cold / home_systems all decoded to UNKNOWN (and
    // therefore rendered nothing) until the DTOs, the section-id enum and
    // the envelope adapter learned them. These pin that they decode.

    @Test
    fun `decodes good_day_to tiles`() {
        val json =
            """
            {"place":{"label":"x","line1":"x","city":"x","state":"OR","postal_code":"97214"},
             "tier":"T3","region_supported":true,"generated_at":"2026-06-07T09:00:00Z",
             "groups":[{"group":"today","label":"Today","sections":[
               {"id":"good_day_to","group":"today","band":"A","access":"available","status":"ready",
                "as_of":null,"source":"Pantopus","coverage":"full","unavailable_reason":null,
                "data":{"tiles":[
                  {"id":"open_windows","label":"Open windows","glyph":"W","verdict":"yes",
                   "answer":"Yes - until 5pm","because":"AQI 38 and 62-68F through 5pm."},
                  {"id":"wash_car","label":"Wash the car","glyph":"C","verdict":"no",
                   "answer":"Wait - rain Tuesday","because":"60% chance of rain Tuesday."}]}}]}]}
            """.trimIndent()

        val env = decode<PlaceIntelligence>(json).groups.first().sections.first()
        assertEquals(PlaceSectionId.GOOD_DAY_TO, env.sectionId)
        val d = assertNotNull(env.goodDayTo).let { env.goodDayTo!! }
        assertEquals(2, d.tiles.size)
        assertEquals(GoodDayVerdict.YES, d.tiles[0].verdict)
        assertEquals(GoodDayVerdict.NO, d.tiles[1].verdict)
        // The reasoning always ships — an opinionated tile must show its work.
        assertTrue(d.tiles[0].because.contains("AQI 38"))
    }

    @Test
    fun `decodes heat_cold with the 7-day strip`() {
        val json =
            """
            {"place":{"label":"x","line1":"x","city":"x","state":"AZ","postal_code":"85001"},
             "tier":"T3","region_supported":true,"generated_at":"2026-08-19T09:00:00Z",
             "groups":[{"group":"risk_readiness","label":"Risk & readiness","sections":[
               {"id":"heat_cold","group":"risk_readiness","band":"A","access":"available","status":"ready",
                "as_of":null,"source":"NWS HeatRisk","coverage":"full","unavailable_reason":null,
                "data":{"mode":"heat","heat_covered":true,"peak_level":3,"peak_date":"2026-08-19",
                        "freeze":null,"headline":"Major heat risk, today through Friday.",
                        "guidance":"Overnight lows near 79F.","source_note":"NWS HeatRisk (experimental)",
                        "heat_days":[{"date":"2026-08-19","day":1,"level":3,"label":"Major","meaning":"m"}]}}]}]}
            """.trimIndent()

        val env = decode<PlaceIntelligence>(json).groups.first().sections.first()
        assertEquals(PlaceSectionId.HEAT_COLD, env.sectionId)
        val d = env.heatCold!!
        assertEquals("heat", d.mode)
        assertTrue(d.heatCovered)
        assertEquals(3, d.peakLevel)
        assertEquals(1, d.heatDays.size)
        assertEquals("Major", d.heatDays[0].label)
    }

    @Test
    fun `decodes heat_cold coverage gap outside CONUS`() {
        // covered=false is a GAP, not a reading of zero — the card must not
        // imply calm where HeatRisk simply has no data.
        val json =
            """
            {"place":{"label":"x","line1":"x","city":"Honolulu","state":"HI","postal_code":"96813"},
             "tier":"T3","region_supported":true,"generated_at":"2026-08-19T09:00:00Z",
             "groups":[{"group":"risk_readiness","label":"Risk & readiness","sections":[
               {"id":"heat_cold","group":"risk_readiness","band":"A","access":"available","status":"ready",
                "as_of":null,"source":"NWS","coverage":"partial",
                "unavailable_reason":"NWS HeatRisk covers the contiguous US.",
                "data":{"mode":"none","heat_covered":false,"peak_level":null,"peak_date":null,
                        "freeze":null,"headline":"No freeze in the forecast.","guidance":"",
                        "source_note":"National Weather Service forecast","heat_days":[]}}]}]}
            """.trimIndent()

        val d = decode<PlaceIntelligence>(json).groups.first().sections.first().heatCold!!
        assertFalse(d.heatCovered)
        assertTrue(d.heatDays.isEmpty())
        assertNull(d.peakLevel)
    }

    @Test
    fun `decodes home_systems with provenance on every row`() {
        val json =
            """
            {"place":{"label":"x","line1":"x","city":"x","state":"OR","postal_code":"97214"},
             "tier":"T3","region_supported":true,"generated_at":"2026-08-19T09:00:00Z",
             "groups":[{"group":"your_home","label":"Your home","sections":[
               {"id":"home_systems","group":"your_home","band":"C","access":"available","status":"ready",
                "as_of":null,"source":"Your household record","coverage":"full","unavailable_reason":null,
                "data":{"summary":{"past_expected_count":1,"aging_count":1,"confirmed_count":1,
                                   "total_count":6,"headline":"Past typical service life: windows."},
                        "systems":[
                          {"key":"water_heater","label":"Water heater","installed_year":2022,"age_years":4,
                           "typical_life_low":8,"typical_life_high":12,"status":"ok","life_remaining":0.67,
                           "source":"resident","source_label":"You told us","confidence":"high",
                           "source_ref":null,"note":"n"},
                          {"key":"windows","label":"Windows","installed_year":1979,"age_years":47,
                           "typical_life_low":20,"typical_life_high":30,"status":"past_expected",
                           "life_remaining":0.0,"source":"estimated",
                           "source_label":"Estimated from year built","confidence":"low",
                           "source_ref":null,"note":"n"}]}}]}]}
            """.trimIndent()

        val env = decode<PlaceIntelligence>(json).groups.first().sections.first()
        assertEquals(PlaceSectionId.HOME_SYSTEMS, env.sectionId)
        // Band C — the household's own record, gated by the trust ladder.
        assertEquals(PlaceBand.C, env.band)
        val d = env.homeSystems!!
        assertEquals(2, d.systems.size)
        assertEquals("You told us", d.systems[0].sourceLabel)
        assertEquals("high", d.systems[0].confidence)
        // An estimate is never dressed up as a fact.
        assertEquals("estimated", d.systems[1].source)
        assertEquals("low", d.systems[1].confidence)
        assertEquals(1, d.summary.pastExpectedCount)
    }

    // ── Full dashboard payload (captured, T3) ────────────────

    @Test
    fun `decodes full intelligence payload`() {
        val intelligence = decode<PlaceIntelligence>(fixture("intelligence-full.json"))

        assertEquals(PlaceTier.T3, intelligence.tier)
        assertTrue(intelligence.regionSupported)
        assertEquals("4008 Northeast Tacoma Court", intelligence.place.line1)
        assertEquals("Camas", intelligence.place.city)
        assertEquals("98607", intelligence.place.postalCode)

        // T3 payload carries 7 groups (identity is T4) and all 18 sections.
        assertEquals(7, intelligence.groups.size)
        val sections = intelligence.groups.flatMap { it.sections }
        // NOTE: this fixture is a 2026-06-12 capture, taken BEFORE
        // good_day_to / heat_cold / home_systems were added, so it carries
        // 18 of the 21 contract sections. The count is asserted against the
        // fixture's own group totals rather than a magic number, so it
        // cannot silently drift; the three newer sections are covered by
        // PlaceIntelligenceDecodingTest's dedicated cases above (inline
        // payloads) until the fixture is re-captured from a live T3 response.
        assertEquals(intelligence.groups.sumOf { it.sections.size }, sections.size)
        assertEquals(18, sections.size)

        assertEquals(PlaceGroup.TODAY, intelligence.groups.first().groupId)
        assertEquals("Today", intelligence.groups.first().label)
    }

    @Test
    fun `decodes ready section payloads`() {
        val intelligence = decode<PlaceIntelligence>(fixture("intelligence-full.json"))
        val sections = intelligence.groups.flatMap { it.sections }

        // Weather — live NOAA data.
        val weather = sections.first { it.sectionId == PlaceSectionId.WEATHER }
        assertEquals(PlaceSectionStatus.READY, weather.status)
        assertEquals(PlaceSectionAccess.AVAILABLE, weather.access)
        assertEquals(PlaceBand.A, weather.band)
        val weatherData = checkNotNull(weather.weather)
        assertTrue(weatherData.conditionLabel.isNotEmpty())
        assertNotEquals(WeatherConditionCode.UNKNOWN, weatherData.conditionCode)

        // Flood — FEMA zone with plain-language meaning.
        val floodData = checkNotNull(sections.first { it.sectionId == PlaceSectionId.FLOOD }.flood)
        assertEquals("X", floodData.zone)
        assertFalse(floodData.inSfha)

        // Your home — Band B property record.
        val yourHome = sections.first { it.sectionId == PlaceSectionId.YOUR_HOME }
        assertEquals(PlaceBand.B, yourHome.band)
        assertNotNull(yourHome.yourHome)

        // Block density — bucket + label only, never a count.
        val densityData =
            checkNotNull(sections.first { it.sectionId == PlaceSectionId.BLOCK_DENSITY }.blockDensity)
        assertNotEquals(PlaceDensityBucket.UNKNOWN, densityData.bucket)
        assertTrue(densityData.label.isNotEmpty())

        // Civic districts — the elected ladder.
        val districts =
            checkNotNull(sections.first { it.sectionId == PlaceSectionId.CIVIC_DISTRICTS }.civicDistricts)
        assertTrue(districts.districts.isNotEmpty())
    }

    @Test
    fun `unavailable sections carry null data and optional reason`() {
        val intelligence = decode<PlaceIntelligence>(fixture("intelligence-full.json"))
        val sections = intelligence.groups.flatMap { it.sections }

        val unavailable = sections.filter { it.status == PlaceSectionStatus.UNAVAILABLE }
        assertTrue(unavailable.isNotEmpty())
        unavailable.forEach { section ->
            assertNull("${section.id} should carry null data when unavailable", section.data)
        }

        val rentBand = sections.first { it.sectionId == PlaceSectionId.RENT_BAND }
        assertEquals("No HUD rent data for your county yet.", rentBand.unavailableReason)
    }

    // ── ?sections= subset (captured) ─────────────────────────

    @Test
    fun `decodes sections subset payload`() {
        val intelligence = decode<PlaceIntelligence>(fixture("intelligence-subset.json"))
        val ids = intelligence.groups.flatMap { it.sections }.map { it.sectionId }
        assertEquals(
            listOf(PlaceSectionId.WEATHER, PlaceSectionId.FLOOD, PlaceSectionId.CIVIC_DISTRICTS),
            ids,
        )
    }

    // ── Anonymous T0 preview (captured) ──────────────────────

    @Test
    fun `decodes public preview payload`() {
        val preview = decode<PlacePreview>(fixture("public-place-preview.json"))

        assertEquals(PlacePreviewStatus.PARTIAL, preview.status)
        assertEquals("preview", preview.tier)
        assertEquals("US", preview.region)
        assertEquals("Camas", preview.place?.city)

        val free = checkNotNull(preview.free)
        assertEquals(PlacePreviewSectionStatus.READY, free.flood.status)
        assertEquals("X", free.flood.zone)
        assertEquals(PlaceDensityBucket.NONE, free.density.bucket)
        assertEquals(PlacePreviewSectionStatus.UNAVAILABLE, free.area.status)

        val locked = checkNotNull(preview.locked)
        assertTrue(locked.isNotEmpty())
        locked.forEach { section ->
            assertNotEquals(
                "${section.id} unlock should be account|claim",
                PlacePreviewUnlock.UNKNOWN,
                section.unlock,
            )
            assertTrue(section.title.isNotEmpty())
        }
    }

    // ── Neighbor message templates (captured) ────────────────

    @Test
    fun `decodes neighbor message templates`() {
        val catalog = decode<NeighborMessageTemplates>(fixture("neighbor-templates.json"))
        assertTrue(catalog.templates.isNotEmpty())
        assertTrue(catalog.replies.isNotEmpty())
        val noise = catalog.templates.first { it.id == "noise" }
        assertEquals("Late-night noise", noise.category)
        assertTrue(noise.body.isNotEmpty())
    }

    // ── Residency letter public verify (captured) ────────────

    @Test
    fun `decodes unknown residency verification`() {
        val verification =
            decode<ResidencyLetterVerification>(fixture("residency-verify-unknown.json"))
        assertFalse(verification.valid)
        assertNull(verification.status)
    }

    // ── Geo autocomplete (captured — note the lng-lat center) ─

    @Test
    fun `decodes geo autocomplete suggestions`() {
        val response = decode<GeoAutocompleteResponse>(fixture("geo-autocomplete.json"))
        val first = response.suggestions.first()
        assertEquals("4008 Northeast Tacoma Court", first.primaryText)
        // GeoJSON order on the wire: [longitude, latitude].
        assertEquals(-122.388947, checkNotNull(first.longitude), 0.0001)
        assertEquals(45.608302, checkNotNull(first.latitude), 0.0001)
    }

    // ── Forward-compatibility (hand-authored) ────────────────

    @Test
    fun `unknown section id survives with null data`() {
        val json = """
        {
          "id": "quantum_risk",
          "group": "some_future_group",
          "band": "A",
          "access": "available",
          "status": "ready",
          "as_of": null,
          "source": "Future Provider",
          "coverage": "full",
          "unavailable_reason": null,
          "data": { "anything": [1, 2, 3] }
        }
        """
        val envelope = decode<PlaceSectionEnvelope>(json)
        assertEquals(PlaceSectionId.UNKNOWN, envelope.sectionId)
        assertEquals("quantum_risk", envelope.id)
        assertEquals(PlaceGroup.UNKNOWN, envelope.groupId)
        assertNull(envelope.data)
    }

    @Test
    fun `unknown enum vocabulary degrades gracefully`() {
        val json = """
        {
          "id": "weather",
          "group": "today",
          "band": "A",
          "access": "available",
          "status": "hyperfresh",
          "as_of": "2026-06-12T00:00:00Z",
          "source": "NWS",
          "coverage": "galactic",
          "unavailable_reason": null,
          "data": {
            "current_temp_f": 62,
            "condition_code": "plasma_storm",
            "condition_label": "Plasma storm",
            "feels_like_f": null,
            "high_f": 70,
            "low_f": 50,
            "hourly": [],
            "daily": []
          }
        }
        """
        val envelope = decode<PlaceSectionEnvelope>(json)
        // Unknown status → quiet degraded state, unknown coverage → partial.
        assertEquals(PlaceSectionStatus.UNAVAILABLE, envelope.status)
        assertEquals(PlaceCoverage.PARTIAL, envelope.coverage)
        // Unknown condition vocabulary keeps the server label renderable.
        val weather = checkNotNull(envelope.weather)
        assertEquals(WeatherConditionCode.UNKNOWN, weather.conditionCode)
        assertEquals("Plasma storm", weather.conditionLabel)
    }

    @Test
    fun `malformed section payload degrades that section only`() {
        val json = """
        {
          "id": "flood",
          "group": "risk_readiness",
          "band": "A",
          "access": "available",
          "status": "ready",
          "as_of": null,
          "source": "FEMA",
          "coverage": "full",
          "unavailable_reason": null,
          "data": { "zone": 12345 }
        }
        """
        val envelope = decode<PlaceSectionEnvelope>(json)
        assertEquals(PlaceSectionId.FLOOD, envelope.sectionId)
        assertEquals(PlaceSectionStatus.READY, envelope.status)
        assertNull("malformed payload should degrade to null data, not throw", envelope.data)
    }

    @Test
    fun `locked section decodes with null data`() {
        val json = """
        {
          "id": "your_home",
          "group": "your_home",
          "band": "B",
          "access": "locked",
          "status": "ready",
          "as_of": null,
          "source": null,
          "coverage": "full",
          "unavailable_reason": "Claim this home to unlock property facts.",
          "data": null
        }
        """
        val envelope = decode<PlaceSectionEnvelope>(json)
        assertEquals(PlaceSectionAccess.LOCKED, envelope.access)
        assertNull(envelope.data)
        assertEquals("Claim this home to unlock property facts.", envelope.unavailableReason)
    }

    // ── Residency letter issuer shape (hand-authored from
    // `backend/services/residencyLetterService.js:185` serializeLetter) ─

    @Test
    fun `decodes residency letter envelope`() {
        val json = """
        {
          "letter": {
            "id": "ltr_1",
            "home_id": "home_1",
            "status": "issued",
            "purpose": "New library card application",
            "resident_name": "Alice Doe",
            "address": { "line1": "4008 Northeast Tacoma Court", "city": "Camas", "state": "WA", "zipcode": "98607" },
            "letter_code": "ABCD-EFGH-JKLM-NPQR",
            "verify_url": "https://pantopus.com/verify-residency/ABCD-EFGH-JKLM-NPQR",
            "issued_at": "2026-06-12T00:00:00Z",
            "revoked_at": null,
            "pdf_sha256": "deadbeef"
          }
        }
        """
        val response = decode<ResidencyLetterResponse>(json)
        assertEquals(ResidencyLetterStatus.ISSUED, response.letter.status)
        assertEquals("ABCD-EFGH-JKLM-NPQR", response.letter.letterCode)
        assertEquals("4008 Northeast Tacoma Court", response.letter.address.line1)
    }

    // ── Pulse envelope (hand-authored from `frontend/packages/types/
    // src/ai.ts` NeighborhoodPulse; live capture pending a home with the
    // `home.view` grant — see Phase 4) ───────────────────────

    @Test
    fun `decodes neighborhood pulse`() {
        val json = """
        {
          "pulse": {
            "greeting": "Good morning",
            "summary": "All quiet on your block.",
            "overall_status": "quiet",
            "property": { "year_built": 1979, "sqft": 1840, "estimated_value": 612000, "zip_median_value": 498000, "property_type": "house" },
            "neighborhood": null,
            "signals": [
              {
                "signal_type": "air_quality",
                "priority": 80,
                "title": "Air quality is good",
                "detail": "AQI 38 — a great day to be outside.",
                "icon": "wind",
                "color": "green",
                "actions": [ { "type": "view", "label": "See details", "route": "/place/today" } ]
              }
            ],
            "seasonal_context": { "season": "summer", "tip": null, "first_action_nudge": null },
            "community_density": { "neighbor_count": 0, "density_message": "Be the first on your block", "invite_cta": true },
            "sources": [ { "provider": "AirNow", "updated_at": "2026-06-12T00:00:00Z" } ],
            "meta": { "community_signals_count": 0, "external_signals_count": 1, "partial_failures": [], "computed_at": "2026-06-12T00:00:00Z" }
          }
        }
        """
        val pulse = decode<NeighborhoodPulse>(json)
        assertEquals("quiet", pulse.pulse.overallStatus)
        assertEquals("air_quality", pulse.pulse.signals.first().signalType)
        assertEquals("See details", pulse.pulse.signals.first().actions?.first()?.label)
    }
}
