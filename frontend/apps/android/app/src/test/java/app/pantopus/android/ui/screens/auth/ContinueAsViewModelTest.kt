package app.pantopus.android.ui.screens.auth

import androidx.fragment.app.FragmentActivity
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.auth.AccountHint
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.SessionEndReason
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Persistent login — the L2 "Continue as …" card's view-model (design §3
 * state B, §7.4). The repository owns the resume flow; this covers the
 * card's mapping of every [AuthRepository.ResumeOutcome], the one-shot
 * auto-prompt, "Use a different account", "Not you? Remove" and the
 * session-end banner.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ContinueAsViewModelTest {
    private val hint = AccountHint(userId = "u_1", displayName = "Ying", maskedEmail = "y•••@gmail.com")
    private val user = UserDto(id = "u_1", email = "ying@gmail.com", displayName = "Ying", avatarUrl = null)
    private val state = MutableStateFlow<AuthRepository.State>(AuthRepository.State.Resumable(hint))
    private val sessionEnd = MutableStateFlow<SessionEndReason?>(null)
    private val activity: FragmentActivity = mockk(relaxed = true)

    private val repo: AuthRepository =
        mockk(relaxed = true) {
            every { this@mockk.state } returns this@ContinueAsViewModelTest.state
            every { sessionEndReason } returns sessionEnd
        }

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    private fun vm() = ContinueAsViewModel(repo)

    @Test
    fun `card shows the resumable hint`() =
        runTest {
            val vm = vm()
            assertEquals(hint, vm.uiState.value.hint)
            assertEquals("Ying", vm.uiState.value.displayName)
            assertTrue(vm.uiState.value.canAct)
        }

    @Test
    fun `restored resume clears the busy flag and leaves the state flip to the host`() =
        runTest {
            coEvery { repo.resume(activity) } answers {
                state.value = AuthRepository.State.SignedIn(user)
                AuthRepository.ResumeOutcome.Restored(user)
            }
            val vm = vm()
            vm.continueAs(activity)
            assertFalse(vm.uiState.value.isResuming)
            assertNull(vm.uiState.value.errorMessage)
            assertNull(vm.uiState.value.hint)
            coVerify(exactly = 1) { repo.resume(activity) }
        }

    @Test
    fun `cancelled prompt stays on the card without an error`() =
        runTest {
            coEvery { repo.resume(activity) } returns AuthRepository.ResumeOutcome.Cancelled
            val vm = vm()
            vm.continueAs(activity)
            assertFalse(vm.uiState.value.isResuming)
            assertNull(vm.uiState.value.errorMessage)
            assertEquals(hint, vm.uiState.value.hint)
        }

    @Test
    fun `transient failure surfaces the message and allows retry`() =
        runTest {
            coEvery { repo.resume(activity) } returns AuthRepository.ResumeOutcome.Transient("Can't reach Pantopus.")
            val vm = vm()
            vm.continueAs(activity)
            assertEquals("Can't reach Pantopus.", vm.uiState.value.errorMessage)
            assertTrue(vm.uiState.value.canAct)

            coEvery { repo.resume(activity) } returns AuthRepository.ResumeOutcome.Cancelled
            vm.continueAs(activity)
            assertNull(vm.uiState.value.errorMessage)
            coVerify(exactly = 2) { repo.resume(activity) }
        }

    @Test
    fun `grant rejected and unavailable are silent here (state already moved to login)`() =
        runTest {
            coEvery { repo.resume(activity) } answers {
                state.value = AuthRepository.State.SignedOut
                AuthRepository.ResumeOutcome.GrantRejected
            }
            val vm = vm()
            vm.continueAs(activity)
            assertNull(vm.uiState.value.errorMessage)
            assertNull(vm.uiState.value.hint)
            assertFalse(vm.uiState.value.isResuming)
        }

    @Test
    fun `no activity means no prompt and an explanatory error`() =
        runTest {
            val vm = vm()
            vm.continueAs(null)
            assertEquals(ContinueAsViewModel.NO_ACTIVITY_MESSAGE, vm.uiState.value.errorMessage)
            coVerify(exactly = 0) { repo.resume(any()) }
        }

    @Test
    fun `auto prompt fires exactly once`() =
        runTest {
            coEvery { repo.resume(activity) } returns AuthRepository.ResumeOutcome.Cancelled
            val vm = vm()
            vm.autoContinue(activity)
            vm.autoContinue(activity)
            vm.autoContinue(activity)
            coVerify(exactly = 1) { repo.resume(activity) }
            // The explicit button still works after the auto prompt was cancelled.
            vm.continueAs(activity)
            coVerify(exactly = 2) { repo.resume(activity) }
        }

    @Test
    fun `use a different account delegates to the repository`() =
        runTest {
            vm().useDifferentAccount()
            verify(exactly = 1) { repo.useDifferentAccount() }
        }

    @Test
    fun `not you remove forgets the hinted account`() =
        runTest {
            val vm = vm()
            vm.removeAccount()
            coVerify(exactly = 1) { repo.removeRememberedAccount("u_1") }
            assertFalse(vm.uiState.value.isRemoving)
        }

    @Test
    fun `session end banner is mirrored and consumed on dismiss`() =
        runTest {
            sessionEnd.value = SessionEndReason.fromCode("DEVICE_REVOKED")
            val vm = vm()
            assertTrue(vm.uiState.value.sessionEndReason?.isSecurity == true)
            vm.dismissSessionEndBanner()
            verify(exactly = 1) { repo.consumeSessionEndReason() }
        }
}
