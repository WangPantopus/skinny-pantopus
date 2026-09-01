@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.auth

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.ui.screens.auth.auth_error.AuthErrorScreen
import app.pantopus.android.ui.screens.auth.forgot_password.ForgotPasswordScreen
import app.pantopus.android.ui.screens.auth.set_password.SetNewPasswordScreen
import app.pantopus.android.ui.screens.auth.set_password.SetNewPasswordViewModel
import app.pantopus.android.ui.screens.auth.sign_up.SignUpScreen
import app.pantopus.android.ui.screens.auth.sign_up.SignUpViewModel
import app.pantopus.android.ui.screens.auth.verify_email.VerifyEmailScreen
import app.pantopus.android.ui.screens.auth.verify_email.VerifyEmailViewModel
import app.pantopus.android.ui.screens.settings.legal.LegalContentScreen
import app.pantopus.android.ui.screens.settings.legal.LegalDocument
import app.pantopus.android.ui.screens.status.verify_email.VerifyEmailLandingScreen
import app.pantopus.android.ui.screens.status.verify_email.VerifyEmailLandingViewModel

/**
 * Nav graph rooted at [AuthRoutes.LOGIN] for the signed-out experience.
 * Mirrors iOS `LoginView`'s `NavigationStack` + `navigationDestination`.
 *
 * P4 wires Login → SignUp / Forgot, and SignUp success → VerifyEmail
 * (since the backend currently hard-gates `/login` until verified —
 * see `docs/mobile/auth-backend-contracts.md`). P5 wires the Verify /
 * Reset deep links and the inline AuthError destination.
 */
@Composable
fun AuthNavHost() {
    val navController = rememberNavController()
    val pendingDeepLink by DeepLinkRouter.pending.collectAsStateWithLifecycle()

    // Pull auth deep links (reset / verify / join-invite) off DeepLinkRouter
    // and push them onto the nav stack. Anything else stays pending for the
    // signed-in tab tree to consume after sign-in.
    LaunchedEffect(pendingDeepLink) {
        when (val pending = pendingDeepLink) {
            is DeepLinkRouter.Destination.ResetPassword -> {
                DeepLinkRouter.consume()
                navController.navigate(AuthRoutes.resetPassword(pending.token)) {
                    popUpTo(AuthRoutes.LOGIN)
                }
            }
            is DeepLinkRouter.Destination.VerifyEmail -> {
                // The email's deep link always carries a token → land on the
                // §1B-2 post-tap landing, not the pre-tap "we sent you a link"
                // surface (which sign-up reaches with no token).
                DeepLinkRouter.consume()
                navController.navigate(
                    AuthRoutes.verifyEmailLanding(email = pending.email, token = pending.token),
                ) {
                    popUpTo(AuthRoutes.LOGIN)
                }
            }
            is DeepLinkRouter.Destination.JoinInvite -> {
                // A referral link opened by a signed-out visitor. RN replaces
                // the login redirect with `/(auth)/register?invite_code=CODE`
                // (`src/app/_layout.tsx:76`), so land straight on Create
                // account with the code carried into the form.
                DeepLinkRouter.consume()
                navController.navigate(AuthRoutes.signUp(pending.code)) {
                    popUpTo(AuthRoutes.LOGIN)
                }
            }
            else -> Unit
        }
    }

    NavHost(
        navController = navController,
        startDestination = AuthRoutes.LOGIN,
    ) {
        composable(
            route = AuthRoutes.LEGAL_PATTERN,
            arguments = listOf(navArgument(AuthRoutes.LEGAL_DOCUMENT_KEY) { type = NavType.StringType }),
        ) { entry ->
            val rowId = entry.arguments?.getString(AuthRoutes.LEGAL_DOCUMENT_KEY).orEmpty()
            LegalContentScreen(
                document = LegalDocument.entries.firstOrNull { it.rowId == rowId } ?: LegalDocument.Terms,
                onBack = { navController.popBackStack() },
            )
        }
        composable(AuthRoutes.LOGIN) {
            LoginScreen(
                onOpenLegal = { document -> navController.navigate(AuthRoutes.legal(document.rowId)) },
                onNavigateToSignUp = { navController.navigate(AuthRoutes.signUp()) },
                onNavigateToForgotPassword = { navController.navigate(AuthRoutes.FORGOT_PASSWORD) },
                onNavigateToVerifyEmail = { navController.navigate(AuthRoutes.verifyEmail()) },
                onNavigateToResetPassword = { token ->
                    navController.navigate(AuthRoutes.resetPassword(token))
                },
                onNavigateToAuthError = { navController.navigate(AuthRoutes.AUTH_ERROR) },
            )
        }
        composable(
            route = AuthRoutes.SIGN_UP_PATTERN,
            arguments =
                listOf(
                    navArgument(SignUpViewModel.INVITE_CODE_KEY) {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
        ) {
            SignUpScreen(
                onClose = { navController.popBackStack() },
                onOpenLegal = { document -> navController.navigate(AuthRoutes.legal(document.rowId)) },
                onSuccess = { email ->
                    // Backend hard-gates login on email_confirmed_at today
                    // (see docs/mobile/auth-backend-contracts.md
                    // §"Backend gap"). Route the user to verify-email so
                    // they can finish onboarding. We hand it the email so
                    // the body copy + resend CTA render correctly.
                    navController.navigate(AuthRoutes.verifyEmail(email = email)) {
                        popUpTo(AuthRoutes.LOGIN)
                    }
                },
            )
        }
        composable(AuthRoutes.FORGOT_PASSWORD) {
            ForgotPasswordScreen(onBack = { navController.popBackStack() })
        }
        composable(
            route = AuthRoutes.RESET_PASSWORD_PATTERN,
            arguments = listOf(navArgument(SetNewPasswordViewModel.TOKEN_KEY) { type = NavType.StringType }),
        ) { entry ->
            val token = entry.arguments?.getString(SetNewPasswordViewModel.TOKEN_KEY).orEmpty()
            SetNewPasswordScreen(
                token = token,
                onBack = { navController.popBackStack() },
                onContinue = {
                    navController.popBackStack(AuthRoutes.LOGIN, inclusive = false)
                },
            )
        }
        composable(
            route = AuthRoutes.VERIFY_EMAIL_PATTERN,
            arguments =
                listOf(
                    navArgument(VerifyEmailViewModel.EMAIL_KEY) {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument(VerifyEmailViewModel.TOKEN_KEY) {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
        ) {
            VerifyEmailScreen(
                onDone = {
                    navController.popBackStack(AuthRoutes.LOGIN, inclusive = false)
                },
                onChangeEmail = { _ ->
                    navController.navigate(AuthRoutes.signUp()) {
                        popUpTo(AuthRoutes.LOGIN)
                    }
                },
            )
        }
        composable(
            route = AuthRoutes.VERIFY_EMAIL_LANDING_PATTERN,
            arguments =
                listOf(
                    navArgument(VerifyEmailLandingViewModel.EMAIL_KEY) {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument(VerifyEmailLandingViewModel.TOKEN_KEY) {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
        ) {
            VerifyEmailLandingScreen(
                // No session after verification (backend revokes it), so
                // Continue drops back to login to sign in.
                onContinue = {
                    navController.popBackStack(AuthRoutes.LOGIN, inclusive = false)
                },
                onUseDifferentEmail = {
                    navController.navigate(AuthRoutes.signUp()) {
                        popUpTo(AuthRoutes.LOGIN)
                    }
                },
            )
        }
        composable(AuthRoutes.AUTH_ERROR) {
            AuthErrorScreen(
                onBack = { navController.popBackStack() },
            )
        }
    }
}
