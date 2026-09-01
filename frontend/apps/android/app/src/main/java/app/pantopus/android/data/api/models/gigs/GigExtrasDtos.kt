package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * RN→native parity response shapes for the secondary `/api/gigs` routes:
 * the Q&A engagement actions, the poster's worker reminder, and the
 * "Rebook a favorite helper" rail. Mirrors iOS `GigExtrasDTOs.swift`.
 */

/**
 * `POST /api/gigs/:gigId/questions/:questionId/upvote` →
 * `{ "upvoted": true }` (`backend/routes/gigs.js:7535`). The route
 * toggles, so the flag reports the post-toggle state.
 */
@JsonClass(generateAdapter = true)
data class GigQuestionUpvoteResponse(
    val upvoted: Boolean = false,
)

/**
 * `DELETE /api/gigs/:gigId/questions/:questionId` →
 * `{ "deleted": true }` (`backend/routes/gigs.js:7600`).
 */
@JsonClass(generateAdapter = true)
data class GigQuestionDeleteResponse(
    val deleted: Boolean = false,
)

/**
 * `POST /api/gigs/:gigId/remind-worker` success body
 * (`backend/routes/gigs.js:5828`). The 429 rate-limited body carries only
 * `error` / `code` / `next_allowed_at`, which the view-model parses out of
 * the raw `NetworkError.ClientError.body`.
 */
@JsonClass(generateAdapter = true)
data class GigStartReminderResponse(
    val success: Boolean? = null,
    @Json(name = "sent_at") val sentAt: String? = null,
    val message: String? = null,
    @Json(name = "next_allowed_at") val nextAllowedAt: String? = null,
)

/** The worker inlined on a rebookable gig (`backend/routes/gigs.js:2960`). */
@JsonClass(generateAdapter = true)
data class RebookableWorkerDto(
    val id: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val username: String? = null,
    val avatarUrl: String? = null,
    val rating: Double? = null,
) {
    /** "Ana" — first name, else username, else a neutral fallback. */
    val displayName: String
        get() =
            firstName?.takeIf { it.isNotBlank() }
                ?: username?.takeIf { it.isNotBlank() }
                ?: "Helper"

    /** "AL" — first+last initials, else the username initial. */
    val initials: String
        get() {
            val pair =
                (
                    (firstName?.firstOrNull()?.toString() ?: "") +
                        (lastName?.firstOrNull()?.toString() ?: "")
                ).uppercase()
            if (pair.isNotEmpty()) return pair
            return username?.firstOrNull()?.uppercase() ?: "?"
        }
}

/** The poster's own review of a rebookable gig, when they left one. */
@JsonClass(generateAdapter = true)
data class RebookableReviewDto(
    val rating: Double? = null,
    val comment: String? = null,
)

/**
 * One card in the "Rebook a favorite helper" rail —
 * `GET /api/gigs/rebookable` (`backend/routes/gigs.js:2885`). Note the
 * handler emits **camelCase** keys (`completedAt`, `avatarUrl`), unlike
 * most gig routes.
 */
@JsonClass(generateAdapter = true)
data class RebookableGigDto(
    val id: String,
    val title: String? = null,
    val category: String? = null,
    val price: Double? = null,
    val completedAt: String? = null,
    val worker: RebookableWorkerDto? = null,
    val myReview: RebookableReviewDto? = null,
    val city: String? = null,
    val state: String? = null,
)

/** `GET /api/gigs/rebookable` envelope. */
@JsonClass(generateAdapter = true)
data class RebookableGigsResponse(
    val rebookable: List<RebookableGigDto> = emptyList(),
)
