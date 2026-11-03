@file:Suppress("PackageNaming", "ReturnCount")

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
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.security.AppLockManager
import app.pantopus.android.data.ai.AIActionAllowlist
import app.pantopus.android.data.ai.AIActionCardStore
import app.pantopus.android.data.ai.AIActionRunner
import app.pantopus.android.data.ai.AICardStateReporter
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.ui.screens.inbox.conversation.ChatAIActionCard
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardAction
import app.pantopus.android.ui.screens.inbox.conversation.ChatAICardRequest
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import javax.inject.Inject

/**
 * The buttons on the assistant's notifications (AI assistant phase 3 contract §9): Mark done for one task, Mark solved
 * for the person's own answered question, and Fewer like this on every suggestion. They run in the background for the
 * person the push names, on the session that received it, with App Lock off, within 8 seconds, as the Plans buttons
 * do. Mark done and Mark solved send the card's own request only when both the card allowlist and the narrower button
 * list take it, then report the card done. On success the notification goes; whenever it doesn't succeed (an error
 * answer, offline, signed out or another account, App Lock, the time limit) a note replaces it that opens the nudge.
 * Only immutable app-created PendingIntents reach this non-exported receiver.
 */
@AndroidEntryPoint
class AssistantActionReceiver : BroadcastReceiver() {
    @Inject lateinit var auth: AuthRepository

    @Inject lateinit var tokens: TokenStorage

    @Inject lateinit var appLock: AppLockManager

    @Inject lateinit var actions: AIActionRunner

    @Inject lateinit var cards: AIActionCardStore

    @Inject lateinit var cardStates: AICardStateReporter

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val action = intent.action ?: return
        if (action !in ACTIONS) return
        val recipient = intent.getStringExtra(RECIPIENT) ?: return
        val expectedSession = intent.getStringExtra(SESSION) ?: return
        val notificationId = intent.getIntExtra(NOTIFICATION_ID, 0)
        val nudgeId = intent.getStringExtra(NUDGE)
        val conversationId = intent.getStringExtra(CONVERSATION)
        val pending = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        scope.launch {
            var outcome: Outcome = Outcome.Failed(null)
            try {
                withTimeout(TIMEOUT_MS) {
                    if (auth.state.value == AuthRepository.State.Unknown) auth.restore()
                    val actor = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id ?: return@withTimeout
                    if (actor != recipient || ReminderActionReceiver.sessionFingerprint(tokens.sessionIdentity()) != expectedSession) {
                        return@withTimeout
                    }
                    appLock.configure(actor)
                    if (appLock.isLocked.value) return@withTimeout
                    val named = ButtonAction.parse(intent.getStringExtra(ASSISTANT_ACTION))
                    val button = named?.takeIf { it.fits(action) }
                    outcome =
                        when {
                            action == FEWER -> fewer(nudgeId)
                            button == null -> Outcome.Failed(null)
                            else -> send(ChatAICardAction(id = button.actionId, label = "", style = "primary", request = button.request))
                        }
                    // Done already: a report that runs out of time stays unreported for the thread to send (§4.4).
                    if (outcome == Outcome.Done) record(actor, action, named, button)
                }
            } catch (_: Exception) {
                // Timed out, or the session went away: the note below says so.
            } finally {
                when (val done = outcome) {
                    Outcome.Done -> NotificationManagerCompat.from(context).cancel(notificationId)
                    is Outcome.Failed -> explain(context, notificationId, action, recipient, nudgeId, conversationId, done.message)
                }
                pending.finish()
                scope.cancel()
            }
        }
    }

    private sealed interface Outcome {
        data object Done : Outcome

        /** [message] is the server's own sentence when it sent one (the task changed, or is gone). */
        data class Failed(val message: String?) : Outcome
    }

    /** `POST /api/ai/nudges/<id>/fewer`: the nudge's kind, muted for 30 days. */
    private suspend fun fewer(nudgeId: String?): Outcome {
        val id = nudgeId?.takeIf(UUID::matches) ?: return Outcome.Failed(null)
        val request = ChatAICardRequest(method = "POST", path = "/api/ai/nudges/$id/fewer")
        return send(ChatAICardAction(id = FEWER_ACTION_ID, label = "Fewer like this", style = "secondary", request = request))
    }

    /**
     * This phone's record, then the server's, so the thread shows the card done on every phone (§4.4). Fewer like this
     * is reported on the card the push names, which carries it when the nudge has one card (as iOS does); the server
     * answers 400 for a card without it, and that report is let go.
     */
    private suspend fun record(
        actor: String,
        action: String,
        named: ButtonAction?,
        button: ButtonAction?,
    ) {
        if (action == FEWER) {
            named?.let { cardStates.reportDoneNow(actor, it.cardId, null, FEWER_ACTION_ID) }
            return
        }
        val done = button ?: return
        val scope = done.itemId ?: ChatAIActionCard.CARD_SCOPE
        cards.markDone(done.cardId, AIActionCardStore.Done(scope, done.actionId, link = null, note = null))
        cardStates.reportDoneNow(actor, done.cardId, done.itemId, done.actionId)
    }

    private suspend fun send(action: ChatAICardAction): Outcome =
        when (val result = actions.run(action)) {
            is AIActionRunner.Outcome.Done -> Outcome.Done
            is AIActionRunner.Outcome.Failed -> Outcome.Failed(result.message.takeUnless { it == NO_CONNECTION })
            AIActionRunner.Outcome.NotAllowed, AIActionRunner.Outcome.SessionChanged -> Outcome.Failed(null)
        }

    /** Replaces the notification: what didn't happen, opening the nudge in the assistant. */
    @Suppress("LongParameterList")
    private fun explain(
        context: Context,
        notificationId: Int,
        action: String,
        recipient: String,
        nudgeId: String?,
        conversationId: String?,
        message: String?,
    ) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val title =
            when (action) {
                MARK_DONE -> "Couldn't mark it done."
                MARK_SOLVED -> "Couldn't mark it solved."
                else -> "Couldn't show fewer like this."
            }
        val body = listOfNotNull(message?.trim()?.takeIf { it.isNotEmpty() }, "Tap to open it in Pantopus.").joinToString(" ")
        val link =
            DeepLinkRouter.assistantNotificationPath("assistant_nudge", nudgeId, null, conversationId) ?: "pantopus://assistant"
        // As the original notification opened: through the not-exported alias, for its recipient only.
        val open =
            Intent().setClassName(context, MainActivity.NOTIFICATION_OPEN).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                this.action = Intent.ACTION_VIEW
                data = Uri.parse(link)
                putExtra(ReminderActionReceiver.PUSH_OPEN, true)
                putExtra(ReminderActionReceiver.PUSH_TYPE, "assistant_nudge")
                putExtra(ASSISTANT_RECIPIENT, recipient)
            }
        val content =
            PendingIntent.getActivity(context, notificationId, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification =
            NotificationCompat
                .Builder(context, NotificationDispatcher.Channel.SYSTEM.id)
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

    /**
     * A push's `assistant_action` (phase 3 contract §9.2): the card's own request, exactly, with the card, row and
     * action it belongs to.
     */
    data class ButtonAction(
        val cardId: String,
        val itemId: String?,
        val actionId: String,
        val request: ChatAICardRequest,
    ) {
        /**
         * The narrower list a button may send (§9.3), on top of the card allowlist: Mark done is a task's status set
         * to done and nothing else; Mark solved is the person's own question.
         */
        fun fits(action: String): Boolean {
            if (!AIActionAllowlist.allows(request)) return false
            return when (action) {
                MARK_DONE ->
                    request.method == "PUT" && TASK_PATH.matches(request.path) &&
                        request.body?.let { runCatching { JSONObject(it) }.getOrNull() }?.let { onlyDone(it) } == true
                MARK_SOLVED -> request.method == "PATCH" && SOLVE_PATH.matches(request.path)
                else -> false
            }
        }

        private fun onlyDone(body: JSONObject): Boolean = body.length() == 1 && body.opt("status") == "done"

        companion object {
            /** The JSON string a push carries; null when any part is missing or isn't what a button sends. */
            fun parse(json: String?): ButtonAction? {
                val value = json?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return null
                val cardId = value.text("card_id")?.takeIf(UUID::matches) ?: return null
                val actionId = value.text("action_id") ?: return null
                val method = value.text("method")?.uppercase() ?: return null
                val path = value.text("path") ?: return null
                val body = value.opt("body")?.takeUnless { it == JSONObject.NULL }
                if (body != null && body !is JSONObject) return null
                return ButtonAction(
                    cardId = cardId,
                    itemId = value.text("item_id"),
                    actionId = actionId,
                    request = ChatAICardRequest(method = method, path = path, body = (body as? JSONObject)?.toString()),
                )
            }

            private fun JSONObject.text(name: String): String? = if (isNull(name)) null else optString(name).trim().ifEmpty { null }
        }
    }

    companion object {
        const val CATEGORY_SUGGESTION = "ASSISTANT_SUGGESTION"
        const val CATEGORY_DONE = "ASSISTANT_DONE"
        const val CATEGORY_SOLVED = "ASSISTANT_SOLVED"
        const val CATEGORY_DONE_ONLY = "ASSISTANT_DONE_ONLY"
        const val CATEGORY_SOLVED_ONLY = "ASSISTANT_SOLVED_ONLY"

        const val MARK_DONE = "ASSISTANT_MARK_DONE"
        const val MARK_SOLVED = "ASSISTANT_MARK_SOLVED"
        const val FEWER = "ASSISTANT_FEWER"

        private val ACTIONS = setOf(MARK_DONE, MARK_SOLVED, FEWER)

        const val RECIPIENT = "pantopus.assistant.action.recipient"
        const val SESSION = "pantopus.assistant.action.session"
        const val NOTIFICATION_ID = "pantopus.assistant.action.notificationId"
        const val NUDGE = "pantopus.assistant.action.nudge"
        const val CONVERSATION = "pantopus.assistant.action.conversation"
        const val ASSISTANT_ACTION = "pantopus.assistant.action.request"

        private const val TIMEOUT_MS = 8_000L

        /** The nudge card's "Fewer like this" action (`nudges/engine.js`). */
        private const val FEWER_ACTION_ID = "fewer"

        /** [AIActionRunner]'s own words for a request that never reached the server: the note says to open it instead. */
        private const val NO_CONNECTION = "Couldn't reach Pantopus. Check your connection and try again."

        private val UUID = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
        private val TASK_PATH = Regex("^/api/homes/[0-9a-fA-F-]{36}/tasks/[0-9a-fA-F-]{36}$")
        private val SOLVE_PATH = Regex("^/api/posts/[0-9a-fA-F-]{36}/solve$")

        private val MARK_DONE_BUTTON = Button(MARK_DONE, "Mark done", needsUnlock = true)
        private val MARK_SOLVED_BUTTON = Button(MARK_SOLVED, "Mark solved", needsUnlock = true)
        private val FEWER_BUTTON = Button(FEWER, "Fewer like this", needsUnlock = false)

        /** The buttons a category gets (§9.2), or null for none: at most one action button, then Fewer like this. */
        fun buttonsFor(category: String?): List<Button>? =
            when (category) {
                CATEGORY_SUGGESTION -> listOf(FEWER_BUTTON)
                CATEGORY_DONE -> listOf(MARK_DONE_BUTTON, FEWER_BUTTON)
                CATEGORY_SOLVED -> listOf(MARK_SOLVED_BUTTON, FEWER_BUTTON)
                CATEGORY_DONE_ONLY -> listOf(MARK_DONE_BUTTON)
                CATEGORY_SOLVED_ONLY -> listOf(MARK_SOLVED_BUTTON)
                else -> null
            }
    }
}
