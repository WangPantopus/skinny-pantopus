package app.pantopus.android.data.store

import app.pantopus.android.data.api.models.plans.MyPlansResponse
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanPinsResponse
import app.pantopus.android.data.api.models.plans.PlansListResponse

/**
 * Nearby Plans' store keys (brief section 6). The map, the list and Today's cards use kind [StoreKind.NEARBY]; a
 * plan's private part (place, note, people, chat) is never stored: the detail is read fresh every time, so a guest
 * who was removed never sees an address from a copy. Kept apart from [StoreKeys] so the two sets grow without merge
 * conflicts.
 */
object PlanStoreKeys {
    /** Every Plans entry; an own write or a Plans push marks them all out of date. */
    const val TOPIC = "plans"

    /** One plan's entries (its pin, rows and card). */
    fun topic(planId: String) = "plan:$planId"

    /**
     * Pins for one viewport and filter, with distance bands measured from a rounded point. Saved on the phone only
     * while every pin is an area point: the exact point of a plan the viewer is in stays in memory.
     */
    @Suppress("LongParameterList")
    fun pins(
        south: Double,
        west: Double,
        north: Double,
        east: Double,
        kinds: String?,
        window: String,
        latitude: Double?,
        longitude: Double?,
    ) = StoreKey<PlanPinsResponse>(
        "api/posts/map",
        mapOf(
            "south" to south.toString(),
            "west" to west.toString(),
            "north" to north.toString(),
            "east" to east.toString(),
            "layers" to "plans",
            "kinds" to kinds?.takeIf(String::isNotBlank),
            "window" to window,
            "latitude" to latitude?.toString(),
            "longitude" to longitude?.toString(),
        ),
        kind = StoreKind.NEARBY,
        topics = setOf(TOPIC, "plan:*"),
        type = PlanPinsResponse::class.java,
        saveWhen = { reply -> reply.markers.all { it.precision == "area" || it.precision == "neighborhood" } },
    )

    /** The list under the map (first page) around a rounded point. */
    fun list(
        latitude: Double?,
        longitude: Double?,
        window: String,
        kinds: String?,
    ) = StoreKey<PlansListResponse>(
        "api/plans",
        mapOf(
            "latitude" to latitude?.toString(),
            "longitude" to longitude?.toString(),
            "window" to window,
            "kinds" to kinds?.takeIf(String::isNotBlank),
        ),
        kind = StoreKind.NEARBY,
        topics = setOf(TOPIC, "plan:*"),
        type = PlansListResponse::class.java,
        saveWhen = { reply -> reply.items.none(PlanDto::carriesPrivatePart) },
    )

    /** Hosting, going, asked and waitlisted: the list's "Your plans" and the Today cards. */
    val mine =
        StoreKey<MyPlansResponse>(
            "api/plans/mine",
            kind = StoreKind.NEARBY,
            topics = setOf(TOPIC, "plan:*"),
            type = MyPlansResponse::class.java,
            saveWhen = { reply ->
                (reply.hosting + reply.going + reply.asked + reply.waitlisted).none(PlanDto::carriesPrivatePart)
            },
        )
}

/** True when a reply carries a plan's private part, which never goes on the phone. */
private fun PlanDto.carriesPrivatePart(): Boolean = place != null || people != null || chatRoomId != null
