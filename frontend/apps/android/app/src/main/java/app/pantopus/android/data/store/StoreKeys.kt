package app.pantopus.android.data.store

import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeDetailResponse
import app.pantopus.android.data.api.models.homes.HomeOwnershipSecurityResponse
import app.pantopus.android.data.api.models.homes.HomePrivacyResponse
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.PropertyDetailsResponse
import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.support_trains.SupportTrainsListResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainsNearbyResponse

/** The store's keys, one per endpoint and parameters it caches, with their kind and change topics (contract §4, §8). */
object StoreKeys {
    /** My Homes: one source for every screen that lists the viewer's homes. */
    val myHomes = StoreKey<MyHomesResponse>("api/homes/my-homes", kind = StoreKind.HOMES, topics = setOf("homes"))

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

    /** A home's Today: [TODAY_SECTIONS] of its Place intelligence. */
    fun today(homeId: String) =
        StoreKey<PlaceIntelligence>(
            "api/homes/$homeId/intelligence",
            mapOf("ballot" to "1", "sections" to todaySectionsQuery),
            kind = StoreKind.TODAY,
            topics = setOf("today", "home:$homeId", "place:$homeId"),
        )

    /**
     * The viewer's access to a Home (role, permissions, expiry). Founder decision 3: decides who may see a Home
     * screen's stored copy (owners and household roles without an expiry).
     */
    fun homeAccess(homeId: String) =
        StoreKey<HomeDashboardAuthorityDto>(
            "api/homes/$homeId/dashboard-access",
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId", "homes"),
        )

    /** A Home as the viewer sees it. */
    fun homeDetail(homeId: String) =
        StoreKey<HomeDetailResponse>("api/homes/$homeId", kind = StoreKind.HOMES, topics = setOf("home:$homeId", "homes", "place:$homeId"))

    /** The viewer's effective permissions in a Home. */
    fun homeMe(homeId: String) = StoreKey<HomeAccessDto>("api/homes/$homeId/me", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's occupants and pending invitations. */
    fun homeOccupants(homeId: String) =
        StoreKey<OccupantsResponse>("api/homes/$homeId/occupants", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's privacy toggles. */
    fun homePrivacy(homeId: String) =
        StoreKey<HomePrivacyResponse>("api/homes/$homeId/privacy", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's ownership security policy. */
    fun homeSecurity(homeId: String) =
        StoreKey<HomeOwnershipSecurityResponse>("api/homes/$homeId/security", kind = StoreKind.HOMES, topics = setOf("home:$homeId"))

    /** A Home's property facts. */
    fun homePropertyDetails(homeId: String) =
        StoreKey<PropertyDetailsResponse>(
            "api/homes/$homeId/property-details",
            kind = StoreKind.HOMES,
            topics = setOf("home:$homeId", "place:$homeId"),
        )
}
