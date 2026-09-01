@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.universal_search

import app.pantopus.android.data.api.models.universalsearch.UniversalSearchGigDto
import app.pantopus.android.data.api.models.universalsearch.UniversalSearchProfileDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Mirrors the iOS `UniversalSearchViewModelTests`: the 2-character
 * threshold hint, locality / price formatting, and Beacon handle
 * extraction from the identity-search `href`.
 */
class UniversalSearchViewModelTest {
    @Test
    fun `threshold hint only fires below two characters`() {
        assertNull(UniversalSearchViewModel.thresholdHint(""))
        assertEquals(
            "Type 1 more character to search.",
            UniversalSearchViewModel.thresholdHint("a"),
        )
        assertNull(UniversalSearchViewModel.thresholdHint("ab"))
    }

    @Test
    fun `locality joins present halves only`() {
        assertEquals("Camas, WA", UniversalSearchViewModel.locality("Camas", "WA"))
        assertEquals("Camas", UniversalSearchViewModel.locality("Camas", null))
        assertEquals("WA", UniversalSearchViewModel.locality(null, "WA"))
        assertNull(UniversalSearchViewModel.locality(null, null))
        assertNull(UniversalSearchViewModel.locality("  ", null))
    }

    @Test
    fun `price label rounds to whole dollars`() {
        assertEquals("\$80", UniversalSearchViewModel.priceLabel(80.0))
        assertEquals("\$80", UniversalSearchViewModel.priceLabel(79.6))
        assertNull(UniversalSearchViewModel.priceLabel(null))
    }

    @Test
    fun `beacon handle prefers href then subtitle then id`() {
        assertEquals(
            "mariak",
            UniversalSearchViewModel.beaconHandle(
                UniversalSearchProfileDto(id = "p1", href = "/@mariak"),
            ),
        )
        assertEquals(
            "davidc",
            UniversalSearchViewModel.beaconHandle(
                UniversalSearchProfileDto(id = "p2", href = "/persona/davidc?ref=x"),
            ),
        )
        assertEquals(
            "anika",
            UniversalSearchViewModel.beaconHandle(
                UniversalSearchProfileDto(id = "p3", subtitle = "@anika"),
            ),
        )
        assertEquals(
            "p4",
            UniversalSearchViewModel.beaconHandle(UniversalSearchProfileDto(id = "p4")),
        )
    }

    @Test
    fun `task projection falls back to untitled and maps the gig route`() {
        val row =
            UniversalSearchViewModel.projectTask(
                UniversalSearchGigDto(id = "g1", title = null, category = "handyman", price = 80.0),
            )
        assertEquals("Untitled Task", row.title)
        assertEquals("handyman", row.subtitle)
        assertEquals("\$80", row.meta)
        assertEquals(UniversalSearchKind.Task, row.kind)
        assertEquals(UniversalSearchDestination.Task("g1"), row.destination)
    }

    @Test
    fun `every tab except all resolves to a single kind`() {
        assertNull(UniversalSearchTab.All.kind)
        assertEquals(UniversalSearchKind.Task, UniversalSearchTab.Tasks.kind)
        assertEquals(UniversalSearchKind.Person, UniversalSearchTab.People.kind)
        assertEquals(UniversalSearchKind.Beacon, UniversalSearchTab.Beacons.kind)
        assertEquals(UniversalSearchKind.Business, UniversalSearchTab.Businesses.kind)
        assertEquals(UniversalSearchKind.Home, UniversalSearchTab.Homes.kind)
    }
}
