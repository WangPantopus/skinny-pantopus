@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Family Mail Party (co-opening) routes in
 * `backend/routes/mailboxV2Phase2.js` (mounted at `api/mailbox/v2/p2`,
 * `backend/app.js:316`).
 *
 * Mirrors `Core/Networking/Models/Mailbox/V2/MailPartyDTOs.swift`.
 */

/** The four `Mail` columns `GET /party/active` projects. */
@JsonClass(generateAdapter = true)
data class MailPartyMailDto(
    val id: String? = null,
    @Json(name = "sender_display") val senderDisplay: String? = null,
    val subject: String? = null,
    @Json(name = "sender_trust") val senderTrust: String? = null,
)

/**
 * One `MailPartySession` row. `GET /party/active` embeds the joined
 * `Mail` row under the literal `Mail` key
 * (`select('*, Mail!inner(id, sender_display, subject, sender_trust)')`,
 * `backend/routes/mailboxV2Phase2.js:931`).
 */
@JsonClass(generateAdapter = true)
data class MailPartySessionDto(
    val id: String,
    @Json(name = "mail_id") val mailId: String,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "initiated_by") val initiatedBy: String? = null,
    /** `pending` / `active` / `completed` / `expired`. */
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "opened_at") val openedAt: String? = null,
    @Json(name = "completed_at") val completedAt: String? = null,
    @Json(name = "Mail") val mail: MailPartyMailDto? = null,
)

/** Envelope for `GET api/mailbox/v2/p2/party/active`. */
@JsonClass(generateAdapter = true)
data class MailPartyActiveResponse(
    val sessions: List<MailPartySessionDto> = emptyList(),
)

/**
 * Envelope for `POST api/mailbox/v2/p2/party/create` —
 * `{ session, expiresIn }`. `expiresIn` is already camelCase on the wire.
 */
@JsonClass(generateAdapter = true)
data class MailPartyCreateResponse(
    val session: MailPartySessionDto,
    val expiresIn: Int? = null,
)

/** Envelope for `POST api/mailbox/v2/p2/party/join` — `{ session }`. */
@JsonClass(generateAdapter = true)
data class MailPartyJoinResponse(
    val session: MailPartySessionDto,
)

/** Envelope for `POST api/mailbox/v2/p2/party/decline` — `{ message }`. */
@JsonClass(generateAdapter = true)
data class MailPartyDeclineResponse(
    val message: String? = null,
)

/** Envelope for `POST api/mailbox/v2/p2/party/reaction` — `{ reaction, ttl }`. */
@JsonClass(generateAdapter = true)
data class MailPartyReactionResponse(
    val reaction: String? = null,
    val ttl: Int? = null,
)

/** Envelope for `POST api/mailbox/v2/p2/party/assign` — `{ message, assignedTo }`. */
@JsonClass(generateAdapter = true)
data class MailPartyAssignResponse(
    val message: String? = null,
    val assignedTo: String? = null,
)

/** Body for `POST api/mailbox/v2/p2/party/create` (validator `:15`). */
@JsonClass(generateAdapter = true)
data class CreateMailPartyRequest(
    val mailId: String,
)

/** Shared body for `POST /party/join` and `/party/decline` (validator `:19`). */
@JsonClass(generateAdapter = true)
data class MailPartySessionRequest(
    val sessionId: String,
)

/** Body for `POST /party/reaction` (validator `:23`). */
@JsonClass(generateAdapter = true)
data class MailPartyReactionRequest(
    val sessionId: String,
    val reaction: String,
)

/** Body for `POST /party/assign` (validator `:28`). */
@JsonClass(generateAdapter = true)
data class MailPartyAssignRequest(
    val sessionId: String,
    val mailId: String,
    val assignToUserId: String,
)
