package app.pantopus.android

import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.auth.AccountHint
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.OAuthProvider
import app.pantopus.android.data.auth.SessionEndReason
import app.pantopus.android.ui.screens.auth.LoginViewModel
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val sampleUser = UserDto(id = "u_1", email = "a@b.com", displayName = "A", avatarUrl = null)

    @Before fun setup() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun repoReturning(
        result: Result<UserDto>,
        remembered: List<AccountHint> = emptyList(),
        sessionEnd: SessionEndReason? = null,
    ) = mockk<AuthRepository>(relaxed = true).apply {
        coEvery { state } returns MutableStateFlow(AuthRepository.State.SignedOut)
        every { rememberedAccounts } returns MutableStateFlow(remembered)
        every { sessionEndReason } returns MutableStateFlow(sessionEnd)
        coEvery { signIn(any(), any()) } returns result
    }

    @Test
    fun `canSubmit requires valid email and 6+ char password`() =
        runTest {
            val vm = LoginViewModel(repoReturning(Result.success(sampleUser)))
            assertFalse(vm.uiState.value.canSubmit)
            vm.onEmailChange("foo@bar.com")
            assertFalse(vm.uiState.value.canSubmit)
            vm.onPasswordChange("secret123")
            assertTrue(vm.uiState.value.canSubmit)
        }

    @Test
    fun `signIn flips isLoading then clears on success`() =
        runTest {
            val repo = repoReturning(Result.success(sampleUser))
            val vm = LoginViewModel(repo)

            vm.onEmailChange("alice@example.com")
            vm.onPasswordChange("hunter22")
            vm.signIn()

            advanceUntilIdle()

            val final = vm.uiState.value
            assertFalse(final.isLoading)
            assertNull(final.errorMessage)
            coVerify { repo.signIn("alice@example.com", "hunter22") }
        }

    @Test
    fun `signIn maps HttpException 401 to AuthError InvalidCredentials`() =
        runTest {
            val http401 =
                HttpException(
                    Response.error<Any>(
                        401,
                        "{\"error\":\"Invalid email or password\"}"
                            .toResponseBody("application/json".toMediaTypeOrNull()),
                    ),
                )
            val repo = repoReturning(Result.failure(http401))
            val vm = LoginViewModel(repo)

            vm.onEmailChange("alice@example.com")
            vm.onPasswordChange("hunter22")
            vm.signIn()

            advanceUntilIdle()

            val final = vm.uiState.value
            assertFalse(final.isLoading)
            assertEquals(AuthError.InvalidCredentials, final.errorMessage)
        }

    @Test
    fun `signIn maps IOException to AuthError NetworkError`() =
        runTest {
            val repo = repoReturning(Result.failure(java.io.IOException("offline")))
            val vm = LoginViewModel(repo)

            vm.onEmailChange("alice@example.com")
            vm.onPasswordChange("hunter22")
            vm.signIn()

            advanceUntilIdle()

            assertEquals(AuthError.NetworkError, vm.uiState.value.errorMessage)
        }

    @Test
    fun `signIn is a no-op when form invalid`() =
        runTest {
            val repo = repoReturning(Result.success(sampleUser))
            val vm = LoginViewModel(repo)

            vm.signIn() // email + password empty
            advanceUntilIdle()

            coVerify(exactly = 0) { repo.signIn(any(), any()) }
        }

    @Test
    fun `typing email after error clears errorMessage`() =
        runTest {
            val repo = repoReturning(Result.failure(java.io.IOException("oops")))
            val vm = LoginViewModel(repo)

            vm.onEmailChange("a@b.com")
            vm.onPasswordChange("hunter22")
            vm.signIn()
            advanceUntilIdle()
            assertEquals(AuthError.NetworkError, vm.uiState.value.errorMessage)

            vm.onEmailChange("a@b.com ")
            assertNull(vm.uiState.value.errorMessage)
        }

    // ---- Persistent login: remembered-account prefill + session-end banner ----

    @Test
    fun `most recent remembered account is surfaced as the prefill hint, email field stays empty`() =
        runTest {
            val hints =
                listOf(
                    AccountHint(
                        userId = "u_1",
                        displayName = "Ying",
                        maskedEmail = "y•••@gmail.com",
                        lastMethod = AccountHint.METHOD_GOOGLE,
                    ),
                    AccountHint(userId = "u_2", displayName = "Old", maskedEmail = "o•••@x.com", lastMethod = AccountHint.METHOD_PASSWORD),
                )
            val vm = LoginViewModel(repoReturning(Result.success(sampleUser), remembered = hints))
            advanceUntilIdle()

            val state = vm.uiState.value
            assertEquals("u_1", state.rememberedAccount?.userId)
            assertEquals("y•••@gmail.com", state.rememberedAccount?.maskedEmail)
            // The hint holds a *masked* address (CONTRACT) — never prefilled into the field.
            assertEquals("", state.email)
            assertEquals(OAuthProvider.Google, state.lastUsedOAuthProvider)
        }

    @Test
    fun `no remembered account means no hint and no last-used provider`() =
        runTest {
            val vm = LoginViewModel(repoReturning(Result.success(sampleUser)))
            advanceUntilIdle()
            assertNull(vm.uiState.value.rememberedAccount)
            assertNull(vm.uiState.value.lastUsedOAuthProvider)
        }

    @Test
    fun `forgetRememberedAccount removes the hinted account on this device`() =
        runTest {
            val repo =
                repoReturning(
                    Result.success(sampleUser),
                    remembered = listOf(AccountHint(userId = "u_1", displayName = "Ying")),
                )
            val vm = LoginViewModel(repo)
            advanceUntilIdle()

            vm.forgetRememberedAccount()
            advanceUntilIdle()

            coVerify(exactly = 1) { repo.removeRememberedAccount("u_1") }
        }

    @Test
    fun `security sign-out reason is surfaced and consumed on dismiss and on successful sign-in`() =
        runTest {
            val reason = SessionEndReason.fromCode("SESSION_REVOKED")
            val repo = repoReturning(Result.success(sampleUser), sessionEnd = reason)
            val vm = LoginViewModel(repo)
            advanceUntilIdle()

            assertEquals(reason, vm.uiState.value.sessionEndReason)
            assertTrue(vm.uiState.value.sessionEndReason?.isSecurity == true)

            vm.dismissSessionEndBanner()
            verify(exactly = 1) { repo.consumeSessionEndReason() }

            vm.onEmailChange("alice@example.com")
            vm.onPasswordChange("hunter22")
            vm.signIn()
            advanceUntilIdle()
            verify(exactly = 2) { repo.consumeSessionEndReason() }
        }
}
