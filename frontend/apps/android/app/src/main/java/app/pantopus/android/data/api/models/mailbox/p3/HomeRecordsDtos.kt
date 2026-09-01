@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.p3

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Phase-3 "Home Records" asset hub in
 * `backend/routes/mailboxV2Phase3.js` (mounted at `api/mailbox/v2/p3` —
 * `backend/app.js:317`). These back the asset index, the per-asset mail
 * drill-down, and the auto-detect scan → suggestions → link flow.
 *
 * Not to be confused with `RecordsDetailDto` (the A17.10 mail-detail body
 * variant) — that one describes a single archival mail item.
 */

/** One tracked home asset — route `backend/routes/mailboxV2Phase3.js:214`. */
@JsonClass(generateAdapter = true)
data class HomeAssetSummaryDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String? = null,
    /** `appliance` / `structure` / `system` / `vehicle` / `other`. */
    @Json(name = "category") val category: String? = null,
    @Json(name = "room") val room: String? = null,
    @Json(name = "manufacturer") val manufacturer: String? = null,
    @Json(name = "model_number") val modelNumber: String? = null,
    @Json(name = "purchased_at") val purchasedAt: String? = null,
    @Json(name = "warranty_expires") val warrantyExpires: String? = null,
    /**
     * Server-computed `active` / `expiring_soon` / `expired` / `none` —
     * `warrantyStatus`, `backend/routes/mailboxV2Phase3.js:167`.
     */
    @Json(name = "warranty_status") val warrantyStatus: String? = null,
    @Json(name = "linked_mail_count") val linkedMailCount: Int? = null,
    @Json(name = "linked_gig_count") val linkedGigCount: Int? = null,
    @Json(name = "photo_url") val photoUrl: String? = null,
)

/**
 * `GET api/mailbox/v2/p3/records/assets` envelope — route line 230.
 * `rooms` is the distinct room list backing the filter chips.
 */
@JsonClass(generateAdapter = true)
data class HomeAssetsResponse(
    @Json(name = "assets") val assets: List<HomeAssetSummaryDto> = emptyList(),
    @Json(name = "rooms") val rooms: List<String>? = null,
)

/**
 * A mail row linked to an asset. The route returns raw `Mail` rows
 * (route line 267) — only the columns the drill-down renders are modelled.
 */
@JsonClass(generateAdapter = true)
data class AssetLinkedMailDto(
    @Json(name = "id") val id: String,
    @Json(name = "subject") val subject: String? = null,
    @Json(name = "sender_name") val senderName: String? = null,
    @Json(name = "delivered_at") val deliveredAt: String? = null,
    @Json(name = "category") val category: String? = null,
)

/** An `AssetPhoto` row — route line 276. */
@JsonClass(generateAdapter = true)
data class AssetPhotoDto(
    @Json(name = "id") val id: String,
    @Json(name = "url") val url: String? = null,
    @Json(name = "caption") val caption: String? = null,
    @Json(name = "taken_at") val takenAt: String? = null,
)

/**
 * `GET api/mailbox/v2/p3/records/asset/:id/mail` envelope — route line
 * 288. `gigs` is always empty server-side today, so it is not modelled.
 */
@JsonClass(generateAdapter = true)
data class AssetMailResponse(
    @Json(name = "asset") val asset: HomeAssetSummaryDto,
    @Json(name = "mail") val mail: List<AssetLinkedMailDto>? = null,
    @Json(name = "photos") val photos: List<AssetPhotoDto>? = null,
)

/** One auto-detect / suggestion hit — route lines 360 and 408. */
@JsonClass(generateAdapter = true)
data class AssetDetectionDto(
    @Json(name = "candidate_name") val candidateName: String? = null,
    @Json(name = "candidate_brand") val candidateBrand: String? = null,
    @Json(name = "candidate_model") val candidateModel: String? = null,
    @Json(name = "confidence") val confidence: Double? = null,
    @Json(name = "source_mail_id") val sourceMailId: String,
    @Json(name = "source_field") val sourceField: String? = null,
)

/**
 * Wire body for `POST api/mailbox/v2/p3/records/auto-detect` — validator
 * at `backend/routes/mailboxV2Phase3.js:26` (`homeId` required).
 */
@JsonClass(generateAdapter = true)
data class AutoDetectAssetsRequest(
    @Json(name = "homeId") val homeId: String,
)

/** `POST api/mailbox/v2/p3/records/auto-detect` envelope — route line 372. */
@JsonClass(generateAdapter = true)
data class AutoDetectAssetsResponse(
    @Json(name = "detections") val detections: List<AssetDetectionDto>? = null,
    @Json(name = "count") val count: Int? = null,
)

/** One unlinked-mail suggestion — route line 406. */
@JsonClass(generateAdapter = true)
data class AssetSuggestionDto(
    @Json(name = "mail") val mail: AssetLinkedMailDto,
    @Json(name = "detections") val detections: List<AssetDetectionDto>? = null,
)

/** `GET api/mailbox/v2/p3/records/suggestions` envelope — route line 419. */
@JsonClass(generateAdapter = true)
data class AssetSuggestionsResponse(
    @Json(name = "suggestions") val suggestions: List<AssetSuggestionDto>? = null,
)

/**
 * Wire body for `POST api/mailbox/v2/p3/records/link` — validator at
 * `backend/routes/mailboxV2Phase3.js:20`. `linkType` is one of `manual` /
 * `auto_detected` / `warranty` / `receipt` / `repair`.
 */
@JsonClass(generateAdapter = true)
data class LinkMailToAssetRequest(
    @Json(name = "mailId") val mailId: String,
    @Json(name = "assetId") val assetId: String,
    @Json(name = "linkType") val linkType: String = "manual",
)

/**
 * A `MailAssetLink` row returned by `POST records/link` (route line 315).
 * `id` is the only place the link primary key is exposed — the asset-mail
 * drill-down does not return it — so it is what the undo affordance carries.
 */
@JsonClass(generateAdapter = true)
data class MailAssetLinkDto(
    @Json(name = "id") val id: String,
    @Json(name = "mail_id") val mailId: String? = null,
    @Json(name = "asset_id") val assetId: String? = null,
    @Json(name = "link_type") val linkType: String? = null,
    @Json(name = "confidence") val confidence: Double? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** `POST api/mailbox/v2/p3/records/link` envelope. */
@JsonClass(generateAdapter = true)
data class LinkMailToAssetResponse(
    @Json(name = "link") val link: MailAssetLinkDto? = null,
)

/** `DELETE api/mailbox/v2/p3/records/unlink/:id` envelope — route line 330. */
@JsonClass(generateAdapter = true)
data class UnlinkMailFromAssetResponse(
    @Json(name = "message") val message: String? = null,
)
