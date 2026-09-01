package app.pantopus.android.ui.screens.auth

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.auth.AuthRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Rule
import org.junit.Test

class LoginScreenTest {
    @get:Rule val compose = createComposeRule()

    private fun viewModelWith(signInResult: Result<UserDto> = Result.success(sampleUser)): LoginViewModel {
        val repo = mockk<AuthRepository>(relaxed = true)
        coEvery { repo.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
        coEvery { repo.signIn(any(), any()) } returns signInResult
        return LoginViewModel(repo)
    }

    @Test
    fun submit_button_is_disabled_initially() {
        compose.setContent { LoginScreen(viewModel = viewModelWith()) }

        compose.onNodeWithTag(LoginScreenTags.EMAIL_FIELD).assertIsDisplayed()
        compose.onNodeWithTag(LoginScreenTags.PASSWORD_FIELD).assertIsDisplayed()
        compose
            .onNodeWithTag(LoginScreenTags.SUBMIT_BUTTON)
            .assertIsDisplayed()
            .assertHasClickAction()
            .assertIsNotEnabled()
    }

    @Test
    fun submit_button_enables_once_form_is_valid() {
        compose.setContent { LoginScreen(viewModel = viewModelWith()) }

        compose.onNodeWithTag(LoginScreenTags.EMAIL_FIELD).performTextInput("alice@example.com")
        compose.onNodeWithTag(LoginScreenTags.PASSWORD_FIELD).performTextInput("hunter22")

        compose.onNodeWithTag(LoginScreenTags.SUBMIT_BUTTON).assertIsEnabled()
    }

    @Test
    fun submit_button_triggers_sign_in() {
        val repo = mockk<AuthRepository>(relaxed = true)
        coEvery { repo.state } returns MutableStateFlow(AuthRepository.State.SignedOut)
        coEvery { repo.signIn(any(), any()) } returns Result.success(sampleUser)
        val vm = LoginViewModel(repo)

        compose.setContent { LoginScreen(viewModel = vm) }

        compose.onNodeWithTag(LoginScreenTags.EMAIL_FIELD).performTextInput("alice@example.com")
        compose.onNodeWithTag(LoginScreenTags.PASSWORD_FIELD).performTextInput("hunter22")
        compose.onNodeWithTag(LoginScreenTags.SUBMIT_BUTTON).performClick()
        compose.waitForIdle()
        // If this throws, sign-in wasn't invoked — the relaxed mock would have recorded it.
        io.mockk.coVerify { repo.signIn("alice@example.com", "hunter22") }
    }

    companion object {
        val sampleUser =
            UserDto(
                id = "u_123",
                email = "alice@example.com",
                displayName = "Alice",
                avatarUrl = null,
            )
    }
}
