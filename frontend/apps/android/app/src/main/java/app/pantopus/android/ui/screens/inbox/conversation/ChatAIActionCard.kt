@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.compose.runtime.Immutable
import java.time.Instant

/** A label and value row on an action card ("When" · "Sat, Oct 24 · 10:00–11:30 AM"). */
@Immutable
data class ChatAICardLine(
    val label: String,
    val value: String,
)

/**
 * One request a card button sends, exactly as the server built it (AI assistant phase 1 contract, section 4.2).
 * The app checks it against its allowlist before sending and never changes it, apart from the
 * `{{response.…}}` placeholders of a follow-up request.
 */
@Immutable
data class ChatAICardRequest(
    /** Upper case: `POST`, `PATCH` or `PUT`. */
    val method: String,
    val path: String,
    /** The JSON object body as text, sent as is; null sends `{}`. */
    val body: String? = null,
    val headers: Map<String, String> = emptyMap(),
)

/** A button on an action card, or on one of its rows. */
@Immutable
data class ChatAICardAction(
    val id: String,
    val label: String,
    /** `primary`, `secondary` or `destructive`. */
    val style: String,
    /** Null when the server's request couldn't be read; the card then says it can't be used. */
    val request: ChatAICardRequest?,
    /** Sent only after [request] succeeds (a repeating task's repeat). */
    val then: ChatAICardRequest? = null,
    val doneLabel: String? = null,
    /** Opens with the deep-link router once done; may hold `{{response.…}}` placeholders. */
    val doneLink: String? = null,
)

/** One row with its own buttons, such as a person asking to join a plan. */
@Immutable
data class ChatAICardItem(
    val id: String,
    val title: String,
    val lines: List<ChatAICardLine> = emptyList(),
    val actions: List<ChatAICardAction> = emptyList(),
)

/** Where one set of buttons stands: the card's own ([ChatAIActionCard.CARD_SCOPE]) or a row's. */
sealed interface ChatAICardRun {
    val actionId: String

    data class Running(override val actionId: String) : ChatAICardRun

    data class Done(
        override val actionId: String,
        /** The finished screen to open ("Open"), already filled in. */
        val link: String? = null,
        /** Why a follow-up step didn't happen ("The repeat wasn't set."). */
        val note: String? = null,
    ) : ChatAICardRun

    /** The server's message, or why the card can't be sent; the buttons stay usable. */
    data class Failed(
        override val actionId: String,
        val message: String,
    ) : ChatAICardRun
}

/**
 * An action card: what the assistant filled in, with buttons that send it through an endpoint the app
 * already uses after one tap (contract section 4). [runs] says how each set of buttons went; it is
 * keyed by [CARD_SCOPE] for the card's own buttons and by a row's id for that row's.
 */
@Immutable
data class ChatAIActionCard(
    /** The server's card id (a UUID, also the idempotency key the request carries). */
    val id: String,
    /** `plan_create`, `home_task`, … */
    val card: String,
    val title: String,
    val lines: List<ChatAICardLine> = emptyList(),
    val warnings: List<String> = emptyList(),
    val expiresAt: Instant? = null,
    val actions: List<ChatAICardAction> = emptyList(),
    val items: List<ChatAICardItem> = emptyList(),
    val runs: Map<String, ChatAICardRun> = emptyMap(),
    /** "Not now" on this device. */
    val dismissed: Boolean = false,
) {
    /** A request is in flight: every button on the card waits for it. */
    val isRunning: Boolean
        get() = runs.values.any { it is ChatAICardRun.Running }

    /** The card's own button went through, or every row's did on a card that has only rows. */
    val isFinished: Boolean
        get() =
            runs[CARD_SCOPE] is ChatAICardRun.Done ||
                (actions.isEmpty() && items.isNotEmpty() && items.all { runs[it.id] is ChatAICardRun.Done })

    fun isExpired(now: Instant = Instant.now()): Boolean = expiresAt?.isBefore(now) == true

    companion object {
        const val CARD_SCOPE = "card"
    }
}

/** A button under a reply that opens a screen of the app (contract section 5). */
@Immutable
data class ChatAILink(
    val label: String,
    val url: String,
)

/** What an assistant reply's action cards and link buttons do; threaded from the screen to each reply. */
class ChatAIReplyActions(
    /** A card button: the card, its scope ([ChatAIActionCard.CARD_SCOPE] or a row's id) and the button. */
    val onAction: (ChatAIDraftCard, String, ChatAICardAction) -> Unit = { _, _, _ -> },
    /** "Not now". */
    val onDismiss: (ChatAIDraftCard) -> Unit = {},
    /** Opens an app link (a link button or a done card's Open) with the deep-link router. */
    val onOpenLink: (String) -> Unit = {},
    /** True when the app can open the link; links it can't open show no button. */
    val canOpen: (String) -> Boolean = { false },
)
