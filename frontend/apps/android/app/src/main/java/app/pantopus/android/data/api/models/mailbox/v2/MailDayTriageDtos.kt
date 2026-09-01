@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * P3F / A13.16 — wire DTOs for the rebuilt My Mail Day triage backend
 * (`backend/routes/mailDay.js`, mounted at /api/mailbox/v2/mailday). These
 * supersede the `/pending`-based stop-gap ([PendingItemDto]); the screen
 * renders this physical-mail triage frame directly.
 */

/** `GET /api/mailbox/v2/mailday/today` — the full day frame. */
@JsonClass(generateAdapter = true)
data class MailDayTodayResponse(
    @Json(name = "date_label") val dateLabel: String = "",
    @Json(name = "streak_days") val streakDays: Int = 0,
    @Json(name = "last_scan_label") val lastScanLabel: String = "",
    val unreviewed: List<MailDayUnreviewedDto> = emptyList(),
    val reviewed: List<MailDayReviewedDto> = emptyList(),
    @Json(name = "yesterday_recap") val yesterdayRecap: MailDayRecapDto? = null,
    @Json(name = "setup_nudges") val setupNudges: List<MailDayNudgeDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class MailDayUnreviewedDto(
    val id: String,
    val kind: String = "envelope",
    val label: String = "",
    val sender: String = "",
    @Json(name = "suggested_name") val suggestedName: String = "",
    @Json(name = "suggested_avatar") val suggestedAvatar: String = "personal_sky",
    @Json(name = "confidence_percent") val confidencePercent: Int = 0,
    @Json(name = "secondary_label") val secondaryLabel: String = "Other",
)

@JsonClass(generateAdapter = true)
data class MailDayReviewedDto(
    val id: String,
    val kind: String = "envelope",
    val label: String = "",
    val action: String = "routed",
    @Json(name = "routed_to") val routedTo: String? = null,
    @Json(name = "routed_tint") val routedTint: String? = null,
    @Json(name = "when_label") val whenLabel: String = "",
    @Json(name = "undo_countdown") val undoCountdown: Int? = null,
)

@JsonClass(generateAdapter = true)
data class MailDayRecapDto(
    @Json(name = "date_label") val dateLabel: String = "",
    val pieces: Int = 0,
    @Json(name = "closed_at_label") val closedAtLabel: String = "",
    val segments: List<MailDayRecapSegmentDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class MailDayRecapSegmentDto(
    val id: String,
    val percent: Double = 0.0,
    val label: String = "",
    val tint: String = "person_primary",
)

@JsonClass(generateAdapter = true)
data class MailDayNudgeDto(
    val id: String,
    val title: String = "",
    val subtitle: String = "",
)

/** `POST /api/mailbox/v2/mailday/items/:itemId/route|junk|return` — `{ item }`. */
@JsonClass(generateAdapter = true)
data class MailDayActionResponse(
    val item: MailDayReviewedDto,
)

/** `POST /api/mailbox/v2/mailday/finish`. */
@JsonClass(generateAdapter = true)
data class MailDayFinishResponse(
    @Json(name = "streak_days") val streakDays: Int = 0,
    val pieces: Int = 0,
    @Json(name = "routed_count") val routedCount: Int = 0,
    @Json(name = "junked_count") val junkedCount: Int = 0,
    @Json(name = "returned_count") val returnedCount: Int = 0,
)
