@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.personadm

import com.squareup.moshi.JsonClass

/**
 * Decoder shapes for the persona-DM routes (`backend/routes/personaDms.js`).
 * The serializers there already emit camelCase, so no `@Json` mapping is
 * needed on the response types.
 *
 * Privacy invariant carried through to the client: no `user_id` for either
 * party appears on the wire. A message is attributed by `senderRole`
 * ("fan" / "creator"), a thread by `membershipId`.
 */

/** Thread detail envelope — `GET .../dms/threads/:threadId`. */
@JsonClass(generateAdapter = true)
data class PersonaDmThreadDetailResponse(
    val thread: PersonaDmThreadDto? = null,
    val fan: PersonaDmFanDto? = null,
    val persona: PersonaDmPersonaDto? = null,
    /** `"fan"` or `"creator"` — which side the caller is on. */
    val viewerRole: String? = null,
    val messages: List<PersonaDmMessageDto> = emptyList(),
    /**
     * Fan-side only. Null for the creator, for `discretion` tiers, and once
     * the creator has replied at least once.
     */
    val replyPolicyStatus: PersonaDmReplyPolicyStatusDto? = null,
)

@JsonClass(generateAdapter = true)
data class PersonaDmThreadDto(
    val id: String? = null,
    val membershipId: String? = null,
    /** `open` / `closed` / `blocked`. */
    val status: String? = null,
    val createdAt: String? = null,
    val lastMessageAt: String? = null,
)

/** The fan's pseudonymous audience identity — never their local identity. */
@JsonClass(generateAdapter = true)
data class PersonaDmFanDto(
    val handle: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
)

@JsonClass(generateAdapter = true)
data class PersonaDmPersonaDto(
    val handle: String? = null,
    val displayName: String? = null,
)

@JsonClass(generateAdapter = true)
data class PersonaDmMessageDto(
    val id: String,
    val threadId: String? = null,
    /** `"fan"` or `"creator"`. */
    val senderRole: String? = null,
    val body: String? = null,
    val createdAt: String? = null,
    val readAt: String? = null,
    // `media` is on the wire but the native composer is text-only today.
)

/**
 * Reply-policy SLA gauge (`personaDmService.getReplyPolicyStatus`).
 * `status` is `on_track` or `sla_missed`; `policy` is one of
 * `discretion / within_3_days / within_7_days / within_14_days / always`.
 */
@JsonClass(generateAdapter = true)
data class PersonaDmReplyPolicyStatusDto(
    val status: String? = null,
    val policy: String? = null,
    val slaDays: Int? = null,
    val daysRemaining: Int? = null,
)

/**
 * Request body shared by open-thread and send-message. Validated 1…2000
 * characters, trimmed (`openThreadSchema` / `sendMessageSchema`).
 */
@JsonClass(generateAdapter = true)
data class PersonaDmMessageBody(
    val body: String,
)

/**
 * 201 body of the open-thread route. `quotaRemaining` is null when the tier
 * grants unlimited threads.
 */
@JsonClass(generateAdapter = true)
data class PersonaDmOpenThreadResponse(
    val threadId: String? = null,
    val quotaRemaining: Int? = null,
)

/** 201 body of the append-message route. */
@JsonClass(generateAdapter = true)
data class PersonaDmSendMessageResponse(
    val message: PersonaDmMessageDto? = null,
)
