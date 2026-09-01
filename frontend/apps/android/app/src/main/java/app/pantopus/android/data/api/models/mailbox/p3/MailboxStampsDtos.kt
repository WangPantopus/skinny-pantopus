@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.p3

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the stamp-collection + seasonal-theme routes in
 * `backend/routes/mailboxV2Phase3.js` (mounted at `api/mailbox/v2/p3`,
 * `backend/app.js:317`).
 *
 * Mirrors `Core/Networking/Models/Mailbox/P3/MailboxStampsDTOs.swift`.
 */

/** One earned `Stamp` row (`backend/routes/mailboxV2Phase3.js:1208`). */
@JsonClass(generateAdapter = true)
data class EarnedStampDto(
    val id: String,
    @Json(name = "stamp_type") val stampType: String? = null,
    val name: String? = null,
    val description: String? = null,
    /** `common` / `uncommon` / `rare` / `legendary`. */
    val rarity: String? = null,
    @Json(name = "earned_at") val earnedAt: String? = null,
    @Json(name = "earned_by") val earnedBy: String? = null,
    @Json(name = "visual_url") val visualUrl: String? = null,
)

/**
 * One catalogue entry the caller hasn't earned yet
 * (`backend/routes/mailboxV2Phase3.js:1231`).
 */
@JsonClass(generateAdapter = true)
data class LockedStampDto(
    @Json(name = "stamp_type") val stampType: String,
    val name: String? = null,
    val description: String? = null,
    val rarity: String? = null,
    val progress: Int? = null,
    val target: Int? = null,
)

/** Envelope for `GET api/mailbox/v2/p3/stamps`. */
@JsonClass(generateAdapter = true)
data class MailboxStampsResponse(
    val earned: List<EarnedStampDto> = emptyList(),
    val locked: List<LockedStampDto> = emptyList(),
    @Json(name = "total_earned") val totalEarned: Int = 0,
    @Json(name = "total_available") val totalAvailable: Int = 0,
)

/**
 * One `SeasonalTheme` row, enriched server-side with `unlocked`
 * (`backend/routes/mailboxV2Phase3.js:1266`).
 */
@JsonClass(generateAdapter = true)
data class SeasonalThemeDto(
    val id: String,
    val name: String? = null,
    /** `spring` / `summer` / `autumn` / `winter` / `custom`. */
    val season: String? = null,
    @Json(name = "accent_color") val accentColor: String? = null,
    @Json(name = "auto_apply") val autoApply: Boolean? = null,
    @Json(name = "active_from") val activeFrom: String? = null,
    @Json(name = "active_until") val activeUntil: String? = null,
    @Json(name = "unlock_condition") val unlockCondition: String? = null,
    val unlocked: Boolean? = null,
)

/** Envelope for `GET api/mailbox/v2/p3/themes` — `{ themes, active }`. */
@JsonClass(generateAdapter = true)
data class SeasonalThemesResponse(
    val themes: List<SeasonalThemeDto> = emptyList(),
    val active: String? = null,
)

/** Body for `POST api/mailbox/v2/p3/themes/apply`. */
@JsonClass(generateAdapter = true)
data class ApplyMailboxThemeRequest(
    val themeId: String,
)

/** Envelope for `POST api/mailbox/v2/p3/themes/apply` — `{ message }`. */
@JsonClass(generateAdapter = true)
data class ApplyMailboxThemeResponse(
    val message: String? = null,
)
