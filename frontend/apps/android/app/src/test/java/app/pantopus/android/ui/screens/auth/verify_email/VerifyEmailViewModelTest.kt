@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.auth.verify_email

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
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
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
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

@OptIn(ExperimentalCoroutinesApi::class)
class VerifyEmailViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun buildVm(
        email: String? = "alice@example.com",
        token: String? = null,
        softGate: Boolean = true,
        repo: AuthRepository = mockk(relaxed = true),
        clock: Clock = Clock.fixed(Instant.ofEpochSecond(5_000), ZoneOffset.UTC),
    ): VerifyEmailViewModel {
        val handle =
            SavedStateHandle(
                buildMap<String, Any?> {
                    if (email != null) put(VerifyEmailViewModel.EMAIL_KEY, email)
                    if (token != null) put(VerifyEmailViewModel.TOKEN_KEY, token)
                    put(VerifyEmailViewModel.SOFT_GATE_KEY, softGate)
                },
            )
        return VerifyEmailViewModel(repo, handle).apply { this.clock = clock }
    }

    @Test
    fun `email + token + softGate hydrated from SavedStateHandle`() {
        val vm = buildVm(email = "alice@example.com", token = "tok", softGate = false)
        assertEquals("alice@example.com", vm.uiState.value.email)
        assertEquals("tok", vm.uiState.value.token)
        assertFalse(vm.uiState.value.softGate)
    }

    // MARK: - Resend rate-limit handling

    @Test
    fun `resend silently no-ops when email missing`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val vm = buildVm(email = null, repo = repo)
            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 0) { repo.resendVerification(any()) }
        }

    @Test
    fun `resend success sets cooldown and didResend`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.resendVerification(any()) } returns Unit
            val clock = Clock.fixed(Instant.ofEpochMilli(5_000_000), ZoneOffset.UTC)
            val vm = buildVm(repo = repo, clock = clock)

            vm.resend()
            advanceUntilIdle()

            val state = vm.uiState.value
            assertTrue(state.didResend)
            assertNull(state.errorMessage)
            assertEquals(5_000_000L + 30_000L, state.resendCooldownUntilEpochMs)
        }

    @Test
    fun `resend short-circuits within cooldown`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.resendVerification(any()) } returns Unit

            var nowMs = 5_000_000L
            val clock =
                object : Clock() {
                    override fun getZone() = ZoneOffset.UTC

                    override fun withZone(zone: java.time.ZoneId) = this

                    override fun instant(): Instant = Instant.ofEpochMilli(nowMs)
                }
            val vm = buildVm(repo = repo, clock = clock)

            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.resendVerification(any()) }

            // Second tap inside the 30s window — must NOT pile on.
            nowMs += 10_000
            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.resendVerification(any()) }

            // After window clears (cleared via test helper) — call goes through.
            vm.clearCooldown()
            nowMs += 30_000
            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 2) { repo.resendVerification(any()) }
        }

    // ── A18.1 countdown label ─────────────────────────────────────────

    @Test
    fun `countdownLabel renders minutes and zero-padded seconds`() {
        // Design frame reads "Resend in 0:42"; the label must round up so a
        // 29.4s remainder never renders as "0:29" while the button is still
        // disabled. Mirrors iOS `VerifyEmailView.countdownLabel`.
        assertEquals("0:42", countdownLabel(42_000L))
        assertEquals("0:30", countdownLabel(29_400L))
        assertEquals("0:05", countdownLabel(5_000L))
        assertEquals("1:05", countdownLabel(65_000L))
        assertEquals("0:00", countdownLabel(0L))
    }

    @Test
    fun `resend error surfaces rate limited message`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.resendVerification(any()) } throws AuthError.RateLimited
            val vm = buildVm(repo = repo)
            vm.resend()
            advanceUntilIdle()
            assertEquals(AuthError.RateLimited, vm.uiState.value.errorMessage)
            assertFalse(vm.uiState.value.isResending)
        }

    // MARK: - Auto-verify (deep-link)

    @Test
    fun `verifyOnAppearIfNeeded calls verifyEmail with the token and flips didVerify`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val tokenSlot = slot<String>()
            coEvery { repo.verifyEmail(capture(tokenSlot)) } returns Unit

            val vm = buildVm(token = "hashed-tok", repo = repo)
            vm.verifyOnAppearIfNeeded()
            advanceUntilIdle()

            assertEquals("hashed-tok", tokenSlot.captured)
            assertTrue(vm.uiState.value.didVerify)
        }

    @Test
    fun `verifyOnAppearIfNeeded is a no-op without a token`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val vm = buildVm(token = null, repo = repo)
            vm.verifyOnAppearIfNeeded()
            advanceUntilIdle()
            coVerify(exactly = 0) { repo.verifyEmail(any()) }
        }

    @Test
    fun `verifyOnAppearIfNeeded runs only once per instance`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.verifyEmail(any()) } returns Unit
            val vm = buildVm(token = "tok", repo = repo)

            vm.verifyOnAppearIfNeeded()
            vm.verifyOnAppearIfNeeded()
            advanceUntilIdle()

            coVerify(exactly = 1) { repo.verifyEmail(any()) }
        }

    @Test
    fun `verifyOnAppearIfNeeded sets didComplete after the banner delay`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.verifyEmail(any()) } returns Unit
            val vm = buildVm(token = "tok", repo = repo)

            vm.verifyOnAppearIfNeeded()
            // Run far enough past the post-success banner pause that
            // didComplete must have flipped.
            advanceTimeBy(VerifyEmailViewModel.VERIFY_SUCCESS_BANNER_DELAY_MS + 100)
            advanceUntilIdle()

            assertTrue(vm.uiState.value.didVerify)
            assertTrue(vm.uiState.value.didComplete)
            assertNotNull(vm.uiState.value)
        }
}
