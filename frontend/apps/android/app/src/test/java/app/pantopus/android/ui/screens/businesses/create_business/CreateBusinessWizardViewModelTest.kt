@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business

import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CreateBusinessWizardViewModelTest {
    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): CreateBusinessWizardViewModel =
        CreateBusinessWizardViewModel(
            businessesRepository = mockk(relaxed = true),
            uploadRepository = mockk(relaxed = true),
        )

    @Test
    fun initial_state_is_pick_category_with_home_default() {
        val vm = makeVm()
        assertEquals(CreateBusinessStep.PickCategory, vm.state.value.currentStep)
        assertEquals(BusinessCategory.Home, vm.state.value.selectedCategory)
        assertEquals("Continue", vm.chrome.primaryCtaLabel)
        assertTrue(vm.chrome.primaryCtaEnabled)
        assertFalse("Default home selection should not be dirty.", vm.chrome.dirty)
        assertEquals(
            WizardProgressLabel.StepOf(current = 1, total = 4),
            vm.chrome.progressLabel,
        )
        assertEquals(WizardLeadingControl.Close, vm.chrome.leading)
    }

    @Test
    fun selecting_non_default_category_marks_dirty() {
        val vm = makeVm()
        vm.selectCategory(BusinessCategory.Tech)
        assertEquals(BusinessCategory.Tech, vm.state.value.selectedCategory)
        assertTrue("Picking a non-default tile must mark the wizard dirty.", vm.chrome.dirty)
    }

    @Test
    fun typing_search_query_marks_dirty() {
        val vm = makeVm()
        vm.setSearchText("tutor")
        assertTrue(vm.state.value.isSearchActive)
        assertTrue(vm.chrome.dirty)
    }

    @Test
    fun search_hits_are_filtered_and_capped() {
        val vm = makeVm()
        vm.setSearchText("tutor")
        val hits = vm.state.value.searchHits
        assertEquals(3, hits.size)
        assertEquals("tutoring-core", hits.first().id)
        assertEquals(BusinessCategory.Personal, hits.first().category)
        assertTrue(hits.all { it.label.lowercase().contains("tutor") })
    }

    @Test
    fun empty_search_yields_no_hits() {
        val vm = makeVm()
        vm.setSearchText("   ")
        assertTrue(vm.state.value.searchHits.isEmpty())
    }

    @Test
    fun selecting_search_hit_selects_category_and_clears_query() {
        val vm = makeVm()
        vm.setSearchText("tutor")
        val hit = vm.state.value.searchHits.first()
        vm.selectSearchHit(hit)
        assertEquals(hit.category, vm.state.value.selectedCategory)
        assertEquals("", vm.state.value.searchText)
        assertFalse(vm.state.value.isSearchActive)
    }

    @Test
    fun primary_from_pick_category_advances_to_legal_info() {
        val vm = makeVm()
        vm.onPrimary()
        assertEquals(CreateBusinessStep.LegalInfo, vm.state.value.currentStep)
        assertEquals(
            WizardProgressLabel.StepOf(current = 2, total = 4),
            vm.chrome.progressLabel,
        )
        assertEquals("Next", vm.chrome.primaryCtaLabel)
    }

    @Test
    fun primary_from_legal_info_requires_basic_fields() {
        val vm = makeVm()
        vm.onPrimary() // → legal
        vm.onPrimary() // blocked without fields
        assertEquals(CreateBusinessStep.LegalInfo, vm.state.value.currentStep)
        assertNotNull(vm.state.value.submitError)
    }

    /**
     * A12.10 parity: Save-as-draft is a confirm-step-only ghost, so the
     * earlier steps must not render it.
     */
    @Test
    fun save_as_draft_ghost_is_confirm_step_only() {
        val vm = makeVm()
        assertNull(vm.chrome.secondaryCta)
        vm.onPrimary() // → legal info
        assertNull(vm.chrome.secondaryCta)
        // Secondary taps outside the confirm step are inert.
        vm.onSecondary()
        assertEquals(CreateBusinessStep.LegalInfo, vm.state.value.currentStep)
        assertNull(vm.pendingEvent.value)
    }

    @Test
    fun logo_pick_is_held_until_create_and_can_be_skipped() {
        val vm = makeVm()
        assertNull(vm.state.value.logoPick)

        vm.setLogoPick(
            CreateBusinessLogoPick(
                bytes = byteArrayOf(1),
                fileName = "business-logo-abc.jpg",
                mimeType = "image/jpeg",
            ),
        )
        assertEquals("business-logo-abc.jpg", vm.state.value.logoPick?.fileName)
        assertFalse(vm.state.value.logoSkipped)

        vm.skipLogo()
        assertNull(vm.state.value.logoPick)
        assertTrue(vm.state.value.logoSkipped)

        vm.unskipLogo()
        assertFalse(vm.state.value.logoSkipped)
    }

    @Test
    fun back_from_legal_info_returns_to_pick_category() {
        val vm = makeVm()
        vm.onPrimary()
        vm.onLeading()
        assertEquals(CreateBusinessStep.PickCategory, vm.state.value.currentStep)
    }

    @Test
    fun back_clears_submit_error_so_it_does_not_leak_onto_the_previous_step() {
        val vm = makeVm()
        vm.onPrimary() // → legal
        vm.onPrimary() // blocked, sets submitError
        assertNotNull(vm.state.value.submitError)

        vm.onLeading() // → pick category

        assertEquals(CreateBusinessStep.PickCategory, vm.state.value.currentStep)
        assertNull(vm.state.value.submitError)
    }

    /**
     * `createBusinessFullSchema` rejects `name > 100` / `description > 2000`,
     * so the setters clamp instead of letting the wizard reach a 400.
     * (`username` is covered by inspection — its setter also schedules the
     * availability check, which would fire a request from a unit test.)
     */
    @Test
    fun field_setters_clamp_to_create_full_schema_limits() {
        val vm = makeVm()
        vm.setBusinessName("a".repeat(150))
        vm.setDescription("c".repeat(2500))
        assertEquals(MAX_BUSINESS_NAME_LENGTH, vm.state.value.businessName.length)
        assertEquals(MAX_BUSINESS_DESCRIPTION_LENGTH, vm.state.value.description.length)
    }

    @Test
    fun close_on_pick_category_dispatches_dismiss() {
        val vm = makeVm()
        vm.onLeading()
        assertEquals(CreateBusinessOutboundEvent.Dismiss, vm.pendingEvent.value)
    }

    @Test
    fun custom_category_submit_stays_on_pick_category_with_backend_error() =
        runTest {
            val vm = makeVm()
            vm.setSearchText("alpaca grooming")
            vm.submitCustomCategory()
            assertEquals(BusinessCategory.Home, vm.state.value.selectedCategory)
            assertEquals(CreateBusinessStep.PickCategory, vm.state.value.currentStep)
            assertEquals("alpaca grooming", vm.state.value.searchText)
            assertEquals(
                "Custom categories aren't available yet. Pick a listed category instead.",
                vm.state.value.submitError,
            )
            assertFalse(vm.state.value.isSubmittingCustom)
        }

    @Test
    fun custom_category_submit_noop_on_empty_query() {
        val vm = makeVm()
        vm.setSearchText("   ")
        vm.submitCustomCategory()
        assertEquals(CreateBusinessStep.PickCategory, vm.state.value.currentStep)
    }

    @Test
    fun what_you_get_only_visible_for_home_services() {
        val vm = makeVm()
        assertFalse("Default .Home should show the strip.", vm.state.value.whatYouGetItems.isEmpty())
        vm.selectCategory(BusinessCategory.Tech)
        assertTrue(
            "Other categories don't have a payload yet.",
            vm.state.value.whatYouGetItems.isEmpty(),
        )
    }

    @Test
    fun pending_event_acknowledge_clears_to_null() {
        val vm = makeVm()
        vm.onLeading()
        assertNotNull(vm.pendingEvent.value)
        vm.acknowledgeEvent()
        assertNull(vm.pendingEvent.value)
    }
}
