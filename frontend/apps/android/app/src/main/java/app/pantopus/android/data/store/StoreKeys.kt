package app.pantopus.android.data.store

import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.notifications.NotificationUnreadCountResponse
import app.pantopus.android.data.api.models.notifications.NotificationsListResponse
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.support_trains.SupportTrainsListResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainsNearbyResponse

/** Change topics (contract §8) that more than one key or repository names. */
object StoreTopics {
    /** The viewer's notifications: one created, read or deleted. */
    const val NOTIFICATIONS = "notifications"

    /** The viewer's list of homes: a home added, claimed, verified, left or deleted. */
    const val HOMES = "homes"
}

/** The store's keys, one per endpoint and parameters it caches, with their kind and change topics (contract §4, §8). */
object StoreKeys {
    /** My Homes: one source for every screen that lists the viewer's homes. */
    val myHomes = StoreKey<MyHomesResponse>("api/homes/my-homes", kind = StoreKind.HOMES, topics = setOf(StoreTopics.HOMES))

    /**
     * The sections the Today tab renders (contract §8 "Today on the phones"): weather and its sky, air, alerts, the
     * sun, "Good day to…", radon, the address calendar, the home and block for the sky drawing, and the ballot card.
     */
    val TODAY_SECTIONS: List<PlaceSectionId> =
        listOf(
            PlaceSectionId.WEATHER,
            PlaceSectionId.AIR_QUALITY,
            PlaceSectionId.ALERTS,
            PlaceSectionId.SUNRISE_SUNSET,
            PlaceSectionId.GOOD_DAY_TO,
            PlaceSectionId.LEAD_RADON,
            PlaceSectionId.ADDRESS_CALENDAR,
            PlaceSectionId.YOUR_HOME,
            PlaceSectionId.BLOCK_DENSITY,
            PlaceSectionId.CIVIC_ELECTION,
        )

    /** `?sections=` as the server reads it. */
    val todaySectionsQuery: String = TODAY_SECTIONS.joinToString(",") { it.raw }

    /** The viewer's notification and briefing preferences (their own settings). */
    val notificationPreferences =
        StoreKey<NotificationPreferences>("api/hub/preferences", kind = StoreKind.YOU, topics = setOf("profile:me"))

    /** Support Trains the viewer organizes or helps with (first page), for My trains and Invitations. */
    val mySupportTrains =
        StoreKey<SupportTrainsListResponse>(
            "api/activities/support-trains/me/support-trains",
            mapOf("limit" to "20", "offset" to "0"),
            kind = StoreKind.SUPPORT_TRAINS,
            topics = setOf("supporttrain:*"),
        )

    /** Support Trains near [latitude], [longitude] (rounded with [roundCoordinate] before they get here). */
    fun nearbySupportTrains(
        latitude: Double,
        longitude: Double,
    ) = StoreKey<SupportTrainsNearbyResponse>(
        "api/activities/support-trains/nearby",
        mapOf("latitude" to latitude.toString(), "longitude" to longitude.toString(), "limit" to "40"),
        kind = StoreKind.SUPPORT_TRAINS,
        topics = setOf("supporttrain:*"),
    )

    /** Three decimals (about 110 m): a key, and the request it names, for a nearby search. */
    fun roundCoordinate(value: Double): Double = kotlin.math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE

    private const val COORDINATE_SCALE = 1000.0

    /**
     * A home's Place for the viewer's role (the Place dashboard): every section, kind Place. A claim, verification or
     * household change marks it through `homes`, `home:` and `place:`.
     */
    fun place(homeId: String) =
        StoreKey<PlaceIntelligence>(
            "api/homes/$homeId/intelligence",
            mapOf("ballot" to "1"),
            kind = StoreKind.PLACE,
            topics = setOf("place:$homeId", "home:$homeId", StoreTopics.HOMES),
        )

    /** The bell's unread count (kind Notifications: fresh 30 seconds, never saved on the phone). */
    val notificationsUnreadCount =
        StoreKey<NotificationUnreadCountResponse>(
            "api/notifications/unread-count",
            kind = StoreKind.NOTIFICATIONS,
            topics = setOf(StoreTopics.NOTIFICATIONS),
        )

    /** The first page of one notifications list (a zone's context, all or unread); later pages are never stored. */
    fun notificationsFirstPage(
        limit: Int,
        unreadOnly: Boolean?,
        context: String?,
    ) = StoreKey<NotificationsListResponse>(
        "api/notifications",
        mapOf("limit" to "$limit", "offset" to "0", "unread" to unreadOnly?.toString(), "context" to context),
        kind = StoreKind.NOTIFICATIONS,
        topics = setOf(StoreTopics.NOTIFICATIONS),
    )

    /** A home's Today: [TODAY_SECTIONS] of its Place intelligence. */
    fun today(homeId: String) =
        StoreKey<PlaceIntelligence>(
            "api/homes/$homeId/intelligence",
            mapOf("ballot" to "1", "sections" to todaySectionsQuery),
            kind = StoreKind.TODAY,
            topics = setOf("today", "home:$homeId", "place:$homeId"),
        )
}
