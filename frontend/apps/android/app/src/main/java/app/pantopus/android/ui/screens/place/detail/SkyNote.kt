@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import app.pantopus.android.data.api.models.place.PlaceCalendarEvent
import app.pantopus.android.data.api.models.place.PlaceWeatherData
import app.pantopus.android.ui.theme.SkyPalette
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import kotlin.math.abs
import kotlin.math.roundToInt

/*
 * One true, timely line for the Now card ("🌕 FULL MOON TONIGHT" in place of
 * "NOW"), and the season for the tree in the scene. A note is shown only when
 * it is true for this address right now: the household's own pickup day, a
 * freezing forecast, a meteor shower's peak night, the moon's phase, a
 * solstice or equinox, the week's warmest day, golden hour.
 * Parity twin of iOS `TodaySkyNotes.swift`.
 */

data class SkyNote(
    val kind: Kind,
    /** Replaces "NOW" above the temperature. */
    val kicker: String,
    /** Said before the reading, e.g. "Full moon tonight." */
    val spoken: String,
    /** Bins the scene puts at the curb: "garbage", "recycling", "yard_waste". */
    val bins: List<String> = emptyList(),
) {
    enum class Kind {
        BINS_OUT,
        PICKUP_TODAY,
        FROST,
        BELOW_FREEZING,
        METEORS,
        FULL_MOON,
        NEW_MOON,
        LONGEST_DAY,
        SHORTEST_DAY,
        EQUINOX,
        WARMEST_DAY,
        GOLDEN_HOUR,
    }

    companion object {
        /** The most useful note for this moment, or null when nothing is worth saying. */
        fun pick(
            now: ZonedDateTime,
            moment: SkyMoment,
            weather: PlaceWeatherData,
            pickups: List<PlaceCalendarEvent>,
        ): SkyNote? {
            val sky = skyWeather(weather.conditionCode)
            val clear = sky == SkyPalette.Weather.CLEAR || sky == SkyPalette.Weather.PARTLY
            return bins(now, moment, pickups)
                ?: frost(weather, moment)
                ?: (if (clear) meteors(now, moment) else null)
                ?: moon(moment, clear)
                ?: solsticeOrEquinox(now)
                ?: warmest(now, weather, moment)
                ?: (if (clear) goldenHour(moment) else null)
        }

        private val PICKUP_KINDS = listOf("garbage", "recycling", "yard_waste")

        /**
         * The evening before a pickup (from 4 pm) and the pickup morning (until noon). Only days the
         * household set itself: city defaults are unconfirmed, the same rule the pickup reminders follow.
         */
        fun bins(
            now: ZonedDateTime,
            moment: SkyMoment,
            pickups: List<PlaceCalendarEvent>,
        ): SkyNote? {
            val evening = moment.minutes >= 16 * 60
            if (!evening && moment.minutes >= 12 * 60) return null
            val key = now.toLocalDate().plusDays(if (evening) 1 else 0).toString()
            val kinds =
                PICKUP_KINDS.filter { kind ->
                    pickups.any { it.kind == kind && it.scope == "home" && it.date.startsWith(key) }
                }
            if (kinds.isEmpty()) return null
            val names = kinds.map { if (it == "yard_waste") "yard waste" else it }
            val list = if (names.size <= 2) names.joinToString(" and ") else names.dropLast(1).joinToString(", ") + ", and " + names.last()
            val capitalized = list.replaceFirstChar { it.uppercase() }
            return if (evening) {
                SkyNote(Kind.BINS_OUT, "🗑️ BINS OUT TONIGHT", "Bins out tonight. $capitalized pickup tomorrow.", kinds)
            } else {
                SkyNote(Kind.PICKUP_TODAY, "🗑️ PICKUP TODAY", "$capitalized pickup today.", kinds)
            }
        }

        fun frost(
            weather: PlaceWeatherData,
            moment: SkyMoment,
        ): SkyNote? {
            if (weather.currentTempF <= 32) return SkyNote(Kind.BELOW_FREEZING, "❄️ BELOW FREEZING", "Below freezing now.")
            // From mid-afternoon on: the next 14 hours dip to freezing.
            val low =
                weather.hourly
                    .take(14)
                    .minOfOrNull { it.tempF }
                    ?.takeIf { moment.minutes >= 15 * 60 && it <= 32 } ?: return null
            return SkyNote(Kind.FROST, "❄️ FROST TONIGHT", "Frost likely tonight, down to ${low.roundToInt()}°.")
        }

        /** The major showers' peak nights, by the date the night starts (the night of D into D + 1). */
        private val SHOWERS =
            listOf(
                Triple(1, 3, "Quadrantid"),
                Triple(4, 21, "Lyrid"),
                Triple(5, 5, "Eta Aquariid"),
                Triple(8, 12, "Perseid"),
                Triple(10, 20, "Orionid"),
                Triple(11, 16, "Leonid"),
                Triple(12, 13, "Geminid"),
            )

        fun meteors(
            now: ZonedDateTime,
            moment: SkyMoment,
        ): SkyNote? {
            if (moment.phase != SkyPalette.Phase.NIGHT) return null
            val night = now.toLocalDate().minusDays(if (moment.minutes >= 12 * 60) 0 else 1)
            val shower = SHOWERS.firstOrNull { it.first == night.monthValue && it.second == night.dayOfMonth } ?: return null
            return SkyNote(Kind.METEORS, "🌠 METEORS TONIGHT", "The ${shower.third} meteor shower peaks tonight.")
        }

        /** Within half a day of full (or new): the moon looks full all night. */
        private const val HALF_DAY = 0.5 / 29.530588853

        fun moon(
            moment: SkyMoment,
            clear: Boolean,
        ): SkyNote? {
            if (abs(moment.moonPhase - 0.5) <= HALF_DAY) return SkyNote(Kind.FULL_MOON, "🌕 FULL MOON TONIGHT", "Full moon tonight.")
            val newMoon = moment.moonPhase <= HALF_DAY || moment.moonPhase >= 1 - HALF_DAY
            if (clear && moment.phase == SkyPalette.Phase.NIGHT && newMoon) {
                return SkyNote(Kind.NEW_MOON, "🌑 NEW MOON TONIGHT", "New moon tonight: a dark sky for stars.")
            }
            return null
        }

        /** March equinox, June solstice, September equinox, December solstice (UTC). */
        private val TURNING_POINTS =
            listOf(
                "2026-03-20T14:46:00Z", "2026-06-21T08:24:00Z", "2026-09-23T00:05:00Z", "2026-12-21T20:50:00Z",
                "2027-03-20T20:25:00Z", "2027-06-21T14:11:00Z", "2027-09-23T06:01:00Z", "2027-12-22T02:42:00Z",
                "2028-03-20T02:17:00Z", "2028-06-20T20:02:00Z", "2028-09-22T11:45:00Z", "2028-12-21T08:20:00Z",
                "2029-03-20T08:02:00Z", "2029-06-21T01:48:00Z", "2029-09-22T17:38:00Z", "2029-12-21T14:14:00Z",
                "2030-03-20T13:51:00Z", "2030-06-21T07:31:00Z", "2030-09-22T23:27:00Z", "2030-12-21T20:09:00Z",
            )

        fun solsticeOrEquinox(now: ZonedDateTime): SkyNote? {
            val today = now.toLocalDate()
            val index =
                TURNING_POINTS.indexOfFirst {
                    Instant.parse(it).atZone(now.zone).toLocalDate() == today
                }
            return when {
                index < 0 -> null
                index % 4 == 1 -> SkyNote(Kind.LONGEST_DAY, "☀️ LONGEST DAY", "The longest day of the year.")
                index % 4 == 3 ->
                    SkyNote(Kind.SHORTEST_DAY, "🌗 SHORTEST DAY", "The shortest day of the year. Days get longer from tomorrow.")
                else -> SkyNote(Kind.EQUINOX, "🌗 EQUINOX TODAY", "Equinox: day and night are about equal.")
            }
        }

        fun warmest(
            now: ZonedDateTime,
            weather: PlaceWeatherData,
            moment: SkyMoment,
        ): SkyNote? {
            val today = weather.daily.firstOrNull() ?: return null
            val next = weather.daily.drop(1).maxOfOrNull { it.highF } ?: return null
            val fits =
                moment.phase != SkyPalette.Phase.NIGHT && weather.daily.size >= 4 &&
                    today.date.startsWith(now.toLocalDate().toString()) && today.highF >= 70 && today.highF >= next + 2
            if (!fits) return null
            return SkyNote(
                Kind.WARMEST_DAY,
                "🌡️ WARMEST THIS WEEK",
                "The warmest day this week, up to ${today.highF.roundToInt()}°.",
            )
        }

        /** The hour before sunset, announced from an hour and a half ahead. */
        fun goldenHour(moment: SkyMoment): SkyNote? {
            val start = moment.sunset - 60
            return when {
                moment.minutes >= start - 90 && moment.minutes < start -> {
                    val time = clockText(start)
                    SkyNote(Kind.GOLDEN_HOUR, "🌇 GOLDEN HOUR $time", "Golden hour starts at $time.")
                }
                moment.minutes >= start && moment.minutes < moment.sunset ->
                    SkyNote(Kind.GOLDEN_HOUR, "🌇 GOLDEN HOUR NOW", "It's golden hour.")
                else -> null
            }
        }

        /** "5:38 PM" for minutes past local midnight, in the person's own clock style. */
        fun clockText(minutes: Double): String =
            LocalTime
                .ofSecondOfDay((minutes * 60).toLong().coerceIn(0L, 86_399L))
                .format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT))
    }
}

/** Northern-hemisphere seasons as a tree shows them: blossom, leaf, colour, bare. */
enum class SkySeason {
    SPRING,
    SUMMER,
    AUTUMN,
    WINTER,
    ;

    companion object {
        fun at(date: LocalDate = LocalDate.now(ZoneId.systemDefault())): SkySeason =
            when (date.monthValue * 100 + date.dayOfMonth) {
                in 315 until 516 -> SPRING
                in 516 until 915 -> SUMMER
                in 915 until 1201 -> AUTUMN
                else -> WINTER
            }
    }
}
