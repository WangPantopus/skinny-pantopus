@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.verification

import app.pantopus.android.data.account.AccountRepository
import app.pantopus.android.data.api.models.identity.IdentityCenterResponse
import app.pantopus.android.data.api.models.identity.PrivateAccountDto
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.identity.IdentityCenterRepository
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
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class VerificationCenterViewModelTest {
    private val identity: IdentityCenterRepository = mockk()
    private val account: AccountRepository = mockk()
    private val auth: AuthRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val state =
            MutableStateFlow<AuthRepository.State>(
                AuthRepository.State.SignedIn(
                    user = UserDto(id = "u_test", email = "a@b.co", displayName = "A", avatarUrl = null),
                ),
            )
        every { auth.state } returns state
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(): VerificationCenterViewModel = VerificationCenterViewModel(identity, account, auth)

    private fun overview(verified: Boolean): IdentityCenterResponse =
        IdentityCenterResponse(
            privateAccount = PrivateAccountDto(id = "u_test", email = "a@b.co", name = "A", verified = verified),
        )

    @Test fun loadVerifiedShowsSingleEmailRow() =
        runTest {
            coEvery { identity.overview() } returns NetworkResult.Success(overview(verified = true))
            val vm = viewModel()
            vm.load()
            val loaded = vm.state.value as GroupedListUiState.Loaded
            val emailGroup = loaded.groups.first { it.id == "email" }
            assertEquals(1, emailGroup.rows.size)
            val chip = emailGroup.rows.first().control as RowControl.ChipStatus
            assertEquals("Verified", chip.label)
            assertEquals(RowControl.ChipTone.Success, chip.tone)
            // WS5.2 hid the phone / home "Coming soon" rows until those flows
            // ship, so only email + photo ID remain. iOS
            // `VerificationCenterViewModel` emits the same two groups.
            assertEquals(listOf("email", "photoid"), loaded.groups.map { it.id })
        }

    @Test fun loadUnverifiedShowsResendRow() =
        runTest {
            coEvery { identity.overview() } returns NetworkResult.Success(overview(verified = false))
            val vm = viewModel()
            vm.load()
            val loaded = vm.state.value as GroupedListUiState.Loaded
            val emailGroup = loaded.groups.first { it.id == "email" }
            assertEquals(2, emailGroup.rows.size)
            assertEquals("email.resend", emailGroup.rows.last().id)
        }

    @Test fun resendOnSuccessUpdatesLabel() =
        runTest {
            coEvery { identity.overview() } returns NetworkResult.Success(overview(verified = false))
            coEvery { account.resendVerification("a@b.co") } returns NetworkResult.Success(Unit)
            val vm = viewModel()
            vm.load()
            vm.onRow("email.resend")
            val loaded = vm.state.value as GroupedListUiState.Loaded
            val emailGroup = loaded.groups.first { it.id == "email" }
            val resend = emailGroup.rows.first { it.id == "email.resend" }
            assertEquals("Sent — check your inbox", resend.label)
        }
}
