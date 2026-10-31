package app.pantopus.android.data.api.models.plans

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * Plans invitations (founder decision, October 31): a host invites people on Pantopus, by email, or with a one-person
 * link they text. An invitation is the host's yes: the person says "I'm in" with the ordinary ask and is in, with no
 * distance or approval step. An email invitation opened by an account the address isn't verified for waits for the
 * host's yes (`needs_host_ok`).
 *
 * Route: backend/routes/plans.js (the invitation routes), the service backend/services/plans/planInvites.js. The same
 * shapes as iOS's PlanInviteDTOs.swift.
 */

/** `my_invite` on a plan card: the viewer's own invitation. */
@JsonClass(generateAdapter = true)
data class PlanMyInviteDto(
    @Json(name = "id") val id: String,
    /** `pending`, `accepted`, `declined` (or `cancelled`). */
    @Json(name = "status") val status: String = "pending",
    /** `account`, `email` or `link`. */
    @Json(name = "channel") val channel: String = "account",
    /** The host says yes first (an email opened by an account it wasn't sent to). */
    @Json(name = "needs_host_ok") val needsHostOk: Boolean = false,
    @Json(name = "invited_at") val invitedAt: String? = null,
) {
    /** Not answered, or "Can't make it" (the person can still change their mind). */
    val isOpen: Boolean get() = status == "pending" || status == "declined"
}

/** `invites` on a hosted plan's card: whether the host can invite now, and how it stands. */
@JsonClass(generateAdapter = true)
data class PlanHostInvitesDto(
    @Json(name = "can_invite") val canInvite: Boolean = false,
    @Json(name = "invited") val invited: Int = 0,
    @Json(name = "said_yes") val saidYes: Int = 0,
    @Json(name = "cant_make_it") val cantMakeIt: Int = 0,
)

/** Someone named on an invitation or in the people list. */
@JsonClass(generateAdapter = true)
data class PlanInvitePersonDto(
    @Json(name = "user_id") val userId: String,
    @Json(name = "display_name") val displayName: String = "",
    @Json(name = "avatar_url") val avatarUrl: String? = null,
)

/**
 * One invitation in the host's list. [state] is `invited`, `opened`, `in`, `waitlisted`, `asked` (an email opened by
 * someone else, waiting for the host's yes), `cant_make_it` or `left`. An email invitation shows the address until
 * the person says they're in.
 */
@JsonClass(generateAdapter = true)
data class PlanInviteRowDto(
    @Json(name = "id") val id: String,
    @Json(name = "channel") val channel: String = "account",
    @Json(name = "state") val state: String = "invited",
    @Json(name = "person") val person: PlanInvitePersonDto? = null,
    @Json(name = "email") val email: String? = null,
    /** The email couldn't be sent (the address said no to invitation emails, or it bounced). */
    @Json(name = "email_failed") val emailFailed: Boolean = false,
    @Json(name = "request_id") val requestId: String? = null,
    @Json(name = "can_cancel") val canCancel: Boolean = false,
    @Json(name = "invited_at") val invitedAt: String? = null,
) {
    /** The name, the address, or "Text invite". */
    val title: String get() = person?.displayName ?: email ?: "Text invite"
}

/** How the host's invitations stand. */
@JsonClass(generateAdapter = true)
data class PlanInviteCountsDto(
    @Json(name = "invited") val invited: Int = 0,
    @Json(name = "in") val isIn: Int = 0,
    @Json(name = "waitlisted") val waitlisted: Int = 0,
    @Json(name = "cant_make_it") val cantMakeIt: Int = 0,
)

/** What happened to one person or address in `POST /invites`: invited, already_invited, already_in, unavailable, host. */
@JsonClass(generateAdapter = true)
data class PlanInviteResultDto(
    @Json(name = "user_id") val userId: String? = null,
    @Json(name = "email") val email: String? = null,
    @Json(name = "outcome") val outcome: String = "",
)

/** `GET /api/plans/:id/invites`, and the answer to inviting or taking one back. */
@JsonClass(generateAdapter = true)
data class PlanInviteListDto(
    @Json(name = "invites") val invites: List<PlanInviteRowDto> = emptyList(),
    /** Text invites nobody has opened yet (not listed one by one). */
    @Json(name = "unopened_links") val unopenedLinks: Int = 0,
    @Json(name = "counts") val counts: PlanInviteCountsDto? = null,
    @Json(name = "emails_left") val emailsLeft: Int? = null,
    @Json(name = "can_invite") val canInvite: Boolean = true,
    /** Only after inviting. */
    @Json(name = "results") val results: List<PlanInviteResultDto> = emptyList(),
)

/** Someone the host can invite: a connection, or someone who came to their plans. */
@JsonClass(generateAdapter = true)
data class PlanInviteCandidateDto(
    @Json(name = "user_id") val userId: String,
    @Json(name = "display_name") val displayName: String = "",
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    /** `connection`, `came_before` or `both`. */
    @Json(name = "reason") val reason: String? = null,
    /** `in`, `asked`, `invited`, or null while they can be invited. */
    @Json(name = "state") val state: String? = null,
)

/** `GET /api/plans/:id/invites/people`. */
@JsonClass(generateAdapter = true)
data class PlanInvitePeopleResponse(
    @Json(name = "people") val people: List<PlanInviteCandidateDto> = emptyList(),
)

/** `POST /api/plans/:id/invites`. */
@JsonClass(generateAdapter = true)
data class PlanInviteBody(
    @Json(name = "user_ids") val userIds: List<String>,
    @Json(name = "emails") val emails: List<String>,
    /** At a home, the host agreed that people who say they're in see the address. */
    @Json(name = "confirm_shares_address") val confirmSharesAddress: Boolean? = null,
)

/** `POST /api/plans/:id/invites/link`. */
@JsonClass(generateAdapter = true)
data class PlanInviteLinkBody(
    @Json(name = "confirm_shares_address") val confirmSharesAddress: Boolean? = null,
)

/** A one-person link and the words to send with it, in the host's voice. */
@JsonClass(generateAdapter = true)
data class PlanInviteLinkResponse(
    @Json(name = "invite_id") val inviteId: String? = null,
    @Json(name = "url") val url: String,
    @Json(name = "message") val message: String = "",
)

/** `POST /api/plans/:id/invites/claim`. */
@JsonClass(generateAdapter = true)
data class PlanInviteClaimBody(
    @Json(name = "token") val token: String,
)

/** The plan as the person sees it now (claiming or declining an invitation). */
@JsonClass(generateAdapter = true)
data class PlanInvitePlanResponse(
    @Json(name = "plan") val plan: PlanDto? = null,
)

/** `GET /api/plans/invites/next`: the newest invitation the person hasn't opened. */
@JsonClass(generateAdapter = true)
data class PlanNextInviteResponse(
    @Json(name = "plan_id") val planId: String? = null,
)
