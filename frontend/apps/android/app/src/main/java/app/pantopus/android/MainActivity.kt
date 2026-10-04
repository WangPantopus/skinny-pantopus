package app.pantopus.android

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.core.security.SecureWindowController
import app.pantopus.android.data.analytics.PilotEvents
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.OAuthSessionStore
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.chats.ActiveChatThread
import app.pantopus.android.push.PushTokenSyncer
import app.pantopus.android.push.ReminderActionReceiver
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.navigation.PantopusNavHost
import app.pantopus.android.ui.theme.PantopusTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.first
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

    @Inject lateinit var pilotEvents: PilotEvents

    @Inject lateinit var authRepository: AuthRepository

    @Inject lateinit var tokenStorage: TokenStorage

    /**
     * App-wide [ToastController]. Survives configuration changes via the
     * Activity instance. Feature view-models can grab the same instance
     * via the Hilt-provided `ToastControllerEntryPoint` (or be passed it
     * directly through a singleton DI binding once we DI-wire it).
     */
    private val toastController = ToastController()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        secureWindowController.bind(this)
        observeAppLockPrivacyHold()
        lifecycleScope.launch {
            authRepository.state.collect { pilotEvents.authChanged() }
        }
        // A recreated Activity retains its navigation/ViewModel state. Replaying the
        // launch link would replace that screen and discard its in-progress input.
        // Fresh processes still route the launch intent; onNewIntent handles new links.
        if (lastNonConfigurationInstance == null) forwardDeepLink(intent)
        setContent {
            PantopusTheme {
                Box(modifier = Modifier.fillMaxSize()) {
                    PantopusNavHost()
                    ToastHost(controller = toastController)
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        // Foreground marker for chat-push suppression — a notification
        // for the on-screen conversation is skipped only while visible.
        activeChatThread.isForeground = true
        pilotEvents.enterForeground()
        appLockManager.appDidBecomeActive()
        launchPushTokenSync()
    }

    override fun onStop() {
        // `isChangingConfigurations` separates a real background from a
        // rotation / locale change / multi-window resize, which destroy and
        // recreate this Activity without the app ever leaving the foreground.
        // iOS sees no `.background` for those at all, so arming here would
        // lock the app in the user's hands on every rotation.
        appLockManager.appDidEnterBackground(isConfigurationChange = isChangingConfigurations)
        if (!isChangingConfigurations) pilotEvents.enterBackground()
        activeChatThread.isForeground = false
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Warm-start deep links (app already in memory).
        forwardDeepLink(intent)
        setIntent(intent)
    }

    private fun forwardReminderAction(
        intent: Intent,
        uri: Uri,
    ): Boolean {
        if (intent.getStringExtra(ReminderActionReceiver.ACTION) != ReminderActionReceiver.TASK_NOT_NOW) return false
        val recipient = intent.getStringExtra(ReminderActionReceiver.RECIPIENT)
        val session = intent.getStringExtra(ReminderActionReceiver.SESSION)
        val destination = DeepLinkRouter.resolve(uri) as? DeepLinkRouter.Destination.HomeTask
        if (recipient == null || session == null || intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) return true
        if (destination == null || !destination.openDueDateEdit) return true
        // Existing encrypted pending-route storage binds the cold login replay.
        DeepLinkRouter.handle(uri.toString(), expectedUserId = recipient)
        intent.removeExtra(ReminderActionReceiver.ACTION)
        lifecycleScope.launch {
            val hydrated = authRepository.state.first { it != AuthRepository.State.Unknown }
            if ((hydrated as? AuthRepository.State.SignedIn)?.user?.id != recipient) return@launch
            if (ReminderActionReceiver.sessionFingerprint(tokenStorage.sessionIdentity()) != session) return@launch
            pilotEvents.send(PilotEvents.Event.ReminderAction, mapOf("kind" to "task", "action" to "not_now"), recipient)
        }
        return true
    }

    private fun forwardDeepLink(intent: Intent?) {
        if (intent?.getBooleanExtra(ReminderActionReceiver.PUSH_OPEN, false) == true) {
            val pushType = intent.getStringExtra(ReminderActionReceiver.PUSH_TYPE)
            intent.removeExtra(ReminderActionReceiver.PUSH_OPEN)
            intent.removeExtra(ReminderActionReceiver.PUSH_TYPE)
            // Task-history restoration can retain the original notification intent.
            // It is an organic return, not another response to that notification.
            if (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY == 0) {
                pilotEvents.notificationOpened(pushType)
            }
        }
        val uri = intent?.data ?: return
        if (intent.action != Intent.ACTION_VIEW) return
        // Browser OAuth callbacks belong to the in-flight sign-in attempt,
        // not the router. Mirrors iOS `PantopusApp`'s
        // `guard !AuthManager.isOAuthCallback(url) else { return }`.
        if (OAuthSessionStore.isOAuthCallback(uri)) {
            OAuthSessionStore.deliver(uri)
            return
        }
        if (forwardReminderAction(intent, uri)) return
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

    private fun launchPushTokenSync() {
        lifecycleScope.launch {
            val outcome = pushTokenSyncer.syncIfNeeded()
            Timber.d("Push token sync outcome=$outcome")
        }
    }
}
