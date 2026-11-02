@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.ai

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/ai/needs-you` (AI assistant phase 3 contract §6.2): what waits on the person, most urgent first, at most 20.
 * Built by the server as the person from the screens' own services; `partial` when a source was left out.
 */
@JsonClass(generateAdapter = true)
data class AINeedsYouResponse(
    val items: List<AINeedsYouItemDto> = emptyList(),
    val total: Int? = null,
    val partial: Boolean? = null,
)

/**
 * One thing waiting: [type] is `still_coming`, `plan_requests`, `task_overdue`, `task_assigned`, `home_invite`,
 * `household_request`, `connection_request`, `nudge_card` or `question_answered`; [title] and [subtitle] are plain text
 * the server wrote in the person's time zone; [link] opens its screen.
 */
@JsonClass(generateAdapter = true)
data class AINeedsYouItemDto(
    val id: String,
    val type: String,
    val title: String,
    val subtitle: String? = null,
    @Json(name = "due_at") val dueAt: String? = null,
    val link: String? = null,
    val subject: AINeedsYouSubjectDto? = null,
)

/** What an item is about: a plan, task, home, post or person, by id (a task also names its home). */
@JsonClass(generateAdapter = true)
data class AINeedsYouSubjectDto(
    val type: String? = null,
    val id: String? = null,
    @Json(name = "home_id") val homeId: String? = null,
)
