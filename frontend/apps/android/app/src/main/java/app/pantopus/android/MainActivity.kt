package app.pantopus.android

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.core.security.SecureWindowController
import app.pantopus.android.data.auth.OAuthSessionStore
import app.pantopus.android.data.chats.ActiveChatThread
import app.pantopus.android.push.PushTokenSyncer
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.navigation.PantopusNavHost
import app.pantopus.android.ui.theme.PantopusTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * The single Activity that hosts the whole Compose UI tree.
 * Navigation is entirely in-Compose via [PantopusNavHost]; incoming
 * deep-link intents get forwarded into [DeepLinkRouter] for the
 * RootTabScreen to consume — except the browser OAuth callback, which goes
 * to [OAuthSessionStore] instead.
 *
 * Declared `singleTask` in the manifest so a browser redirect resumes this
 * instance through [onNewIntent] rather than stacking a second copy.
 *
 * Extends [FragmentActivity] so [androidx.biometric.BiometricPrompt] (app
 * lock + transfer-ownership) has a valid host.
 */
@AndroidEntryPoint
class MainActivity : FragmentActivity() {
    @Inject lateinit var pushTokenSyncer: PushTokenSyncer

    /** Chat-push suppression: notifications skip rooms the user is viewing. */
    @Inject lateinit var activeChatThread: ActiveChatThread

    @Inject lateinit var appLockManager: AppLockManager

    @Inject lateinit var secureWindowController: SecureWindowController

    /**
     * App-wide [ToastController]. Survives configuration changes via the
     * Activity instance. Feature view-models can grab the same instance
     * via the Hilt-provided `ToastControllerEntryPoint` (or be passed it
     * directly through a singleton DI binding once we DI-wire it).
     */
    private val toastController = ToastController()

    /**
     * Runtime POST_NOTIFICATIONS launcher (Android 13+). Mirrors iOS's
     * `UNUserNotificationCenter.requestAuthorization` — same trigger
     * point (first launch), same observable outcome (system prompt then
     * grant or deny). The result is logged; the syncer will fire either
     * way so a denial doesn't strand the FCM token off-device.
     */
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            Timber.d("POST_NOTIFICATIONS granted=$granted")
            if (!granted) {
                Timber.i("Push permission denied — system notifications will be suppressed")
            }
            // Kick the syncer regardless. Even if the user denies the
            // system prompt the backend should still know the token so
            // server-side preference toggles can re-enable later.
            launchPushTokenSync()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        secureWindowController.bind(this)
        observeAppLockPrivacyHold()
        // Cold-start deep links arrive via the launch intent.
        forwardDeepLink(intent)
        setContent {
            PantopusTheme {
                Box(modifier = Modifier.fillMaxSize()) {
                    PantopusNavHost()
                    ToastHost(controller = toastController)
                }
            }
        }
        // Mirror iOS AppDelegate.requestNotificationPermission():
        // on Android 13+ the OS requires an explicit runtime prompt.
        // On earlier versions notifications are granted by default.
        requestNotificationPermissionIfNeeded()
    }

    override fun onStart() {
        super.onStart()
        // Foreground marker for chat-push suppression — a notification
        // for the on-screen conversation is skipped only while visible.
        activeChatThread.isForeground = true
        appLockManager.appDidBecomeActive()
    }

    override fun onStop() {
        // `isChangingConfigurations` separates a real background from a
        // rotation / locale change / multi-window resize, which destroy and
        // recreate this Activity without the app ever leaving the foreground.
        // iOS sees no `.background` for those at all, so arming here would
        // lock the app in the user's hands on every rotation.
        appLockManager.appDidEnterBackground(isConfigurationChange = isChangingConfigurations)
        activeChatThread.isForeground = false
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Warm-start deep links (app already in memory).
        forwardDeepLink(intent)
        setIntent(intent)
    }

    private fun forwardDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (intent.action != Intent.ACTION_VIEW) return
        // Browser OAuth callbacks belong to the in-flight sign-in attempt,
        // not the router. Mirrors iOS `PantopusApp`'s
        // `guard !AuthManager.isOAuthCallback(url) else { return }`.
        if (OAuthSessionStore.isOAuthCallback(uri)) {
            OAuthSessionStore.deliver(uri)
            return
        }
        DeepLinkRouter.handle(uri)
    }

    /**
     * Hold `FLAG_SECURE` for as long as the signed-in user has app lock on,
     * so the recents thumbnail (and screenshots) can't leak their account.
     * This is Android's counterpart to iOS's `AppSwitcherPrivacyOverlay`,
     * which iOS draws before the app-switcher snapshot under the same
     * condition — `AppLockManager.preferenceEnabled` is only ever true for a
     * configured (signed-in) user who turned the lock on.
     */
    private fun observeAppLockPrivacyHold() {
        lifecycleScope.launch {
            appLockManager.preferenceEnabled.collect { enabled ->
                secureWindowController.setPrivacyHold(enabled)
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            // < Android 13: implicit grant — go straight to syncing.
            launchPushTokenSync()
            return
        }
        val granted =
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        if (granted) {
            launchPushTokenSync()
        } else {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun launchPushTokenSync() {
        lifecycleScope.launch {
            val outcome = pushTokenSyncer.syncIfNeeded()
            Timber.d("Push token sync outcome=$outcome")
        }
    }
}
