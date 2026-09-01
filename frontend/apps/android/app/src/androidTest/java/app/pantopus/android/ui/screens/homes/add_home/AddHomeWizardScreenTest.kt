@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CheckAddressRequest
import app.pantopus.android.data.api.models.homes.CheckAddressResponse
import app.pantopus.android.data.api.models.homes.CreateHomeRequest
import app.pantopus.android.data.api.models.homes.CreateHomeResponse
import app.pantopus.android.data.api.models.homes.HomeDto
import app.pantopus.android.data.api.models.homes.PropertySuggestionsRequest
import app.pantopus.android.data.api.models.homes.PropertySuggestionsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.shared.wizard.WizardShellTags
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test

/**
 * Screen-level tests for the Add Home wizard. We host the real screen
 * but drive form state through the VM's public API rather than
 * [performTextInput] — Compose UI Test's text-input plumbing has
 * fought every previous attempt on the macos-15 / Xcode 16.4 emulator,
 * and the wizard's state machine is what we actually want to verify.
 *
 * Where assertions on rendered state are unavoidable (the discard
 * dialog), we go through `compose.runOnIdle { vm.… }` to flush
 * recomposition before tapping the rendered control.
 */
class AddHomeWizardScreenTest {
    @get:Rule val compose = createComposeRule()

    private val repo: HomesRepository = mockk(relaxed = true)

    private val checkAddressOk =
        CheckAddressResponse(
            status = CheckAddressResponse.STATUS_NOT_FOUND,
        )

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

    private fun makeViewModel(): AddHomeWizardViewModel {
        coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns NetworkResult.Success(checkAddressOk)
        coEvery { repo.create(any<CreateHomeRequest>()) } returns NetworkResult.Success(createHomeResponse)
        // `runCheckAddress` also fans out to the ATTOM public-records lookup.
        // Unstubbed, the relaxed mock hands back an instance that is neither
        // Success nor Failure, and the exhaustive `when` in
        // `loadPropertySuggestions` throws NoWhenBranchMatchedException.
        coEvery { repo.propertySuggestions(any<PropertySuggestionsRequest>()) } returns
            NetworkResult.Success(PropertySuggestionsResponse())
        val networkMonitor =
            mockk<NetworkMonitor>(relaxed = true).also {
                every { it.isOnline } returns MutableStateFlow(true)
            }
        return AddHomeWizardViewModel(repo, mockk(relaxed = true), SavedStateHandle(), networkMonitor)
    }

    private fun AddHomeWizardViewModel.fillAddress() {
        selectAddressCandidate(AddHomeSampleData.nearbyHomes[0])
    }

    @Test
    fun continue_button_is_disabled_until_home_is_selected() {
        compose.setContent {
            AddHomeWizardScreen(onDismiss = {}, onOpenHomeDashboard = {}, viewModel = makeViewModel())
        }
        compose
            .onNodeWithTag(WizardShellTags.PRIMARY_CTA)
            .assertIsDisplayed()
            .assertIsNotEnabled()
    }

    @Test
    fun selecting_home_enables_continue() {
        val vm = makeViewModel()
        compose.setContent {
            AddHomeWizardScreen(onDismiss = {}, onOpenHomeDashboard = {}, viewModel = vm)
        }
        compose.runOnIdle { vm.fillAddress() }
        compose.waitForIdle()
        // Assert on the VM directly — chrome.primaryCtaEnabled is a pure
        // function of the form's current step + address completeness, so
        // it doesn't depend on Compose recomposition timing.
        assert(vm.chrome.primaryCtaEnabled) {
            "After selecting a home, Continue must be enabled."
        }
    }

    @Test
    fun close_on_dirty_form_shows_discard_confirm() {
        val vm = makeViewModel()
        var dismissed = false
        // Mutate the form BEFORE setContent so the initial composition
        // sees `chrome.dirty == true` on first render. Mutating after
        // setContent has been racy on the macos-15 emulator: the
        // StateFlow → collectAsStateWithLifecycle hop sometimes lands
        // after WizardShell's onLeading closure has already captured a
        // stale chrome.
        vm.updateSearchQuery("412 Elm")
        compose.setContent {
            AddHomeWizardScreen(
                onDismiss = { dismissed = true },
                onOpenHomeDashboard = {},
                viewModel = vm,
            )
        }
        compose.onNodeWithTag(WizardShellTags.LEADING).performClick()
        // Material 3 AlertDialog renders inside its own Popup window —
        // reach the visible surface by title text rather than testTag.
        // The popup creates matching text/button nodes that the emulator's
        // `isDisplayed` check can report as hidden even when the dialog is
        // on-screen, so this test verifies semantics existence plus the
        // important behaviour: a dirty close must not dismiss immediately.
        compose.waitUntil(timeoutMillis = 10_000) {
            compose.onAllNodesWithText("Discard your progress?").fetchSemanticsNodes().isNotEmpty()
        }
        assertFalse("Dirty close must show a discard confirmation instead of dismissing.", dismissed)
    }

    @Test
    fun close_on_empty_form_dismisses_immediately() {
        var dismissed = false
        compose.setContent {
            AddHomeWizardScreen(
                onDismiss = { dismissed = true },
                onOpenHomeDashboard = {},
                viewModel = makeViewModel(),
            )
        }
        compose.onNodeWithTag(WizardShellTags.LEADING).performClick()
        compose.waitForIdle()
        assert(dismissed) { "Empty step 1 must dismiss without prompting." }
    }

    @Test
    fun happy_path_reaches_success_step() {
        val vm = makeViewModel()
        compose.setContent {
            AddHomeWizardScreen(onDismiss = {}, onOpenHomeDashboard = {}, viewModel = vm)
        }

        // Drive every step through the VM. We stay inside `runOnIdle` so
        // each call lands on a settled composition; we then `waitUntil`
        // on the VM's StateFlow for the suspending coroutines (check
        // address, submit) to finish before advancing.
        compose.runOnIdle { vm.fillAddress() }
        compose.waitForIdle()

        // Step 1 → 2 (Confirm + runCheckAddress).
        compose.runOnIdle { vm.onPrimary() }
        compose.waitUntil(timeoutMillis = 15_000) { vm.state.value.addressCheck != null }

        // Step 2 → 3 (Role).
        compose.runOnIdle { vm.onPrimary() }

        // Step 3: pick Owner, advance to Review.
        compose.runOnIdle { vm.selectRole(AddHomeRole.Owner) }
        compose.runOnIdle { vm.onPrimary() }

        // Step 4: submit. Wait for the .Success transition.
        compose.runOnIdle { vm.onPrimary() }
        compose.waitUntil(timeoutMillis = 15_000) {
            vm.state.value.form.currentStep == AddHomeStep.Success
        }

        assert(vm.state.value.form.currentStep == AddHomeStep.Success) {
            "Wizard must reach Success after submit completes."
        }
        assert(vm.state.value.createdHomeId == "home_42") {
            "createdHomeId must capture the response's home id."
        }
    }
}
