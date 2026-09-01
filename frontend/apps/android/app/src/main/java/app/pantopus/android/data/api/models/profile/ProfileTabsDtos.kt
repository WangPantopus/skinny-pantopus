package app.pantopus.android.data.api.models.profile

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Decoders for the public-profile Portfolio and Reviews tabs.
 *
 *   `GET  /api/files/portfolio`          — `backend/routes/files.js:489`
 *   `GET  /api/files/portfolio/{userId}` — `backend/routes/files.js:526`
 *   `POST /api/files/portfolio`          — `backend/routes/files.js:362`
 *   `DELETE /api/files/{id}`             — `backend/routes/files.js:853`
 *   `GET  /api/reviews/user/{userId}`    — `backend/routes/reviews.js:149`
 *
 * Mounts: `backend/app.js:329` (files), `:340` (reviews). The Gigs tab
 * reuses `GigDto` / `GigsListResponse` from `models/gigs/GigDtos.kt`.
 *
 * iOS counterpart: `Core/Networking/Models/ProfileTabs/ProfileTabsDTOs.kt`.
 */

/**
 * Free-form `File.metadata` jsonb written by the portfolio upload route
 * (`backend/routes/files.js:437-445`).
 */
@JsonClass(generateAdapter = true)
data class PortfolioFileMetadataDto(
    val title: String? = null,
    val description: String? = null,
    val tags: List<String>? = null,
    /** `{ small, medium, large }` — only for images the server resized. */
    val thumbnails: Map<String, String>? = null,
)

/** One `File` row from either portfolio list route. */
@JsonClass(generateAdapter = true)
data class PortfolioFileDto(
    val id: String,
    @Json(name = "file_url") val fileUrl: String? = null,
    val filename: String? = null,
    @Json(name = "original_filename") val originalFilename: String? = null,
    /**
     * `portfolio_image` / `portfolio_video` / `portfolio_document` /
     * `resume` / `certification` — the `.in(...)` filter both list routes
     * apply.
     */
    @Json(name = "file_type") val fileType: String? = null,
    /** User-chosen bucket (`file_context`) — the upload `category` field. */
    @Json(name = "file_context") val fileContext: String? = null,
    val visibility: String? = null,
    @Json(name = "display_order") val displayOrder: Int? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val metadata: PortfolioFileMetadataDto? = null,
)

/** Envelope from both portfolio list routes: `{ files: [...] }`. */
@JsonClass(generateAdapter = true)
data class PortfolioListResponse(
    val files: List<PortfolioFileDto> = emptyList(),
)

/** `{ id, url, type }` nested in the portfolio upload echo. */
@JsonClass(generateAdapter = true)
data class PortfolioUploadedFileDto(
    val id: String,
    val url: String? = null,
    val type: String? = null,
)

/** `{ message, file }` from `POST /api/files/portfolio`. */
@JsonClass(generateAdapter = true)
data class PortfolioUploadResponse(
    val message: String? = null,
    val file: PortfolioUploadedFileDto? = null,
)

/** `{ message }` from `DELETE /api/files/{id}`. */
@JsonClass(generateAdapter = true)
data class FileDeleteResponse(
    val message: String? = null,
)

/** Nested reviewer join on a gig review (`reviews.js:174`). */
@JsonClass(generateAdapter = true)
data class GigReviewReviewerDto(
    val id: String? = null,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "last_name") val lastName: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** Nested gig join — the role context behind `received_as`. */
@JsonClass(generateAdapter = true)
data class GigReviewGigDto(
    val id: String? = null,
    val title: String? = null,
)

/** One row from `GET /api/reviews/user/{userId}`. */
@JsonClass(generateAdapter = true)
data class GigReviewDto(
    val id: String,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "reviewer_id") val reviewerId: String? = null,
    val rating: Int = 0,
    val comment: String? = null,
    @Json(name = "media_urls") val mediaUrls: List<String>? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    /** Server-flattened convenience fields (`reviews.js:250-256`). */
    @Json(name = "reviewer_name") val reviewerName: String? = null,
    @Json(name = "reviewer_avatar") val reviewerAvatar: String? = null,
    @Json(name = "reviewer_username") val reviewerUsername: String? = null,
    /**
     * `worker` | `poster` | `unknown` — resolved server-side from the
     * gig's `accepted_by` / `user_id` (`reviews.js:156-163`).
     */
    @Json(name = "received_as") val receivedAs: String? = null,
    val reviewer: GigReviewReviewerDto? = null,
    val gig: GigReviewGigDto? = null,
)

/** Per-role tallies emitted alongside the review page. */
@JsonClass(generateAdapter = true)
data class GigReviewCountsDto(
    val worker: Int = 0,
    val poster: Int = 0,
    val unknown: Int = 0,
)

/** Envelope from `GET /api/reviews/user/{userId}`. */
@JsonClass(generateAdapter = true)
data class GigReviewsResponse(
    val reviews: List<GigReviewDto> = emptyList(),
    val total: Int? = null,
    @Json(name = "average_rating") val averageRating: Double? = null,
    val counts: GigReviewCountsDto? = null,
)
