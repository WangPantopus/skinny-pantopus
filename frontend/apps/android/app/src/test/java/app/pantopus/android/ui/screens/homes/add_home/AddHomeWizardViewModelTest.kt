@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.lifecycle.SavedStateHandle
import app.cash.turbine.test
import app.pantopus.android.data.api.models.homes.CheckAddressRequest
import app.pantopus.android.data.api.models.homes.CheckAddressResponse
import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.models.homes.CreateHomeResponse
import app.pantopus.android.data.api.models.homes.HomeDto
import app.pantopus.android.data.api.models.homes.NormalizedAddressDto
import app.pantopus.android.data.api.models.homes.PropertySuggestionsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homediscovery.HomeDiscoveryRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
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

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
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
        AddHomeWizardViewModel(repo, discoveryRepo, savedStateHandle, networkMonitor)

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

    private val createHomeResponse =
        CreateHomeResponse(
            message = "ok",
            home =
                HomeDto(
                    id = "home_42",
                    name = "412 Elm St",
                    address = "412 Elm St",
                    city = "Portland",
                    state = "OR",
                    zipcode = "97214",
                    homeType = null,
                    visibility = "public",
                    description = null,
                    createdAt = "2025-01-01T00:00:00Z",
                    updatedAt = "2025-01-01T00:00:00Z",
                ),
            requiresVerification = false,
            verificationType = null,
            role = "owner",
        )

    private val checkAddressOk =
        CheckAddressResponse(
            status = CheckAddressResponse.STATUS_NOT_FOUND,
        )

    private val checkAddressZipMismatch =
        CheckAddressResponse(
            status = CheckAddressResponse.STATUS_NOT_FOUND,
            normalizedAddress =
                NormalizedAddressDto(
                    street = "412 Elm Street",
                    unit = "3B",
                    city = "Brooklyn",
                    state = "NY",
                    zipCodeSnake = "11211",
                    latitude = 40.7138,
                    longitude = -73.9527,
                    isMultiUnit = true,
                ),
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
                NetworkResult.Success(checkAddressZipMismatch)
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
    fun submit_advances_to_success_and_records_home_id() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            coEvery { repo.create(any<CreateHomeRequest>()) } returns
                NetworkResult.Success(createHomeResponse)

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

            assertEquals(AddHomeStep.Success, vm.state.value.form.currentStep)
            assertEquals("home_42", vm.state.value.createdHomeId)
            assertEquals("View home", vm.chrome.primaryCtaLabel)
            assertEquals("addHomeBackToHub", vm.chrome.secondaryCta?.testTag)
            assertFalse(
                "Success step must hide the segmented progress bar.",
                vm.chrome.showsProgressBar,
            )
        }

    @Test
    fun submit_error_keeps_user_on_review() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            coEvery { repo.create(any<CreateHomeRequest>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))

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
        }

    // MARK: - Success step CTAs

    @Test
    fun success_primary_fires_open_dashboard_event() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            coEvery { repo.create(any<CreateHomeRequest>()) } returns
                NetworkResult.Success(createHomeResponse)

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
                assertTrue(event is AddHomeOutboundEvent.OpenHomeDashboard)
                assertEquals("home_42", (event as AddHomeOutboundEvent.OpenHomeDashboard).homeId)
                cancelAndConsumeRemainingEvents()
            }
        }

    @Test
    fun success_secondary_fires_dismiss_event() =
        runTest {
            coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns
                NetworkResult.Success(checkAddressOk)
            coEvery { repo.create(any<CreateHomeRequest>()) } returns
                NetworkResult.Success(createHomeResponse)

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
            vm.onSecondary()
            assertEquals(AddHomeOutboundEvent.Dismiss, vm.pendingEvent.value)
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
        assertTrue(vm.showsAutocomplete)
        assertEquals(5, vm.autocompleteResults.size)
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
    fun claimed_candidate_does_not_select() {
        val vm = makeVm()
        vm.selectAddressCandidate(AddHomeSampleData.nearbyHomes[2])
        assertNull(vm.state.value.selectedHomeId)
        assertFalse(vm.chrome.primaryCtaEnabled)
    }

    // MARK: - Saved-state restore

    @Test
    fun saved_state_handle_restores_form_on_construct() {
        val handle =
            SavedStateHandle(
                mapOf(
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
        val vm = AddHomeWizardViewModel(repo, discoveryRepo, handle, networkMonitor)
        assertEquals(AddHomeStep.Role, vm.state.value.form.currentStep)
        assertEquals("412 Elm St", vm.state.value.form.address.street)
        assertEquals(AddHomeRole.Tenant, vm.state.value.form.role)
        assertEquals(AddHomeSampleData.nearbyHomes[0].id, vm.state.value.selectedHomeId)
    }
}
