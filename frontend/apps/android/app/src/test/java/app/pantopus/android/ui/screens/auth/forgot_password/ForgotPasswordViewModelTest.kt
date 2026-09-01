@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.auth.forgot_password

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
class ForgotPasswordViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun buildVm(
        repo: AuthRepository = mockk(relaxed = true),
        clock: Clock = Clock.fixed(Instant.ofEpochSecond(1_000), ZoneOffset.UTC),
    ): ForgotPasswordViewModel = ForgotPasswordViewModel(repo).apply { this.clock = clock }

    @Test
    fun `canSubmit requires a valid email`() {
        val vm = buildVm()
        assertFalse(vm.uiState.value.canSubmit)
        vm.onEmailChange("not-an-email")
        assertFalse(vm.uiState.value.canSubmit)
        vm.onEmailChange("alice@example.com")
        assertTrue(vm.uiState.value.canSubmit)
    }

    @Test
    fun `submit calls AuthRepository forgotPassword with trimmed lowercased email and flips phase`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val emailSlot = slot<String>()
            coEvery { repo.forgotPassword(capture(emailSlot)) } returns Unit
            val vm = buildVm(repo)

            vm.onEmailChange("  Alice@Example.com ")
            vm.submit()
            advanceUntilIdle()

            val state = vm.uiState.value
            assertTrue(state.phase is ForgotPasswordViewModel.Phase.Sent)
            assertEquals("alice@example.com", (state.phase as ForgotPasswordViewModel.Phase.Sent).email)
            assertEquals("alice@example.com", emailSlot.captured)
            assertNull(state.errorMessage)
            assertFalse(state.isLoading)
            assertEquals(1_000_000L + 30_000L, state.resendCooldownUntilEpochMs)
        }

    @Test
    fun `submit rolls back loading state on error`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.forgotPassword(any()) } throws AuthError.RateLimited

            val vm = buildVm(repo)
            vm.onEmailChange("alice@example.com")
            vm.submit()
            advanceUntilIdle()

            val state = vm.uiState.value
            assertEquals(AuthError.RateLimited, state.errorMessage)
            assertFalse(state.isLoading)
            assertTrue(state.phase is ForgotPasswordViewModel.Phase.Form)
        }

    @Test
    fun `submit blocked when invalid does not hit network`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            val vm = buildVm(repo)
            vm.submit() // email empty
            advanceUntilIdle()
            coVerify(exactly = 0) { repo.forgotPassword(any()) }
        }

    @Test
    fun `resend honours local cooldown`() =
        runTest {
            val repo = mockk<AuthRepository>(relaxed = true)
            coEvery { repo.forgotPassword(any()) } returns Unit

            // Mutable clock so we can step through the cooldown window.
            var nowMs = 1_000_000L
            val clock =
                object : Clock() {
                    override fun getZone() = ZoneOffset.UTC

                    override fun withZone(zone: java.time.ZoneId) = this

                    override fun instant(): Instant = Instant.ofEpochMilli(nowMs)
                }
            val vm = buildVm(repo, clock = clock)

            vm.onEmailChange("alice@example.com")
            vm.submit()
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.forgotPassword("alice@example.com") }

            // Inside the 30s window — silent no-op.
            nowMs += 5_000
            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 1) { repo.forgotPassword("alice@example.com") }

            // After the window — call goes through.
            nowMs += 30_000
            vm.resend()
            advanceUntilIdle()
            coVerify(exactly = 2) { repo.forgotPassword("alice@example.com") }
        }
}
