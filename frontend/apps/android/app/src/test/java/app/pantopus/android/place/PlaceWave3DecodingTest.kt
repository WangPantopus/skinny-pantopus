package app.pantopus.android.place

import app.pantopus.android.data.api.models.place.BlockInviteRecipient
import app.pantopus.android.data.api.models.place.BlockStatusResponse
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionAccess
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.data.api.models.place.RealRentScope
import app.pantopus.android.data.api.models.place.RealRentStanding
import app.pantopus.android.data.api.models.place.RealRentState
import app.pantopus.android.data.api.models.place.RentReportResponse
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.detail.isComplete
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Decoding contract for the Wave 3 additions: the band-D `real_rent`
 * section (the FIRST section to use band D), its contribution DTOs, and
 * the Block Founders status with its three unlock meters.
 *
 * The two states that matter most are the ones a naive client gets
 * wrong: `building` is a real, partial reading of the block's progress
 * — never an error and never an empty card — and an unrecognized
 * vocabulary value must degrade to UNKNOWN rather than blanking the
 * whole section.
 */
class PlaceWave3DecodingTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json)) { "decoded null" }

    private fun wrap(section: String): String =
        """
        {"place":{"label":"x","line1":"x","city":"x","state":"OR","postal_code":"97214"},
         "tier":"T4","region_supported":true,"generated_at":"2026-08-25T09:00:00Z",
         "groups":[{"group":"money_signals","label":"Money signals","sections":[$section]}]}
        """.trimIndent()

    private fun realRent(json: String) = decode<PlaceIntelligence>(wrap(json)).groups.first().sections.first()

    @Test
    fun `decodes real_rent while the block is still building`() {
        // Not an error and not empty: the block's own progress toward
        // its benchmark, which is what the Block Founders meter reads.
        val env =
            realRent(
                """
                {"id":"real_rent","group":"money_signals","band":"D","access":"available","status":"partial",
                 "as_of":null,"source":"Pantopus · verified neighbors on your block","coverage":"partial",
                 "unavailable_reason":null,
                 "data":{"state":"building","reports":4,"needed":10,"scope":null,"bedrooms":null,
                   "sample_size":null,"rent_p25":null,"rent_median":null,"rent_p75":null,
                   "your_rent":2150,"standing":null,
                   "summary":"4 of 10 verified homes on your block have shared their rent."}}
                """.trimIndent(),
            )

        assertEquals(PlaceSectionId.REAL_RENT, env.sectionId)
        assertEquals(PlaceSectionStatus.PARTIAL, env.status)
        val d = checkNotNull(env.realRent)
        assertEquals(RealRentState.BUILDING, d.state)
        assertEquals(4, d.reports)
        assertEquals(10, d.needed)
        assertEquals(2150, d.yourRent)
        assertNull(d.scope)
        assertNull(d.standing)
        assertNull(d.rentMedian)
        assertTrue(d.summary.startsWith("4 of 10"))
    }

    @Test
    fun `decodes real_rent once the band is ready`() {
        val env =
            realRent(
                """
                {"id":"real_rent","group":"money_signals","band":"D","access":"available","status":"ready",
                 "as_of":null,"source":"Pantopus · verified neighbors on your block","coverage":"full",
                 "unavailable_reason":null,
                 "data":{"state":"ready","reports":14,"needed":10,"scope":"bedrooms","bedrooms":2,
                   "sample_size":14,"rent_p25":1950,"rent_median":2100,"rent_p75":2300,
                   "your_rent":2450,"standing":"above_band",
                   "summary":"14 verified 2-bedroom homes on your block pay a median of $2,100/mo."}}
                """.trimIndent(),
            )

        val d = checkNotNull(env.realRent)
        assertEquals(RealRentState.READY, d.state)
        assertEquals(RealRentScope.BEDROOMS, d.scope)
        assertEquals(2, d.bedrooms)
        assertEquals(14, d.sampleSize)
        assertEquals(1950, d.rentP25)
        assertEquals(2100, d.rentMedian)
        assertEquals(2300, d.rentP75)
        assertEquals(RealRentStanding.ABOVE_BAND, d.standing)
    }

    @Test
    fun `decodes the all_sizes scope without a bedroom count`() {
        // Scope degrades EXPLICITLY — a studio must never be quietly
        // priced against a four-bedroom, so `all_sizes` carries a null
        // bedroom count and the client says so.
        val d =
            checkNotNull(
                realRent(
                    """
                    {"id":"real_rent","group":"money_signals","band":"D","access":"available","status":"ready",
                     "as_of":null,"source":"Pantopus","coverage":"full","unavailable_reason":null,
                     "data":{"state":"ready","reports":11,"needed":10,"scope":"all_sizes","bedrooms":null,
                       "sample_size":11,"rent_p25":1500,"rent_median":1875,"rent_p75":2400,
                       "your_rent":null,"standing":null,"summary":"11 verified homes of all sizes."}}
                    """.trimIndent(),
                ).realRent,
            )
        assertEquals(RealRentScope.ALL_SIZES, d.scope)
        assertNull(d.bedrooms)
        assertNull(d.yourRent)
        assertNull(d.standing)
    }

    @Test
    fun `real_rent vocabulary additions fall back to UNKNOWN`() {
        // A future server-side state/scope/standing must not throw inside
        // the envelope adapter and blank the whole section — the amounts
        // and the summary still have to render.
        val d =
            checkNotNull(
                realRent(
                    """
                    {"id":"real_rent","group":"money_signals","band":"D","access":"available","status":"ready",
                     "as_of":null,"source":"Pantopus","coverage":"full","unavailable_reason":null,
                     "data":{"state":"cooling","reports":12,"needed":10,"scope":"square_feet","bedrooms":3,
                       "sample_size":12,"rent_p25":1800,"rent_median":2000,"rent_p75":2250,
                       "your_rent":2000,"standing":"wildly_above","summary":"A future shape."}}
                    """.trimIndent(),
                ).realRent,
            )
        assertEquals(RealRentState.UNKNOWN, d.state)
        assertEquals(RealRentScope.UNKNOWN, d.scope)
        assertEquals(RealRentStanding.UNKNOWN, d.standing)
        assertEquals(2000, d.rentMedian)
        assertEquals("A future shape.", d.summary)
    }

    @Test
    fun `a locked real_rent envelope carries the lock reason and no data`() {
        // Band D is T4-only, and real_rent is the first section to use
        // it: below T4 the client must render the locked state, never an
        // empty band.
        val env =
            realRent(
                """
                {"id":"real_rent","group":"money_signals","band":"D","access":"locked","status":"unavailable",
                 "as_of":null,"source":"Pantopus","coverage":"none",
                 "unavailable_reason":"Verify your address to see what your block actually pays.","data":null}
                """.trimIndent(),
            )
        assertEquals(PlaceSectionAccess.LOCKED, env.access)
        assertNull(env.realRent)
        assertEquals("Verify your address to see what your block actually pays.", env.unavailableReason)
    }

    @Test
    fun `real_rent dashboard reading is the server summary plus progress`() {
        val building =
            realRent(
                """
                {"id":"real_rent","group":"money_signals","band":"D","access":"available","status":"partial",
                 "as_of":null,"source":"Pantopus","coverage":"partial","unavailable_reason":null,
                 "data":{"state":"building","reports":4,"needed":10,"scope":null,"bedrooms":null,
                   "sample_size":null,"rent_p25":null,"rent_median":null,"rent_p75":null,
                   "your_rent":null,"standing":null,"summary":"4 of 10 verified homes have shared."}}
                """.trimIndent(),
            )
        val reading = PlacePresentation.reading(building)
        assertEquals("4 of 10 verified homes have shared.", reading.value)
        assertEquals("4 of 10", reading.chip?.text)
        assertEquals(PlaceChipTone.SKY, reading.chip?.tone)

        val ready =
            realRent(
                """
                {"id":"real_rent","group":"money_signals","band":"D","access":"available","status":"ready",
                 "as_of":null,"source":"Pantopus","coverage":"full","unavailable_reason":null,
                 "data":{"state":"ready","reports":12,"needed":10,"scope":"all_sizes","bedrooms":null,
                   "sample_size":12,"rent_p25":1800,"rent_median":2000,"rent_p75":2250,
                   "your_rent":null,"standing":null,"summary":"12 verified homes pay a median of $2,000/mo."}}
                """.trimIndent(),
            )
        val readyReading = PlacePresentation.reading(ready)
        assertEquals("12 verified homes pay a median of $2,000/mo.", readyReading.value)
        // No progress chip once the band is real — the count is the band.
        assertNull(readyReading.chip)
    }

    @Test
    fun `real_rent config is distinct from the HUD rent band`() {
        // Both live in Money signals and must never read as one claim.
        val real = PlacePresentation.config(PlaceSectionId.REAL_RENT)
        val hud = PlacePresentation.config(PlaceSectionId.RENT_BAND)
        assertEquals("Real rent on your block", real.title)
        assertEquals("Rent band", hud.title)
    }

    // ── The contribution DTOs ────────────────────────────────

    @Test
    fun `decodes the caller's own rent report`() {
        val json =
            """
            {"report":{"monthly_rent":2150,"bedrooms":2,
              "reported_at":"2026-08-01T00:00:00.000Z","updated_at":"2026-08-20T00:00:00.000Z"}}
            """.trimIndent()
        val report = checkNotNull(decode<RentReportResponse>(json).report)
        assertEquals(2150, report.monthlyRent)
        assertEquals(2, report.bedrooms)
        assertEquals("2026-08-20T00:00:00.000Z", report.updatedAt)
    }

    @Test
    fun `an absent rent report decodes to null, not an error`() {
        assertNull(decode<RentReportResponse>("""{"report":null}""").report)
    }

    // ── Block Founders ───────────────────────────────────────

    @Test
    fun `decodes the block founders status with its three meters`() {
        val json =
            """
            {"block":{"available":true,"rank":2,"established_at":"2026-06-14T00:00:00.000Z",
              "verified_count":7,"rent_reports":4,
              "meters":[
                {"id":"real_rent","label":"Real rents on your block","current":4,"needed":10,"unlocked":false},
                {"id":"bill_benchmark","label":"Bill benchmark","current":7,"needed":10,"unlocked":false},
                {"id":"block_growing","label":"“Growing block” status","current":7,"needed":25,"unlocked":false}],
              "invites_remaining":2,"invites_weekly_cap":3}}
            """.trimIndent()
        val block = decode<BlockStatusResponse>(json).block
        assertTrue(block.available)
        assertEquals(2, block.rank)
        assertEquals(7, block.verifiedCount)
        // The real_rent meter counts RENT REPORTS, not verified homes —
        // the two readings differ and the client must not conflate them.
        assertEquals(4, block.rentReports)
        assertEquals(3, block.meters.size)
        assertEquals("real_rent", block.meters[0].id)
        assertEquals(4, block.meters[0].current)
        assertEquals(7, block.meters[1].current)
        assertEquals(25, block.meters[2].needed)
        assertEquals(2, block.invitesRemaining)
        assertEquals(3, block.invitesWeeklyCap)
        assertNotNull(block.establishedAt)
    }

    @Test
    fun `an unavailable block carries its reason and safe defaults`() {
        val block = decode<BlockStatusResponse>("""{"block":{"available":false,"reason":"NO_COORDINATES"}}""").block
        assertEquals(false, block.available)
        assertEquals("NO_COORDINATES", block.reason)
        assertNull(block.rank)
        assertEquals(0, block.verifiedCount)
        assertEquals(0, block.rentReports)
        assertTrue(block.meters.isEmpty())
    }

    @Test
    fun `an incomplete invite address never reaches the wire`() {
        // The send spends a real postcard in the viewer's name, so the
        // guard that stops a certain-400 is worth locking: the route's
        // fence is line1 + city + a two-letter state + ZIP.
        fun r(
            line1: String = "12 Elm St",
            city: String = "Camas",
            state: String = "WA",
            zip: String = "98607",
        ) = BlockInviteRecipient(line1, city, state, zip)

        assertTrue(r().isComplete())
        assertTrue(r(zip = "98607-1234").isComplete())
        assertEquals(false, r(line1 = "  ").isComplete())
        assertEquals(false, r(city = "").isComplete())
        assertEquals(false, r(zip = "").isComplete())
        // A one-letter or three-letter state is the route's BAD_ADDRESS.
        assertEquals(false, r(state = "W").isComplete())
        assertEquals(false, r(state = "WAS").isComplete())
    }
}
