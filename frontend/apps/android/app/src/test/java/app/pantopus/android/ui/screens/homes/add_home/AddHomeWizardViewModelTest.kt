@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.homes.CheckAddressRequest
import app.pantopus.android.data.api.models.homes.CheckAddressResponse
import app.pantopus.android.data.api.models.homes.HomeAddressValidationResponse
import app.pantopus.android.data.api.models.homes.HomeAddressVerdict
import app.pantopus.android.data.api.models.homes.PropertySuggestionsResponse
import app.pantopus.android.data.api.models.homes.ValidatedHomeAddress
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
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
class AddHomeWizardViewModelTest {
    private val repo: HomesRepository = mockk(relaxed = true)
    private val discoveryRepo: HomeDiscoveryRepository = mockk(relaxed = true)
    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns MutableStateFlow(true)
        }

    private val geo: GeoApi = mockk(relaxed = true)
    private val location: LocationProvider = mockk(relaxed = true)
    private val session: HomeClaimSessionScope = mockk(relaxed = true)
    private val sessions: HomeClaimSessionScopeFactory = mockk()
    private val invalidated = MutableStateFlow(false)
    private val scopeHash = "a".repeat(64)
    private val creationFixture = HomeCreationTestFixture()
    private val creations: HomeCreationFactory = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { sessions.create(any()) } returns session
        every { creations.create(any()) } answers { creationFixture.coordinator(session::requireCurrent) }
        every { session.isCurrent } answers { !invalidated.value }
        every { session.invalidated } returns invalidated
        every { session.storageIdentityHash } answers { scopeHash.takeUnless { invalidated.value } }
        coEvery { session.confirmCurrent() } answers { !invalidated.value }
        coEvery { repo.validateAddress(any()) } returns
            NetworkResult.Success(
                HomeAddressValidationResponse(
                    "ddc23700-0000-4000-8000-000000000010",
                    HomeAddressVerdict("OK", ValidatedHomeAddress("412 Elm Street", "3B", "Brooklyn", "NY", "11211", 40.7138, -73.9527)),
                ),
            )
        // A12.2 — the Confirm step runs the property-suggestions lookup
        // right after check-address clears. Stub it explicitly: a relaxed
        // mock would hand back a proxy that is neither `Success` nor
        // `Failure`, which the sealed `when` can't match.
        coEvery { repo.propertySuggestions(any()) } returns
            NetworkResult.Success(PropertySuggestionsResponse())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(savedStateHandle: SavedStateHandle = SavedStateHandle()) =
        AddHomeWizardViewModel(repo, discoveryRepo, savedStateHandle, networkMonitor, geo, location, sessions, creations)

    private fun fillAddress(vm: AddHomeWizardViewModel) {
        vm.selectAddressCandidate(AddHomeSampleData.nearbyHomes[0])
    }

    private fun fillBrooklynAddress(
        vm: AddHomeWizardViewModel,
        zipCode: String,
    ) {
        vm.updateField(AddressField.Street, "412 Elm Street")
        vm.updateField(AddressField.Unit, "3B")
        vm.updateField(AddressField.City, "Brooklyn")
        vm.updateField(AddressField.State, "NY")
        vm.updateField(AddressField.Zip, zipCode)
    }

    private val checkAddressOk =
        CheckAddressResponse(
            status = CheckAddressResponse.STATUS_NOT_FOUND,
        )

    // MARK: - Initial chrome

    @Test
    fun initial_chrome_reflects_address_step() {
        val vm = makeVm()
        val chrome = vm.chrome
        assertEquals("Find your home", chrome.title)
        assertEquals("Continue", chrome.primaryCtaLabel)
        assertFalse(
            "Continue must be disabled until a home is selected.",
            chrome.primaryCtaEnabled,
        )
        assertEquals(WizardLeadingControl.Close, chrome.leading)
        assertEquals(
            WizardProgressLabel.StepOf(current = 1, total = 4),
            chrome.progressLabel,
        )
    }

    @Test
    fun selected_home_enables_continue() {
        val vm = makeVm()
        fillAddress(vm)
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    // MARK: - Address → Confirm

    @Test
    fun primary_advances_and_fires_check_address() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            val vm = makeVm()
            fillAddress(vm)
            vm.onPrimary()
            // Allow advance() coroutine + check-address to flush.
            advanceTimeBy(50)
            assertEquals(AddHomeStep.Confirm, vm.state.value.form.currentStep)
            assertNotNull(vm.state.value.addressCheck)
            assertEquals(WizardLeadingControl.Back, vm.chrome.leading)
        }

    @Test
    fun check_address_error_surfaces_message() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "down"))
            val vm = makeVm()
            fillAddress(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(AddHomeStep.Confirm, vm.state.value.form.currentStep)
            assertNull(vm.state.value.addressCheck)
            assertNotNull(vm.state.value.errorMessage)
        }

    @Test
    fun zip_mismatch_disables_continue_until_apply() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            val vm = makeVm()
            fillBrooklynAddress(vm, "11201")
            vm.onPrimary()
            advanceTimeBy(50)

            assertEquals(AddHomeStep.Confirm, vm.state.value.form.currentStep)
            assertEquals("11201", vm.state.value.zipMismatch?.enteredZip)
            assertEquals("11211", vm.state.value.zipMismatch?.correctedZip)
            assertFalse(vm.chrome.primaryCtaEnabled)
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(AddHomeStep.Confirm, vm.state.value.form.currentStep)

            vm.applyGeocodedZip()

            assertEquals("11211", vm.state.value.form.address.zipCode)
            assertNull(vm.state.value.zipMismatch)
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    // MARK: - Back navigation

    @Test
    fun back_on_confirm_returns_to_address() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            val vm = makeVm()
            fillAddress(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onLeading()
            assertEquals(AddHomeStep.Address, vm.state.value.form.currentStep)
        }

    // MARK: - Role gating

    @Test
    fun role_step_requires_selection() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            val vm = makeVm()
            fillAddress(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            // Confirm → Role
            vm.onPrimary()
            advanceTimeBy(50)
            assertEquals(AddHomeStep.Role, vm.state.value.form.currentStep)
            assertFalse(vm.chrome.primaryCtaEnabled)
            vm.selectRole(AddHomeRole.Owner)
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    // MARK: - Submit happy path

    @Test
    fun confirmed_creation_shows_saved_result_without_granting_dashboard_access() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)

            val vm = makeVm()
            fillAddress(vm)
            vm.onPrimary()
            advanceTimeBy(50) // Confirm
            vm.onPrimary()
            advanceTimeBy(50) // Role
            vm.selectRole(AddHomeRole.Owner)
            vm.onPrimary()
            advanceTimeBy(50) // Review
            vm.onPrimary()
            advanceTimeBy(50) // Submit → Success

            assertTrue(vm.state.value.showsCreationRecovery)
            assertEquals("completed", vm.state.value.creationOutcome?.state)
            assertEquals(HomeCreationTestFixture.HOME_ID, vm.state.value.createdHomeId)
            assertEquals("Open My Homes", vm.chrome.primaryCtaLabel)
            assertNull(vm.pendingEvent.value)
            assertNull(vm.chrome.secondaryCta)
            assertFalse(
                "Success step must hide the segmented progress bar.",
                vm.chrome.showsProgressBar,
            )
        }

    @Test
    fun unknown_submission_retains_original_request_and_recovery_choices() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            creationFixture.failTransport = true

            val vm = makeVm()
            fillAddress(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.selectRole(AddHomeRole.Owner)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)

            assertEquals(AddHomeStep.Review, vm.state.value.form.currentStep)
            assertNotNull(vm.state.value.errorMessage)
            assertTrue(vm.state.value.showsCreationRecovery)
            assertNotNull(creationFixture.saved)
            assertEquals("Try saving again", vm.chrome.primaryCtaLabel)
        }

    // MARK: - Confirmed creation CTAs

    @Test
    fun confirmed_creation_acknowledgment_opens_current_homes_and_clears_command() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)

            val vm = makeVm()
            fillAddress(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.selectRole(AddHomeRole.Owner)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)
            // Now on success step.
            vm.pendingEvent.test {
                // Drain the initial null.
                assertNull(awaitItem())
                vm.onPrimary()
                val event = awaitItem()
                assertEquals(AddHomeOutboundEvent.OpenHomes, event)
                assertNull(creationFixture.saved)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun closing_confirmed_creation_retains_unacknowledged_outcome() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)

            val vm = makeVm()
            fillAddress(vm)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.selectRole(AddHomeRole.Owner)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onPrimary()
            advanceTimeBy(50)
            vm.onLeading()
            assertEquals(AddHomeOutboundEvent.Dismiss, vm.pendingEvent.value)
            assertEquals("completed", creationFixture.saved?.outcome?.state)
        }

    // MARK: - Close-confirm

    @Test
    fun close_on_empty_step1_is_clean() {
        val vm = makeVm()
        assertFalse(vm.chrome.dirty)
    }

    @Test
    fun close_on_filled_step1_is_dirty() {
        val vm = makeVm()
        fillAddress(vm)
        assertTrue(vm.chrome.dirty)
    }

    // MARK: - Search

    @Test
    fun search_query_shows_autocomplete_without_enabling_continue() {
        val vm = makeVm()
        vm.updateSearchQuery("412 Elm")
        assertFalse(vm.showsAutocomplete)
        assertTrue(vm.state.value.searchResults.isEmpty())
        vm.updateSearchQuery("")
        assertFalse(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun select_address_candidate_populates_address_and_enables_continue() {
        val vm = makeVm()
        val candidate = AddHomeSampleData.nearbyHomes[0]
        vm.selectAddressCandidate(candidate)
        assertEquals(candidate.id, vm.state.value.selectedHomeId)
        assertEquals(candidate.line1, vm.state.value.homeSearchQuery)
        assertEquals(candidate.addressFields, vm.state.value.form.address)
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun candidate_never_supplies_validation_or_claim_authority() {
        val vm = makeVm()
        vm.selectAddressCandidate(AddHomeSampleData.nearbyHomes[2])
        assertNotNull(vm.state.value.selectedHomeId)
        assertTrue(vm.chrome.primaryCtaEnabled)
        assertNull(vm.state.value.validatedAddressId)
    }

    // MARK: - Saved-state restore

    @Test
    fun saved_state_handle_restores_form_on_construct() {
        val handle =
            SavedStateHandle(
                mapOf(
                    "addHome.sessionScope" to scopeHash,
                    "addHome.step" to AddHomeStep.Role.ordinal0,
                    "addHome.street" to "412 Elm St",
                    "addHome.unit" to "Apt 3B",
                    "addHome.city" to "Brooklyn",
                    "addHome.state" to "NY",
                    "addHome.zip" to "11211",
                    "addHome.primary" to true,
                    "addHome.role" to "Tenant",
                ),
            )
        val vm = makeVm(handle)
        assertEquals(AddHomeStep.Address, vm.state.value.form.currentStep)
        assertEquals("412 Elm St", vm.state.value.form.address.street)
        assertEquals(AddHomeRole.Tenant, vm.state.value.form.role)
        assertNull(vm.state.value.selectedHomeId)
        assertNull(vm.state.value.validatedAddressId)
    }

    @Test
    fun changed_session_discards_saved_address_and_role() {
        val handle = SavedStateHandle(mapOf("addHome.sessionScope" to "old", "addHome.street" to "Private prior address"))
        val vm = makeVm(handle)
        assertEquals(AddHomeFormState.EMPTY, vm.state.value.form)
        assertNull(handle.get<String>("addHome.street"))
    }

    @Test
    fun partial_manual_draft_restores_visible_fields() {
        val vm = makeVm(SavedStateHandle(mapOf("addHome.sessionScope" to scopeHash, "addHome.city" to "Test")))
        assertTrue(vm.state.value.isManualEntry)
        assertEquals("Test", vm.state.value.form.address.city)
        assertFalse(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun background_retires_a_held_validation_and_requires_retry() =
        runTest {
            val pending = kotlinx.coroutines.CompletableDeferred<NetworkResult<HomeAddressValidationResponse>>()
            coEvery { repo.validateAddress(any()) } coAnswers { pending.await() }
            val vm = makeVm()
            fillBrooklynAddress(vm, "11211")
            vm.onPrimary()
            assertTrue(vm.state.value.isCheckingAddress)
            vm.suspendAddressEntry()
            pending.complete(
                NetworkResult.Success(
                    HomeAddressValidationResponse(
                        "ddc23700-0000-4000-8000-000000000010",
                        HomeAddressVerdict("OK", ValidatedHomeAddress("412 Elm Street", "3B", "Brooklyn", "NY", "11211", 40.7, -73.9)),
                    ),
                ),
            )
            testScheduler.runCurrent()
            assertEquals(AddHomeStep.Address, vm.state.value.form.currentStep)
            assertNull(vm.state.value.validatedAddressId)
            assertNull(vm.state.value.addressCheck)
            assertFalse(vm.state.value.isCheckingAddress)
        }

    @Test
    fun session_retirement_clears_in_memory_and_restored_form() =
        runTest {
            val handle = SavedStateHandle()
            val vm = makeVm(handle)
            fillBrooklynAddress(vm, "11211")
            invalidated.value = true
            assertFalse(vm.state.value.isSessionCurrent)
            assertEquals(AddHomeFormState.EMPTY, vm.state.value.form)
            assertNull(handle.get<String>("addHome.street"))
            assertFalse(vm.chrome.primaryCtaEnabled)
        }

    @Test
    fun discarded_draft_cannot_be_restored_by_disposal() {
        val handle = SavedStateHandle()
        val vm = makeVm(handle)
        fillBrooklynAddress(vm, "11211")
        vm.onDiscard()
        vm.suspendAddressEntry()
        assertEquals(AddHomeFormState.EMPTY, makeVm(handle).state.value.form)
        assertNull(handle.get<String>("addHome.street"))
    }
}
