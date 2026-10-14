@file:Suppress("PackageNaming", "MagicNumber", "ReturnCount")

package app.pantopus.android.push

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.pantopus.android.MainActivity
import app.pantopus.android.R
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.planCode
import app.pantopus.android.data.plans.planMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import javax.inject.Inject

/**
 * Nearby Plans' notification buttons (board A3), run in the background for the person the push names and only on
 * the session that received it (the same checks as the reminder buttons). A button that works clears its
 * notification; one that doesn't replaces it with an honest line that opens the plan or its requests, in the words
 * iOS shows on the plan ("Couldn't accept Priya. This plan is full."). Only immutable app-created PendingIntents reach
 * this non-exported receiver.
 */
@AndroidEntryPoint
class PlanActionReceiver : BroadcastReceiver() {
    @Inject lateinit var auth: AuthRepository

    @Inject lateinit var tokens: TokenStorage

    @Inject lateinit var plans: PlansRepository

    @Inject lateinit var appLock: AppLockManager

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val action = intent.action ?: return
        if (action !in ACTIONS) return
        val recipient = intent.getStringExtra(RECIPIENT) ?: return
        val expectedSession = intent.getStringExtra(SESSION) ?: return
        val planId = intent.getStringExtra(PLAN) ?: return
        val notificationId = intent.getIntExtra(NOTIFICATION_ID, 0)
        val pending = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        scope.launch {
            try {
                withTimeout(TIMEOUT_MS) {
                    if (auth.state.value == AuthRepository.State.Unknown) auth.restore()
                    val actor = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id ?: return@withTimeout
                    if (actor != recipient || ReminderActionReceiver.sessionFingerprint(tokens.sessionIdentity()) != expectedSession) {
                        return@withTimeout
                    }
                    appLock.configure(actor)
                    if (appLock.isLocked.value) return@withTimeout
                    val result = perform(action, planId, intent.getStringExtra(REQUEST))
                    when (result) {
                        is NetworkResult.Success -> NotificationManagerCompat.from(context).cancel(notificationId)
                        is NetworkResult.Failure ->
                            explain(context, notificationId, action, planId, intent.getStringExtra(TITLE), result.error)
                    }
                    plans.changed(planId)
                }
            } catch (_: NetworkError) {
                // A refusal or an outage: leave the notification for the person to open.
            } catch (_: Exception) {
                // Timed out or signed out: claim nothing.
            } finally {
                pending.finish()
                scope.cancel()
            }
        }
    }

    private suspend fun perform(
        action: String,
        planId: String,
        requestId: String?,
    ): NetworkResult<Unit> =
        when (action) {
            ACCEPT -> requestId?.let { plans.accept(planId, it, confirmSharesAddress = false) } ?: missing()
            DECLINE -> requestId?.let { plans.decline(planId, it) } ?: missing()
            ON_MY_WAY -> plans.onMyWay(planId)
            STILL_COMING -> plans.stillComing(planId, coming = true)
            CANT_MAKE_IT_CHANGED -> plans.stillComing(planId, coming = false)
            CANT_MAKE_IT -> plans.withdraw(planId)
            else -> missing()
        }

    private fun missing(): NetworkResult<Unit> = NetworkResult.Failure(NetworkError.NotFound)

    /** Replaces the notification with what went wrong; tapping it opens the plan (or its requests for the host). */
    private fun explain(
        context: Context,
        notificationId: Int,
        action: String,
        planId: String,
        pushTitle: String?,
        error: NetworkError,
    ) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val toRequests = action == ACCEPT || action == DECLINE
        val (title, body) = failure(action, pushTitle, error)
        val link = if (toRequests) "pantopus://plans/$planId/requests" else "pantopus://plans/$planId"
        val open =
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                this.action = Intent.ACTION_VIEW
                data = Uri.parse(link)
            }
        val content =
            PendingIntent.getActivity(
                context,
                notificationId,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val notification =
            NotificationCompat
                .Builder(context, NotificationDispatcher.Channel.PLANS.id)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(content)
                .build()
        runCatching { NotificationManagerCompat.from(context).notify(notificationId, notification) }
    }

    /** One notification button. */
    data class Button(
        val action: String,
        val label: String,
        val needsUnlock: Boolean,
    )

    companion object {
        const val CATEGORY_REQUEST = "PLAN_REQUEST"
        const val CATEGORY_REMINDER = "PLAN_REMINDER"
        const val CATEGORY_CHANGED = "PLAN_CHANGED"

        const val ACCEPT = "PLAN_ACCEPT"
        const val DECLINE = "PLAN_DECLINE"
        const val ON_MY_WAY = "PLAN_ON_MY_WAY"
        const val CANT_MAKE_IT = "PLAN_CANT_MAKE_IT"
        const val STILL_COMING = "PLAN_STILL_COMING"
        const val CANT_MAKE_IT_CHANGED = "PLAN_CANT_MAKE_IT_CHANGED"

        private val ACTIONS = setOf(ACCEPT, DECLINE, ON_MY_WAY, CANT_MAKE_IT, STILL_COMING, CANT_MAKE_IT_CHANGED)

        /** Refusals that mean "the host must confirm sharing their address first" (H10). */
        private val ADDRESS_CODES = setOf("confirm_shares_address", "confirm_shares_address_required", "needs_address_confirmation")

        const val PLAN = "pantopus.plan.id"
        const val REQUEST = "pantopus.plan.request"
        const val RECIPIENT = "pantopus.plan.recipient"
        const val SESSION = "pantopus.plan.session"
        const val NOTIFICATION_ID = "pantopus.plan.notificationId"
        const val TITLE = "pantopus.plan.title"

        private const val TIMEOUT_MS = 8_000L

        /**
         * What didn't go through and why (board A3), in the words iOS shows on the plan: "Couldn't accept Priya" and
         * "This plan is full. They can stay on the waitlist." (the server's sentence).
         */
        internal fun failure(
            action: String,
            pushTitle: String?,
            error: NetworkError,
        ): Pair<String, String> {
            val who = requesterFirst(pushTitle) ?: "this request"
            val headline =
                when (action) {
                    ACCEPT -> "Couldn't accept $who"
                    DECLINE -> "Couldn't decline $who"
                    ON_MY_WAY -> "Couldn't send “On my way”"
                    STILL_COMING -> "Couldn't send “Still coming”"
                    else -> "Couldn't tell the host you can't make it"
                }
            val reason =
                when {
                    error.planCode in ADDRESS_CODES -> "Accepting shares your address. Confirm it on the request first."
                    error is NetworkError.NotFound -> "This plan isn't available anymore."
                    else -> error.planMessage
                }
            return headline to reason
        }

        /** "Priya" from a request push's title ("Priya asked to join your watch party"), else null. */
        internal fun requesterFirst(pushTitle: String?): String? =
            pushTitle
                ?.substringBefore(" asked to join", missingDelimiterValue = "")
                ?.trim()
                ?.takeIf { it.isNotEmpty() }

        /** The buttons a category gets (board A3), or null for none. */
        fun buttonsFor(category: String?): List<Button>? =
            when (category) {
                CATEGORY_REQUEST -> listOf(Button(ACCEPT, "Accept", needsUnlock = true), Button(DECLINE, "Decline", needsUnlock = true))
                CATEGORY_REMINDER ->
                    listOf(Button(ON_MY_WAY, "On my way", needsUnlock = false), Button(CANT_MAKE_IT, "Can't make it", needsUnlock = true))
                CATEGORY_CHANGED ->
                    listOf(
                        Button(STILL_COMING, "Still coming", needsUnlock = false),
                        Button(CANT_MAKE_IT_CHANGED, "Can't make it", needsUnlock = true),
                    )
                else -> null
            }
    }
}
