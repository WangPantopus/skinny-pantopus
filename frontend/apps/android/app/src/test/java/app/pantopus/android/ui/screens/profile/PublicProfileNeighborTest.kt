@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * B.2 (A10.5) — content invariants for the canonical neighbor profile,
 * mirroring iOS `PublicProfileNeighborSnapshotTests`.
 */
class PublicProfileNeighborTest {
    @Test
    fun tabOrder_isAboutReviewsVerificationsPosts() {
        assertEquals(
            listOf(
                NeighborProfileTab.About,
                NeighborProfileTab.Reviews,
                NeighborProfileTab.Verifications,
                NeighborProfileTab.Posts,
            ),
            NeighborProfileTab.entries.toList(),
        )
    }

    @Test
    fun populatedFrame_content() {
        val c = PublicProfileSampleData.derekPopulated
        assertFalse(c.isNewNeighbor)
        assertEquals(47, c.reviewCount)
        assertEquals("Message", c.primaryCtaLabel)
        assertEquals(NeighborIdentity.Personal, c.hero.identity)
        assertEquals("Neighbor since 2022", c.hero.kicker)
        assertEquals(4, c.verifications.size)
        assertFalse(c.reviews.isEmpty())
        assertNull(c.mutuals)
    }

    @Test
    fun newNeighborFrame_degradesAndCarriesSecondarySections() {
        val c = PublicProfileSampleData.sashaNewNeighbor
        assertTrue(c.isNewNeighbor)
        assertEquals(0, c.reviewCount)
        assertTrue(c.reviews.isEmpty())
        assertEquals("Say hi", c.primaryCtaLabel)
        assertEquals(NeighborIdentity.Fresh, c.hero.identity)

        assertEquals(listOf("—", "0", "New"), c.stats.map { it.value })

        assertFalse(c.verifications.isEmpty())
        assertNotNull(c.mutuals)
        assertNotNull(c.welcome)
        assertEquals(4, c.mutuals?.count)
    }

    @Test
    fun identityChipLabels() {
        assertEquals("Personal · Verified", NeighborIdentity.Personal.label)
        assertEquals("Home · Verified", NeighborIdentity.Home.label)
        assertEquals("Business · Verified", NeighborIdentity.Business.label)
        assertEquals("Verified · New here", NeighborIdentity.Fresh.label)
    }

    @Test
    fun tabsPairsCarryReviewCount() {
        val tabs = PublicProfileSampleData.derekPopulated.tabs
        assertEquals(NeighborProfileTab.Reviews, tabs[1].first)
        assertEquals(47, tabs[1].second)
        assertNull(tabs[0].second)
    }
}
