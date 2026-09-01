@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.vacation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/**
 * A14.8 — projection coverage for the Vacation Hold view-model. Mirrors
 * the iOS `VacationHoldViewModelTests`: scope-toggle behaviour, civic
 * lock, span recompute, and the scheduling → active mode flip on Save.
 */
class VacationHoldViewModelTest {
    @Test
    fun schedulingSeed_matchesSampleDraft() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Scheduling)
        val mode = vm.mode.value
        assertTrue(mode is VacationHoldMode.Scheduling)
        mode as VacationHoldMode.Scheduling
        assertEquals(13, mode.draft.spanDays)
        assertTrue(mode.draft.isValid)
        assertEquals(4, mode.draft.scopes.size)
        assertTrue(mode.draft.scopes.any { it.kind == VacationHoldScope.Kind.Civic && it.isLocked })
        assertEquals("Save", vm.trailingActionLabel)
        assertTrue(vm.trailingActionEnabled)
    }

    @Test
    fun activeSeed_matchesSampleHold() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Active)
        val mode = vm.mode.value
        assertTrue(mode is VacationHoldMode.Active)
        mode as VacationHoldMode.Active
        assertEquals(5, mode.hold.daysLeft)
        assertEquals("Jun 9", mode.hold.untilLabel)
        assertEquals(3, mode.hold.stats.size)
        assertEquals(4, mode.hold.heldItems.size)
        assertEquals("Edit", vm.trailingActionLabel)
        assertTrue(vm.trailingActionEnabled)
    }

    @Test
    fun toggleScope_flipsMail() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Scheduling)
        vm.toggleScope(VacationHoldScope.Kind.Mail, isOn = false)
        val draft = (vm.mode.value as VacationHoldMode.Scheduling).draft
        assertEquals(false, draft.scopes.first { it.kind == VacationHoldScope.Kind.Mail }.isOn)
    }

    @Test
    fun civicLockedScope_isImmutable() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Scheduling)
        vm.toggleScope(VacationHoldScope.Kind.Civic, isOn = true)
        val draft = (vm.mode.value as VacationHoldMode.Scheduling).draft
        val civic = draft.scopes.first { it.kind == VacationHoldScope.Kind.Civic }
        assertTrue(civic.isLocked)
        assertFalse(civic.isOn)
    }

    @Test
    fun saveDisabledWhenAllScopesOff() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Scheduling)
        vm.toggleScope(VacationHoldScope.Kind.Mail, isOn = false)
        vm.toggleScope(VacationHoldScope.Kind.Packages, isOn = false)
        vm.toggleScope(VacationHoldScope.Kind.MarketplacePickups, isOn = false)
        assertFalse(vm.trailingActionEnabled)
    }

    @Test
    fun setFromDate_recomputesSpan() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Scheduling)
        vm.setFromDate(LocalDate.of(2026, 6, 5))
        val draft = (vm.mode.value as VacationHoldMode.Scheduling).draft
        assertEquals(5, draft.spanDays)
    }

    @Test
    fun setToDateBeforeFrom_clampsToFrom() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Scheduling)
        val initial = (vm.mode.value as VacationHoldMode.Scheduling).draft
        vm.setToDate(initial.fromDate.minusDays(5))
        val draft = (vm.mode.value as VacationHoldMode.Scheduling).draft
        assertEquals(initial.fromDate, draft.toDate)
    }

    @Test
    fun save_flipsSchedulingToActive() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Scheduling)
        vm.tapTrailingAction()
        assertTrue(vm.mode.value is VacationHoldMode.Active)
        assertEquals("Edit", vm.trailingActionLabel)
    }

    @Test
    fun edit_flipsActiveToScheduling() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Active)
        vm.tapTrailingAction()
        assertTrue(vm.mode.value is VacationHoldMode.Scheduling)
        assertEquals("Save", vm.trailingActionLabel)
    }

    @Test
    fun endHoldEarly_flipsActiveToScheduling() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Active)
        vm.endHoldEarly()
        assertTrue(vm.mode.value is VacationHoldMode.Scheduling)
        assertEquals("Save", vm.trailingActionLabel)
    }

    @Test
    fun toggleForwardingOff_clearsAddressRow() {
        val vm = VacationHoldViewModel(VacationHoldSeed.Scheduling)
        vm.toggleForwarding(isOn = false)
        val draft = (vm.mode.value as VacationHoldMode.Scheduling).draft
        assertFalse(draft.forwardingEnabled)
    }
}
