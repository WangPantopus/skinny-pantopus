@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.p3

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Mail Memory routes ("On This Day" + "Year In Mail") in
 * `backend/routes/mailboxV2Phase3.js`.
 *
 * Mirrors `Core/Networking/Models/Mailbox/P3/MailMemoryDTOs.swift`.
 */

/** One mail row referenced by a memory card (`mailboxV2Phase3.js:1334`). */
@JsonClass(generateAdapter = true)
data class MailMemoryItemMailDto(
    val id: String,
    val subject: String? = null,
    @Json(name = "sender_name") val senderName: String? = null,
    val category: String? = null,
    @Json(name = "delivered_at") val deliveredAt: String? = null,
)

/**
 * One "On This Day" card. `id` is a synthesised key
 * (`otd-<year>-<month>-<day>`), not a UUID.
 */
@JsonClass(generateAdapter = true)
data class MailMemoryDto(
    val id: String,
    @Json(name = "memory_type") val memoryType: String? = null,
    @Json(name = "reference_date") val referenceDate: String? = null,
    val headline: String? = null,
    val body: String? = null,
    @Json(name = "mail_items") val mailItems: List<MailMemoryItemMailDto>? = null,
    val dismissed: Boolean? = null,
)

/** Envelope for `GET api/mailbox/v2/p3/memory/on-this-day`. */
@JsonClass(generateAdapter = true)
data class MailMemoriesResponse(
    val memories: List<MailMemoryDto> = emptyList(),
)

/** One row of the Year-In-Mail top-sender leaderboard. */
@JsonClass(generateAdapter = true)
data class YearInMailSenderDto(
    @Json(name = "sender_display") val senderDisplay: String? = null,
    @Json(name = "sender_trust") val senderTrust: String? = null,
    @Json(name = "item_count") val itemCount: Int? = null,
    val category: String? = null,
)

/** Envelope for `GET api/mailbox/v2/p3/memory/year/:year`. */
@JsonClass(generateAdapter = true)
data class YearInMailResponse(
    val year: Int = 0,
    @Json(name = "total_items") val totalItems: Int = 0,
    @Json(name = "by_drawer") val byDrawer: Map<String, Int> = emptyMap(),
    @Json(name = "by_type") val byType: Map<String, Int> = emptyMap(),
    @Json(name = "top_senders") val topSenders: List<YearInMailSenderDto> = emptyList(),
    @Json(name = "total_packages") val totalPackages: Int = 0,
    @Json(name = "first_mail_date") val firstMailDate: String? = null,
    @Json(name = "most_active_month") val mostActiveMonth: String? = null,
    @Json(name = "share_card_url") val shareCardUrl: String? = null,
)

/** Body for `POST api/mailbox/v2/p3/memory/dismiss`. */
@JsonClass(generateAdapter = true)
data class DismissMailMemoryRequest(
    val memoryId: String,
)

/** Envelope for `POST api/mailbox/v2/p3/memory/dismiss` — `{ message }`. */
@JsonClass(generateAdapter = true)
data class DismissMailMemoryResponse(
    val message: String? = null,
)

/**
 * Envelope for `POST api/mailbox/v2/p3/memory/year/:year/share` —
 * `{ shareCardUrl }`. Already camelCase on the wire (a JS literal, not a
 * Postgres column).
 */
@JsonClass(generateAdapter = true)
data class ShareYearInMailResponse(
    val shareCardUrl: String? = null,
)
