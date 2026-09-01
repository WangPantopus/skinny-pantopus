@file:Suppress("PackageNaming", "FunctionNaming")

package app.pantopus.android.ui.screens.mailbox.earn

import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A10.11 — Covers the Earn VM's seeded (preview/test) path: load selects
 * populated (active earner) vs. empty (new earner) from the seeded
 * fixture, plus the shape of the sample fixtures. The live fetch path is
 * covered by CI integration; here the repository is a relaxed mock the
 * seeded path never touches. Mirrors the iOS `EarnViewModelTests`.
 */
class EarnViewModelTest {
    private fun makeVm(): EarnViewModel = EarnViewModel(repository = mockk(relaxed = true))

    @Test
    fun initial_state_is_loading() {
        val vm = makeVm()
        assertEquals(EarnUiState.Loading, vm.state.value)
    }

    @Test
    fun load_resolves_to_populated_for_active_earner() {
        val vm = makeVm()
        vm.setFixture(EarnSampleData.populated)
        vm.load()
        val state = vm.state.value
        assertTrue("expected Populated, got $state", state is EarnUiState.Populated)
        val content = (state as EarnUiState.Populated).content
        assertEquals("312.40", content.available)
        assertEquals("\$148.00", content.thisWeek)
        assertEquals("\$60.00", content.pending)
        assertEquals("7421", content.payoutMethod?.last4)
        assertTrue(content.autoCashOut?.isOn == true)
    }

    @Test
    fun load_resolves_to_empty_for_new_earner() {
        val vm = makeVm()
        vm.setFixture(null)
        vm.load()
        val state = vm.state.value
        assertTrue("expected Empty, got $state", state is EarnUiState.Empty)
        val ways = (state as EarnUiState.Empty).waysToEarn
        // The new-earner frame still carries the shared `Ways to earn` rows.
        assertEquals(3, ways.size)
        assertEquals(EarnWayKind.Browse, ways.first().kind)
    }

    @Test
    fun populated_fixture_shape() {
        val content = EarnSampleData.populated
        assertEquals(4, content.earnings.size)
        assertEquals("74%", content.weeklyGoal?.ringLabel)
        assertEquals("\$52 to go", content.weeklyGoal?.headline)
        assertEquals("YTD earnings \$4,920 · 1099 available mid-Jan", content.taxDocs?.bodyText)
        assertEquals("Every Friday · cleared balance", content.autoCashOut?.detail)
        assertEquals("Today", content.earnings[0].day)
    }

    @Test
    fun ways_to_earn_shape() {
        val ways = EarnSampleData.waysToEarn
        assertEquals(
            listOf(EarnWayKind.Browse, EarnWayKind.Refer, EarnWayKind.Offer),
            ways.map { it.kind },
        )
        // Only the first row is featured (the tinted Browse launcher).
        assertTrue(ways[0].featured)
        assertFalse(ways[1].featured)
        assertFalse(ways[2].featured)
        assertEquals(
            listOf(EarnAccent.Primary, EarnAccent.Home, EarnAccent.Business),
            ways.map { it.accent },
        )
    }

    @Test
    fun exactly_one_pending_earning() {
        val pending = EarnSampleData.populated.earnings.filter { it.status is EarnStatus.Pending }
        assertEquals(1, pending.size)
        assertEquals("60.00", pending.first().amount)
        assertEquals("Dec 3", (pending.first().status as EarnStatus.Pending).clearsLabel)
    }

    @Test
    fun earning_categories_are_money_in_subset() {
        val cats = EarnSampleData.populated.earnings.mapNotNull { it.category }.toSet()
        // Earn is money-in only — no bank / fee rows (those are Wallet's).
        assertEquals(
            setOf(
                EarnCategory.Cleaning,
                EarnCategory.PetCare,
                EarnCategory.Handyman,
                EarnCategory.ChildCare,
            ),
            cats,
        )
    }
}
