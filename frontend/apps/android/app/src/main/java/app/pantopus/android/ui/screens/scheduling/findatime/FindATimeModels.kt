@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.findatime

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Stream A11 — Find-a-time & who's-free (home-only) shared model types.
 *
 * The F4 → F5 hop is two arg-less A0 routes (`FIND_A_TIME` /
 * `FIND_A_TIME_SLOTS`), so the setup criteria are handed across the process via
 * [FindATimeSession] rather than nav args (which the frozen `RootTabScreen`
 * stubs don't carry). F7's "Find a time here" seeds the same session.
 */

/** Coordination mode — `collective` (everyone free) or `round_robin` (one covers). */
enum class FindMode(val wire: String) {
    Collective("collective"),
    RoundRobin("round_robin"),
}

/** A household member as picked in F4 and rendered across F5/F7. */
data class FindMember(
    val userId: String,
    val name: String,
    val avatarUrl: String? = null,
    /** F4 Required/Optional toggle. Required members drive the find-a-time query. */
    val required: Boolean = true,
) {
    /** Up to two uppercase initials for the fallback avatar disc. */
    val initials: String
        get() =
            name
                .trim()
                .split(Regex("\\s+"))
                .filter { it.isNotBlank() }
                .take(2)
                .map { it.first().uppercaseChar() }
                .joinToString("")
                .ifBlank { "?" }
}

/**
 * The setup payload F4 stashes for F5. The routes are arg-less, so this is the
 * handoff channel; [windowLabel] is the human window ("this week").
 */
data class FindATimeCriteria(
    val homeId: String,
    val title: String,
    val members: List<FindMember>,
    val mode: FindMode,
    val durationMin: Int,
    /** First covered day, as an ISO date (`yyyy-MM-dd`) sent as `from`. */
    val fromIso: String,
    /**
     * EXCLUSIVE end (the day after the last covered day), sent as `to`. The
     * backend parses a date-only bound as UTC midnight, so an inclusive last
     * day would silently drop that entire day's slots.
     */
    val toIso: String,
    val windowLabel: String,
    /** IANA tz sent on the read and used to render `startLocal`. */
    val timezone: String,
) {
    val requiredMembers: List<FindMember> get() = members.filter { it.required }
}

/**
 * Process-scoped handoff between the F4 setup screen and the F5 slots screen,
 * plus F7's "Find a time here" window seed. A `@Singleton` (not nav args)
 * because the A0 routes `scheduling/find-a-time` / `…/slots` carry none.
 */
@Singleton
class FindATimeSession
    @Inject
    constructor() {
        /** Set by F4 "Next"; consumed by F5 on entry. */
        @Volatile
        var criteria: FindATimeCriteria? = null

        /** Optional window seed (inclusive ISO dates) from F7 "Find a time here". */
        @Volatile
        var seedFromIso: String? = null

        @Volatile
        var seedToIso: String? = null

        /**
         * Set by F5 when `POST /find-a-time` returns zero slots; consumed by the
         * F4 setup editor so its no-overlap banner + quick fixes render.
         */
        @Volatile
        var noOverlapMessage: String? = null

        fun takeSeed(): Pair<String, String>? {
            val from = seedFromIso
            val to = seedToIso
            seedFromIso = null
            seedToIso = null
            return if (from != null && to != null) from to to else null
        }

        fun takeNoOverlapMessage(): String? {
            val message = noOverlapMessage
            noOverlapMessage = null
            return message
        }
    }
