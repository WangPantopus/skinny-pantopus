@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.widget

import app.pantopus.android.data.widget.TodayWidgetSnapshot
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * The one thing worth knowing, worked out when the widget is drawn (the day words are never stored):
 * a pickup today (until noon) or tomorrow, air at 101 or worse, the nearest other date, any pickup,
 * the air. Parity twin of iOS `TodayWidgetLine` in `TodayWidget.swift`.
 */
data class TodayWidgetLine(
    val headline: String,
    val caption: String?,
) {
    companion object {
        private val PICKUP_KINDS = listOf("garbage", "recycling", "yard_waste")

        fun pick(
            snapshot: TodayWidgetSnapshot,
            now: ZonedDateTime,
        ): TodayWidgetLine {
            val today = now.toLocalDate()
            val upcoming = snapshot.dates.filter { it.date >= today.toString() }.sortedBy { it.date }
            val pickups = upcoming.filter { it.kind in PICKUP_KINDS }
            return pickupLine(pickups, today, now.hour)
                ?: snapshot.air?.takeIf { it.aqi >= 101 }?.let { TodayWidgetLine("Air: ${it.label}", "AQI ${it.aqi}") }
                ?: upcoming.firstOrNull { it.kind !in PICKUP_KINDS }?.let { TodayWidgetLine(it.title, dayWords(it.date, today)) }
                ?: pickups.firstOrNull()?.let { next ->
                    TodayWidgetLine(names(pickups.filter { it.date == next.date }), dayWords(next.date, today))
                }
                ?: snapshot.air?.let { TodayWidgetLine("Air is ${it.label.lowercase()}", "AQI ${it.aqi}") }
                ?: TodayWidgetLine("All clear on ${snapshot.placeLabel}", null)
        }

        /** Pickup today until noon; tomorrow's becomes "Bins out tonight" from 5 pm. */
        private fun pickupLine(
            pickups: List<TodayWidgetSnapshot.DateItem>,
            today: LocalDate,
            hour: Int,
        ): TodayWidgetLine? {
            val todays = pickups.filter { it.date.startsWith(today.toString()) }
            if (hour < 12 && todays.isNotEmpty()) return TodayWidgetLine("${names(todays)} today", confirmed(todays, "Bins at the curb"))
            val tomorrows = pickups.filter { it.date.startsWith(today.plusDays(1).toString()) }
            if (tomorrows.isEmpty()) return null
            return if (hour >= 17) {
                TodayWidgetLine("Bins out tonight", confirmed(tomorrows, "${names(tomorrows)} tomorrow"))
            } else {
                TodayWidgetLine("${names(tomorrows)} tomorrow", confirmed(tomorrows, "Bins out tonight"))
            }
        }

        /** "Recycling and garbage", in calendar order. */
        private fun names(dates: List<TodayWidgetSnapshot.DateItem>): String {
            val kinds = dates.map { if (it.kind == "yard_waste") "yard waste" else it.kind }.distinct()
            val list = if (kinds.size <= 2) kinds.joinToString(" and ") else kinds.dropLast(1).joinToString(", ") + ", and " + kinds.last()
            return list.replaceFirstChar { it.uppercase() }
        }

        /** City defaults aren't the household's own pickup day yet. */
        private fun confirmed(
            dates: List<TodayWidgetSnapshot.DateItem>,
            caption: String,
        ): String = if (dates.all { it.scope == "home" }) caption else "$caption · Unconfirmed"

        /** "Tomorrow · Fri, Oct 23", "In 4 days · Fri, Oct 23". */
        private fun dayWords(
            key: String,
            today: LocalDate,
        ): String {
            val date = runCatching { LocalDate.parse(key.take(10)) }.getOrNull() ?: return key
            val days = ChronoUnit.DAYS.between(today, date)
            val whenText = date.format(DateTimeFormatter.ofPattern("EEE, MMM d", Locale.getDefault()))
            return when (days) {
                0L -> "Today"
                1L -> "Tomorrow · $whenText"
                else -> "In $days days · $whenText"
            }
        }
    }
}
