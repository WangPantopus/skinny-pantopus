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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.routing.PendingDeepLinkStore
import app.pantopus.android.core.security.AppLockHost
import app.pantopus.android.core.security.AppLockSetupPromptDialog
import app.pantopus.android.core.security.StepUpHost
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.RootViewModel
import app.pantopus.android.ui.screens.auth.AuthNavHost
import app.pantopus.android.ui.screens.auth.ContinueAsScreen
import app.pantopus.android.ui.screens.root.RootTabScreen
import app.pantopus.android.ui.theme.PantopusColors

/** Mirrors iOS `auth.welcomeBackToast`; present only while the toast is up. */
const val WELCOME_BACK_TOAST_TAG = "auth.welcomeBackToast"

/**
 * Top-level dispatcher — cross-fades between splash / signed-out auth nav /
 * the L2 "Continue as …" card / signed-in root tab container based on
 * [AuthRepository.State]. The signed-out branch hosts its own NavController
 * via [AuthNavHost] so P4/P5 stubs (sign up, forgot, reset, verify, error)
 * are reachable from Login.
 *
 * Persistent login (design §9): `Resumable` renders [ContinueAsScreen];
 * `ON_START` runs the proactive refresh; a security / expiry sign-out opens
 * the front door on the login screen; the signed-in branch mounts
 * [StepUpHost] so destructive actions can run a step-up.
 */
@Composable
fun PantopusNavHost(viewModel: RootViewModel = hiltViewModel()) {
    val authState by viewModel.authState.collectAsStateWithLifecycle()
    val lastInteractiveSignInAt by viewModel.lastInteractiveSignInAt.collectAsStateWithLifecycle()
    val sessionEndReason by viewModel.sessionEndReason.collectAsStateWithLifecycle()
    var previousAuth by remember { mutableStateOf<AuthRepository.State?>(null) }
    val lifecycleOwner = LocalLifecycleOwner.current
    val toastController = remember { ToastController() }
    val shownToast by toastController.current.collectAsStateWithLifecycle()

    // Design §7.2 — every foreground pass refreshes an about-to-expire token
    // before the first request can 401.
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_START) viewModel.onAppStart()
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(authState) {
        viewModel.syncAppLock(authState)
        val prev = previousAuth
        previousAuth = authState
        // L2 → signed in: "Welcome back, Ying" (design §3 state B).
        if (authState is AuthRepository.State.SignedIn && prev is AuthRepository.State.Resumable) {
            val name = prev.hint.displayName?.takeIf { it.isNotBlank() }
            toastController.success(if (name != null) "Welcome back, $name" else "Welcome back")
        }
        // Workstream 1.4 — one-shot replay of a deferred content deep link
        // into DeepLinkRouter so RootTabScreen consumers navigate.
        if (authState is AuthRepository.State.SignedIn &&
            prev !is AuthRepository.State.SignedIn
        ) {
            DeepLinkRouter.acknowledgeLoginPresentation()
            PendingDeepLinkStore.take()?.let { DeepLinkRouter.handle(it) }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedContent(
            targetState = authState,
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            label = "pantopus-auth-state",
        ) { state ->
            when (state) {
                AuthRepository.State.Unknown -> SplashScreen()
                // A session that ended for a security reason (or expired)
                // lands on the login screen so the banner is seen — not on
                // the Place funnel.
                AuthRepository.State.SignedOut -> PlaceLaunchHost(openAuth = sessionEndReason != null)
                // L2 "Continue as Ying" + BiometricPrompt -> AuthRepository.resume.
                is AuthRepository.State.Resumable -> ContinueAsScreen()
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
                        // Step-up coordinator (device_key biometric / password
                        // sheet) for the 403 STEP_UP_REQUIRED interceptor and
                        // the Devices / delete-account flows.
                        StepUpHost(coordinator = viewModel.stepUpCoordinator)
                    }
            }
        }
        ToastHost(
            controller = toastController,
            modifier = if (shownToast != null) Modifier.testTag(WELCOME_BACK_TOAST_TAG) else Modifier,
        )
    }
}

/**
 * The signed-out front door: the Place launch funnel, with the existing
 * auth flow shown over it for sign-in / account creation (W6). Once the
 * session flips to signed-in, the parent swaps in [RootTabScreen] and the
 * stashed place is saved by [HomeTabHostViewModel].
 */
@Composable
private fun PlaceLaunchHost(openAuth: Boolean = false) {
    var showAuth by remember { mutableStateOf(openAuth) }
    val prefersLogin by DeepLinkRouter.prefersLoginPresentation.collectAsStateWithLifecycle()

    // Persistent login: a session-end banner is pending → show the login
    // screen (which renders + consumes it) instead of the Place funnel.
    LaunchedEffect(openAuth) {
        if (openAuth) showAuth = true
    }

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
