@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.hub.today

import app.pantopus.android.data.api.models.hub.HubTodayPayload
import app.pantopus.android.data.api.models.hub.TodayAlertDto
import app.pantopus.android.data.api.models.hub.TodayAqiDto
import app.pantopus.android.data.api.models.hub.TodayLocationDto
import app.pantopus.android.data.api.models.hub.TodaySignalDto
import app.pantopus.android.data.api.models.hub.TodayWeatherDto
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * P1-F — pure `HubTodayPayload → TodayDetailContent` projection (mirrors iOS
 * `TodayDetailMappingTests`).
 */
class TodayDetailMapperTest {
    private fun weather(
        temp: Double? = 67.0,
        code: String? = "clear",
        label: String? = "Mostly sunny",
        high: Double? = 74.0,
        low: Double? = 58.0,
    ) = TodayWeatherDto(currentTempF = temp, conditionCode = code, conditionLabel = label, highF = high, lowF = low)

    private fun payload(
        label: String? = "Elm Park",
        weather: TodayWeatherDto? = null,
        aqi: TodayAqiDto? = null,
        alerts: List<TodayAlertDto>? = emptyList(),
        signals: List<TodaySignalDto>? = emptyList(),
    ) = HubTodayPayload(
        location = TodayLocationDto(label = label, timezone = "America/New_York"),
        summary = "Mild.",
        weather = weather,
        aqi = aqi,
        alerts = alerts,
        signals = signals,
    )

    @Test
    fun maps_weather_and_aqi() {
        val content =
            TodayDetailMapper.fromPayload(
                payload(weather = weather(), aqi = TodayAqiDto(index = 42, category = "Good", isNoteworthy = false)),
            )
        assertEquals("Elm Park", content.kicker)
        assertEquals("67°", content.temperature)
        assertEquals("Mostly sunny", content.condition)
        assertEquals("High 74° · Low 58°", content.highLowFeels)
        assertEquals(1, content.chips.size)
        assertEquals("AQI", content.chips[0].label)
        assertEquals("42", content.chips[0].value)
        assertEquals(TodayTone.Success, content.chips[0].dotTone)
        assertFalse(content.isAlert)
    }

    @Test
    fun temperature_falls_back_when_missing() {
        val content = TodayDetailMapper.fromPayload(payload(weather = null))
        assertEquals("—°", content.temperature)
        assertTrue(content.chips.isEmpty())
    }

    @Test
    fun alert_selects_error_accent_and_snow_glyph() {
        val content =
            TodayDetailMapper.fromPayload(
                payload(
                    weather = weather(code = "freezing", label = "Hard freeze"),
                    alerts = listOf(TodayAlertDto(id = "a1", severity = "severe", title = "Hard-freeze warning")),
                ),
            )
        assertTrue(content.isAlert)
        assertEquals("Elm Park · Advisory", content.kicker)
        assertEquals(TodayTone.Error, content.signalsAccent)
        assertEquals("Hard-freeze warning", content.ribbon?.title)
        assertEquals(PantopusIcon.Snowflake, content.glyph)
    }

    @Test
    fun signals_map_with_icon_and_severity() {
        val content =
            TodayDetailMapper.fromPayload(
                payload(
                    signals =
                        listOf(
                            TodaySignalDto(kind = "rain", label = "Light shower", detail = "After 4pm", urgency = "low"),
                            TodaySignalDto(kind = "grid", label = "Grid strain", detail = "Reduce heat", urgency = "high"),
                        ),
                ),
            )
        assertEquals(2, content.signals.size)
        assertEquals("Signals · 2 today", content.signalsTitle)
        assertEquals(PantopusIcon.CloudRain, content.signals[0].icon)
        assertNull(content.signals[0].severity)
        assertEquals(PantopusIcon.Zap, content.signals[1].icon)
        assertEquals("High", content.signals[1].severity?.label)
    }

    @Test
    fun glyph_mapping() {
        assertEquals(PantopusIcon.CloudRain, TodayDetailMapper.glyph(weather(code = "rain", label = "Showers"), false))
        assertEquals(PantopusIcon.Sun, TodayDetailMapper.glyph(weather(code = "clear", label = "Sunny"), false))
        assertEquals(PantopusIcon.CloudSun, TodayDetailMapper.glyph(weather(code = "cloudy", label = "Overcast"), false))
    }

    @Test
    fun date_label_honours_timezone() {
        // 2026-05-19T17:00:00Z is 1pm EDT (Tuesday) in New York.
        val instant = Instant.parse("2026-05-19T17:00:00Z")
        assertEquals("Tue · May 19", TodayDetailMapper.dateLabel(instant, "America/New_York"))
    }
}
