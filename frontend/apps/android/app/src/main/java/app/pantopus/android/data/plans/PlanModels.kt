package app.pantopus.android.data.plans

import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanPinDto

/** The four kinds of plan (decision D3). [wire] is the API value, [label] the name people see. */
enum class PlanKind(
    val wire: String,
    val label: String,
) {
    WATCH_PARTY("watch_party", "Watch party"),
    PLAYDATE("playdate", "Playdate"),
    PICKUP_GAME("pickup_game", "Pickup game"),
    WALK_COFFEE("walk_coffee", "Walk & coffee"),
    ;

    /** The noun used in sentences: "Host your own watch party", "How was Sunday's pickup game?". */
    val noun: String get() = label.lowercase()

    companion object {
        fun from(wire: String?): PlanKind? = entries.firstOrNull { it.wire == wire }
    }
}

/** `PlanRequest.status`. */
enum class PlanRequestStatus(
    val wire: String,
) {
    PENDING("pending"),
    WAITLISTED("waitlisted"),
    ACCEPTED("accepted"),
    DECLINED("declined"),
    WITHDRAWN("withdrawn"),
    LEFT("left"),
    REMOVED("removed"),
    EXPIRED("expired"),
    ;

    companion object {
        fun from(wire: String?): PlanRequestStatus? = entries.firstOrNull { it.wire == wire }
    }
}

/** `state` of a plan. */
enum class PlanState(
    val wire: String,
) {
    UPCOMING("upcoming"),
    LIVE("live"),
    ENDED("ended"),
    CANCELLED("cancelled"),
    ;

    companion object {
        fun from(wire: String?): PlanState = entries.firstOrNull { it.wire == wire } ?: UPCOMING
    }
}

/** The map's time window (`window` on the pins and list routes). */
enum class PlanWindow(
    val wire: String,
    val label: String,
) {
    NOW("now", "Happening now"),
    TODAY("today", "Today"),
    WEEK("week", "This week"),
    WEEKEND("weekend", "This weekend"),
}

/** Where the viewer stands with a plan, from the card's `viewer` block (or a pin's two viewer fields). */
enum class PlanViewerStanding {
    NONE,
    HOSTING,
    REQUESTED,
    WAITLISTED,
    IN,
    DECLINED,
    REMOVED,
    LEFT,
    ;

    companion object {
        fun of(
            role: String?,
            requestStatus: String?,
        ): PlanViewerStanding =
            when {
                role == "host" -> HOSTING
                else ->
                    when (PlanRequestStatus.from(requestStatus)) {
                        PlanRequestStatus.ACCEPTED -> IN
                        PlanRequestStatus.PENDING -> REQUESTED
                        PlanRequestStatus.WAITLISTED -> WAITLISTED
                        PlanRequestStatus.DECLINED, PlanRequestStatus.EXPIRED -> DECLINED
                        PlanRequestStatus.REMOVED -> REMOVED
                        PlanRequestStatus.LEFT, PlanRequestStatus.WITHDRAWN -> LEFT
                        null -> NONE
                    }
            }
    }
}

val PlanDto.planKind: PlanKind? get() = PlanKind.from(kind)
val PlanDto.planState: PlanState get() = PlanState.from(state)
val PlanDto.standing: PlanViewerStanding
    get() = PlanViewerStanding.of(viewer?.role, viewer?.requestStatus ?: myRequest?.status)

/** True when the private part (place, note, people) came with this copy: the viewer hosts it or is in. */
val PlanDto.hasPrivatePart: Boolean get() = place != null || people != null

val PlanDto.isPlaydate: Boolean get() = planKind == PlanKind.PLAYDATE
val PlanDto.isAtHome: Boolean get() = placeKind == "home"
val PlanDto.hostApproves: Boolean get() = howPeopleGetIn != "automatic"

val PlanPinDto.planKind: PlanKind? get() = PlanKind.from(kind)
val PlanPinDto.planState: PlanState get() = PlanState.from(state)
val PlanPinDto.standing: PlanViewerStanding get() = PlanViewerStanding.of(viewerRole, viewerRequestStatus)

/** The automatic rules a host can pick (brief section 4). */
object PlanAutoRule {
    const val VERIFIED = "verified"
    const val HOSTED_BEFORE = "hosted_before"
    const val ANYONE_NEARBY = "anyone_nearby"
}

/** Why someone can't ask (`viewer.cannot_ask_reason`). */
object PlanCannotAsk {
    const val NEEDS_VERIFIED_ADDRESS = "needs_verified_address"
    const val TOO_FAR = "too_far"
    const val NEEDS_LOCATION = "needs_location"
    const val FULL_USE_WAITLIST = "full_use_waitlist"
    const val DECLINED = "declined"
    const val REMOVED = "removed"
    const val BLOCKED = "blocked"
    const val TOO_MANY_REQUESTS = "too_many_requests"
    const val ENDED = "ended"
}

/** Kids' age bands for playdates (wire value to label). [low] and [high] are the ages the band covers. */
enum class KidsAgeBand(
    val wire: String,
    val label: String,
    val low: Int,
    val high: Int,
) {
    UNDER_2("under_2", "Under 2", 0, 1),
    AGE_2_3("2_3", "2–3", 2, 3),
    AGE_4_5("4_5", "4–5", 4, 5),
    AGE_6_8("6_8", "6–8", 6, 8),
    AGE_9_12("9_12", "9–12", 9, 12),
    ;

    companion object {
        fun from(wire: String?): KidsAgeBand? = entries.firstOrNull { it.wire == wire }

        /** "2–5" from a set of bands (the lowest age to the highest), "under 2" for that band alone. */
        fun rangeLabel(wires: List<String>?): String? {
            val bands = wires.orEmpty().mapNotNull(::from)
            if (bands.isEmpty()) return null
            if (bands.size == 1 && bands.first() == UNDER_2) return "under 2"
            return "${bands.minOf { it.low }}–${bands.maxOf { it.high }}"
        }
    }
}
