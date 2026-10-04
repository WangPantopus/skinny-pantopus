@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.push

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import app.pantopus.android.core.routing.HomeTaskNotificationRoute
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.analytics.PilotEvents
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskAccessFactory
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import java.security.MessageDigest
import javax.inject.Inject

/** Only immutable app-created notification PendingIntents reach this non-exported receiver. */
@AndroidEntryPoint
class ReminderActionReceiver : BroadcastReceiver() {
    @Inject lateinit var auth: AuthRepository

    @Inject lateinit var tokens: TokenStorage

    @Inject lateinit var tasks: HomeTaskAccessFactory

    @Inject lateinit var events: PilotEvents

    @Inject lateinit var appLock: AppLockManager

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val action = intent.action
        if (action != BINS_OUT && action != TASK_DONE) return
        val recipient = intent.getStringExtra(RECIPIENT) ?: return
        val expectedSession = intent.getStringExtra(SESSION) ?: return
        val pending = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        scope.launch {
            try {
                withTimeout(8_000) {
                    if (auth.state.value == AuthRepository.State.Unknown) auth.restore()
                    val actor = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id ?: return@withTimeout
                    if (actor != recipient || sessionFingerprint(tokens.sessionIdentity()) != expectedSession) return@withTimeout
                    appLock.configure(actor)
                    if (appLock.isLocked.value) return@withTimeout
                    when (action) {
                        BINS_OUT -> {
                            val date =
                                intent.getStringExtra(DATE)?.takeIf { it.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$")) }
                                    ?: return@withTimeout
                            events.send(
                                PilotEvents.Event.ReminderAction,
                                mapOf("kind" to "pickup", "action" to "bins_out", "date" to date),
                                actor,
                            )
                        }
                        TASK_DONE -> if (!completeTask(context, intent, scope, expectedSession, actor)) return@withTimeout
                    }
                    if (intent.hasExtra(NOTIFICATION_ID)) {
                        NotificationManagerCompat.from(context).cancel(intent.getIntExtra(NOTIFICATION_ID, 0))
                    }
                }
            } catch (_: Exception) {
                // Expired auth, denied permissions or an uncertain task reply do not
                // claim completion. Leave the task/notification available to reopen.
            } finally {
                pending.finish()
                scope.cancel()
            }
        }
    }

    private suspend fun completeTask(
        context: Context,
        intent: Intent,
        scope: CoroutineScope,
        expectedSession: String,
        actor: String,
    ): Boolean {
        val keyguard = context.getSystemService(KeyguardManager::class.java)
        if (keyguard == null || keyguard.isDeviceLocked) return false
        val home = HomeTaskNotificationRoute.canonicalId(intent.getStringExtra(HOME))
        val task = HomeTaskNotificationRoute.canonicalId(intent.getStringExtra(TASK))
        if (home == null || task == null) return false
        val access =
            tasks.create(home, scope, dispatchGuard = {
                check(sessionFingerprint(tokens.sessionIdentity()) == expectedSession)
                check(!appLock.isLocked.value && !keyguard.isDeviceLocked)
            })
        access.complete(task, completed = true) {
            check(sessionFingerprint(tokens.sessionIdentity()) == expectedSession)
            check(!appLock.isLocked.value && !keyguard.isDeviceLocked)
        }
        if (sessionFingerprint(tokens.sessionIdentity()) != expectedSession) return false
        events.send(PilotEvents.Event.ReminderAction, mapOf("kind" to "task", "action" to "done"), actor)
        return true
    }

    companion object {
        const val BINS_OUT = "BINS_OUT"
        const val TASK_DONE = "TASK_DONE"
        const val TASK_NOT_NOW = "TASK_NOT_NOW"
        const val RECIPIENT = "pantopus.reminder.recipient"
        const val SESSION = "pantopus.reminder.session"
        const val HOME = "pantopus.reminder.home"
        const val TASK = "pantopus.reminder.task"
        const val DATE = "pantopus.reminder.date"
        const val ACTION = "pantopus.reminder.action"
        const val NOTIFICATION_ID = "pantopus.reminder.notificationId"
        const val PUSH_OPEN = "pantopus.notification.open"
        const val PUSH_TYPE = "pantopus.notification.type"

        internal fun sessionFingerprint(identity: Pair<String, String?>?): String? {
            val (actor, session) = identity ?: return null
            if (session.isNullOrBlank()) return null
            return MessageDigest.getInstance("SHA-256").digest("$actor|$session".toByteArray()).joinToString("") { "%02x".format(it) }
        }
    }
}
