@file:Suppress("LongMethod", "MatchingDeclarationName")

package app.pantopus.android.core.security

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

/** Hilt door into [AppLockManager] for composables outside a view-model. */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface AppLockEntryPoint {
    fun appLockManager(): AppLockManager
}

/** The process-wide [AppLockManager], resolved without a view-model. */
@Composable
fun rememberAppLockManager(): AppLockManager {
    val context = LocalContext.current
    return remember(context) {
        EntryPointAccessors
            .fromApplication(
                context.applicationContext,
                AppLockEntryPoint::class.java,
            ).appLockManager()
    }
}

/** Gate lifecycle for [SensitiveScreenGuard]. */
private sealed interface GuardPhase {
    data object Pending : GuardPhase

    data object Authenticating : GuardPhase

    data object Authenticated : GuardPhase

    data class Rejected(val message: String?) : GuardPhase
}

/**
 * Screen-level identity gate for the money surfaces (Wallet, Settings →
 * Payments). Mirrors RN `components/security/SensitiveScreenGuard.tsx` and the
 * iOS `SensitiveScreenGuard`:
 *
 * - the device carries no credential (no biometric, no device credential) →
 *   [content] renders immediately, because there is nothing to check against,
 * - a successful check inside the 5-minute grace window → [content] renders
 *   immediately,
 * - otherwise the biometric / device-credential sheet is raised *before*
 *   [content] is composed. Cancel or failure calls [onRejected], which pops
 *   the screen exactly like RN's `backOrDismissTo(router, MAIN_TABS_ROUTE)`.
 */
@Composable
fun SensitiveScreenGuard(
    reason: String,
    modifier: Modifier = Modifier,
    graceMs: Long = AppLockManager.SENSITIVE_AUTH_GRACE_MS,
    manager: AppLockManager = rememberAppLockManager(),
    onRejected: () -> Unit,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findFragmentActivity() }
    var phase by remember { mutableStateOf<GuardPhase>(GuardPhase.Pending) }
    var attempt by remember { mutableStateOf(0) }

    LaunchedEffect(attempt) {
        if (phase !is GuardPhase.Pending) return@LaunchedEffect
        manager.refreshCapability()
        val host = activity
        // RN's first branch: nothing to check against — never make the screen
        // unreachable. Same when the host isn't a FragmentActivity (previews).
        if (host == null || manager.capability.value != AppLockManager.Capability.Available) {
            phase = GuardPhase.Authenticated
            return@LaunchedEffect
        }
        if (manager.isWithinSensitiveGracePeriod(graceMs)) {
            phase = GuardPhase.Authenticated
            return@LaunchedEffect
        }
        phase = GuardPhase.Authenticating
        phase =
            when (val outcome = manager.verifySensitiveAction(host, reason)) {
                is AppLockManager.SensitiveActionOutcome.Verified -> GuardPhase.Authenticated
                is AppLockManager.SensitiveActionOutcome.Cancelled -> {
                    onRejected()
                    GuardPhase.Rejected(null)
                }
                is AppLockManager.SensitiveActionOutcome.Failed -> {
                    onRejected()
                    GuardPhase.Rejected(outcome.message)
                }
            }
    }

    if (phase is GuardPhase.Authenticated) {
        content()
        return
    }

    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .padding(Spacing.s6)
                .testTag("sensitiveScreenGuard"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4, Alignment.CenterVertically),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Lock,
            contentDescription = null,
            size = 44.dp,
            tint = PantopusColors.primary600,
        )
        Text(
            text = reason,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        val rejected = phase as? GuardPhase.Rejected
        Text(
            text =
                when {
                    rejected == null -> "Confirm it's you to continue."
                    rejected.message != null -> rejected.message
                    else -> "Identity check cancelled."
                },
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        if (rejected != null) {
            PrimaryButton(
                title = "Try again",
                onClick = {
                    phase = GuardPhase.Pending
                    attempt += 1
                },
                modifier = Modifier.testTag("sensitiveScreenGuardRetry"),
            )
        }
    }
}

/**
 * One-shot identity re-check in front of a money-moving action (a wallet
 * withdrawal today). Mirrors RN's `useSensitiveActionGuard`, which every
 * Wallet / Payouts action calls even inside a guarded screen.
 *
 * Returns [AppLockManager.SensitiveActionOutcome.Verified] when the caller may
 * proceed. Lives in the composable layer because Android's `BiometricPrompt`
 * needs the host `FragmentActivity`; iOS mirrors the same call site.
 */
@Composable
fun rememberSensitiveActionGuard(
    manager: AppLockManager = rememberAppLockManager(),
): suspend (String) -> AppLockManager.SensitiveActionOutcome {
    val context = LocalContext.current
    val activity = remember(context) { context.findFragmentActivity() }
    return remember(manager, activity) {
        { reason ->
            val host = activity
            if (host == null) {
                AppLockManager.SensitiveActionOutcome.Verified
            } else {
                manager.verifySensitiveAction(host, reason)
            }
        }
    }
}
