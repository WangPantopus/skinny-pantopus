@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.auth.auth_error

import androidx.lifecycle.ViewModel
import app.pantopus.android.data.auth.AuthError
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** Headline + body shown by `AuthErrorScreen`. Pure value, easy to test. */
data class AuthErrorCopy(
    val headline: String,
    val body: String,
)

/**
 * Maps each [AuthError] case to user-facing copy + retryability. Mirrors
 * the iOS `AuthErrorViewModel` 1:1.
 */
@HiltViewModel
class AuthErrorViewModel
    @Inject
    constructor() : ViewModel() {
        companion object {
            fun copy(error: AuthError): AuthErrorCopy =
                when (error) {
                    is AuthError.InvalidCredentials ->
                        AuthErrorCopy(
                            headline = "Couldn't sign you in",
                            body = "Double-check your email and password, then try again.",
                        )
                    is AuthError.EmailAlreadyExists ->
                        AuthErrorCopy(
                            headline = "Email already in use",
                            body = "Try signing in instead, or use a different email.",
                        )
                    is AuthError.WeakPassword ->
                        AuthErrorCopy(
                            headline = "Pick a stronger password",
                            body = "At least 8 characters, with a mix of letters and numbers.",
                        )
                    is AuthError.NetworkError ->
                        AuthErrorCopy(
                            headline = "Can't reach Pantopus",
                            body = "Check your connection and try again.",
                        )
                    is AuthError.RateLimited ->
                        AuthErrorCopy(
                            headline = "Too many attempts",
                            body = "Take a breath and try again in a moment.",
                        )
                    is AuthError.ServerError ->
                        AuthErrorCopy(
                            headline = "Something went wrong",
                            body = "We hit a snag on our end. Give it another try.",
                        )
                    is AuthError.Unknown ->
                        AuthErrorCopy(
                            headline = "Something went wrong",
                            body = "We're not sure what happened. Try again or go back.",
                        )
                }
        }

        fun isRetryable(error: AuthError): Boolean =
            when (error) {
                is AuthError.EmailAlreadyExists,
                is AuthError.InvalidCredentials,
                is AuthError.WeakPassword,
                -> false
                is AuthError.NetworkError,
                is AuthError.RateLimited,
                is AuthError.ServerError,
                is AuthError.Unknown,
                -> true
            }
    }
