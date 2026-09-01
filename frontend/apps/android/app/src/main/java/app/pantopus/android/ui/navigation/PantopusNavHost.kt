package app.pantopus.android.ui.navigation

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.routing.PendingDeepLinkStore
import app.pantopus.android.core.security.AppLockHost
import app.pantopus.android.core.security.AppLockSetupPromptDialog
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.ui.screens.RootViewModel
import app.pantopus.android.ui.screens.auth.AuthNavHost
import app.pantopus.android.ui.screens.root.RootTabScreen
import app.pantopus.android.ui.theme.PantopusColors

/**
 * Top-level dispatcher — cross-fades between splash / signed-out auth nav /
 * signed-in root tab container based on [AuthRepository.State]. The
 * signed-out branch hosts its own NavController via [AuthNavHost] so P4/P5
 * stubs (sign up, forgot, reset, verify, error) are reachable from Login.
 */
@Composable
fun PantopusNavHost(viewModel: RootViewModel = hiltViewModel()) {
    val authState by viewModel.authState.collectAsStateWithLifecycle()
    val lastInteractiveSignInAt by viewModel.lastInteractiveSignInAt.collectAsStateWithLifecycle()
    var previousAuth by remember { mutableStateOf<AuthRepository.State?>(null) }

    LaunchedEffect(authState) {
        viewModel.syncAppLock(authState)
        val prev = previousAuth
        previousAuth = authState
        // Workstream 1.4 — one-shot replay of a deferred content deep link
        // into DeepLinkRouter so RootTabScreen consumers navigate.
        if (authState is AuthRepository.State.SignedIn &&
            prev !is AuthRepository.State.SignedIn
        ) {
            DeepLinkRouter.acknowledgeLoginPresentation()
            PendingDeepLinkStore.take()?.let { DeepLinkRouter.handle(it) }
        }
    }

    AnimatedContent(
        targetState = authState,
        transitionSpec = { fadeIn() togetherWith fadeOut() },
        label = "pantopus-auth-state",
    ) { state ->
        when (state) {
            AuthRepository.State.Unknown -> SplashScreen()
            AuthRepository.State.SignedOut -> PlaceLaunchHost()
            is AuthRepository.State.SignedIn ->
                AppLockHost(
                    manager = viewModel.appLockManager,
                    isSignedIn = true,
                    onSignOut = { viewModel.signOutFromAppLock() },
                ) {
                    RootTabScreen()
                    // One-time post-login offer to turn app lock on (RN
                    // `AppLockSetupPromptLayer`, `src/app/_layout.tsx:132`).
                    AppLockSetupPromptDialog(
                        manager = viewModel.appLockManager,
                        isSignedIn = true,
                        lastInteractiveSignInAt = lastInteractiveSignInAt,
                    )
                }
        }
    }
}

/**
 * The signed-out front door: the Place launch funnel, with the existing
 * auth flow shown over it for sign-in / account creation (W6). Once the
 * session flips to signed-in, the parent swaps in [RootTabScreen] and the
 * stashed place is saved by [HomeTabHostViewModel].
 */
@Composable
private fun PlaceLaunchHost() {
    var showAuth by remember { mutableStateOf(false) }
    val prefersLogin by DeepLinkRouter.prefersLoginPresentation.collectAsStateWithLifecycle()

    // Workstream 1.4 — RN AuthGate parity: a deferred protected (or
    // auth-owned) deep link auto-presents the existing Sign-in path
    // without replacing the Place funnel underneath.
    //
    // The trigger is [DeepLinkRouter.prefersLoginPresentation], NOT the
    // presence of a stashed link. The stash survives process death for 24h,
    // so keying off it would force Sign-in over the Place funnel on every
    // launch after a link the user chose not to sign in for. A link that
    // arrives during this process — including the one that cold-started the
    // app — always sets the flag before this host composes, and the stash is
    // still replayed by the sign-in transition above whenever it happens.
    LaunchedEffect(prefersLogin) {
        if (prefersLogin) {
            showAuth = true
            DeepLinkRouter.acknowledgeLoginPresentation()
        }
    }

    if (showAuth) {
        AuthNavHost()
    } else {
        app.pantopus.android.ui.screens.place.launch.PlaceLaunchScreen(
            onSignIn = { showAuth = true },
            onCreateAccount = { showAuth = true },
        )
    }
}

/** Launch-time splash while we hydrate the session from DataStore. */
@Composable
private fun SplashScreen() {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(color = PantopusColors.primary600)
    }
}
