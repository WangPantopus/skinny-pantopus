@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.status.verify_email

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
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
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

@OptIn(ExperimentalCoroutinesApi::class)
class VerifyEmailLandingViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun buildVm(
        email: String? = "alice@example.com",
        token: String? = null,
        repo: AuthRepository = mockk(relaxed = true),
        clock: Clock = Clock.fixed(Instant.ofEpochSecond(5_000), ZoneOffset.UTC),
    ): VerifyEmailLandingViewModel {
        val handle =
            SavedStateHandle(
                buildMap<String, Any?> {
                    if (email != null) put(VerifyEmailLandingViewModel.EMAIL_KEY, email)
                    if (token != null) put(VerifyEmailLandingViewModel.TOKEN_KEY, token)
                },
            )
        return VerifyEmailLandingViewModel(repo, handle).apply { this.clock = clock }
    }

    // MARK: - Verify on appear

    @Test
    fun `verifyOnAppear success lands on Success phase`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val tokenSlot = slot<String>()
            coEvery { repo.verifyEmail(capture(tokenSlot)) } returns Unit

            val vm = buildVm(token = "hashed-tok", repo = repo)
            vm.verifyOnAppearIfNeeded()
            advanceUntilIdle()

            assertEquals("hashed-tok", tokenSlot.captured)
            assertEquals(VerifyEmailLandingViewModel.Phase.Success, vm.uiState.value.phase)
        }

    @Test
    fun `verifyOnAppear server rejection lands on Expired phase`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.verifyEmail(any()) } throws AuthError.ServerError("Invalid or expired token")

            val vm = buildVm(token = "stale-tok", repo = repo)
            vm.verifyOnAppearIfNeeded()
            advanceUntilIdle()

            assertEquals(VerifyEmailLandingViewModel.Phase.Expired, vm.uiState.value.phase)
        }

    @Test
    fun `verifyOnAppear without a token is Expired and skips the network`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val vm = buildVm(token = null, repo = repo)
            vm.verifyOnAppearIfNeeded()
            advanceUntilIdle()

            assertEquals(VerifyEmailLandingViewModel.Phase.Expired, vm.uiState.value.phase)
            coVerify(exactly = 0) { repo.verifyEmail(any()) }
        }

    @Test
    fun `verifyOnAppear runs only once per instance`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.verifyEmail(any()) } returns Unit
            val vm = buildVm(token = "tok", repo = repo)

            vm.verifyOnAppearIfNeeded()
            vm.verifyOnAppearIfNeeded()
            advanceUntilIdle()

            coVerify(exactly = 1) { repo.verifyEmail(any()) }
        }

    // MARK: - Resend

    @Test
    fun `resend success sets cooldown and a success toast`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.resendVerification(any()) } returns Unit
            val clock = Clock.fixed(Instant.ofEpochMilli(5_000_000), ZoneOffset.UTC)
            val vm = buildVm(token = "stale-tok", repo = repo, clock = clock)

            vm.resend()
            advanceUntilIdle()

            val state = vm.uiState.value
            assertEquals(false, state.toast?.isError)
            assertEquals(5_000_000L + 30_000L, state.resendCooldownUntilEpochMs)
        }

    @Test
    fun `resend short-circuits within cooldown`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.resendVerification(any()) } returns Unit
            val vm = buildVm(token = "stale-tok", repo = repo)

            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.resendVerification(any()) }

            // Second tap inside the window must NOT pile on.
            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.resendVerification(any()) }
        }

    @Test
    fun `resend silently no-ops when email missing`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val vm = buildVm(email = null, token = "stale-tok", repo = repo)
            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 0) { repo.resendVerification(any()) }
            assertFalse(vm.uiState.value.canResend)
        }

    @Test
    fun `resend failure surfaces an error toast and no cooldown`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.resendVerification(any()) } throws AuthError.RateLimited
            val vm = buildVm(token = "stale-tok", repo = repo)

            vm.resend()
            advanceUntilIdle()

            assertTrue(vm.uiState.value.toast?.isError == true)
            assertNull(vm.uiState.value.resendCooldownUntilEpochMs)
        }
}
