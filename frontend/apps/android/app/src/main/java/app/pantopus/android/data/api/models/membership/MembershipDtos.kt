@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.membership

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Decoder shapes for `GET /api/personas/:id/membership` — the fan-side view
 * of their own membership (A10.8). Built by `serializeMembershipForFan`
 * (`backend/serializers/identitySerializers.js:352`) wrapped in `stripNullish`,
 * so several keys may be absent — every field is optional. The membership
 * serializer emits camelCase keys, so no `@Json` mapping is needed. The cancel
 * route echoes the same envelope.
 */

@JsonClass(generateAdapter = true)
data class PersonaMembershipResponse(
    val membership: PersonaMembershipDto? = null,
)

@JsonClass(generateAdapter = true)
data class PersonaMembershipDto(
    val membershipId: String? = null,
    val persona: MembershipPersonaDto? = null,
    val tier: MembershipTierDto? = null,
    val status: String? = null,
    val cancelAtPeriodEnd: Boolean? = null,
    val currentPeriodStart: String? = null,
    val currentPeriodEnd: String? = null,
    /**
     * Present once a tier change has been scheduled — it lands at
     * `currentPeriodEnd`, not immediately.
     */
    val scheduledTierChange: MembershipScheduledTierChangeDto? = null,
    /**
     * Message-thread + video-call credits left this period. `msgThreads` is
     * null when the tier grants unlimited (or no) threads — the distinction
     * comes from `tier.msgThreadsPerPeriod`.
     */
    val quotaRemaining: MembershipQuotaRemainingDto? = null,
)

/**
 * `serializeMembershipForFan` emits `{ tierId }` only — the target tier's
 * name is resolved client-side against the public tier ladder.
 */
@JsonClass(generateAdapter = true)
data class MembershipScheduledTierChangeDto(
    val tierId: String? = null,
)

@JsonClass(generateAdapter = true)
data class MembershipQuotaRemainingDto(
    val msgThreads: Int? = null,
    val videoCalls: Int? = null,
)

/** The persona the fan supports — shared `serializeAudienceProfileForViewer`. */
@JsonClass(generateAdapter = true)
data class MembershipPersonaDto(
    val id: String? = null,
    val handle: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val category: String? = null,
    val audienceLabel: String? = null,
    val followerCount: Int? = null,
    val credential: CredentialDto? = null,
)

@JsonClass(generateAdapter = true)
data class CredentialDto(
    val status: String? = null,
    val label: String? = null,
)

/** The fan's tier — perk fields drive the "What you get" benefit rows. */
@JsonClass(generateAdapter = true)
data class MembershipTierDto(
    val id: String? = null,
    val rank: Int? = null,
    val name: String? = null,
    val priceCents: Int? = null,
    val currency: String? = null,
    val billingInterval: String? = null,
    val msgThreadsPerPeriod: Int? = null,
    val creatorCanInitiateDm: Boolean? = null,
    val replyPolicy: String? = null,
)

// MARK: - GET /api/personas/:handle/tiers  (public tier ladder)

/**
 * The tier ladder the change-tier picker offers. Emitted by
 * `backend/routes/personas.js:1111` with `stripe_price_id` stripped.
 */
@JsonClass(generateAdapter = true)
data class PersonaPublicTiersResponse(
    val tiers: List<PersonaPublicTierDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class PersonaPublicTierDto(
    val id: String,
    val rank: Int,
    val name: String? = null,
    val description: String? = null,
    val priceCents: Int? = null,
    val currency: String? = null,
    val billingInterval: String? = null,
    val msgThreadsPerPeriod: Int? = null,
    val replyPolicy: String? = null,
)

@JsonClass(generateAdapter = true)
data class MembershipTierChangeBody(
    @Json(name = "tier_rank") val tierRank: Int,
)

@JsonClass(generateAdapter = true)
data class MembershipRefundRequestBody(
    val reason: String,
    @Json(name = "thread_id") val threadId: String? = null,
)
