package app.pantopus.android.data.store

import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionId

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

    /** A home's Today: [TODAY_SECTIONS] of its Place intelligence. */
    fun today(homeId: String) =
        StoreKey<PlaceIntelligence>(
            "api/homes/$homeId/intelligence",
            mapOf("ballot" to "1", "sections" to todaySectionsQuery),
            kind = StoreKind.TODAY,
            topics = setOf("today", "home:$homeId", "place:$homeId"),
        )
}
