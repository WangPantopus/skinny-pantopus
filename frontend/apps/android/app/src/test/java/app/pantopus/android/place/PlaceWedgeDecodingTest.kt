package app.pantopus.android.place

import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.place.BlockFounding
import app.pantopus.android.data.api.models.place.BlockStatusResponse
import app.pantopus.android.data.api.models.place.PlaceCalendarEvent
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceGroup
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlacePreviewAhaTone
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.isRecentMove
import app.pantopus.android.ui.screens.place.detail.RadonToday
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId

/**
 * Wedge v2 on Android — the aha card + Band-A sections on the anonymous
 * preview (D1), the address calendar section (D6), the Founding
 * Neighbor tier (D5), and the movers window (D5). Same fixtures as the
 * web and iOS tests, so a contract drift fails all three.
 */
class PlaceWedgeDecodingTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    @Test
    fun `preview decodes the aha card and the section envelopes`() {
        val json =
            """
            {"status":"ready","tier":"preview","region":"US",
             "place":{"address":"2518 NW Pantopus Loop","city":"Camas","state":"WA","zipcode":"98607"},
             "aha":{"section_id":"lead_radon","tone":"alert","grade":"Radon zone 1",
               "headline":"This county is in the EPA's highest radon band",
               "detail":"Zone 1 means the predicted average indoor level is above the EPA action level.",
               "follow_up":"Claim it and we'll remind you when a test kit is due."},
             "sections":[{"id":"flood","group":"risk_readiness","band":"A","access":"available","status":"ready",
               "as_of":"2026-09-01T14:00:00.000Z","source":"FEMA","coverage":"full","unavailable_reason":null,
               "data":{"zone":"X","zone_label":"Zone X","risk_level":"minimal","in_sfha":false,
                       "insurance_required":false,"plain_meaning":"Minimal flood risk"}}],
             "money_lead":null,"disclaimer":"A free, one-time look."}
            """.trimIndent()
        val preview = moshi.adapter(PlacePreview::class.java).fromJson(json)!!
        val aha = assertNotNull(preview.aha).let { preview.aha!! }
        assertTrue(aha.isRenderable)
        assertEquals(PlacePreviewAhaTone.ALERT, aha.toneEnum)
        assertEquals("lead_radon", aha.sectionId)
        assertEquals("Radon zone 1", aha.grade)
        assertEquals(1, preview.sections?.size)
        assertEquals(PlaceGroup.RISK_READINESS, preview.sections?.first()?.groupId)
        assertEquals(PlaceSectionStatus.READY, preview.sections?.first()?.status)
        assertNotNull(preview.sections?.first()?.flood)
        val radon =
            """
            {"id":"lead_radon","group":"risk_readiness","band":"A","access":"available","status":"ready",
             "as_of":null,"source":"EPA radon zones","coverage":"full","unavailable_reason":null,
             "data":{"year_built":1979,"lead_paint_risk":"moderate","radon_zone":2,"county_name":"Clark County",
                     "summary":"Screening only","disclaimer":"Test this home."}}
            """.trimIndent()
        val adapter = moshi.adapter(PlaceSectionEnvelope::class.java)
        val named = adapter.fromJson(radon)!!
        assertEquals("Clark County", named.leadRadon?.countyName)
        assertEquals(2, named.leadRadon?.radonZone)
        val legacy = adapter.fromJson(radon.replace(",\"county_name\":\"Clark County\"", ""))!!
        assertNull(legacy.leadRadon?.countyName)
        assertEquals(2, legacy.leadRadon?.radonZone)
    }

    @Test
    fun `an unknown aha tone renders as info and older backends carry no aha`() {
        val adapter = moshi.adapter(PlacePreview::class.java)
        val odd = adapter.fromJson("""{"status":"ready","tier":"preview","aha":{"tone":"purple","headline":"Something new"}}""")!!
        assertEquals(PlacePreviewAhaTone.INFO, odd.aha?.toneEnum)
        assertTrue(odd.aha?.isRenderable == true)
        assertEquals("", odd.aha?.grade)
        val older = adapter.fromJson("""{"status":"ready","tier":"preview"}""")!!
        assertNull(older.aha)
        assertNull(older.sections)
        val date = LocalDate.of(2026, 11, 12)
        val tested = RadonToday.payload(true, date, true, "2.5")
        assertEquals("done", tested.status)
        assertEquals("members", tested.visibility)
        assertEquals("2026-11-12", tested.details?.get("tested_on"))
        assertEquals(2.5, tested.details?.get("result_pci"))
        assertTrue(runCatching { RadonToday.payload(true, date, false, "NaN") }.isFailure)
        assertTrue(runCatching { RadonToday.payload(true, date, false, "-1") }.isFailure)
        val reminder = RadonToday.payload(false, date, false, "")
        assertEquals("Test for radon", reminder.title)
        assertNull(reminder.status)
        assertEquals("members", reminder.visibility)
        assertTrue(reminder.dueAt?.contains("T09:00:00") == true)
        assertEquals("2026-11-01T09:00:00-08:00", RadonToday.dueAt(LocalDate.of(2026, 11, 1), ZoneId.of("America/Los_Angeles")))
        val rows =
            listOf(
                HomeTaskDto(
                    "open",
                    "home",
                    "reminder",
                    "Test for radon",
                    status = "in_progress",
                    createdAt = "2026-10-02T12:00:00Z",
                    detailsValue = reminder.details,
                ),
                HomeTaskDto(
                    "done",
                    "home",
                    "reminder",
                    "Radon test",
                    status = "done",
                    createdAt = "2026-10-03T12:00:00Z",
                    detailsValue = tested.details,
                ),
                HomeTaskDto(
                    "canceled",
                    "home",
                    "reminder",
                    "Test for radon",
                    status = "canceled",
                    createdAt = "2026-10-04T12:00:00Z",
                    detailsValue = reminder.details,
                ),
            )
        assertEquals("open", RadonToday.selected(rows)?.id)
        assertEquals("done", RadonToday.selected(rows.drop(1))?.id)
        assertNull(RadonToday.selected(listOf(rows[2])))
        assertTrue(RadonToday.message(rows[1]).startsWith("Radon tested"))
        assertTrue(RadonToday.message(rows[1]).endsWith("2.5 pCi/L"))
    }

    @Test
    fun `address_calendar decodes and reads as the next event or the pickup prompt`() {
        val adapter = moshi.adapter(PlaceSectionEnvelope::class.java)
        val withNext =
            adapter.fromJson(
                """
                {"id":"address_calendar","group":"today","band":"A","access":"available","status":"ready",
                 "as_of":"2026-09-01T14:00:00.000Z","source":"Pantopus registry","coverage":"full","unavailable_reason":null,
                 "data":{"today":"2026-09-01","window_days":14,"rule_count":4,"needs_pickup_day":false,
                   "next":{"rule_id":"r1","kind":"garbage","title":"Garbage pickup","detail":null,"date":"2026-09-02",
                           "days_until":1,"all_day":true,"lead_days":1,"scope":"home","source":null,"source_url":null,"confidence":"official"},
                   "upcoming":[{"rule_id":"r1","kind":"garbage","title":"Garbage pickup","date":"2026-09-02","days_until":1,
                                "all_day":true,"lead_days":1,"scope":"home","confidence":"official"}]}}
                """.trimIndent(),
            )!!
        assertEquals(PlaceSectionId.ADDRESS_CALENDAR, withNext.sectionId)
        assertEquals(1, withNext.addressCalendar?.upcoming?.size)
        assertEquals("Garbage pickup · Tomorrow", PlacePresentation.reading(withNext).value)

        val needsDay =
            adapter.fromJson(
                """
                {"id":"address_calendar","group":"today","band":"A","access":"available","status":"ready",
                 "as_of":null,"source":null,"coverage":"full","unavailable_reason":null,
                 "data":{"today":"2026-09-01","window_days":14,"rule_count":2,"needs_pickup_day":true,"next":null,"upcoming":[]}}
                """.trimIndent(),
            )!!
        assertTrue(needsDay.addressCalendar?.needsPickupDay == true)
        assertEquals("Set your pickup day", PlacePresentation.reading(needsDay).value)
        assertEquals("Address calendar", PlacePresentation.config(PlaceSectionId.ADDRESS_CALENDAR).title)
        assertEquals("Set your pickup day and your pickups start here.", needsDay.addressCalendar?.pickupSetupMessage)
        assertNull(withNext.addressCalendar?.pickupSetupMessage)
        val legacy = checkNotNull(withNext.addressCalendar?.upcoming?.first())
        assertNull(legacy.holidayMoveLine)
        val eventAdapter = moshi.adapter(PlaceCalendarEvent::class.java)
        for ((days, line) in listOf(1 to "Moved a day for Thanksgiving.", 2 to "Moved for Thanksgiving.")) {
            val moved =
                checkNotNull(
                    eventAdapter.fromJson(
                        """{"rule_id":"pickup","kind":"garbage","date":"2026-11-27",
                            "moved_from":"2026-11-26","holiday":"Thanksgiving","shift_days":$days}""",
                    ),
                )
            assertEquals("2026-11-26", moved.movedFrom)
            assertEquals(line, moved.holidayMoveLine)
        }
        val emptyPickup = checkNotNull(needsDay.addressCalendar)
        assertNull(emptyPickup.copy(upcoming = listOf(legacy)).pickupSetupMessage)
        assertEquals(
            emptyPickup.pickupSetupMessage,
            emptyPickup.copy(upcoming = listOf(legacy.copy(kind = "property_tax"))).pickupSetupMessage,
        )
    }

    @Test
    fun `the founding tier decodes and its line matches iOS copy`() {
        val status =
            moshi.adapter(BlockStatusResponse::class.java).fromJson(
                """
                {"block":{"available":true,"rank":3,"verified_count":12,
                  "founding":{"is_founding":true,"slot":3,"slots_total":5,"slots_taken":3,"slots_open":2,
                              "window_open":true,"window_ends_at":"2026-09-20T00:00:00.000Z"}}}
                """.trimIndent(),
            )!!
        assertEquals("Founding Neighbor · slot 3 of 5. Permanent.", status.block.founding?.line())

        val now = java.time.Instant.parse("2026-09-01T00:00:00Z").toEpochMilli()
        val open =
            BlockFounding(
                isFounding = false,
                slotsTotal = 5,
                slotsTaken = 2,
                slotsOpen = 3,
                windowOpen = true,
                windowEndsAt = "2026-09-04T12:00:00.000Z",
            )
        assertEquals("3 Founding Neighbor slots still open · closes in 4 days", open.line(now))
        val one = open.copy(slotsOpen = 1, windowEndsAt = "2026-09-02T00:00:00.000Z")
        assertEquals("1 Founding Neighbor slot still open · closes in 1 day", one.line(now))
        assertNull(open.copy(windowOpen = false).line(now))
        assertNull(BlockFounding().line(now))
    }

    @Test
    fun `the movers window is sixty days after the move-in date`() {
        val today = LocalDate.of(2026, 9, 1).toEpochDay()
        assertTrue(isRecentMove("2026-08-15", today))
        assertTrue(isRecentMove("2026-07-03T00:00:00.000Z", today))
        assertTrue(isRecentMove("2026-09-10", today)) // moving in next week
        assertFalse(isRecentMove("2026-06-30", today))
        assertFalse(isRecentMove("2026-10-01", today))
        assertFalse(isRecentMove(null, today))
        assertFalse(isRecentMove("not a date", today))
    }
}
