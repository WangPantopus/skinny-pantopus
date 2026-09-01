package app.pantopus.android.ui.screens

import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.core.security.StepUpCoordinator
import app.pantopus.android.data.api.models.auth.AuthErrorCodes
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.SessionEndReason
import app.pantopus.android.data.realtime.SocketManager
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

/**
 * Persistent login — the `ON_START` proactive-refresh hook (design §7.2,
 * CONTRACT §"Client behaviour"). A refusal here is the server saying the
 * session is gone, so the banner-carrying sign-out must happen immediately
 * rather than waiting for the next request to 401.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RootViewModelTest {
    private val dispatcher = UnconfinedTestDispatcher()
    private val appLock: AppLockManager = mockk(relaxed = true)
    private val stepUp: StepUpCoordinator = mockk(relaxed = true)
    private val revoked = MutableSharedFlow<Unit>(replay = 1, extraBufferCapacity = 1)
    private val sockets: SocketManager = mockk(relaxed = true) { coEvery { sessionRevoked } returns revoked }
    private val user = UserDto(id = "u_1", email = "a@b.com", displayName = "A", avatarUrl = null)

    @Before fun setUp() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun repo(state: AuthRepository.State) =
        mockk<AuthRepository>(relaxed = true).apply {
            coEvery { this@apply.state } returns MutableStateFlow(state)
            coEvery { sessionEndReason } returns MutableStateFlow(null)
            coEvery { lastInteractiveSignInAt } returns MutableStateFlow(null)
        }

    @Test
    fun `onAppStart does nothing while signed out`() =
        runTest {
            val repo = repo(AuthRepository.State.SignedOut)
            RootViewModel(repo, appLock, stepUp, sockets).onAppStart()

            coVerify(exactly = 0) { repo.refreshIfExpiringSoon(any()) }
            coVerify(exactly = 0) { repo.signOut(any()) }
        }

    @Test
    fun `onAppStart signs out with the backend reason when the refresh is refused`() =
        runTest {
            val repo = repo(AuthRepository.State.SignedIn(user))
            val reason = SessionEndReason.fromCode(AuthErrorCodes.SESSION_REVOKED)
            coEvery { repo.refreshIfExpiringSoon(any()) } returns AuthRepository.RefreshOutcome.AuthRejected(reason)

            RootViewModel(repo, appLock, stepUp, sockets).onAppStart()

            coVerify(exactly = 1) { repo.signOut(reason) }
        }

    @Test
    fun `onAppStart keeps the session on a rotation or a transient failure`() =
        runTest {
            val rotated = repo(AuthRepository.State.SignedIn(user))
            coEvery { rotated.refreshIfExpiringSoon(any()) } returns AuthRepository.RefreshOutcome.Rotated("new")
            RootViewModel(rotated, appLock, stepUp, sockets).onAppStart()
            coVerify(exactly = 0) { rotated.signOut(any()) }

            val transient = repo(AuthRepository.State.SignedIn(user))
            coEvery { transient.refreshIfExpiringSoon(any()) } returns AuthRepository.RefreshOutcome.Transient
            RootViewModel(transient, appLock, stepUp, sockets).onAppStart()
            coVerify(exactly = 0) { transient.signOut(any()) }

            // No refresh was needed (null) — nothing happens either.
            val fresh = repo(AuthRepository.State.SignedIn(user))
            coEvery { fresh.refreshIfExpiringSoon(any()) } returns null
            RootViewModel(fresh, appLock, stepUp, sockets).onAppStart()
            coVerify(exactly = 0) { fresh.signOut(any()) }
        }

    /**
     * CONTRACT / design §7.7 — the socket is never the authority: an
     * `auth:session_revoked` push must be confirmed with a `/refresh` probe
     * (`AuthRepository.confirmSessionRevoked`), never signed out blindly.
     * iOS does this in `SocketClient`; Android does it here.
     */
    @Test
    fun `socket auth session_revoked is confirmed with a refresh probe`() =
        runTest {
            val repo = repo(AuthRepository.State.SignedIn(user))

            RootViewModel(repo, appLock, stepUp, sockets)
            revoked.emit(Unit)

            coVerify(exactly = 1) { repo.confirmSessionRevoked() }
            // Never a blind sign-out — confirmSessionRevoked owns that call.
            coVerify(exactly = 0) { repo.signOut(any()) }
        }
}
