@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CheckAddressRequest
import app.pantopus.android.data.api.models.homes.CheckAddressResponse
import app.pantopus.android.data.api.models.homes.HomeAddressValidationResponse
import app.pantopus.android.data.api.models.homes.HomeAddressVerdict
import app.pantopus.android.data.api.models.homes.PropertySuggestionsRequest
import app.pantopus.android.data.api.models.homes.PropertySuggestionsResponse
import app.pantopus.android.data.api.models.homes.ValidatedHomeAddress
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeCreationCodec
import app.pantopus.android.data.homes.HomeCreationOutcome
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.homes.PendingHomeCreation
import app.pantopus.android.data.homes.PendingHomeCreationStore
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.wizard.WizardShellTags
import com.squareup.moshi.Moshi
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

    private fun makeViewModel(): AddHomeWizardViewModel {
        coEvery { repo.validateAddress(any()) } returns
            NetworkResult.Success(
                HomeAddressValidationResponse(
                    "ddc23800-0000-4000-8000-000000000010",
                    HomeAddressVerdict("OK", ValidatedHomeAddress("412 Elm St", "Apt 3B", "Brooklyn", "NY", "11211", 40.7138, -73.9527)),
                ),
            )
        coEvery { repo.checkAddress(any<CheckAddressRequest>()) } returns NetworkResult.Success(checkAddressOk)
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
        val session = mockk<HomeClaimSessionScope>(relaxed = true)
        every { session.isCurrent } returns true
        every { session.invalidated } returns MutableStateFlow(false)
        every { session.storageIdentityHash } returns "a".repeat(64)
        coEvery { session.confirmCurrent() } returns true
        val sessions = mockk<HomeClaimSessionScopeFactory>()
        every { sessions.create(any()) } returns session
        val codec = HomeCreationCodec(Moshi.Builder().build())
        val scope = HomeCreationScope("http://127.0.0.1:18084/", "ddc23800-0000-4000-8000-000000000001")
        var saved: PendingHomeCreation? = null
        val store =
            object : PendingHomeCreationStore {
                override suspend fun read(scope: HomeCreationScope): PendingHomeCreation? = saved

                override suspend fun replace(
                    scope: HomeCreationScope,
                    expected: PendingHomeCreation?,
                    next: PendingHomeCreation?,
                ) {
                    check(saved == expected)
                    saved = next
                }
            }
        val creation =
            HomeCreationCoordinator(scope, store, codec, { draft, _ ->
                HomeCreationOutcome(
                    state = "completed",
                    command = HomeCreationOutcome.Command(scope.actorId, draft.requestId, "2026-09-11T12:00:00Z", "2026-09-11T12:00:01Z"),
                    home = HomeCreationOutcome.Home("ddc23800-0000-4000-8000-000000000042"),
                    ownershipClaimId = "ddc23800-0000-4000-8000-000000000043", accessSecretIds = emptyList(),
                    role = "owner", requiresVerification = true, verificationType = "ownership", currentAccess = "not_checked",
                )
            }, session::requireCurrent)
        val creations = mockk<HomeCreationFactory>()
        every { creations.create(any()) } returns creation
        return AddHomeWizardViewModel(
            repo,
            mockk(relaxed = true),
            SavedStateHandle(),
            networkMonitor,
            mockk(relaxed = true),
            mockk(relaxed = true),
            sessions,
            creations,
        )
    }

    private fun AddHomeWizardViewModel.fillAddress() {
        selectAddressCandidate(AddHomeSampleData.nearbyHomes[0])
    }

    @Test
    fun continue_button_is_disabled_until_home_is_selected() {
        compose.setContent {
            AddHomeWizardScreen(onDismiss = {}, onOpenHomes = {}, viewModel = makeViewModel())
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
            AddHomeWizardScreen(onDismiss = {}, onOpenHomes = {}, viewModel = vm)
        }
        compose.runOnIdle { vm.fillAddress() }
        compose.waitForIdle()
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).assertIsEnabled()
    }

    @Test
    fun close_on_dirty_form_shows_discard_confirm() {
        val vm = makeViewModel()
        var dismissed = false
        compose.setContent {
            AddHomeWizardScreen(
                onDismiss = { dismissed = true },
                onOpenHomes = {},
                viewModel = vm,
            )
        }
        compose.runOnIdle { vm.updateField(AddressField.City, "Test") }
        compose.waitForIdle()
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
                onOpenHomes = {},
                viewModel = makeViewModel(),
            )
        }
        compose.onNodeWithTag(WizardShellTags.LEADING).performClick()
        compose.waitForIdle()
        assert(dismissed) { "Empty step 1 must dismiss without prompting." }
    }

    @Test
    fun confirmed_creation_shows_result_before_opening_current_homes() {
        val vm = makeViewModel()
        compose.setContent {
            AddHomeWizardScreen(onDismiss = {}, onOpenHomes = {}, viewModel = vm)
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

        // Step 4: submit and await the retained outcome.
        compose.runOnIdle { vm.onPrimary() }
        compose.waitUntil(timeoutMillis = 15_000) {
            vm.state.value.creationOutcome?.state == "completed"
        }

        assert(vm.state.value.creationOutcome?.state == "completed") {
            "Wizard must show the confirmed result after submit completes."
        }
        assert(vm.state.value.createdHomeId == "ddc23800-0000-4000-8000-000000000042") {
            "createdHomeId must capture the response's home id."
        }
    }
}
