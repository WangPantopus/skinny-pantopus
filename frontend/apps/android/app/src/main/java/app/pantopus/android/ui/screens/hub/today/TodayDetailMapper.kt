@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.hub.today

import app.pantopus.android.data.api.models.hub.BriefingDeliveryDto
import app.pantopus.android.data.api.models.hub.HubTodayPayload
import app.pantopus.android.data.api.models.hub.TodayAlertDto
import app.pantopus.android.data.api.models.hub.TodayAqiDto
import app.pantopus.android.data.api.models.hub.TodaySignalDto
import app.pantopus.android.data.api.models.hub.TodayWeatherDto
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/**
 * P1-F — projects the orchestrated `/api/hub/today` payload onto
 * [TodayDetailContent] (mirrors the iOS `TodayDetailViewModel` mapping). The
 * data-backed sections (kicker, weather hero, AQI chip, advisory ribbon,
 * Signals) map from the response; the decorative sun-arc + Share card have no
 * backend field, so they fall back to the [base] design placeholder.
 */
@Suppress("TooManyFunctions")
object TodayDetailMapper {
    /**
     * When [briefing] is present (a push tap carrying
     * `metadata.briefing_delivery_id`), its stored `summary_text` and
     * `signals_snapshot` take precedence over the live Today snapshot — the
     * same precedence RN applies in `hub-today.tsx:87`.
     */
    fun fromPayload(
        payload: HubTodayPayload?,
        briefing: BriefingDeliveryDto? = null,
        now: Instant = Instant.now(),
        base: TodayDetailContent = TodaySampleData.populated,
    ): TodayDetailContent {
        val alerts = payload?.alerts ?: emptyList()
        val hasAlert = alerts.isNotEmpty()
        val storedSignals = briefing?.signalsSnapshot ?: emptyList()
        val signals =
            (if (storedSignals.isEmpty()) (payload?.signals ?: emptyList()) else storedSignals)
                .map { signal(it) }
        val label = payload?.location?.label ?: "Today"
        val storedSummary = briefing?.summaryText?.takeIf { it.isNotEmpty() }
        return TodayDetailContent(
            kicker = if (hasAlert) "$label · Advisory" else label,
            dateLabel = dateLabel(now, payload?.location?.timezone),
            temperature = temperature(payload?.weather),
            condition = storedSummary ?: payload?.weather?.conditionLabel ?: payload?.summary ?: "—",
            highLowFeels = highLow(payload?.weather),
            glyph = glyph(payload?.weather, hasAlert),
            chips = listOfNotNull(aqiChip(payload?.aqi)),
            ribbon = if (hasAlert) ribbon(alerts.first()) else null,
            sunSky = base.sunSky,
            signalsTitle = if (signals.isEmpty()) "Signals" else "Signals · ${signals.size} today",
            signalsAccent = if (hasAlert) TodayTone.Error else TodayTone.Personal,
            signals = signals,
            aroundTitle = base.aroundTitle,
            around = emptyList(),
            share = base.share,
        )
    }

    fun temperature(weather: TodayWeatherDto?): String {
        val temp = weather?.currentTempF ?: return "—°"
        return "${temp.roundToInt()}°"
    }

    fun highLow(weather: TodayWeatherDto?): String {
        if (weather == null) return ""
        val parts = mutableListOf<String>()
        weather.highF?.let { parts.add("High ${it.roundToInt()}°") }
        weather.lowF?.let { parts.add("Low ${it.roundToInt()}°") }
        if (weather.precipitationNext6h == true) parts.add("Rain likely")
        return parts.joinToString(" · ")
    }

    fun aqiChip(aqi: TodayAqiDto?): TodayHeroChip? {
        val index = aqi?.index ?: return null
        return TodayHeroChip(
            icon = PantopusIcon.Leaf,
            label = "AQI",
            value = index.toString(),
            scale = aqi.category,
            dotTone = if (aqi.isNoteworthy == true) TodayTone.Warning else TodayTone.Success,
        )
    }

    fun ribbon(alert: TodayAlertDto): TodayAlertRibbon {
        val body =
            alert.severity?.let { sev -> "${sev.replaceFirstChar { it.uppercase() }} advisory in effect." }
                ?: "Advisory in effect."
        return TodayAlertRibbon(title = alert.title ?: "Weather advisory", body = body)
    }

    fun signal(dto: TodaySignalDto): TodaySignal =
        TodaySignal(
            id = dto.kind ?: dto.label ?: "signal",
            icon = signalIcon(dto.kind, dto.label),
            tone = signalTone(dto.urgency),
            title = dto.label ?: "Update",
            body = dto.detail ?: "",
            timing = "",
            severity = signalSeverity(dto.urgency),
        )

    @Suppress("CyclomaticComplexMethod")
    fun glyph(
        weather: TodayWeatherDto?,
        hasAlert: Boolean,
    ): PantopusIcon {
        val needle = "${weather?.conditionCode ?: ""} ${weather?.conditionLabel ?: ""}".lowercase()
        return when {
            needle.contains("snow") || needle.contains("freez") || needle.contains("sleet") || needle.contains("ice") ->
                PantopusIcon.Snowflake
            needle.contains("rain") || needle.contains("shower") || needle.contains("drizzl") ->
                PantopusIcon.CloudRain
            needle.contains("thunder") || needle.contains("storm") -> PantopusIcon.Zap
            needle.contains("wind") -> PantopusIcon.Wind
            needle.contains("cloud") || needle.contains("fog") || needle.contains("haze") || needle.contains("overcast") ->
                PantopusIcon.CloudSun
            needle.contains("clear") || needle.contains("sun") -> PantopusIcon.Sun
            hasAlert -> PantopusIcon.AlertTriangle
            else -> PantopusIcon.CloudSun
        }
    }

    @Suppress("CyclomaticComplexMethod")
    private fun signalIcon(
        kind: String?,
        label: String?,
    ): PantopusIcon {
        val needle = "${kind ?: ""} ${label ?: ""}".lowercase()
        return when {
            needle.contains("grid") || needle.contains("power") || needle.contains("energy") -> PantopusIcon.Zap
            needle.contains("rain") || needle.contains("precip") || needle.contains("storm") -> PantopusIcon.CloudRain
            needle.contains("pollen") || needle.contains("allerg") -> PantopusIcon.Flower
            needle.contains("freez") || needle.contains("snow") || needle.contains("cold") -> PantopusIcon.Snowflake
            needle.contains("air") || needle.contains("aqi") || needle.contains("smoke") -> PantopusIcon.Leaf
            needle.contains("transit") || needle.contains("commute") || needle.contains("traffic") -> PantopusIcon.Bus
            needle.contains("heat") || needle.contains("uv") || needle.contains("sun") -> PantopusIcon.SunDim
            needle.contains("water") || needle.contains("hydrat") -> PantopusIcon.Droplets
            else -> PantopusIcon.Info
        }
    }

    private fun signalTone(urgency: String?): TodayTone =
        when (urgency?.lowercase()) {
            "critical", "severe", "extreme" -> TodayTone.Error
            "high", "moderate", "warning", "watch" -> TodayTone.Warning
            "low", "info" -> TodayTone.Neutral
            else -> TodayTone.Personal
        }

    private fun signalSeverity(urgency: String?): TodaySignalSeverity? =
        when (urgency?.lowercase()) {
            "critical", "severe", "extreme" -> TodaySignalSeverity("Critical", TodayTone.Error)
            "high", "warning" -> TodaySignalSeverity("High", TodayTone.Warning)
            "watch" -> TodaySignalSeverity("Watch", TodayTone.Warning)
            else -> null
        }

    fun dateLabel(
        now: Instant,
        timezone: String?,
    ): String {
        val zone = timezone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()
        return now.atZone(zone).format(DateTimeFormatter.ofPattern("EEE · MMM d", Locale.US))
    }
}
