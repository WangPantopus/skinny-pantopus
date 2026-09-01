@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.nearby.map

import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.listings.ListingDto
import app.pantopus.android.ui.screens.gigs.GigFilterCriteria
import app.pantopus.android.ui.screens.gigs.GigsCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * P5.3 — unit tests for the Nearby map filter criteria: the criteria ↔
 * sections round-trip, active-count, entity-type gating, the distance
 * predicate, and the gig / listing predicates. Mirrors the iOS
 * `MapFilterSheetTests`.
 */
class MapFilterCriteriaTest {
    private val now = Instant.parse("2026-05-20T12:00:00Z").epochSecond

    private fun gig(
        category: String? = "handyman",
        price: Double? = 60.0,
    ): GigDto = GigDto(id = "g1", title = "Sample", price = price, category = category)

    private fun listing(
        category: String? = "moving",
        price: Double? = 250.0,
    ): ListingDto = ListingDto(id = "l1", title = "Sample", category = category, price = price)

    @Test fun default_has_no_active_filters() {
        assertEquals(0, MapFilterCriteria().activeCount)
    }

    @Test fun sections_lead_with_entity_type_then_distance_then_gig_dimensions() {
        assertEquals(
            listOf(
                "entityType", "distance", "category", "budget", "schedule", "openToBids", "postedWithin",
                // The map keeps its own radius range AND the gig radius presets, so
                // "distance" appears twice by design — retitled "Gig radius" the
                // second time. Both parse sides discriminate on control type.
                "distance", "deadline", "archetype",
            ),
            MapFilterCriteria().toSections().map { it.id },
        )
    }

    @Test fun round_trip_preserves_every_selection() {
        val criteria =
            MapFilterCriteria(
                entityType = MapEntityType.Gigs,
                distanceLower = 0f,
                distanceUpper = 2f,
                gig =
                    GigFilterCriteria(
                        categories = setOf(GigsCategory.Handyman),
                        openToBids = true,
                        postedWithin = app.pantopus.android.ui.screens.gigs.GigPostedWithin.Today,
                    ),
            )
        assertEquals(criteria, MapFilterCriteria.fromSections(criteria.toSections()))
    }

    @Test fun active_count_includes_entity_type_and_distance() {
        val criteria =
            MapFilterCriteria(
                entityType = MapEntityType.Listings,
                distanceLower = 0f,
                distanceUpper = 3f,
                gig = GigFilterCriteria(categories = setOf(GigsCategory.Moving)),
            )
        assertEquals(3, criteria.activeCount)
    }

    @Test fun entity_type_gating() {
        assertTrue(MapEntityType.Both.allowsGigs)
        assertTrue(MapEntityType.Both.allowsListings)
        assertTrue(MapEntityType.Gigs.allowsGigs)
        assertFalse(MapEntityType.Gigs.allowsListings)
        assertFalse(MapEntityType.Listings.allowsGigs)
        assertTrue(MapEntityType.Listings.allowsListings)
    }

    @Test fun distance_predicate() {
        val criteria = MapFilterCriteria(distanceLower = 0f, distanceUpper = 2f)
        assertTrue(criteria.matchesDistance(1.0))
        assertFalse(criteria.matchesDistance(3.0))
        assertFalse(criteria.matchesDistance(null))
        assertTrue(MapFilterCriteria().matchesDistance(null))
    }

    @Test fun matches_gig_respects_entity_type() {
        assertTrue(MapFilterCriteria(entityType = MapEntityType.Gigs).matchesGig(gig(), 0.5, now))
        assertFalse(MapFilterCriteria(entityType = MapEntityType.Listings).matchesGig(gig(), 0.5, now))
    }

    @Test fun matches_listing_respects_entity_type() {
        assertTrue(MapFilterCriteria(entityType = MapEntityType.Listings).matchesListing(listing(), 0.5))
        assertFalse(MapFilterCriteria(entityType = MapEntityType.Gigs).matchesListing(listing(), 0.5))
    }

    @Test fun matches_listing_honours_category_and_budget() {
        val byCategory = MapFilterCriteria(gig = GigFilterCriteria(categories = setOf(GigsCategory.Handyman)))
        assertFalse(byCategory.matchesListing(listing(category = "moving"), 0.5))
        assertTrue(byCategory.matchesListing(listing(category = "handyman"), 0.5))

        val byBudget = MapFilterCriteria(gig = GigFilterCriteria(budgetLower = 0f, budgetUpper = 100f))
        assertFalse(byBudget.matchesListing(listing(price = 250.0), 0.5))
        assertTrue(byBudget.matchesListing(listing(price = 80.0), 0.5))
    }

    @Test fun matches_gig_respects_distance_radius() {
        val criteria = MapFilterCriteria(distanceLower = 0f, distanceUpper = 1f)
        assertTrue(criteria.matchesGig(gig(), 0.5, now))
        assertFalse(criteria.matchesGig(gig(), 2.0, now))
    }
}
