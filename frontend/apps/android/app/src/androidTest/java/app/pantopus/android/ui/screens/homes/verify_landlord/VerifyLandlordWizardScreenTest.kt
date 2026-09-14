@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.verify_landlord

import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.tenant.TenantHomeStatusResponse
import app.pantopus.android.data.api.models.tenant.TenantLeaseDto
import app.pantopus.android.data.api.models.tenant.TenantRequestContextDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.tenant.TenantRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.wizard.WizardShellTags
import app.pantopus.android.ui.theme.PantopusTheme
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/** Exercise live recomposition: static step snapshots cannot detect stale wizard controls. */
class VerifyLandlordWizardScreenTest {
    @get:Rule val compose = createComposeRule()

    private val repository = mockk<TenantRepository>()

    private fun makeViewModel(): VerifyLandlordWizardViewModel {
        val monitor = mockk<NetworkMonitor>()
        every { monitor.isOnline } returns MutableStateFlow(true)
        val session = mockk<HomeClaimSessionScope>()
        every { session.isCurrent } returns true
        every { session.actorId } returns "actor-1"
        every { session.invalidated } returns MutableStateFlow(false)
        coEvery { session.confirmCurrent() } returns true
        val sessions = mockk<HomeClaimSessionScopeFactory>()
        every { sessions.create(any()) } returns session
        coEvery { repository.homeStatus("home-1") } returns
            NetworkResult.Success(
                TenantHomeStatusResponse(
                    "home-1",
                    TenantRequestContextDto("home-1", "actor-1", null, null),
                    TenantHomeStatusResponse.LeaseStatus("none"),
                ),
            )
        return VerifyLandlordWizardViewModel(
            monitor,
            SavedStateHandle(mapOf(VERIFY_LANDLORD_HOME_ID_KEY to "home-1")),
            repository,
            sessions,
        )
    }

    @Test
    fun advancing_and_returning_update_the_visible_controls_and_preserve_discard() {
        val vm = makeViewModel()
        var dismissed = false
        compose.setContent {
            PantopusTheme {
                VerifyLandlordWizardScreen({ dismissed = true }, {}, vm)
            }
        }
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).performClick()
        compose.onNodeWithTag(WizardShellTags.STEP_READOUT).assertTextEquals("2 of 3")
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).assertTextEquals("Submit")
        compose.onNodeWithTag(WizardShellTags.LEADING).assertContentDescriptionEquals("Back")

        compose.runOnIdle { vm.setMoveInDate("2026-09-14") }
        compose.onNodeWithTag(WizardShellTags.LEADING).performClick()
        compose.onNodeWithTag(WizardShellTags.STEP_READOUT).assertTextEquals("1 of 3")
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).assertTextEquals("Start verification")
        compose.onNodeWithTag(WizardShellTags.LEADING).assertContentDescriptionEquals("Close").performClick()
        compose.onNodeWithText("Discard your progress?").assertExists()
        assertFalse(dismissed)
        coVerify(exactly = 0) { repository.requestApproval(any(), any()) }
    }

    @Test
    fun validation_and_saved_request_recovery_update_the_existing_footer() {
        val vm = makeViewModel()
        var dismissed = false
        compose.setContent {
            PantopusTheme {
                VerifyLandlordWizardScreen({ dismissed = true }, {}, vm)
            }
        }
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).performClick()
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).performClick()
        compose.waitUntil { vm.state.value.errors != null }
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).assertIsNotEnabled()
        compose.runOnIdle {
            vm.setOwnerName("Fixture Owner")
            vm.setContactName("Fixture Contact")
            vm.setEmail("owner@example.invalid")
        }
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).assertIsEnabled()
        val lease = TenantLeaseDto("lease-1", "home-1", "pending", "tenant_request")
        coEvery { repository.homeStatus("home-1") } returns
            NetworkResult.Success(
                TenantHomeStatusResponse(
                    "home-1",
                    TenantRequestContextDto("home-1", "actor-1", "lease-1", "pending"),
                    TenantHomeStatusResponse.LeaseStatus("pending", lease),
                ),
            )
        compose.runOnIdle { vm.restoreSavedRequest() }
        compose.waitUntil { vm.state.value.currentStep == VerifyLandlordStep.Sent }
        compose.onNodeWithTag(WizardShellTags.STEP_READOUT).assertTextEquals("3 of 3")
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).assertTextEquals("Done")
        compose.onNodeWithTag(WizardShellTags.LEADING).assertContentDescriptionEquals("Close")
        compose.onNodeWithTag("verifyLandlordMailCodeCTA").assertExists()
        compose.onNodeWithTag(WizardShellTags.PRIMARY_CTA).performClick()
        compose.runOnIdle { assertTrue(dismissed) }
        coVerify(exactly = 0) { repository.requestApproval(any(), any()) }
    }
}
