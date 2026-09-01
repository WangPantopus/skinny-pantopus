@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.ownership_security

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.HomeOwnershipSecurityDto
import app.pantopus.android.data.api.models.homes.HomeOwnershipSecurityResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeOwnershipSecurityResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeOwnershipSecurityRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A14.2 (policy variant) — projection + wiring tests for the per-home
 * ownership security policy (`GET/PATCH /api/homes/:id/security`).
 * The group ids, row ids and banner copy asserted here are a parity
 * contract with the iOS `HomeOwnershipSecurityViewModelTests`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class HomeOwnershipSecurityViewModelTest {
    private val repository: HomeOwnershipSecurityRepository = mockk(relaxed = true)

    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns MutableStateFlow(true)
        }

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun dto(
        state: String = "normal",
        claimActive: Boolean? = false,
        claimEndsAt: String? = null,
        ownerClaim: String = "open",
        memberAttach: String = "open_invite",
        mask: String = "normal",
        ownerCount: Int? = 2,
    ) = HomeOwnershipSecurityDto(
        securityState = state,
        claimWindowEndsAt = claimEndsAt,
        ownerClaimPolicy = ownerClaim,
        memberAttachPolicy = memberAttach,
        privacyMaskLevel = mask,
        tenureMode = "rental",
        claimWindowActive = claimActive,
        ownerCount = ownerCount,
    )

    private fun makeVm(homeId: String = "home-1") =
        HomeOwnershipSecurityViewModel(
            repository = repository,
            networkMonitor = networkMonitor,
            savedStateHandle = SavedStateHandle(mapOf(HOME_OWNERSHIP_SECURITY_HOME_ID_KEY to homeId)),
        )

    private fun groups(vm: HomeOwnershipSecurityViewModel): List<GroupedListGroup> = (vm.state.value as GroupedListUiState.Loaded).groups

    @Test fun load_projects_three_radio_groups() =
        runTest {
            coEvery { repository.getSecurity(any()) } returns
                NetworkResult.Success(HomeOwnershipSecurityResponse(dto()))
            val vm = makeVm()
            vm.load()
            val projected = groups(vm)
            assertEquals(listOf("privacyMask", "ownerClaim", "memberAttach"), projected.map { it.id })
            assertEquals(3, projected[0].rows.size)
            assertEquals(2, projected[1].rows.size)
            assertEquals(3, projected[2].rows.size)
            val selected =
                projected.flatMap { it.rows }.filter { (it.control as? RowControl.Radio)?.isSelected == true }
            assertEquals(
                listOf("privacyMask.normal", "ownerClaim.open", "memberAttach.open_invite"),
                selected.map { it.id },
            )
            assertEquals("2 verified owners", vm.footerCaption.value)
        }

    @Test fun load_failure_surfaces_error_state() =
        runTest {
            coEvery { repository.getSecurity(any()) } returns
                NetworkResult.Failure(NetworkError.Forbidden)
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is GroupedListUiState.Error)
            assertNull(vm.banner.value)
        }

    @Test fun claim_window_surfaces_banner_and_locks_review_required() =
        runTest {
            coEvery { repository.getSecurity(any()) } returns
                NetworkResult.Success(
                    HomeOwnershipSecurityResponse(
                        dto(
                            state = "claim_window",
                            claimActive = true,
                            claimEndsAt = "2026-09-01T00:00:00.000Z",
                        ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            assertEquals("Claim Window Active", vm.banner.value?.title)
            assertTrue(vm.claimWindowActive)

            vm.onSelectRadio("ownerClaim.review_required")
            assertEquals(
                HomeOwnershipSecurityViewModel.CLAIM_WINDOW_LOCK_COPY,
                groups(vm).first { it.id == "ownerClaim" }.helper,
            )
            assertEquals("open", vm.policy?.ownerClaimPolicy)
        }

    @Test fun pending_quorum_response_surfaces_owner_approval_banner() =
        runTest {
            coEvery { repository.getSecurity(any()) } returns
                NetworkResult.Success(HomeOwnershipSecurityResponse(dto()))
            coEvery { repository.updateSecurity(any(), any()) } returns
                NetworkResult.Success(
                    UpdateHomeOwnershipSecurityResponse(
                        message = "This change will auto-approve in 7 days unless rejected",
                        quorumActionId = "qa-1",
                        pending = true,
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.onSelectRadio("ownerClaim.review_required")
            assertEquals("Owner approval requested", vm.banner.value?.title)
            assertEquals(
                "This change will auto-approve in 7 days unless rejected",
                vm.banner.value?.subtitle,
            )
            assertEquals("open", vm.policy?.ownerClaimPolicy)
            vm.onDismissBanner()
            assertNull(vm.banner.value)
        }

    @Test fun applied_patch_updates_selection() =
        runTest {
            coEvery { repository.getSecurity(any()) } returns
                NetworkResult.Success(HomeOwnershipSecurityResponse(dto()))
            coEvery { repository.updateSecurity(any(), any()) } returns
                NetworkResult.Success(
                    UpdateHomeOwnershipSecurityResponse(
                        message = "Settings updated",
                        security = dto(mask = "high", memberAttach = "verified_only", ownerCount = null),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.onSelectRadio("privacyMask.high")
            assertEquals("high", vm.policy?.privacyMaskLevel)
            assertEquals("verified_only", vm.policy?.memberAttachPolicy)
        }

    @Test fun status_banner_copy_per_security_state() {
        assertNull(HomeOwnershipSecurityViewModel.statusBanner(dto(state = "normal")))
        assertEquals(
            "New owner claims require manual review.",
            HomeOwnershipSecurityViewModel.statusBanner(dto(state = "review_required"))?.subtitle,
        )
        assertEquals(
            "Home protections enabled",
            HomeOwnershipSecurityViewModel.statusBanner(dto(state = "frozen"))?.title,
        )
    }
}
