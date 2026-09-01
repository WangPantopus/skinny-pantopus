@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Time polls. Host: `GET/POST /polls`, `GET /polls/:id`, `POST /polls/:id/finalize`.
 * Public: `GET /poll/:id`, `POST /poll/:id/vote`.
 */
@JsonClass(generateAdapter = true)
data class PollDto(
    val id: String,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
    val title: String? = null,
    val description: String? = null,
    @Json(name = "duration_min") val durationMin: Int? = null,
    val status: String? = null,
    @Json(name = "finalized_start_at") val finalizedStartAt: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** One poll slot option. */
@JsonClass(generateAdapter = true)
data class PollOptionDto(
    val id: String,
    @Json(name = "poll_id") val pollId: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
)

/**
 * One vote. The host detail (`GET /polls/:id`) returns numeric `value` (usually
 * 1); the public detail (`GET /poll/:id`) returns `'yes'|'maybe'|'no'`. Modelled
 * as a permissive value so either decodes.
 */
@JsonClass(generateAdapter = true)
data class PollVoteDto(
    @Json(name = "option_id") val optionId: String? = null,
    @Json(name = "voter_name") val voterName: String? = null,
    val value: Any? = null,
)

/** `GET /polls` — `{ polls: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetPollsResponse(
    val polls: List<PollDto> = emptyList(),
)

/** `POST /polls` — `{ poll, options }`. */
@JsonClass(generateAdapter = true)
data class PollCreatedResponse(
    val poll: PollDto,
    val options: List<PollOptionDto> = emptyList(),
)

/** `GET /polls/:id` and `GET /poll/:id` — poll + options + votes. */
@JsonClass(generateAdapter = true)
data class PollDetailResponse(
    val poll: PollDto,
    val options: List<PollOptionDto> = emptyList(),
    val votes: List<PollVoteDto> = emptyList(),
)

/** `POST /polls/:id/finalize` — `{ poll, finalized_start_at }`. */
@JsonClass(generateAdapter = true)
data class FinalizePollResponse(
    val poll: PollDto,
    @Json(name = "finalized_start_at") val finalizedStartAt: String? = null,
)

/** One option write entry for poll creation. */
@JsonClass(generateAdapter = true)
data class PollOptionInput(
    val start: String,
    val end: String,
)

/** Body for `POST /polls`. */
@JsonClass(generateAdapter = true)
data class CreatePollRequest(
    val title: String,
    val options: List<PollOptionInput>,
    val description: String? = null,
    @Json(name = "duration_min") val durationMin: Int? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** Body for `POST /polls/:id/finalize`. */
@JsonClass(generateAdapter = true)
data class FinalizePollRequest(
    @Json(name = "option_id") val optionId: String,
)

/** One vote write entry (public). `value` ∈ `yes|maybe|no`. */
@JsonClass(generateAdapter = true)
data class PollVoteInput(
    @Json(name = "option_id") val optionId: String,
    val value: String? = null,
)

/** Body for `POST /poll/:id/vote` (public). */
@JsonClass(generateAdapter = true)
data class PublicPollVoteRequest(
    val votes: List<PollVoteInput>,
    val name: String? = null,
    val email: String? = null,
)
