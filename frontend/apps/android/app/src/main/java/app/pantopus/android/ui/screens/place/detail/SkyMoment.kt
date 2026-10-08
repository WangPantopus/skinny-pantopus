@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import app.pantopus.android.data.api.models.place.WeatherConditionCode
import app.pantopus.android.ui.theme.SkyPalette
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.math.floor

/** Where the day is at this address: phase, how far the sun has travelled, the moon's phase. */
data class SkyMoment(
    val phase: SkyPalette.Phase,
    /** 0 at sunrise, 1 at sunset, clamped. */
    val dayFraction: Double,
    /** 11 pm to 5 am: only one window stays lit. */
    val lateNight: Boolean,
    /** 0 new moon, 0.5 full, back toward 1 at the next new moon. */
    val moonPhase: Double,
    /** Minutes past local midnight now, at sunrise and at sunset. */
    val minutes: Double,
    val sunrise: Double,
    val sunset: Double,
) {
    companion object {
        /**
         * Sunrise and sunset arrive as local wall-clock times ("2026-10-07T07:15") and can be a day
         * old just after midnight; only their clock times are used, which drift a couple of minutes a day.
         */
        fun at(
            now: ZonedDateTime,
            sunrise: String?,
            sunset: String?,
        ): SkyMoment {
            val minutes = now.hour * 60.0 + now.minute + now.second / 60.0
            var rise = clockMinutes(sunrise) ?: 390.0
            var set = clockMinutes(sunset) ?: 1110.0
            if (set <= rise) {
                rise = 390.0
                set = 1110.0
            }
            val phase =
                when {
                    minutes >= rise - 30 && minutes < rise + 40 -> SkyPalette.Phase.DAWN
                    minutes >= rise + 40 && minutes < set - 40 -> SkyPalette.Phase.DAY
                    minutes >= set - 40 && minutes < set + 30 -> SkyPalette.Phase.DUSK
                    else -> SkyPalette.Phase.NIGHT
                }
            return SkyMoment(
                phase = phase,
                dayFraction = ((minutes - rise) / (set - rise)).coerceIn(0.0, 1.0),
                lateNight = minutes >= 23 * 60 || minutes < 5 * 60,
                moonPhase = moonPhase(now.toInstant().toEpochMilli()),
                minutes = minutes,
                sunrise = rise,
                sunset = set,
            )
        }

        /** Minutes past midnight of a sunrise/sunset string; a zoned instant is read in the local zone. */
        fun clockMinutes(raw: String?): Double? {
            if (raw.isNullOrBlank()) return null
            val local =
                runCatching { LocalDateTime.parse(raw.take(16)) }.getOrNull()
                    ?.takeUnless { raw.length > 16 && raw.drop(16).any { it == 'Z' || it == '+' || it == '-' } }
                    ?: runCatching { OffsetDateTime.parse(raw).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime() }
                        .getOrNull()
                    ?: return null
            return local.hour * 60.0 + local.minute
        }

        /** The moon's age as a fraction of the 29.53-day synodic month, from the new moon of 6 January 2000. */
        fun moonPhase(epochMillis: Long): Double {
            val julianDay = epochMillis / 86_400_000.0 + 2_440_587.5
            val cycles = (julianDay - 2_451_550.1) / 29.530588853
            val fraction = cycles - floor(cycles)
            return if (fraction < 0) fraction + 1 else fraction
        }
    }
}

fun skyWeather(code: WeatherConditionCode): SkyPalette.Weather =
    when (code) {
        WeatherConditionCode.CLEAR, WeatherConditionCode.WIND -> SkyPalette.Weather.CLEAR
        WeatherConditionCode.PARTLY_CLOUDY -> SkyPalette.Weather.PARTLY
        WeatherConditionCode.CLOUDY, WeatherConditionCode.UNKNOWN -> SkyPalette.Weather.OVERCAST
        WeatherConditionCode.FOG -> SkyPalette.Weather.FOG
        WeatherConditionCode.RAIN, WeatherConditionCode.SLEET -> SkyPalette.Weather.WET
        WeatherConditionCode.SNOW -> SkyPalette.Weather.SNOW
        WeatherConditionCode.THUNDERSTORM -> SkyPalette.Weather.STORM
    }

/** The minute clock: the sky moves from day to dusk while the tab stays open. */
@Composable
fun rememberMinuteClock(): ZonedDateTime {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (isActive) {
            delay(60_000L - System.currentTimeMillis() % 60_000L)
            now = System.currentTimeMillis()
        }
    }
    return remember(now) { ZonedDateTime.ofInstant(Instant.ofEpochMilli(now), ZoneId.systemDefault()) }
}
