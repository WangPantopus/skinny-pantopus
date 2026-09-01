@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.settings.password

import app.pantopus.android.data.account.AccountRepository
import app.pantopus.android.data.api.models.settings.AuthMethodsResponse
import app.pantopus.android.data.api.models.settings.PasswordUpdateBody
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
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

@OptIn(ExperimentalCoroutinesApi::class)
class PasswordChangeViewModelTest {
    private val account: AccountRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(): PasswordChangeViewModel = PasswordChangeViewModel(account)

    @Test fun loadDiscoversHasPasswordFromAuthMethods() =
        runTest {
            coEvery { account.authMethods() } returns
                NetworkResult.Success(AuthMethodsResponse(providers = listOf("email"), hasPassword = true))
            val vm = viewModel()
            vm.load()
            assertTrue(vm.requiresCurrent)
        }

    @Test fun loadOAuthOnlyDoesNotRequireCurrent() =
        runTest {
            coEvery { account.authMethods() } returns
                NetworkResult.Success(AuthMethodsResponse(providers = listOf("google"), hasPassword = false))
            val vm = viewModel()
            vm.load()
            assertFalse(vm.requiresCurrent)
        }

    @Test fun isValidRejectsShortPassword() =
        runTest {
            coEvery { account.authMethods() } returns
                NetworkResult.Success(AuthMethodsResponse(hasPassword = true))
            val vm = viewModel()
            vm.load()
            vm.update(PasswordChangeViewModel.FieldKey.Current, "old-password-123")
            vm.update(PasswordChangeViewModel.FieldKey.New, "short")
            vm.update(PasswordChangeViewModel.FieldKey.Confirm, "short")
            assertFalse(vm.isValid)
        }

    @Test fun isValidRejectsMismatchedConfirm() =
        runTest {
            coEvery { account.authMethods() } returns
                NetworkResult.Success(AuthMethodsResponse(hasPassword = true))
            val vm = viewModel()
            vm.load()
            vm.update(PasswordChangeViewModel.FieldKey.Current, "old-password-123")
            vm.update(PasswordChangeViewModel.FieldKey.New, "new-password-456")
            vm.update(PasswordChangeViewModel.FieldKey.Confirm, "different")
            assertFalse(vm.isValid)
            assertEquals(
                "Doesn't match the new password above.",
                vm.fields.value[PasswordChangeViewModel.FieldKey.Confirm]?.error,
            )
        }

    @Test fun strengthReflectsNewPassword() =
        runTest {
            coEvery { account.authMethods() } returns
                NetworkResult.Success(AuthMethodsResponse(hasPassword = true))
            val vm = viewModel()
            vm.load()
            vm.update(PasswordChangeViewModel.FieldKey.New, "Bake-Sourdough-Friday-77")
            assertEquals(4, vm.strength.rulesMet)
            assertTrue(vm.strength.isStrong)
            assertFalse(vm.isNewPasswordBreached)
            assertTrue(vm.isNewValid)
        }

    @Test fun breachedNewPasswordIsInvalidAndFlagged() =
        runTest {
            coEvery { account.authMethods() } returns
                NetworkResult.Success(AuthMethodsResponse(hasPassword = true))
            val vm = viewModel()
            vm.load()
            vm.update(PasswordChangeViewModel.FieldKey.Current, "old-password-123")
            vm.update(PasswordChangeViewModel.FieldKey.New, "password123")
            vm.update(PasswordChangeViewModel.FieldKey.Confirm, "password123")
            assertTrue(vm.isNewPasswordBreached)
            assertTrue(vm.strength.breached)
            assertFalse(vm.isValid)
            assertEquals(
                "Too common — appeared in 2.3M public records.",
                vm.fields.value[PasswordChangeViewModel.FieldKey.New]?.error,
            )
        }

    @Test fun saveSuccessSetsToastAndShouldDismiss() =
        runTest {
            coEvery { account.authMethods() } returns
                NetworkResult.Success(AuthMethodsResponse(hasPassword = true))
            val body = slot<PasswordUpdateBody>()
            coEvery { account.updatePassword(capture(body)) } returns NetworkResult.Success(Unit)
            val vm = viewModel()
            vm.load()
            vm.update(PasswordChangeViewModel.FieldKey.Current, "old-password-123")
            vm.update(PasswordChangeViewModel.FieldKey.New, "new-password-456")
            vm.update(PasswordChangeViewModel.FieldKey.Confirm, "new-password-456")
            vm.save()
            assertEquals("Password updated", vm.toast.value)
            assertTrue(vm.shouldDismiss.value)
            assertNull(vm.formError.value)
            // Body uses camelCase (no snake_case adapter). Reach inside to verify.
            assertNotNull(body.captured)
            assertEquals("old-password-123", body.captured.currentPassword)
            assertEquals("new-password-456", body.captured.newPassword)
        }

    @Test fun save401MarksCurrentPasswordFieldAndShowsBanner() =
        runTest {
            coEvery { account.authMethods() } returns
                NetworkResult.Success(AuthMethodsResponse(hasPassword = true))
            coEvery { account.updatePassword(any()) } returns
                NetworkResult.Failure(NetworkError.Unauthorized)
            val vm = viewModel()
            vm.load()
            vm.update(PasswordChangeViewModel.FieldKey.Current, "wrong-password-1")
            vm.update(PasswordChangeViewModel.FieldKey.New, "new-password-456")
            vm.update(PasswordChangeViewModel.FieldKey.Confirm, "new-password-456")
            vm.save()
            assertEquals(
                "That doesn't match the password on file.",
                vm.fields.value[PasswordChangeViewModel.FieldKey.Current]?.error,
            )
            assertEquals("Couldn't update password", vm.formError.value?.title)
            assertFalse(vm.shouldDismiss.value)
        }
}
