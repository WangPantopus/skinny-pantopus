package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /api/homes/:id/changes?since=` (TPR contract §7): real, dated changes at a Home since this account's last visit,
 * newest first, at most 20; [total] counts them all. [until] is the server's time of the answer: the next visit's `since`.
 * [incomplete] when a source couldn't be read (some may be missing). An older server answers 404.
 */
@JsonClass(generateAdapter = true)
data class HomeChangesResponse(
    val since: String? = null,
    val until: String? = null,
    val total: Int = 0,
    val items: List<HomeChangeItem> = emptyList(),
    val incomplete: Boolean = false,
)

/** One change: what it is ([kind], [title]), when ([occurredAt], an instant), who or what it came from ([origin]). */
@JsonClass(generateAdapter = true)
data class HomeChangeItem(
    val id: String = "",
    val kind: String = "",
    val title: String = "",
    val detail: String? = null,
    @Json(name = "occurred_at") val occurredAt: String? = null,
    val origin: String? = null,
    val route: HomeChangeRoute? = null,
)

/** Where a change opens: `today` (with a [section]), `place_detail` ([group], [section]), `documents` ([id]), `home_activity`. */
@JsonClass(generateAdapter = true)
data class HomeChangeRoute(
    val screen: String = "",
    val section: String? = null,
    val group: String? = null,
    val id: String? = null,
)
