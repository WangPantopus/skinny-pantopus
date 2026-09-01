@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Presentation mode for the conversation surface. Orthogonal to
 * [ChatCounterparty] (who you're talking to) — `mode` drives the chrome
 * (avatar treatment, empty/welcome state, bubble shapes). [Dm] is the
 * default human DM/group thread; [AiAssistant] is the Pantopus AI thread;
 * [CreatorThread] / [FanThread] add creator/fan-specific chrome.
 */
enum class ChatConversationMode { Dm, AiAssistant, CreatorThread, FanThread }

/** Creator-side context rendered above a creator/fan DM thread. */
@Immutable
data class ChatCreatorThreadContext(
    /**
     * The persona whose creator inbox this thread belongs to. `null` when
     * the caller hasn't resolved it — the audience strip then shows the
     * generic "Creator inbox" label rather than a placeholder name.
     */
    val personaName: String? = null,
    /**
     * Reach / engagement line under the strip title. `null` unless the
     * caller has real audience analytics for this persona; there is no
     * per-thread analytics payload on the wire, so it normally stays null.
     */
    val audienceSummary: String? = null,
    val fanTierName: String,
    /** Tier rank (1=Free, 2=Bronze, 3=Silver, 4=Gold). */
    val fanTierRank: Int,
    /**
     * Header sub-line ("Member since …"). `null` when the membership join
     * date / distance isn't known — the header then drops the line instead
     * of inventing one.
     */
    val fanSubtitle: String? = null,
    /**
     * `null` when the backend hasn't reported a reply allowance for this
     * thread. There is no creator-side weekly reply quota on the wire yet
     * (`backend/routes/personaDms.js` only meters the fan), so the meter and
     * its lock stay hidden instead of showing invented counts.
     */
    val quota: ChatCreatorQuota? = null,
    /**
     * The real, creator-authored tier this fan can be invited up to. `null`
     * when the caller hasn't loaded the persona's tier ladder — the A15.4
     * upgrade card is then omitted rather than pitching an invented tier
     * name or invented perks.
     */
    val upgradeOffer: ChatCreatorUpgradeOffer? = null,
) {
    companion object {
        private const val TIER_RANK_FREE = 1

        /**
         * Context for a creator thread where only the fan's tier is known.
         * Everything else stays null — the persona name, the audience
         * summary, the membership sub-line and the upgrade ladder all need
         * data the creator-inbox row does not carry, and inventing them
         * would ship one creator's copy to every creator.
         */
        fun defaults(
            fanTierName: String = "Free",
            fanTierRank: Int = TIER_RANK_FREE,
        ): ChatCreatorThreadContext =
            ChatCreatorThreadContext(
                fanTierName = fanTierName,
                fanTierRank = fanTierRank,
            )
    }
}

/**
 * A15.4 upgrade-fan card payload. Every string here is creator-authored
 * tier data (`GET /api/personas/:handle/tiers` — name / description /
 * price) or derived from the tier's published policy fields. Nothing in
 * this type may be synthesised by the UI.
 */
@Immutable
data class ChatCreatorUpgradeOffer(
    /** The tier's own name, exactly as the creator published it. */
    val tierName: String,
    /** Formatted price, e.g. "$15/mo". `null` when the tier has no price. */
    val priceLabel: String? = null,
    /** The tier's creator-authored description; `null` hides the body. */
    val summary: String? = null,
    /**
     * Perk lines built from the tier's published policy fields
     * (`msgThreadsPerPeriod`, `replyPolicy`, `creatorCanInitiateDm`).
     * Empty hides the perk block.
     */
    val perks: List<String> = emptyList(),
    /**
     * False until a creator→fan upgrade-offer endpoint exists. The send
     * action renders disabled with an honest note while this is false.
     */
    val canSendOffer: Boolean = false,
)

@Immutable
data class ChatCreatorQuota(
    val used: Int,
    val total: Int,
    val resetCopy: String,
) {
    /**
     * A [total] of zero means "no replies allowed", which is maxed — the
     * unknown case is modelled by a null quota, not by a zero total.
     */
    val isMaxed: Boolean
        get() = used >= total
}

/**
 * A15.5 `.openers .op` — a suggested first message on the empty fan
 * thread. Tapping one fills the composer. [id] doubles as the test tag
 * suffix so iOS and Android address the same rows.
 */
@Immutable
data class FanOpener(
    val id: String,
    val icon: PantopusIcon,
    val label: String,
    val title: String,
)

class ChatCreatorThreadChrome(
    val context: ChatCreatorThreadContext,
    val onOpenAudienceProfile: () -> Unit = {},
)

data class ChatConversationChrome(
    val mode: ChatConversationMode = ChatConversationMode.Dm,
    val fanEntitlement: ChatFanEntitlement? = null,
    val creatorThread: ChatCreatorThreadChrome? = null,
)

@Immutable
data class ChatConversationRouteArgs(
    val mode: ChatThreadMode,
    val counterparty: ChatCounterparty,
    val currentUserId: String,
    val scrollToMessageId: String? = null,
    val initialTopic: ChatInitialTopic? = null,
    /** Backing gig for gig rooms — drives the A15 pinned context strip. */
    val gigId: String? = null,
)

/**
 * A15 `.ctx-strip` — pinned gig context rendered under the header of a
 * gig room. Built from the gig detail fetch keyed by the route's gigId.
 */
@Immutable
data class ChatGigContextStrip(
    val gigId: String,
    val title: String,
    val meta: String,
)

@Immutable
data class ChatInitialTopic(
    val topicType: String,
    val topicRefId: String? = null,
    val title: String,
)

/** Counterparty type — drives the header swap + empty-state copy. */
sealed interface ChatCounterparty {
    val displayName: String

    data class Person(
        override val displayName: String,
        val initials: String,
        val locality: String? = null,
        val verified: Boolean = false,
        val online: Boolean = false,
    ) : ChatCounterparty

    data class Group(
        override val displayName: String,
        val memberCount: Int? = null,
    ) : ChatCounterparty

    data class Ai(
        override val displayName: String,
    ) : ChatCounterparty
}

/** Source-of-truth identifier for the thread. */
sealed interface ChatThreadMode {
    data class Room(val id: String) : ChatThreadMode

    data class Person(val otherUserId: String) : ChatThreadMode

    data object Ai : ChatThreadMode
}

enum class ChatMessageSide { Incoming, Outgoing }

enum class ChatDeliveryState { Sending, Failed, Delivered, Read }

@Immutable
data class ChatFanEntitlement(
    val currentTier: String,
    val renewsOn: String,
    val messagesLeft: Int,
    val messageLimit: Int,
    val resetCopy: String,
    val requiredReplyTier: String? = null,
) {
    val canReply: Boolean
        get() = requiredReplyTier == null && messagesLeft > 0
}

enum class ChatSystemLinkAccent { Primary, Success, Warning, Error }

enum class ChatQueuedAttachmentKind { Image, Document }

@Immutable
data class ChatQueuedAttachment(
    val id: String,
    val kind: ChatQueuedAttachmentKind,
    val filename: String,
    val mimeType: String = "application/octet-stream",
    val bytes: ByteArray? = null,
)

/**
 * Inline "this would cost about $X" estimate rendered inside an AI reply
 * bubble (`AiEstimateCard`).
 */
@Immutable
data class ChatEstimate(
    val amount: String,
    val basis: String,
    val confidence: String,
)

@Immutable
data class ChatAIDraftCard(
    val id: String,
    val type: String,
    val title: String,
    val summary: String? = null,
    val priceLabel: String? = null,
    val valid: Boolean = true,
)

@Immutable
data class ChatReplyPreview(
    val messageId: String,
    val senderName: String,
    val text: String,
)

@Immutable
data class ChatBubbleReaction(
    val reaction: String,
    val count: Int,
    val reactedByMe: Boolean,
)

@Immutable
data class ChatConversationTopic(
    val id: String,
    val topicType: String,
    val title: String,
    val status: String? = null,
)

@Immutable
data class ChatLocationCard(
    val latitude: Double,
    val longitude: Double,
    val address: String,
)

@Immutable
data class ChatGigOfferCard(
    val gigId: String,
    val title: String,
    val category: String? = null,
    val priceLabel: String? = null,
    val status: String? = null,
)

@Immutable
data class ChatListingOfferCard(
    val listingId: String,
    val title: String,
    val category: String? = null,
    val priceLabel: String,
    val condition: String? = null,
    val imageUrl: String? = null,
)

@Immutable
data class ChatShareGigOption(
    val id: String,
    val title: String,
    val category: String? = null,
    val price: Double? = null,
    val status: String? = null,
)

@Immutable
data class ChatShareListingOption(
    val id: String,
    val title: String,
    val category: String? = null,
    val price: Double? = null,
    val isFree: Boolean = false,
    val condition: String? = null,
    val imageUrl: String? = null,
)

/** Body of a single bubble. */
sealed interface ChatBubbleBody {
    data class Text(val text: String) : ChatBubbleBody

    data class TextWithImages(
        val text: String,
        val imageUrls: List<String>,
    ) : ChatBubbleBody

    data class Image(val url: String?) : ChatBubbleBody

    data class Attachment(
        val filename: String,
        val sizeLabel: String? = null,
    ) : ChatBubbleBody

    data class LocationCard(val card: ChatLocationCard) : ChatBubbleBody

    data class GigOfferCard(val card: ChatGigOfferCard) : ChatBubbleBody

    data class ListingOfferCard(val card: ChatListingOfferCard) : ChatBubbleBody

    data class SystemLink(
        val label: String,
        val sub: String,
        val accent: ChatSystemLinkAccent,
    ) : ChatBubbleBody

    /**
     * Structured AI reply: prose plus an optional inline estimate card.
     * Renders wider than a plain bubble with a "Pantopus AI" tag
     * (`AiAssistant` mode only).
     */
    data class AiReply(
        val text: String,
        val estimate: ChatEstimate?,
        val drafts: List<ChatAIDraftCard> = emptyList(),
    ) : ChatBubbleBody
}

internal val ChatBubbleBody.isRichCard: Boolean
    get() =
        this is ChatBubbleBody.LocationCard ||
            this is ChatBubbleBody.GigOfferCard ||
            this is ChatBubbleBody.ListingOfferCard ||
            this is ChatBubbleBody.SystemLink

@Immutable
data class ChatBubbleContent(
    val id: String,
    val side: ChatMessageSide,
    val body: ChatBubbleBody,
    val replyPreview: ChatReplyPreview? = null,
    val reactions: List<ChatBubbleReaction> = emptyList(),
    val hasTail: Boolean,
    val stamp: String?,
    val deliveryState: ChatDeliveryState?,
    val lockedTier: String? = null,
    val sentSupportTier: String? = null,
    val isContinuation: Boolean = false,
)

@Immutable
data class ChatDayDivider(
    val id: String,
    val label: String,
)

/** Inline creator-side reference to a broadcast that prompted the DM. */
@Immutable
data class ChatBroadcastReference(
    val id: String,
    val title: String,
    val subtitle: String,
    val metric: String,
)

sealed interface ChatTimelineRow {
    val rowId: String

    data class DayDivider(val divider: ChatDayDivider) : ChatTimelineRow {
        override val rowId: String = "divider_${divider.id}"
    }

    data class BroadcastReference(val reference: ChatBroadcastReference) : ChatTimelineRow {
        override val rowId: String = "broadcast_${reference.id}"
    }

    data class Bubble(val content: ChatBubbleContent) : ChatTimelineRow {
        override val rowId: String = "bubble_${content.id}"
    }

    /**
     * Topic-change marker on the unfiltered person thread — [id] is the id
     * of the first message filed under the new topic, keeping LazyColumn
     * keys unique. [label] is the topic title (fallback "General").
     */
    data class TopicDivider(val id: String, val label: String) : ChatTimelineRow {
        override val rowId: String = "topic_$id"
    }
}

@Immutable
data class ChatPromptChip(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
)

sealed interface ChatConversationUiState {
    data object Loading : ChatConversationUiState

    data object Empty : ChatConversationUiState

    data class Loaded(val rows: List<ChatTimelineRow>) : ChatConversationUiState

    data class Error(val message: String) : ChatConversationUiState
}
