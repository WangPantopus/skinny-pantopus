@file:Suppress("PackageNaming", "LongParameterList")

package app.pantopus.android.ui.screens.hub.today

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A10.3 — render payloads for the Hub "Today" briefing. Pure value types so
 * the view-model can be fed deterministic stub data ([TodaySampleData]) and
 * every state snapshots reproducibly. Colour is a semantic [TodayTone]; the
 * screen maps tones → `PantopusColors` so the model stays free of UI types.
 */

/** Semantic colour role (foreground accent + pale tinted background). */
enum class TodayTone { Neutral, Personal, Home, Business, Success, Warning, Error }

/** A weather/air metric chip in the hero row (AQI · UV · Wind). */
data class TodayHeroChip(
    val icon: PantopusIcon,
    val label: String,
    val value: String,
    val scale: String? = null,
    val dotTone: TodayTone? = null,
)

/** Advisory ribbon shown under the hero headline in the alert state. */
data class TodayAlertRibbon(
    val title: String,
    val body: String,
)

/** "Sun & sky" arc data — [progress] is the sun's position in `0f..1f`. */
data class TodaySunSky(
    val progress: Float,
    val sunrise: String,
    val sunset: String,
    val phaseLabel: String,
    val daylight: String,
)

/** Optional severity pill + matching left-bar stripe on a signal. */
data class TodaySignalSeverity(
    val label: String,
    val tone: TodayTone,
)

/** A weather-driven signal row inside the Signals section. */
data class TodaySignal(
    val id: String,
    val icon: PantopusIcon,
    val tone: TodayTone,
    val title: String,
    val body: String,
    val timing: String,
    val severity: TodaySignalSeverity? = null,
)

/** A single "Around the block" datapoint (coloured dot + text). */
data class TodayAroundItem(
    val id: String,
    val tone: TodayTone,
    val text: String,
)

/** The trailing share card (quiet primary CTA for a read-mostly briefing). */
data class TodayShareCard(
    val title: String,
    val subtitle: String,
)

/** Full render payload for the Today detail screen. */
data class TodayDetailContent(
    val kicker: String,
    val dateLabel: String,
    val temperature: String,
    val condition: String,
    val highLowFeels: String,
    val glyph: PantopusIcon,
    val chips: List<TodayHeroChip>,
    val ribbon: TodayAlertRibbon?,
    val sunSky: TodaySunSky,
    val signalsTitle: String,
    val signalsAccent: TodayTone,
    val signals: List<TodaySignal>,
    val aroundTitle: String,
    val around: List<TodayAroundItem>,
    val share: TodayShareCard,
) {
    /** Advisory briefings select the alert state + alert-triangle kicker. */
    val isAlert: Boolean get() = ribbon != null
}

/**
 * Today always has weather data, so there is no `Empty` state — the advisory
 * variant ([Alert]) stands in for it.
 */
sealed interface TodayDetailUiState {
    data object Loading : TodayDetailUiState

    data class Populated(val content: TodayDetailContent) : TodayDetailUiState

    data class Alert(val content: TodayDetailContent) : TodayDetailUiState

    data class Error(val message: String) : TodayDetailUiState
}
