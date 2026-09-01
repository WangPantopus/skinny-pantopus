package app.pantopus.android.data.api.models.mailbox.v2

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Phase-2 package/unboxing writes in
 * `backend/routes/mailboxV2Phase2.js` (mounted at
 * `api/mailbox/v2/p2`, `backend/app.js:316`). Three routes back the
 * A17.14 Unboxing screen:
 *
 *  - `POST …/p2/package/:mailId/unboxing`      (:1217) — record the
 *    condition photo / unboxing video on the `MailPackage` row.
 *  - `POST …/p2/package/:mailId/save-warranty` (:1246) — flip
 *    `warranty_saved` / `manual_saved` and auto-file to Home › Warranties.
 *  - `POST …/p2/package/:mailId/gig`           (:1280) — post the
 *    assembly/help gig for the package.
 *
 * All three take camelCase bodies, so no `@Json(name = …)` mapping is
 * needed on the request types.
 */

/**
 * Wire body for the unboxing write — route
 * `backend/routes/mailboxV2Phase2.js:1217`. `conditionPhotoUrl` and
 * `unboxingVideoUrl` must be absolute URIs (Joi `.uri()`), so the caller
 * uploads the capture first and passes the returned S3 URL.
 */
@JsonClass(generateAdapter = true)
data class PackageUnboxingRequest(
    val conditionPhotoUrl: String? = null,
    val unboxingVideoUrl: String? = null,
    val skip: Boolean? = null,
)

/** Envelope for the unboxing write — `{ message, updates }`. */
@JsonClass(generateAdapter = true)
data class PackageUnboxingResponse(
    val message: String? = null,
)

/**
 * Wire body for the save-warranty write — route
 * `backend/routes/mailboxV2Phase2.js:1246`. `type` is `warranty` or
 * `manual` (no Joi validator; the handler switches on the literal).
 */
@JsonClass(generateAdapter = true)
data class PackageSaveWarrantyRequest(
    val type: String,
)

/**
 * Envelope for the save-warranty write — `{ message, folder }` where
 * `folder` is the destination `VaultFolder` id when one exists.
 */
@JsonClass(generateAdapter = true)
data class PackageSaveWarrantyResponse(
    val message: String? = null,
    val folder: String? = null,
)

/**
 * Wire body for the package-gig write — route
 * `backend/routes/mailboxV2Phase2.js:1280`. `gigType` is required and one
 * of `hold / inside / sign / custom / assembly` (`packageGigSchema`, :83).
 */
@JsonClass(generateAdapter = true)
data class PackageGigRequest(
    val gigType: String,
    val title: String? = null,
    val description: String? = null,
    val suggestedStart: String? = null,
    val compensation: Double? = null,
)

/** Envelope for the package-gig write. */
@JsonClass(generateAdapter = true)
data class PackageGigResponse(
    val message: String? = null,
    val gigId: String? = null,
    val title: String? = null,
    val preDelivery: Boolean? = null,
)

/**
 * Typed view of the `MailPackage` row returned by
 * `GET /api/mailbox/v2/package/:mailId` — route
 * `backend/routes/mailboxV2.js:634`. `PackageDetailResponse` keeps the row
 * untyped for the A17.8 detail variant; the Unboxing screen needs the
 * Phase-2 columns added in
 * `backend/database/migrations/047_mailbox_phase2.sql:256`, so it decodes
 * them explicitly. Every field is optional — the row is written
 * incrementally by the carrier pipeline.
 */
@JsonClass(generateAdapter = true)
data class UnboxingPackageDto(
    val id: String? = null,
    @Json(name = "mail_id") val mailId: String? = null,
    val carrier: String? = null,
    @Json(name = "tracking_id_masked") val trackingIdMasked: String? = null,
    /** `pre_receipt / in_transit / out_for_delivery / delivered / exception`. */
    val status: String? = null,
    @Json(name = "delivery_photo_url") val deliveryPhotoUrl: String? = null,
    @Json(name = "delivery_location_note") val deliveryLocationNote: String? = null,
    @Json(name = "condition_photo_url") val conditionPhotoUrl: String? = null,
    @Json(name = "unboxing_video_url") val unboxingVideoUrl: String? = null,
    @Json(name = "unboxing_completed") val unboxingCompleted: Boolean? = null,
    @Json(name = "warranty_saved") val warrantySaved: Boolean? = null,
    @Json(name = "manual_saved") val manualSaved: Boolean? = null,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "gig_type") val gigType: String? = null,
    @Json(name = "inferred_item_name") val inferredItemName: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** Sender ref folded into the package envelope. */
@JsonClass(generateAdapter = true)
data class UnboxingPackageSender(
    val display: String? = null,
    val trust: String? = null,
)

/**
 * Typed envelope for `GET /api/mailbox/v2/package/:mailId` —
 * `{ package, timeline, sender }`. The Unboxing screen only reads the
 * package row and the sender display name.
 */
@JsonClass(generateAdapter = true)
data class UnboxingPackageResponse(
    @Json(name = "package") val packageRow: UnboxingPackageDto,
    val sender: UnboxingPackageSender? = null,
)

/**
 * Envelope for `POST api/mailbox/v2/package/:mailId/share-eta` — route
 * `backend/routes/mailboxV2.js:727`. `notified` is the number of other
 * household residents who received the arriving-soon notice.
 */
@JsonClass(generateAdapter = true)
data class SharePackageEtaResponse(
    val message: String? = null,
    val notified: Int? = null,
)
