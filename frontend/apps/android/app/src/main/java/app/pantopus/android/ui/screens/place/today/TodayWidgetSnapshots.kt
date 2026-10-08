package app.pantopus.android.ui.screens.place.today

import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.widget.TodayWidgetSnapshot
import app.pantopus.android.ui.screens.place.detail.isLive
import app.pantopus.android.ui.screens.place.detail.section

/**
 * The "Today at your address" widget's snapshot from what the Today tab just loaded: the weather,
 * sun and air sections it showed and the address calendar's upcoming dates (live, or [fallback]).
 * Only the street name goes in, never the house number. Parity twin of iOS
 * `TodayWidgetSnapshot+Intel.swift`.
 */
fun PlaceIntelligence.todayWidgetSnapshot(
    fallback: PlaceAddressCalendarData? = null,
    nowEpochMs: Long = System.currentTimeMillis(),
): TodayWidgetSnapshot {
    val weather = section(PlaceSectionId.WEATHER)?.takeIf { it.isLive() }?.weather
    val airSection = section(PlaceSectionId.AIR_QUALITY)?.takeIf { it.isLive() }
    val sun = section(PlaceSectionId.SUNRISE_SUNSET)?.sunriseSunset
    val calendar = section(PlaceSectionId.ADDRESS_CALENDAR)?.takeIf { it.isLive() }?.addressCalendar ?: fallback
    val street = place.line1.trim()
    return TodayWidgetSnapshot(
        savedAtEpochMs = nowEpochMs,
        placeLabel = if (street.isEmpty()) place.city else TodayWidgetSnapshot.streetOnly(street),
        weather =
            weather?.let {
                TodayWidgetSnapshot.Weather(it.currentTempF, it.conditionCode.name.lowercase(), it.conditionLabel, it.highF, it.lowF)
            },
        sun = sun?.let { TodayWidgetSnapshot.Sun(it.sunrise, it.sunset) },
        air =
            airSection?.airQuality?.let {
                TodayWidgetSnapshot.Air(it.index, it.categoryLabel, airSection.source, smoky = it.dominantPollutant == "pm25")
            },
        dates = calendar?.upcoming.orEmpty().map { TodayWidgetSnapshot.DateItem(it.kind, it.title, it.date, it.scope) },
    )
}
