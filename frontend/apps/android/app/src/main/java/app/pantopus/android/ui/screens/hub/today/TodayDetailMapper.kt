@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.hub.today

import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.hub.BriefingDeliveryDto
import app.pantopus.android.data.api.models.hub.HubTodayPayload
import app.pantopus.android.data.api.models.hub.TodayAlertDto
import app.pantopus.android.data.api.models.hub.TodayAqiDto
import app.pantopus.android.data.api.models.hub.TodaySignalDto
import app.pantopus.android.data.api.models.hub.TodayWeatherDto
import app.pantopus.android.ui.components.InviteLinks
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/**
 * P1-F — projects the orchestrated `/api/hub/today` payload onto
 * [TodayDetailContent] (mirrors the iOS `TodayDetailViewModel` mapping). The
 * data-backed sections (kicker, weather hero, AQI chip, advisory ribbon,
 * Signals, Sun & sky) map from the response, and the Share card says what
 * Share sends; only the Around title comes from the [base] design placeholder
 * (the list itself stays empty).
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
        // Launch cut #7 (Household extras): bill-due and home-calendar signals are hidden.
        val rawSignals =
            (if (storedSignals.isEmpty()) (payload?.signals ?: emptyList()) else storedSignals)
                .filter { LaunchFeatures.householdExtras || it.kind !in HOUSEHOLD_EXTRAS_SIGNAL_KINDS }
        val signals = rawSignals.map { signal(it) }
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
            sunSky = sunSky(payload?.weather, payload?.location?.timezone, now),
            signalsTitle = if (signals.isEmpty()) "Signals" else "Signals · ${signals.size} today",
            signalsAccent = if (hasAlert) TodayTone.Error else TodayTone.Personal,
            signals = signals,
            aroundTitle = base.aroundTitle,
            around = emptyList(),
            share =
                TodayShareCard(
                    title = "Share today's briefing",
                    subtitle = SHARE_SUBTITLE,
                    message = shareMessage(payload, rawSignals),
                ),
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
        val zone = zoneFor(timezone)
        return now.atZone(zone).format(DateTimeFormatter.ofPattern("EEE · MMM d", Locale.US))
    }

    /** The Share card's line: what Share sends. */
    const val SHARE_SUBTITLE = "Send today's weather and signals to a neighbor"

    private const val MINUTES_PER_HOUR = 60
    private const val EARLY_MORNING_UNTIL = 8
    private const val MID_MORNING_UNTIL = 11
    private const val MIDDAY_UNTIL = 14
    private const val AFTERNOON_UNTIL = 17

    /**
     * "Sun & sky" from today's sunrise and sunset, in the place's timezone. Null when the
     * feed has no sun times, so the card is left out rather than showing made-up ones.
     */
    fun sunSky(
        weather: TodayWeatherDto?,
        timezone: String?,
        now: Instant,
    ): TodaySunSky? {
        val sunrise = parseInstant(weather?.sunriseUtc) ?: return null
        val sunset = parseInstant(weather?.sunsetUtc) ?: return null
        if (!sunset.isAfter(sunrise)) return null
        val zone = zoneFor(timezone)
        val clock = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
        val daylight = Duration.between(sunrise, sunset)
        val elapsed = Duration.between(sunrise, now).toMillis().toFloat() / daylight.toMillis()
        return TodaySunSky(
            progress = elapsed.coerceIn(0f, 1f),
            sunrise = sunrise.atZone(zone).format(clock),
            sunset = sunset.atZone(zone).format(clock),
            phaseLabel = phaseLabel(now, sunrise, sunset, zone),
            daylight = "${daylight.toHours()}h ${daylight.toMinutes() % MINUTES_PER_HOUR}m of daylight",
        )
    }

    /** Where the day is, by the place's clock: "Before sunrise", "Early morning" … "Evening", "After sunset". */
    fun phaseLabel(
        now: Instant,
        sunrise: Instant,
        sunset: Instant,
        zone: ZoneId,
    ): String {
        if (now.isBefore(sunrise)) return "Before sunrise"
        if (now.isAfter(sunset)) return "After sunset"
        val hour = now.atZone(zone).hour
        return when {
            hour < EARLY_MORNING_UNTIL -> "Early morning"
            hour < MID_MORNING_UNTIL -> "Mid-morning"
            hour < MIDDAY_UNTIL -> "Midday"
            hour < AFTERNOON_UNTIL -> "Afternoon"
            else -> "Evening"
        }
    }

    /**
     * Signal kinds about the place, which anyone nearby could know. The rest (bill_due, task_due, calendar,
     * mail, gig, and any kind this client doesn't know) are the viewer's own and never leave in a share.
     */
    private val SHAREABLE_SIGNAL_KINDS: Set<String?> =
        setOf("alert", "precipitation", "aqi", "temperature", "seasonal", "local_update", "address_calendar")

    /** Launch cut #7 (Household extras): signal kinds of bill management and the home calendar. */
    private val HOUSEHOLD_EXTRAS_SIGNAL_KINDS: Set<String?> = setOf("bill_due", "calendar")

    private const val SHARE_FALLBACK = "Today's Pantopus briefing — ${InviteLinks.DOWNLOAD_URL}"

    /**
     * What "Share today's briefing" sends: the weather, a public weather alert and place-level signals, with a
     * link to Pantopus. Never the place name (a location label can be an address), the summary line or a stored
     * briefing's text (both are composed from the viewer's own bills, tasks and mail), or a personal signal.
     */
    fun shareMessage(
        payload: HubTodayPayload?,
        signals: List<TodaySignalDto>,
    ): String {
        val weather = payload?.weather
        val parts =
            listOfNotNull(
                listOfNotNull(weather?.currentTempF?.let { temperature(weather) }, weather?.conditionLabel).joinToString(", "),
                highLow(weather),
                payload?.alerts?.firstOrNull()?.let { ribbon(it).title },
                signals.filter { it.kind in SHAREABLE_SIGNAL_KINDS }.mapNotNull { it.label }.joinToString(" · "),
            )
        val sentences = parts.map { it.trim('.', ' ') }.filter { it.isNotEmpty() }
        if (sentences.isEmpty()) return SHARE_FALLBACK
        return "Today's briefing: ${sentences.joinToString(". ")}.\nShared from Pantopus: ${InviteLinks.DOWNLOAD_URL}"
    }

    /** The share text for the screen's state: the prepared message, or just the link while loading or failed. */
    fun shareText(state: TodayDetailUiState): String {
        val content =
            when (state) {
                is TodayDetailUiState.Populated -> state.content
                is TodayDetailUiState.Alert -> state.content
                else -> null
            }
        return content?.share?.message?.ifBlank { null } ?: SHARE_FALLBACK
    }

    private fun parseInstant(iso: String?): Instant? = iso?.let { runCatching { Instant.parse(it) }.getOrNull() }

    private fun zoneFor(timezone: String?): ZoneId = timezone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()
}
