package app.pantopus.android.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * §1C-b — Navigation drawer (LAUNCHER / Option A). Asserts the projection:
 * the kebab-cased slug contract (shared verbatim with iOS), the section
 * structure per context, and the `BackToHub` visibility rule.
 */
class NavigationDrawerProjectionTest {
    // Slug contract (drives `navDrawer.item.<slug>`)

    @Test
    fun slugKebabCasesLabels() {
        assertEquals("my-bids", navDrawerSlug("My Bids"))
        assertEquals("profile-and-privacy", navDrawerSlug("Profile & Privacy"))
        assertEquals("offers-and-bids", navDrawerSlug("Offers & Bids"))
        assertEquals("wallet-and-payments", navDrawerSlug("Wallet & Payments"))
        assertEquals("help-and-support", navDrawerSlug("Help & Support"))
        assertEquals("locations-and-hours", navDrawerSlug("Locations & Hours"))
        assertEquals("property-details", navDrawerSlug("Property Details"))
    }

    // Personal context

    @Test
    fun personalSectionsMatchDesign() {
        val context = NavigationDrawerContext.Personal(name = "Maria Lopez")
        assertEquals(NavigationDrawerPillar.Personal, context.pillar())
        assertFalse(context.showsBackToHub())
        assertEquals("Personal", context.headerTitle())
        assertEquals("Maria Lopez · Your profile", context.headerSubtitle())
        assertEquals(
            listOf("Manage", "Discover", "Your Stuff", "Settings"),
            context.sections().map { it.overline },
        )
        val slugs = context.sections().flatMap { section -> section.items.map { it.slug } }
        assertEquals(
            listOf(
                "my-homes", "my-businesses", "connections", "mailbox", "profile-and-privacy",
                "beacon-updates", "search", "discover-neighbors",
                "my-beacon", "my-listings", "my-pulse", "my-tasks", "my-bids",
                "offers-and-bids", "post-task", "wallet-and-payments",
                "settings", "help-and-support",
            ),
            slugs,
        )
    }

    // Home context

    @Test
    fun homeSectionsAndBackToHub() {
        val context = NavigationDrawerContext.Home(id = "h1", title = "Maple Street", subtitle = "123 Maple St")
        assertEquals(NavigationDrawerPillar.Home, context.pillar())
        assertTrue(context.showsBackToHub())
        assertEquals("Maple Street", context.headerTitle())
        assertEquals("123 Maple St", context.headerSubtitle())
        assertEquals(listOf(null, "More", "Settings"), context.sections().map { it.overline })
        val active = context.sections().first().items.first { it.isActive }
        assertEquals("overview", active.slug)
    }

    // Business context

    @Test
    fun businessSections() {
        val context =
            NavigationDrawerContext.Business(id = "b1", title = "Cortado Coffee", subtitle = "Coffee shop · Downtown")
        assertEquals(NavigationDrawerPillar.Business, context.pillar())
        assertTrue(context.showsBackToHub())
        assertEquals(listOf(null, "Manage", "Settings"), context.sections().map { it.overline })
        val slugs = context.sections().flatMap { section -> section.items.map { it.slug } }
        assertEquals(
            listOf(
                "overview", "profile", "locations-and-hours", "catalog", "pages",
                "post-task", "business-chat",
                "team", "reviews", "payments",
                "settings",
            ),
            slugs,
        )
    }
}
