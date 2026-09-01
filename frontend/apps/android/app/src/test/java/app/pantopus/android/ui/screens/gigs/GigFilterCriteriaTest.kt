@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.gigs

import app.pantopus.android.data.api.models.gigs.GigDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * P5.3 — unit tests for the Gig filter criteria: the criteria ↔
 * sections round-trip, active-count, the tolerant schedule mapping,
 * and the per-dimension predicates. Mirrors the iOS
 * `GigFilterSheetTests`.
 */
class GigFilterCriteriaTest {
    private val now = Instant.parse("2026-05-20T12:00:00Z").epochSecond

    private fun gig(
        id: String = "g1",
        price: Double? = 60.0,
        category: String? = "handyman",
        scheduleType: String? = null,
        acceptedBy: String? = null,
        createdAt: String? = "2026-05-20T08:00:00Z",
    ): GigDto =
        GigDto(
            id = id,
            title = "Sample",
            price = price,
            category = category,
            scheduleType = scheduleType,
            acceptedBy = acceptedBy,
            createdAt = createdAt,
        )

    @Test fun default_has_no_active_filters() {
        assertEquals(0, GigFilterCriteria().activeCount)
    }

    @Test fun schedule_backend_values_match_wire_contract() {
        // P0.4 — single-selection schedule rides as `schedule_type`.
        assertEquals("scheduled", GigScheduleFilter.OneTime.backendValue)
        assertEquals("recurring", GigScheduleFilter.Recurring.backendValue)
        assertEquals("flexible", GigScheduleFilter.Flexible.backendValue)
    }

    @Test fun sections_cover_every_dimension_in_order() {
        assertEquals(
            listOf(
                "category",
                "budget",
                "schedule",
                "openToBids",
                "postedWithin",
                // Wave B added the three RN chip dimensions.
                "distance",
                "deadline",
                "archetype",
            ),
            GigFilterCriteria().toSections().map { it.id },
        )
    }

    @Test fun round_trip_preserves_every_selection() {
        val criteria =
            GigFilterCriteria(
                categories = setOf(GigsCategory.Handyman, GigsCategory.Cleaning),
                budgetLower = 50f,
                budgetUpper = 300f,
                schedules = setOf(GigScheduleFilter.OneTime, GigScheduleFilter.Flexible),
                openToBids = true,
                postedWithin = GigPostedWithin.Week,
            )
        assertEquals(criteria, GigFilterCriteria.fromSections(criteria.toSections()))
    }

    @Test fun active_count_counts_each_active_dimension() {
        val criteria =
            GigFilterCriteria(
                categories = setOf(GigsCategory.Handyman),
                budgetLower = 50f,
                budgetUpper = 300f,
                schedules = setOf(GigScheduleFilter.OneTime),
                openToBids = true,
                postedWithin = GigPostedWithin.Today,
            )
        assertEquals(5, criteria.activeCount)
    }

    @Test fun budget_ceiling_is_open_ended() {
        val criteria = GigFilterCriteria(budgetLower = 100f, budgetUpper = GigFilterCriteria.BUDGET_MAX)
        assertTrue(criteria.matchesBudget(1000.0))
        assertTrue(criteria.matchesBudget(100.0))
        assertFalse(criteria.matchesBudget(50.0))
    }

    @Test fun budget_excludes_unpriced_gigs_when_active() {
        assertFalse(GigFilterCriteria(budgetLower = 50f, budgetUpper = 300f).matchesBudget(null))
        assertTrue(GigFilterCriteria().matchesBudget(null))
    }

    @Test fun schedule_mapping_is_tolerant() {
        assertEquals(GigScheduleFilter.OneTime, GigScheduleFilter.fromBackendKey("scheduled"))
        assertEquals(GigScheduleFilter.OneTime, GigScheduleFilter.fromBackendKey("one_time"))
        assertEquals(GigScheduleFilter.Recurring, GigScheduleFilter.fromBackendKey("Recurring"))
        assertEquals(GigScheduleFilter.Flexible, GigScheduleFilter.fromBackendKey("flexible"))
        assertNull(GigScheduleFilter.fromBackendKey("mystery"))
        assertNull(GigScheduleFilter.fromBackendKey(null))
    }

    @Test fun matches_category_dimension() {
        val criteria = GigFilterCriteria(categories = setOf(GigsCategory.Cleaning))
        assertFalse(criteria.matches(gig(category = "handyman"), now))
        assertTrue(criteria.matches(gig(category = "cleaning"), now))
    }

    @Test fun matches_open_to_bids_dimension() {
        val criteria = GigFilterCriteria(openToBids = true)
        assertTrue(criteria.matches(gig(acceptedBy = null), now))
        assertFalse(criteria.matches(gig(acceptedBy = "u9"), now))
    }

    @Test fun matches_schedule_dimension() {
        val criteria = GigFilterCriteria(schedules = setOf(GigScheduleFilter.OneTime))
        assertTrue(criteria.matches(gig(scheduleType = "scheduled"), now))
        assertFalse(criteria.matches(gig(scheduleType = "flexible"), now))
        assertFalse(criteria.matches(gig(scheduleType = null), now))
    }

    @Test fun matches_posted_within_dimension() {
        val criteria = GigFilterCriteria(postedWithin = GigPostedWithin.Today)
        assertTrue(criteria.matches(gig(createdAt = "2026-05-20T06:00:00Z"), now))
        assertFalse(criteria.matches(gig(createdAt = "2026-05-10T06:00:00Z"), now))
    }

    // MARK: - P6a saved-search label + POST body

    @Test fun saved_search_label_matches_the_spec_example() {
        assertEquals(
            "Cleaning · under $100 · 5 mi",
            savedSearchLabel(categoryLabel = "Cleaning", maxPrice = 100.0, radiusMiles = 5.0),
        )
    }

    @Test fun saved_search_label_orders_every_part() {
        assertEquals(
            "Cleaning · “mount tv” · $50–$300 · One-time · open to bids · 2.5 mi",
            savedSearchLabel(
                categoryLabel = "Cleaning",
                search = "mount tv",
                minPrice = 50.0,
                maxPrice = 300.0,
                scheduleLabel = "One-time",
                openToBids = true,
                radiusMiles = 2.5,
            ),
        )
    }

    @Test fun saved_search_label_handles_lone_bounds_and_fallback() {
        assertEquals("over $50 · 5 mi", savedSearchLabel(minPrice = 50.0, radiusMiles = 5.0))
        assertEquals("All tasks · 5 mi", savedSearchLabel(radiusMiles = 5.0))
        assertEquals("All tasks", savedSearchLabel())
    }

    @Test fun to_saved_search_body_maps_every_active_dimension() {
        val body =
            GigFilterCriteria(
                budgetLower = 50f,
                budgetUpper = 300f,
                schedules = setOf(GigScheduleFilter.OneTime),
                openToBids = true,
            ).toSavedSearchBody(
                category = GigsCategory.Cleaning,
                search = " mount tv ",
                latitude = 40.7,
                longitude = -73.9,
                radiusMiles = 5.0,
            )
        assertEquals("cleaning", body.category)
        assertEquals("mount tv", body.search)
        assertEquals(50.0, body.minPrice!!, 0.0)
        assertEquals(300.0, body.maxPrice!!, 0.0)
        assertEquals("scheduled", body.scheduleType)
        assertEquals("offers", body.payType)
        assertEquals(40.7, body.latitude, 0.0)
        assertEquals(-73.9, body.longitude, 0.0)
        assertEquals(5.0, body.radiusMiles, 0.0)
        assertTrue(body.notify)
        assertEquals("Cleaning · “mount tv” · $50–$300 · One-time · open to bids · 5 mi", body.name)
    }

    @Test fun to_saved_search_body_omits_inactive_dimensions() {
        val body =
            GigFilterCriteria().toSavedSearchBody(
                category = GigsCategory.All,
                search = null,
                latitude = 40.7,
                longitude = -73.9,
                radiusMiles = 5.0,
            )
        assertNull(body.category)
        assertNull(body.search)
        assertNull(body.minPrice)
        assertNull(body.maxPrice)
        assertNull(body.scheduleType)
        assertNull(body.payType)
        assertEquals("All tasks · 5 mi", body.name)
    }

    @Test fun budget_extremes_stay_off_the_wire() {
        val body =
            GigFilterCriteria(
                budgetLower = GigFilterCriteria.BUDGET_MIN,
                budgetUpper = GigFilterCriteria.BUDGET_MAX,
            ).toSavedSearchBody(
                category = null,
                search = null,
                latitude = 40.7,
                longitude = -73.9,
                radiusMiles = 5.0,
            )
        assertNull(body.minPrice)
        assertNull(body.maxPrice)
    }

    @Test fun recurring_schedule_is_not_storable_server_side() {
        // The create schema only accepts asap|today|scheduled|flexible —
        // the feed's `recurring` bucket stays a client-side filter.
        val body =
            GigFilterCriteria(schedules = setOf(GigScheduleFilter.Recurring)).toSavedSearchBody(
                category = null,
                search = null,
                latitude = 40.7,
                longitude = -73.9,
                radiusMiles = 5.0,
            )
        assertNull(body.scheduleType)
        assertEquals("Recurring · 5 mi", body.name)
    }

    @Test fun multi_schedule_selection_sends_no_schedule_type() {
        val body =
            GigFilterCriteria(
                schedules = setOf(GigScheduleFilter.OneTime, GigScheduleFilter.Flexible),
            ).toSavedSearchBody(
                category = null,
                search = null,
                latitude = 40.7,
                longitude = -73.9,
                radiusMiles = 5.0,
            )
        assertNull(body.scheduleType)
    }
}
