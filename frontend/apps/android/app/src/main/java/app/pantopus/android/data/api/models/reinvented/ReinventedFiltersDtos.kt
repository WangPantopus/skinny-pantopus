package app.pantopus.android.data.api.models.reinvented

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/*
 * Filters on the new Pulse's list and map ("Pulse, reinvented" PHASE-5 piece B, CONTRACT 10a): four optional fields on
 * `GET /api/reinvented/list` and `/map`. With none of them on, both requests are exactly today's (the single `chip`).
 */

/** What the person chose in the Filters sheet; remembered on the phone, per person. Empty: today's request. */
data class ReinventedFilters(
    /** What: 6a's chip names but `all` (`live`, `learn`, `spots`, `ask`, `plans`, `sports`). */
    val kinds: Set<String> = emptySet(),
    /** When, on the list: `now`, `today`, `tonight` or `weekend` (on the map the time row is this choice). */
    val whenKey: String? = null,
    /** From: `connections`; null is everyone. */
    val from: String? = null,
    /** State: `unanswered`, `room`. */
    val state: Set<String> = emptySet(),
    /** "New since your last visit": the time kept on the phone, sent as it is. */
    val since: String? = null,
) {
    val isEmpty: Boolean get() = kinds.isEmpty() && whenKey == null && from == null && state.isEmpty() && since == null

    /** The Filters button's count: each choice that is on. */
    val count: Int get() = kinds.size + listOfNotNull(whenKey, from, since).size + state.size

    /** The request's `kinds` (in the contract's order), or null to leave it out. */
    val kindsQuery: String? get() = KINDS.filter { it in kinds }.joinToString(",").ifEmpty { null }

    val stateQuery: String? get() = STATES.filter { it in state }.joinToString(",").ifEmpty { null }

    companion object {
        val KINDS = listOf("live", "learn", "spots", "ask", "plans", "sports")
        val WHENS = listOf("now", "today", "tonight", "weekend")
        val STATES = listOf("unanswered", "room")
        const val CONNECTIONS = "connections"
    }
}

/** `filters` on a list or map answer whenever any field was sent: what the server applied, normalised. */
@JsonClass(generateAdapter = true)
data class ReinventedAppliedFiltersDto(
    val kinds: List<String>? = null,
    @Json(name = "when") val whenKey: String? = null,
    val from: String? = null,
    val state: List<String>? = null,
    val since: String? = null,
)
