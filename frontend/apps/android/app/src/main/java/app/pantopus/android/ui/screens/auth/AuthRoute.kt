package app.pantopus.android.ui.screens.auth

import android.net.Uri
import app.pantopus.android.data.auth.AuthError

/**
 * Typed destinations for the signed-out experience. Mirrors iOS `AuthRoute`.
 * The NavController graph in `AuthNavHost` declares string routes; this
 * sealed hierarchy is the type-safe handle the call site uses.
 */
sealed class AuthRoute {
    data object Login : AuthRoute()

    /**
     * Create account. [inviteCode] is non-null only when the screen was
     * reached from a `pantopus://join/:code` deep link — it pre-fills the
     * optional Invite code field and rides the register call as
     * `invite_code`, mirroring RN's `/(auth)/register?invite_code=CODE`
     * (`pantopus/frontend/apps/mobile/src/app/(auth)/register.tsx:25,129`).
     */
    data class SignUp(
        val inviteCode: String? = null,
    ) : AuthRoute()

    data object ForgotPassword : AuthRoute()

    data class ResetPassword(
        val token: String,
    ) : AuthRoute()

    /**
     * Verify-email surface. [email] is the address the link was sent to
     * (rendered in the body copy + used by the resend CTA). [token] is
     * the hashed Supabase OTP from the verification link, set when the
     * route was reached via the verification email's deep link.
     */
    data class VerifyEmail(
        val email: String? = null,
        val token: String? = null,
    ) : AuthRoute()

    data class ErrorRoute(
        val error: AuthError,
    ) : AuthRoute()
}

/** Flat string-route table that the NavHost composables register against. */
object AuthRoutes {
    const val LOGIN = "auth/login"
    const val FORGOT_PASSWORD = "auth/forgot_password"
    const val AUTH_ERROR = "auth/error"

    /**
     * A19 legal document reached from a signed-out consent sentence
     * (login OAuth line, sign-up Terms checkbox). RN pushes
     * `/legal/terms` / `/legal/privacy` from the same taps
     * (`src/app/(auth)/register.tsx:327,334`).
     */
    const val LEGAL_PATTERN = "auth/legal/{document}"

    /** Key for the `{document}` path arg on [LEGAL_PATTERN]. */
    const val LEGAL_DOCUMENT_KEY = "document"

    fun legal(document: String): String = "auth/legal/$document"

    /**
     * Create account. `{invite_code}` is an optional query arg carried in
     * from a `pantopus://join/:code` deep link; blank means "typed here".
     */
    const val SIGN_UP_PATTERN = "auth/sign_up?invite_code={invite_code}"

    /** Reset password takes a `{token}` path argument. */
    const val RESET_PASSWORD_PATTERN = "auth/reset_password/{token}"

    /**
     * Verify-email accepts optional `{email}` + `{token}` query args. The
     * blank-string default mirrors the iOS optional bindings.
     */
    const val VERIFY_EMAIL_PATTERN = "auth/verify_email?email={email}&token={token}"

    /**
     * §1B-2 — Verify-email DEEP-LINK LANDING (the post-tap result screen,
     * distinct from [VERIFY_EMAIL_PATTERN] above). Reached only via the
     * verification email's deep link, so `{token}` is always present.
     */
    const val VERIFY_EMAIL_LANDING_PATTERN = "auth/verify_email_landing?email={email}&token={token}"

    fun resetPassword(token: String): String = "auth/reset_password/$token"

    fun signUp(inviteCode: String? = null): String {
        val codeArg = Uri.encode(inviteCode?.takeIf { it.isNotEmpty() }.orEmpty())
        return "auth/sign_up?invite_code=$codeArg"
    }

    fun verifyEmail(
        email: String? = null,
        token: String? = null,
    ): String {
        val emailArg = email?.takeIf { it.isNotEmpty() }.orEmpty()
        val tokenArg = token?.takeIf { it.isNotEmpty() }.orEmpty()
        return "auth/verify_email?email=$emailArg&token=$tokenArg"
    }

    fun verifyEmailLanding(
        email: String? = null,
        token: String? = null,
    ): String {
        val emailArg = email?.takeIf { it.isNotEmpty() }.orEmpty()
        val tokenArg = token?.takeIf { it.isNotEmpty() }.orEmpty()
        return "auth/verify_email_landing?email=$emailArg&token=$tokenArg"
    }
}
