@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * B.1 — state-projection coverage for the Mailbox root (drawer-tabs
 * hybrid). Mirrors the iOS `MailboxRootViewModelTests`: the three design
 * frames (Me/Incoming, Biz/Counter, Earn/Incoming-Empty) plus the
 * preserve-tab and per-(drawer, tab) count behaviours.
 */
class MailboxRootViewModelTest {
    private fun rows(state: ListOfRowsUiState): List<RowModel> =
        (state as? ListOfRowsUiState.Loaded)?.sections?.flatMap { it.rows } ?: emptyList()

    private fun headers(state: ListOfRowsUiState): List<String> =
        (state as? ListOfRowsUiState.Loaded)?.sections?.mapNotNull { it.header } ?: emptyList()

    // ─── Frame 01 · Me / Incoming ──────────────────────────────────

    @Test
    fun meIncoming_populatedFrame() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Me, initialTab = MailboxTab.Incoming)
        vm.load()

        assertTrue(vm.state.value is ListOfRowsUiState.Loaded)
        assertEquals(listOf("Today", "Yesterday"), headers(vm.state.value))
        assertEquals(5, rows(vm.state.value).size)
        assertEquals("Echo Pop arriving today by 8pm", rows(vm.state.value).first().title)
    }

    // ─── Frame 02 · Biz / Counter ──────────────────────────────────

    @Test
    fun bizCounter_populatedFrame() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Business, initialTab = MailboxTab.Counter)
        vm.load()

        assertTrue(vm.state.value is ListOfRowsUiState.Loaded)
        assertEquals(listOf("Due this week", "Awaiting your response"), headers(vm.state.value))
        assertEquals(5, rows(vm.state.value).size)
    }

    // ─── Frame 03 · Earn / Incoming (empty) ────────────────────────

    @Test
    fun earnIncoming_emptyFrame() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Earn, initialTab = MailboxTab.Incoming)
        vm.load()

        val state = vm.state.value
        assertTrue(state is ListOfRowsUiState.Empty)
        state as ListOfRowsUiState.Empty
        assertEquals("No earn items yet", state.headline)
        assertEquals("Open Earn dashboard", state.ctaTitle)
    }

    @Test
    fun everyEarnTabIsEmpty() {
        MailboxTab.entries.forEach { tab ->
            val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Earn, initialTab = tab)
            vm.load()
            assertTrue("Earn/${tab.id} should be empty", vm.state.value is ListOfRowsUiState.Empty)
        }
    }

    // ─── Drawer switch preserves the selected tab ──────────────────

    @Test
    fun drawerSwitchPreservesSelectedTab() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Me, initialTab = MailboxTab.Incoming)
        vm.load()

        vm.selectTab(MailboxTab.Counter)
        assertEquals(MailboxTab.Counter, vm.selectedTab.value)

        vm.selectDrawer(MailboxDrawer.Business)
        assertEquals(MailboxTab.Counter, vm.selectedTab.value)
        assertEquals(MailboxDrawer.Business, vm.selectedDrawer.value)
        assertEquals(listOf("Due this week", "Awaiting your response"), headers(vm.state.value))
    }

    @Test
    fun selectingTabRebuildsState() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Me, initialTab = MailboxTab.Incoming)
        vm.load()
        assertEquals(listOf("Today", "Yesterday"), headers(vm.state.value))

        vm.selectTab(MailboxTab.Counter)
        assertEquals(listOf("Awaiting your response"), headers(vm.state.value))
    }

    // ─── Per-(drawer, tab) unread counts ───────────────────────────

    @Test
    fun tabBadgesForMeDrawer() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Me, initialTab = MailboxTab.Incoming)
        assertEquals(3, vm.tabBadge(MailboxTab.Incoming))
        assertEquals(2, vm.tabBadge(MailboxTab.Counter))
        assertNull(vm.tabBadge(MailboxTab.Vault))
    }

    @Test
    fun drawerBadgesAggregateUnread() {
        val vm = MailboxRootViewModel()
        assertEquals(5, vm.drawerBadge(MailboxDrawer.Me))
        assertEquals(3, vm.drawerBadge(MailboxDrawer.Home))
        assertEquals(0, vm.drawerBadge(MailboxDrawer.Earn))
    }

    @Test
    fun unreadCountForBizCounter() {
        val vm = MailboxRootViewModel()
        assertEquals(4, vm.unreadCount(MailboxDrawer.Business, MailboxTab.Counter))
    }

    // ─── Trust override flows into the row chips ────────────────────

    @Test
    fun sampleRowCarriesPerItemTrust() {
        val vm = MailboxRootViewModel(initialDrawer = MailboxDrawer.Me, initialTab = MailboxTab.Incoming)
        vm.load()

        val coupon = rows(vm.state.value).first { it.id == "me-in-3" }
        assertEquals("Partial", coupon.chips?.last()?.text)
    }

    // ─── Seeded states ─────────────────────────────────────────────

    @Test
    fun seededErrorStateSurvivesLoad() {
        val vm = MailboxRootViewModel(seededState = ListOfRowsUiState.Error("Couldn't load mail."))
        vm.load()
        assertTrue(vm.state.value is ListOfRowsUiState.Error)
    }

    @Test
    fun initialStateIsLoading() {
        val vm = MailboxRootViewModel()
        assertTrue(vm.state.value is ListOfRowsUiState.Loading)
    }
}
