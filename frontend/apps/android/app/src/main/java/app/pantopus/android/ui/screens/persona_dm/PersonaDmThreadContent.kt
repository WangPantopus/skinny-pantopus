@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.persona_dm

/**
 * A15.4 "Creator thread" / A15.5 "Fan thread" — render models for the
 * persona-DM thread. Mirrors iOS `PersonaDmThreadContent.swift`.
 *
 * This is a separate surface from generic chat: there is no counterparty
 * user id, the header renders the persona (fan view) or the fan's
 * pseudonymous handle (creator view), and a fan-side reply-policy banner
 * states the SLA the creator committed to.
 */

/** Which side of the thread the signed-in viewer is on. */
enum class PersonaDmViewerRole {
    Fan,
    Creator,
    ;

    companion object {
        fun fromWire(wire: String?): PersonaDmViewerRole = if (wire == "creator") Creator else Fan
    }
}

/**
 * One rendered bubble. [fromViewer] drives right/left alignment and the
 * filled/outlined bubble treatment.
 */
data class PersonaDmMessageContent(
    val id: String,
    val fromViewer: Boolean,
    val body: String,
    val timeLabel: String,
    /** "Read" receipt under the viewer's own bubbles. */
    val readByCounterparty: Boolean,
)

/** Fan-side reply-policy banner kind. */
enum class PersonaDmPolicyBannerKind {
    OnTrack,
    Missed,
}

/**
 * Fan-side reply-policy banner. [PersonaDmPolicyBannerKind.Missed] is the
 * state that unlocks the membership refund request (`reason: sla_missed`).
 */
data class PersonaDmPolicyBanner(
    val kind: PersonaDmPolicyBannerKind,
    val text: String,
)

/** Loaded thread composition. */
data class PersonaDmThreadLoaded(
    /** `@handle` of the other side (persona for a fan, fan for a creator). */
    val title: String,
    /** Display name of the other side. */
    val subtitle: String,
    val initials: String,
    val viewerRole: PersonaDmViewerRole,
    val policyBanner: PersonaDmPolicyBanner?,
    val messages: List<PersonaDmMessageContent>,
)

/**
 * Top-level render state. [Empty] carries the resolved header so the chrome
 * stays stable while the "no messages yet" body renders.
 */
sealed interface PersonaDmThreadUiState {
    data object Loading : PersonaDmThreadUiState

    data class Loaded(val content: PersonaDmThreadLoaded) : PersonaDmThreadUiState

    data class Empty(val content: PersonaDmThreadLoaded) : PersonaDmThreadUiState

    data class Error(val message: String) : PersonaDmThreadUiState
}

// ---------------------------------------------------------------------------
// Fan inbox (A15.5 "Start a conversation" frame)
// ---------------------------------------------------------------------------

/**
 * Why the fan cannot open a new thread right now. These are the backend's
 * first-class rejection codes, not generic errors —
 * `backend/routes/personaDms.js:46`.
 */
enum class FanInboxGate {
    /** `402 quota_exhausted` — every message-thread credit spent this period. */
    QuotaExhausted,

    /** `403 tier_does_not_allow` — the tier grants no DM threads at all. */
    TierDoesNotAllow,

    /** `403 no_membership` — no active membership on this persona. */
    NoMembership,

    /** `403 blocked` — the creator blocked this account. */
    Blocked,
    ;

    val headline: String
        get() =
            when (this) {
                QuotaExhausted -> "Out of message threads"
                TierDoesNotAllow -> "No messaging on this tier"
                NoMembership -> "Subscribe first"
                Blocked -> "Cannot message"
            }

    val body: String
        get() =
            when (this) {
                QuotaExhausted ->
                    "You have used all your message threads for this period. " +
                        "They reset when your membership renews."
                TierDoesNotAllow -> "This tier doesn't include direct messages — upgrade to send a DM."
                NoMembership -> "You need to subscribe to a paid tier first."
                Blocked -> "This profile cannot accept new messages from your account."
            }

    /** CTA label for the gate, or null when there is nothing to do here. */
    val ctaTitle: String?
        get() =
            when (this) {
                QuotaExhausted, Blocked -> null
                TierDoesNotAllow, NoMembership -> "Change tier"
            }
}

/**
 * Remaining message-thread credits. A null [remaining] with a non-null
 * [limit] means unlimited; a null [limit] means the tier grants none.
 */
data class FanInboxQuota(
    val remaining: Int?,
    val limit: Int?,
) {
    /** "3 of 5 left" chip copy from the A15.5 quota gate. */
    val chipLabel: String
        get() {
            val cap = limit ?: return "No message threads on this tier"
            if (cap < 0 || remaining == null) return "Unlimited message threads"
            return "$remaining of $cap left"
        }
}

/** The "Start a conversation" frame. */
data class FanInboxStartContent(
    /** `@handle` of the persona. */
    val personaTitle: String,
    val personaName: String,
    val initials: String,
    val quota: FanInboxQuota,
    /** Non-null when the composer must stay locked. */
    val gate: FanInboxGate?,
)

/** Top-level render state for the fan inbox. */
sealed interface FanInboxUiState {
    data object Loading : FanInboxUiState

    /** An open thread already exists — render the thread surface for it. */
    data class Thread(val threadId: String) : FanInboxUiState

    data class Start(val content: FanInboxStartContent) : FanInboxUiState

    data class Error(val message: String) : FanInboxUiState
}
