@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.auth.auth_error

import app.pantopus.android.data.auth.AuthError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthErrorViewModelTest {
    @Test
    fun `copy for InvalidCredentials`() {
        val copy = AuthErrorViewModel.copy(AuthError.InvalidCredentials)
        assertEquals("Couldn't sign you in", copy.headline)
    }

    @Test
    fun `copy for EmailAlreadyExists`() {
        assertEquals(
            "Email already in use",
            AuthErrorViewModel.copy(AuthError.EmailAlreadyExists).headline,
        )
    }

    @Test
    fun `copy for WeakPassword`() {
        assertEquals(
            "Pick a stronger password",
            AuthErrorViewModel.copy(AuthError.WeakPassword).headline,
        )
    }

    @Test
    fun `copy for NetworkError`() {
        assertEquals(
            "Can't reach Pantopus",
            AuthErrorViewModel.copy(AuthError.NetworkError).headline,
        )
    }

    @Test
    fun `copy for RateLimited`() {
        assertEquals(
            "Too many attempts",
            AuthErrorViewModel.copy(AuthError.RateLimited).headline,
        )
    }

    @Test
    fun `copy for ServerError does not leak raw message`() {
        val copy = AuthErrorViewModel.copy(AuthError.ServerError("SQL error at line 42"))
        assertEquals("Something went wrong", copy.headline)
        assertFalse(copy.body.contains("SQL"))
    }

    @Test
    fun `copy for Unknown`() {
        assertEquals(
            "Something went wrong",
            AuthErrorViewModel.copy(AuthError.Unknown).headline,
        )
    }

    @Test
    fun `isRetryable only for transient errors`() {
        val vm = AuthErrorViewModel()
        assertFalse(vm.isRetryable(AuthError.InvalidCredentials))
        assertFalse(vm.isRetryable(AuthError.EmailAlreadyExists))
        assertFalse(vm.isRetryable(AuthError.WeakPassword))
        assertTrue(vm.isRetryable(AuthError.NetworkError))
        assertTrue(vm.isRetryable(AuthError.RateLimited))
        assertTrue(vm.isRetryable(AuthError.ServerError("any")))
        assertTrue(vm.isRetryable(AuthError.Unknown))
    }
}
