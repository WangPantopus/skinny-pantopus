@file:Suppress("ComplexCondition")

package app.pantopus.android.core.security

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.DestructiveButton
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.launch

/** Applies reference-counted FLAG_SECURE while [enabled] and this composition is active. */
@Composable
fun SecureScreenEffect(enabled: Boolean = true) {
    val context = LocalContext.current
    val controller =
        remember(context) {
            EntryPointAccessors
                .fromApplication(
                    context.applicationContext,
                    SecureWindowEntryPoint::class.java,
                ).secureWindowController()
        }
    SecureScreenEffect(enabled = enabled, controller = controller)
}

/** Applies reference-counted FLAG_SECURE while [enabled] and this composition is active. */
@Composable
fun SecureScreenEffect(
    enabled: Boolean = true,
    controller: SecureWindowController,
) {
    DisposableEffect(enabled, controller) {
        if (enabled) {
            controller.acquire()
            onDispose { controller.release() }
        } else {
            onDispose { }
        }
    }
}

/**
 * The lock seal.
 *
 * Hosted in its own dialog *window* rather than as a z-ordered sibling inside
 * [AppLockHost]. Two things sit outside this subtree and would otherwise stay
 * visible and interactive while locked: `ToastHost`, declared after the
 * NavHost in MainActivity's root Box, and every `Dialog` / `ModalBottomSheet`,
 * which Compose renders in its own window above the Activity's content view.
 * A dialog window added last outranks all of them. iOS mirrors this exactly —
 * the same overlay is hosted in a dedicated `UIWindow` above `.alert`, which
 * outranks every UIKit-presented `.sheet` / `.fullScreenCover`.
 */
@Composable
fun AppLockOverlay(
    manager: AppLockManager,
    onSignOut: () -> Unit,
) {
    Dialog(
        onDismissRequest = { },
        properties =
            DialogProperties(
                dismissOnBackPress = false,
                dismissOnClickOutside = false,
                usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false,
            ),
    ) {
        AppLockOverlayContent(manager = manager, onSignOut = onSignOut)
    }
}

@Composable
private fun AppLockOverlayContent(
    manager: AppLockManager,
    onSignOut: () -> Unit,
) {
    val lastError by manager.lastError.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context.findFragmentActivity()
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        activity?.let { manager.unlockIfNeeded(it, automatic = true) }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("appLockOverlay"),
        contentAlignment = Alignment.Center,
    ) {
        // Swallow every pointer event — drags and multi-touch included — so the
        // signed-in UI underneath can never be operated while locked. It sits
        // *beneath* the column (consuming on the Initial pass would otherwise
        // starve our own Retry / Sign out buttons).
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .pointerInput(Unit) {
                        awaitPointerEventScope {
                            while (true) {
                                awaitPointerEvent(PointerEventPass.Initial)
                                    .changes
                                    .forEach { it.consume() }
                            }
                        }
                    },
        )
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            modifier = Modifier.padding(Spacing.s6),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Lock,
                contentDescription = null,
                size = 52.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Pantopus is locked",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = lastError ?: "Authenticate to reveal your account.",
                fontSize = 14.sp,
                color = PantopusColors.appTextMuted,
                textAlign = TextAlign.Center,
            )
            PrimaryButton(
                title = "Retry",
                onClick = {
                    scope.launch {
                        activity?.let { manager.unlockIfNeeded(it) }
                    }
                },
                modifier = Modifier.testTag("appLockRetry"),
            )
            DestructiveButton(
                title = "Sign out",
                onClick = onSignOut,
                modifier = Modifier.testTag("appLockSignOut"),
            )
        }
    }
}

/**
 * Hosts signed-in content under the app-lock overlay when locked.
 * Callers should already have [AppLockManager.configure]d the signed-in user.
 */
@Composable
fun AppLockHost(
    manager: AppLockManager,
    isSignedIn: Boolean,
    onSignOut: suspend () -> Unit,
    content: @Composable () -> Unit,
) {
    val isLocked by manager.isLocked.collectAsStateWithLifecycle()
    val covered = isSignedIn && isLocked
    // Owned by the host, not by the overlay: `onSignOut` clears the lock as its
    // first act, which tears the overlay down — a scope remembered *inside* the
    // overlay would be cancelled mid-sign-out.
    val hostScope = rememberCoroutineScope()
    Box(modifier = Modifier.fillMaxSize()) {
        // While covered the whole subtree drops out of the semantics tree so
        // TalkBack can't read out private content the overlay is hiding.
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .then(if (covered) Modifier.clearAndSetSemantics { } else Modifier),
        ) {
            content()
        }
        // Declared after `content()` so it outranks the NavHost's own handler:
        // system Back must not pop destinations hidden behind the lock. iOS has
        // no equivalent because the overlay window swallows the interactive
        // pop gesture outright.
        BackHandler(enabled = covered) { }
        if (covered) {
            AppLockOverlay(
                manager = manager,
                onSignOut = { hostScope.launch { onSignOut() } },
            )
        }
    }
}

/**
 * The one-time post-login offer to turn on biometric app lock.
 *
 * RN raises this from `AppLockSetupPromptLayer` (`src/app/_layout.tsx:132`)
 * once per account: after an *interactive* sign-in (never a silent session
 * restore), while the device can actually authenticate and the lock is off,
 * it asks once and remembers the answer in
 * [AppLockManager.SetupPromptState] — Pending → Enabled | Declined. Native
 * had the lock itself but no offer, so unless a user went hunting in
 * Settings → Privacy & Security they never learned it existed.
 *
 * iOS mirrors this with `AppLockSetupPromptModifier`.
 *
 * @param lastInteractiveSignInAt `AuthRepository.lastInteractiveSignInAt`.
 *   Each distinct stamp is offered at most once, so recomposition can't
 *   re-raise the dialog.
 */
@Suppress("LongMethod", "CyclomaticComplexMethod")
@Composable
fun AppLockSetupPromptDialog(
    manager: AppLockManager,
    isSignedIn: Boolean,
    lastInteractiveSignInAt: Long?,
) {
    val setupPromptState by manager.setupPromptState.collectAsStateWithLifecycle()
    val preferenceEnabled by manager.preferenceEnabled.collectAsStateWithLifecycle()
    val capability by manager.capability.collectAsStateWithLifecycle()
    val biometricLabel by manager.biometricLabel.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context.findFragmentActivity()
    val scope = rememberCoroutineScope()

    var promptedSignInAt by remember { mutableStateOf<Long?>(null) }
    var showOffer by remember { mutableStateOf(false) }
    var showFailure by remember { mutableStateOf(false) }

    val unlockLabel =
        if (biometricLabel == "Biometric") "Biometric unlock" else biometricLabel

    LaunchedEffect(
        isSignedIn,
        lastInteractiveSignInAt,
        setupPromptState,
        preferenceEnabled,
        capability,
    ) {
        if (!isSignedIn ||
            lastInteractiveSignInAt == null ||
            setupPromptState != AppLockManager.SetupPromptState.Pending ||
            preferenceEnabled ||
            capability != AppLockManager.Capability.Available ||
            promptedSignInAt == lastInteractiveSignInAt
        ) {
            return@LaunchedEffect
        }
        promptedSignInAt = lastInteractiveSignInAt
        showOffer = true
    }

    if (showOffer) {
        AlertDialog(
            onDismissRequest = { },
            title = { Text("Enable $unlockLabel?") },
            text = {
                Text(
                    "Use $unlockLabel to protect sensitive actions like " +
                        "payments and account changes.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showOffer = false
                        val host = activity ?: return@TextButton
                        scope.launch {
                            val enabled =
                                manager.setEnabled(
                                    enabled = true,
                                    activity = host,
                                    source = AppLockManager.EnableSource.PostLoginPrompt,
                                )
                            // A plain cancel is silent (RN swallows
                            // `reason === 'cancelled'`); anything else explains
                            // where to find the setting later.
                            if (!enabled && manager.lastError.value != AppLockManager.CANCELLED_MESSAGE) {
                                showFailure = true
                            }
                        }
                    },
                    modifier = Modifier.testTag("appLockSetupPromptEnable"),
                ) { Text("Enable") }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showOffer = false
                        manager.dismissSetupPrompt()
                    },
                    modifier = Modifier.testTag("appLockSetupPromptDismiss"),
                ) { Text("Not Now") }
            },
            modifier = Modifier.testTag("appLockSetupPrompt"),
        )
    }

    if (showFailure) {
        AlertDialog(
            onDismissRequest = { showFailure = false },
            title = { Text("Could not enable $unlockLabel") },
            text = { Text("You can turn it on later from Privacy & Security.") },
            confirmButton = {
                TextButton(onClick = { showFailure = false }) { Text("OK") }
            },
            modifier = Modifier.testTag("appLockSetupPromptFailure"),
        )
    }
}

internal fun Context.findFragmentActivity(): FragmentActivity? {
    var ctx: Context? = this
    while (ctx is ContextWrapper) {
        if (ctx is FragmentActivity) return ctx
        ctx = ctx.baseContext
    }
    return null
}
