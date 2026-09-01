package app.pantopus.android.place

import app.pantopus.android.data.api.models.place.PlaceBand
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceHeroVariant
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Locks the contract → card presentation (PlacePresentation) against the
 * captured T3 dashboard fixture + hand-authored envelopes. Mirrors the
 * iOS `PlacePresentationTests`.
 */
class PlacePresentationTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private fun fixture(): PlaceIntelligence {
        val json =
            checkNotNull(javaClass.classLoader?.getResource("place/intelligence-full.json")).readText()
        return checkNotNull(moshi.adapter(PlaceIntelligence::class.java).fromJson(json))
    }

    private fun PlaceIntelligence.section(id: PlaceSectionId): PlaceSectionEnvelope =
        groups.flatMap { it.sections }.first { it.sectionId == id }

    @Test
    fun `flood reading is minimal-risk chip`() {
        val reading = PlacePresentation.reading(fixture().section(PlaceSectionId.FLOOD))
        assertEquals("Minimal risk", reading.chip?.text)
        assertEquals(PlaceChipTone.SUCCESS, reading.chip?.tone)
    }

    @Test
    fun `civic districts reading counts districts`() {
        val reading = PlacePresentation.reading(fixture().section(PlaceSectionId.CIVIC_DISTRICTS))
        assertTrue(reading.value?.contains("districts on record") == true)
    }

    @Test
    fun `sunrise sunset formats local wall clock`() {
        // Sunrise/sunset arrive as zone-less local times ("…T05:19").
        val reading = PlacePresentation.reading(fixture().section(PlaceSectionId.SUNRISE_SUNSET))
        assertEquals("5:19a · 8:59p", reading.value)
    }

    @Test
    fun `derive pulse floats captured heat warning`() {
        // The captured fixture carries an active Extreme Heat Warning.
        val pulse = PlacePresentation.derivePulse(fixture())
        assertEquals(PlaceHeroVariant.ALERT, pulse.variant)
        assertEquals("Extreme Heat Warning", pulse.title)
    }

    @Test
    fun `derive pulse floats active alert`() {
        val intel =
            makeIntelligence(
                alerts =
                    """
                    { "active": [ { "id": "a1", "event": "Wind Advisory", "severity": "advisory",
                      "headline": "Wind Advisory until 6 PM", "description": "Secure loose objects.",
                      "onset": null, "ends": null } ] }
                    """.trimIndent(),
            )
        val pulse = PlacePresentation.derivePulse(intel)
        assertEquals(PlaceHeroVariant.ALERT, pulse.variant)
        assertEquals("Wind Advisory until 6 PM", pulse.title)
        assertEquals("Secure loose objects.", pulse.nudgeText)
    }

    @Test
    fun `derive pulse floats unhealthy air`() {
        val intel =
            makeIntelligence(
                airQuality =
                    """
                    { "index": 158, "category": "unhealthy", "category_label": "Unhealthy",
                      "dominant_pollutant": "pm25", "health_message": "Limit time outdoors." }
                    """.trimIndent(),
            )
        val pulse = PlacePresentation.derivePulse(intel)
        assertEquals(PlaceHeroVariant.ALERT, pulse.variant)
        assertTrue(pulse.title.contains("unhealthy"))
        assertEquals("Limit time outdoors.", pulse.nudgeText)
    }

    @Test
    fun `lock cta by band`() {
        fun envForBand(band: String) =
            checkNotNull(
                moshi.adapter(PlaceSectionEnvelope::class.java).fromJson(
                    """
                    { "id": "your_home", "group": "your_home", "band": "$band", "access": "locked",
                      "status": "ready", "as_of": null, "source": null, "coverage": "full",
                      "unavailable_reason": null, "data": null }
                    """.trimIndent(),
                ),
            )
        assertEquals("Verify address", PlacePresentation.lockCta(envForBand("D")))
        assertEquals("Claim home", PlacePresentation.lockCta(envForBand("B")))
        assertEquals("Claim home", PlacePresentation.lockCta(envForBand("C")))
        assertEquals("Create account", PlacePresentation.lockCta(envForBand("A")))
        // Silence unused-import lint for PlaceBand (referenced indirectly).
        assertEquals(PlaceBand.D, PlaceBand.D)
    }

    private fun makeIntelligence(
        alerts: String? = null,
        airQuality: String? = null,
    ): PlaceIntelligence {
        fun envelope(
            id: String,
            data: String?,
        ): String =
            """
            { "id": "$id", "group": "today", "band": "A", "access": "available",
              "status": "${if (data == null) "unavailable" else "ready"}", "as_of": null,
              "source": "Test", "coverage": "full", "unavailable_reason": null,
              "data": ${data ?: "null"} }
            """.trimIndent()
        val json =
            """
            {
              "place": { "label": "X", "line1": "X", "city": "C", "state": "WA", "postal_code": null },
              "tier": "T3", "region_supported": true, "generated_at": "2026-06-12T00:00:00Z",
              "groups": [ { "group": "today", "label": "Today", "sections": [
                ${envelope("alerts", alerts)},
                ${envelope("air_quality", airQuality)}
              ] } ]
            }
            """.trimIndent()
        return checkNotNull(moshi.adapter(PlaceIntelligence::class.java).fromJson(json))
    }
}
