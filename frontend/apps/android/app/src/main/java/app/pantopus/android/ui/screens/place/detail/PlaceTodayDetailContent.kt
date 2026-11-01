@file:Suppress("TooManyFunctions")

package app.pantopus.android.ui.screens.place.detail

import android.net.Uri
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.ai.RadonReportReading
import app.pantopus.android.data.analytics.PilotEvents
import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.place.AirQualityCategory
import app.pantopus.android.data.api.models.place.BallotGovernments
import app.pantopus.android.data.api.models.place.GoodDayVerdict
import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.PlaceAirQualityData
import app.pantopus.android.data.api.models.place.PlaceCalendarEvent
import app.pantopus.android.data.api.models.place.PlaceGoodDayTile
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceLeadRadonData
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.data.api.models.place.PlaceWeatherAlert
import app.pantopus.android.data.api.models.place.PlaceWeatherDay
import app.pantopus.android.data.api.models.place.WeatherAlertSeverity
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.homes.HomeTaskEditPatch
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.screens.ballot.BallotGovernmentsSheet
import app.pantopus.android.ui.screens.ballot.BallotPlacement
import app.pantopus.android.ui.screens.ballot.BallotTodayCard
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskCreationFactory
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.components.placeSurface
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import timber.log.Timber
import java.math.BigDecimal
import java.math.RoundingMode
import java.net.HttpURLConnection.HTTP_FORBIDDEN
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

/** Above this font scale, rows that share a line with actions stack instead. */
private const val LARGE_TEXT_SCALE = 1.3f

private const val RADON_MORNING_HOUR = 9
private const val RADON_REMINDER_DAYS = 14L
private const val RADON_DISMISS_DAYS = 30L

/** The EPA's action level for radon, and the level from which it suggests considering a fix. */
private const val RADON_ACTION_LEVEL_PCI = 4.0
private const val RADON_CONSIDER_LEVEL_PCI = 2.0
private const val RADON_ACTION_LEVEL_URL = "https://www.epa.gov/radon/what-epas-action-level-radon-and-what-does-it-mean"

/**
 * What the radon and first-use cards last knew, per home, for one screen's lifetime: a card built again (coming back
 * to the tab, the app returning from the background) starts from it while it is read again, so it doesn't grow from
 * "One thing…" to "Two things…" a moment after showing.
 */
class RadonTodayMemory {
    internal val byHome = mutableMapOf<String, RadonSnapshot>()

    /** Reads Today forced (pull to refresh, Retry): each one reads the household's tasks again as well. */
    var forcedReads by mutableIntStateOf(0)
        private set

    fun readAgain() {
        forcedReads++
    }
}

internal data class RadonSnapshot(
    val task: HomeTaskDto?,
    val canCreate: Boolean,
    val loaded: Boolean,
    val firstUseDismissed: Boolean,
    val dismissedUntil: Long,
    /** When the tasks were read (wall clock). */
    val readAt: Long,
)

/** Contract §4 "Homes and household": a household's tasks are fresh for 2 minutes. */
private const val RADON_TASKS_FRESH_MS = 2 * 60 * 1000L

/** How current the alert check on screen is (contract §4, Today alerts). */
enum class TodayAlertsCheck {
    /** Checked within the last 30 minutes: show the alerts, or the all-clear. */
    CURRENT,

    /** Older, and being read again now. */
    CHECKING,

    /** Older, and the last read failed: never shown as "no alerts". */
    UNAVAILABLE,
}

/** What only the Today tab adds to the shared content: the agenda's household and plan rows, Plans, Ask. */
data class TodayTabParts(
    val tasks: List<HomeTaskDto> = emptyList(),
    val plans: List<Pair<PlanDto, Boolean>> = emptyList(),
    val actions: AgendaActions = AgendaActions(),
    /** Today's plan cards (A1, A2, A5), shown inside "Coming up at home". */
    val plansBlock: (@Composable () -> Unit)? = null,
    /** A saved place's "Get reminders for this address" step: Add your home. */
    val onAddHome: (() -> Unit)? = null,
    val onAsk: (() -> Unit)? = null,
)

/**
 * [onOpenBallot] takes the Ballot P0 card's "Open your ballot" to the
 * Place card; without it the button is left out. [alertsCheck] replaces the
 * alerts with an honest line once the check on screen is out of date.
 * The order is the TPR brief's (section 5): what matters now, what is coming
 * up, then optional setup and every full card and source, folded.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
@Suppress("LongParameterList", "LongMethod")
fun PlaceTodayDetailContent(
    intel: PlaceIntelligence,
    viewModel: AddressCalendarActions? = null,
    radonFactory: HomeTaskCreationFactory? = null,
    pilotEvents: PilotEvents? = null,
    radonContext: (suspend () -> Unit)? = null,
    onOpenBallot: (() -> Unit)? = null,
    alertsCheck: TodayAlertsCheck = TodayAlertsCheck.CURRENT,
    radonMemory: RadonTodayMemory? = null,
    tab: TodayTabParts = TodayTabParts(),
) {
    val homeState =
        if (radonFactory != null && pilotEvents != null && radonContext != null) {
            rememberHomeTodayState(intel, viewModel, radonFactory, pilotEvents, radonContext, radonMemory)
        } else {
            null
        }
    val zone = placeSkyZone(intel)
    val now = rememberMinuteClock(zone)
    val scope = rememberCoroutineScope()
    val targets = remember { TodayTargets() }
    var pickupOpenTrigger by remember(viewModel?.calendarHomeId) { mutableStateOf(0) }
    var calendarOpen by rememberSaveable(viewModel?.calendarHomeId) { mutableStateOf(false) }
    var conditionsOpen by rememberSaveable { mutableStateOf(false) }
    val calendarEnv = intel.section(PlaceSectionId.ADDRESS_CALENDAR)
    val shownCalendar = rememberShownCalendar(intel, calendarEnv, viewModel)
    val needsPickup = shownCalendar?.needsPickupDay == true && viewModel != null
    val alertsEnv = intel.section(PlaceSectionId.ALERTS)
    val active = alertsEnv?.alerts?.active?.takeIf { alertsCheck == TodayAlertsCheck.CURRENT && alertsEnv.isLive() }.orEmpty()
    val openPickup = {
        calendarOpen = true
        pickupOpenTrigger++
        scope.launch {
            withFrameNanos { }
            targets.calendar.bringIntoView()
        }
        Unit
    }

    fun openConditions(target: BringIntoViewRequester) {
        conditionsOpen = true
        scope.launch {
            withFrameNanos { }
            target.bringIntoView()
        }
    }

    // 3. What's in effect now, before anything else.
    TodayAdvisorySummary(active, alertsEnv?.source, now, Modifier.padding(bottom = 12.dp))
    // 4. The sky, the hours ahead, the source and Share.
    TodayWeatherSection(
        intel,
        shownCalendar?.upcoming.orEmpty(),
        active,
        now,
        onBins = {
            calendarOpen = true
            scope.launch {
                withFrameNanos { }
                targets.calendar.bringIntoView()
            }
        },
        onDetails = { openConditions(targets.conditions) },
    )
    // 5. Coming up at home, with the full calendar one tap away.
    val ballot = BallotPlacement.ballot(intel)
    val election = intel.section(PlaceSectionId.CIVIC_ELECTION)?.civicElection?.takeIf { ballot != null }?.let { it.name to it.date }
    val items =
        remember(shownCalendar, ballot, election, tab.tasks, tab.plans, now.toLocalDate()) {
            TodayAgenda.items(
                now.toLocalDate(),
                zone,
                shownCalendar,
                ballot?.card,
                election,
                tab.tasks,
                tab.plans,
                guest = intel.viewer?.role == "nonresident",
            )
        }
    var governments by remember { mutableStateOf<BallotGovernments?>(null) }
    // A place with no address calendar (a saved place) and nothing else coming shows no agenda; its plan cards stay.
    if (calendarEnv == null && items.isEmpty()) {
        tab.plansBlock?.invoke()
    } else {
        ComingUpAtHome(
            items = items,
            now = now,
            actions =
                tab.actions.copy(
                    onEditPickup = viewModel?.let { { openPickup() } },
                    onOpenBallot = onOpenBallot,
                    onOpenGovernments = { governments = it },
                ),
            calendarOpen = calendarOpen,
            onToggleCalendar = calendarEnv?.let { { calendarOpen = !calendarOpen } },
            unavailable = calendarEnv?.takeIf { shownCalendar == null }?.let { env -> { PlaceDetailFallbackCard(env) } },
            calendar = {
                Column(modifier = Modifier.bringIntoViewRequester(targets.calendar)) {
                    AddressCalendarSection(calendarEnv, shownCalendar, viewModel, pickupOpenTrigger)
                }
            },
            plans = tab.plansBlock,
        )
    }
    // 6. Air and daylight side by side; each opens its full card below.
    TodayAirDaylightPair(
        air = intel.section(PlaceSectionId.AIR_QUALITY),
        sun = intel.section(PlaceSectionId.SUNRISE_SUNSET),
        zone = intel.homeZone,
        onAir = { openConditions(targets.air) },
        onSun = { openConditions(targets.sun) },
    )
    // 7. Good day for…, with what the screen itself says could limit it.
    TodayGoodDaySection(intel, active, now)
    // 8. The ballot week card while the server says it applies (its next date is also an agenda row).
    BallotPlacement.today(intel)?.let { card ->
        BallotTodayCard(card = card, onOpenBallot = onOpenBallot, modifier = Modifier.padding(top = Spacing.s4))
    }
    // 10. Optional setup, folded: pickup days, radon, a saved place's reminders.
    TodayHomeSetup(homeState, intel, needsPickup, openPickup, tab.onAddHome)
    // 11. Every full card and source, folded.
    TodayFullConditions(intel, alertsCheck, shownCalendar, conditionsOpen, { conditionsOpen = !conditionsOpen }, targets, now)
    // 12. Ask, at the end.
    tab.onAsk?.let { TodayAskEntry("Ask Pantopus about today", it) }
    if (homeState?.sheet != null) RadonTaskSheet(homeState)
    governments?.let { BallotGovernmentsSheet(governments = it, address = intel.place.line1, onDismiss = { governments = null }) }
}

/** The server sends pollutant tokens ("pm25", "ozone"); show their usual names. */
private val POLLUTANT_NAMES = mapOf("pm25" to "PM2.5", "pm10" to "PM10", "ozone" to "Ozone", "no2" to "NO2", "so2" to "SO2", "co" to "CO")

@Composable
private fun AqiCard(data: PlaceAirQualityData) {
    val pollutant = data.dominantPollutant?.lowercase()?.takeIf { it.isNotEmpty() }?.let { POLLUTANT_NAMES[it] ?: it.uppercase() }
    PlaceDetailCard(modifier = Modifier.testTag("todayAqiCard")) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(
                modifier = Modifier.semantics(mergeDescendants = true) {},
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                TodayAqiGauge(data.index, data.category)
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(data.categoryLabel, fontSize = 18.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold, color = aqiColor(data))
                    Text("US Air Quality Index", fontSize = 12.5.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary)
                    pollutant?.let { Text("Mostly $it", fontSize = 12.5.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary) }
                }
            }
            Text(data.healthMessage, fontSize = 13.5.sp, lineHeight = 18.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

/** Every active alert in full, or "No active weather alerts" with when it was checked ([checkedAt], the place's clock). */
@Composable
private fun AlertsCard(
    active: List<PlaceWeatherAlert>,
    checkedAt: String?,
    source: String?,
    now: ZonedDateTime,
) {
    if (active.isEmpty()) {
        PlaceDetailCard(modifier = Modifier.testTag("todayAlertsNone")) {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                TodayAllClearBadge()
                Column {
                    Text("No active weather alerts", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                    checkedAt?.let { Text("Checked $it", fontSize = 13.sp, color = PantopusColors.appTextMuted) }
                }
            }
        }
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AlertWindow.ordered(active).forEach { AlertRow(it, source, now) }
        }
    }
}

/** An alert check past its max shown age: being read again, or "Alerts unavailable · Retry". */
@Composable
private fun AlertsOutOfDateCard(checking: Boolean) {
    val onRetry = LocalPlaceDetailRetry.current
    PlaceDetailCard(modifier = Modifier.testTag("todayAlertsOutOfDate")) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    if (checking) "Checking for alerts…" else "Alerts unavailable",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                Text(
                    if (checking) "The last check is more than 30 minutes old." else "Couldn't check for alerts just now.",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
            if (!checking && onRetry != null) {
                Text(
                    "Retry",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(role = Role.Button, onClick = onRetry)
                            .padding(horizontal = 10.dp, vertical = 12.dp),
                )
            }
        }
    }
}

@Composable
private fun AlertRow(
    alert: PlaceWeatherAlert,
    source: String?,
    now: ZonedDateTime,
) {
    val warn = alert.severity == WeatherAlertSeverity.WARNING
    val bg = if (warn) PantopusColors.errorBg else PantopusColors.warningBg
    val fg = if (warn) PantopusColors.error else PantopusColors.warning
    PlaceDetailCard(padding = 15.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Box(modifier = Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(bg), contentAlignment = Alignment.Center) {
                PantopusIconImage(PantopusIcon.TriangleAlert, null, size = 18.dp, strokeWidth = 2f, tint = fg)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(alert.event, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                val issuer = alert.senderName?.takeIf { it.isNotBlank() } ?: source?.takeIf { it.isNotBlank() }
                Text(
                    listOfNotNull(AlertWindow.text(alert, now), issuer).joinToString(" · "),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = fg,
                )
                if (alert.headline.isNotEmpty()) {
                    Text(alert.headline, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextStrong)
                }
                alert.area?.takeIf { it.isNotBlank() }?.let {
                    Text("Area: $it", fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
                }
                listOfNotNull(AlertWindow.issued(alert, now.zone), AlertWindow.span(alert, now)).forEach {
                    Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
                }
                val text = alert.originalText.ifBlank { alert.description }
                if (text.isNotEmpty()) {
                    Text(
                        text,
                        fontSize = 13.sp,
                        lineHeight = 18.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

private fun aqiColor(data: PlaceAirQualityData): Color =
    when (data.category) {
        app.pantopus.android.data.api.models.place.AirQualityCategory.GOOD -> PantopusColors.home
        app.pantopus.android.data.api.models.place.AirQualityCategory.MODERATE,
        app.pantopus.android.data.api.models.place.AirQualityCategory.UNHEALTHY_SENSITIVE,
        -> PantopusColors.warning
        app.pantopus.android.data.api.models.place.AirQualityCategory.UNHEALTHY,
        app.pantopus.android.data.api.models.place.AirQualityCategory.VERY_UNHEALTHY,
        app.pantopus.android.data.api.models.place.AirQualityCategory.HAZARDOUS,
        -> PantopusColors.error
        app.pantopus.android.data.api.models.place.AirQualityCategory.UNKNOWN -> PantopusColors.appTextSecondary
    }

/** Where "Weather details", the air and daylight sides and "Set pickup days" scroll to. */
@OptIn(ExperimentalFoundationApi::class)
private class TodayTargets {
    val calendar = BringIntoViewRequester()
    val conditions = BringIntoViewRequester()
    val air = BringIntoViewRequester()
    val sun = BringIntoViewRequester()
}

/**
 * The calendar Today shows: the section's when it is live, else the existing authorized calendar route's (the
 * section was unavailable), read once per Today copy and home.
 */
@Composable
private fun rememberShownCalendar(
    intel: PlaceIntelligence,
    env: PlaceSectionEnvelope?,
    viewModel: AddressCalendarActions?,
): PlaceAddressCalendarData? {
    var fallback by remember(intel.generatedAt, viewModel?.calendarHomeId) { mutableStateOf<PlaceAddressCalendarData?>(null) }
    LaunchedEffect(intel.generatedAt, env?.status, viewModel?.calendarHomeId) {
        if (env?.status == PlaceSectionStatus.UNAVAILABLE && viewModel != null) {
            fallback = viewModel.loadAddressCalendar()
        }
    }
    return env?.addressCalendar?.takeIf { env.isLive() } ?: fallback
}

/** The full two-week calendar (the agenda's second view): the strip, every date, the pickup schedule and its source. */
@Composable
private fun AddressCalendarSection(
    env: PlaceSectionEnvelope?,
    data: PlaceAddressCalendarData?,
    viewModel: AddressCalendarActions?,
    openTrigger: Int,
) {
    env ?: return
    Column(modifier = Modifier.padding(top = 4.dp)) {
        if (data != null) {
            AddressCalendarCard(data, viewModel, openTrigger)
            PlaceSourceNote(data.source ?: "Pantopus registry", "next ${data.windowDays} days")
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
}

@Composable
private fun TodayWeatherSection(
    intel: PlaceIntelligence,
    pickups: List<PlaceCalendarEvent>,
    active: List<PlaceWeatherAlert>,
    now: ZonedDateTime,
    onBins: () -> Unit,
    onDetails: () -> Unit,
) {
    val env = intel.section(PlaceSectionId.WEATHER) ?: return
    val data = env.weather
    if (data == null || !env.isLive()) {
        PlaceDetailFallbackCard(env)
        return
    }
    val sun = intel.section(PlaceSectionId.SUNRISE_SUNSET)?.sunriseSunset
    TodaySkyHero(
        data,
        sun,
        pickups,
        skyAir(intel),
        place =
            SkyPlace(
                home = intel.section(PlaceSectionId.YOUR_HOME)?.yourHome.let { SkyHome.of(it?.house, it?.homeType) },
                streetLights = SkyStreet.lights(intel.section(PlaceSectionId.BLOCK_DENSITY)?.blockDensity?.bucket?.name?.lowercase()),
                timeZone = now.zone,
            ),
        onBins = onBins,
    )
    TodayHourlyStrip(remember(data, active, sun, now) { hourlyCells(data, active, sun, now) }, Modifier.padding(top = 10.dp))
    val updated = PlacePresentation.fmtTime(env.asOf, intel.homeZone)?.let { "updated $it" }
    val source: @Composable () -> Unit = { PlaceSourceNote(env.source.orEmpty().ifBlank { "Source unavailable" }, updated) }
    val actions: @Composable () -> Unit = {
        TodayTextAction("Weather details", onClick = onDetails, modifier = Modifier.testTag("today.weatherDetails"))
        if (intel.place.city.isNotEmpty()) {
            SkyShareLink(SkyShareCard(data, sun, skyAir(intel), intel.place.city, ZonedDateTime.now(now.zone)))
        }
    }
    // At large text sizes the source takes its own line and the actions follow, so neither squeezes to a letter a line.
    if (LocalDensity.current.fontScale > LARGE_TEXT_SCALE) {
        Column(modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
            source()
            Row(verticalAlignment = Alignment.CenterVertically) { actions() }
        }
    } else {
        Row(modifier = Modifier.fillMaxWidth().padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.weight(1f)) { source() }
            actions()
        }
    }
}

/** "Good day for…" as a list, each verdict beside what the screen itself shows could limit it. */
@Composable
private fun TodayGoodDaySection(
    intel: PlaceIntelligence,
    active: List<PlaceWeatherAlert>,
    now: ZonedDateTime,
) {
    val env = intel.section(PlaceSectionId.GOOD_DAY_TO) ?: return
    val data = env.goodDayTo
    // Deliberately silent when there is nothing to answer: an empty verdict list is worse than none.
    if (data == null || !env.isLive() || data.tiles.isEmpty()) return
    val advisories =
        active.filter { AlertWindow.coversToday(it, now) }
            .map { "${it.event} ${AlertWindow.text(it, now).replaceFirstChar { c -> c.lowercase() }}" }
    val air =
        intel.section(PlaceSectionId.AIR_QUALITY)?.takeIf { it.isLive() }?.airQuality
            ?.takeIf { it.category != AirQualityCategory.GOOD && it.category != AirQualityCategory.UNKNOWN }
            ?.let { "${it.categoryLabel.lowercase()} air (${it.index})" }
    TodaySectionHead("Good day for…")
    TodayGoodDayList(data.tiles, limits = { tile -> goodDayLimits(tile, advisories, air) })
    PlaceSourceNote("Derived from today's conditions", PlacePresentation.fmtTime(env.asOf, intel.homeZone))
}

/**
 * What could limit a "yes" or "careful", from what Today itself shows (TPR brief 5.7): an advisory covering part of the
 * rest of the day, and moderate or worse air. A "no" needs no warning.
 */
private fun goodDayLimits(
    tile: PlaceGoodDayTile,
    advisories: List<String>,
    air: String?,
): List<String> =
    if (tile.verdict == GoodDayVerdict.NO || tile.verdict == GoodDayVerdict.UNKNOWN) emptyList() else advisories + listOfNotNull(air)

@Composable
private fun TodayGoodDayList(
    tiles: List<PlaceGoodDayTile>,
    limits: (PlaceGoodDayTile) -> List<String>,
) {
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    Column(modifier = Modifier.fillMaxWidth().placeSurface().padding(horizontal = 14.dp).testTag("today.goodDay")) {
        tiles.forEachIndexed { index, tile ->
            if (index > 0) TodayHairline()
            GoodDayListRow(tile, limits(tile), open = openId == tile.id) { openId = if (openId == tile.id) null else tile.id }
        }
    }
}

@Composable
private fun GoodDayListRow(
    tile: PlaceGoodDayTile,
    limits: List<String>,
    open: Boolean,
    onToggle: () -> Unit,
) {
    val tone = goodDayVerdictColors(tile.verdict)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClickLabel = if (open) "Hide why" else "Why") { onToggle() }
                .semantics(mergeDescendants = true) {
                    contentDescription = "${tile.label}: ${tile.answer}" + limits.joinToString("") { ". $it" }
                    stateDescription = if (open) "Expanded" else "Collapsed"
                }.heightIn(min = 56.dp)
                .animateContentSize()
                .padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(tone.second), contentAlignment = Alignment.Center) {
                Text(tile.glyph, fontSize = (18 / LocalDensity.current.fontScale).sp)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(tile.label, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(tile.answer, fontSize = 13.5.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium, color = tone.first)
            }
            PantopusIconImage(
                if (open) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                null,
                size = 16.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        // One line, as on iPhone: "Dense Fog Advisory until 10 AM · moderate air (76)".
        if (limits.isNotEmpty()) {
            Row(modifier = Modifier.padding(start = 48.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PantopusIconImage(PantopusIcon.TriangleAlert, null, size = 13.dp, tint = PantopusColors.warning)
                Text(limits.joinToString(" · "), fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
            }
        }
        if (open) {
            Text(
                tile.because,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.padding(start = 48.dp),
            )
        }
    }
}

// ─── The address calendar (Wedge v2 D6) ──────────────────────
// Pickup days, tax dates, council meetings — the reason Today earns a
// tab. The one thing the resident must tell us is the pickup day;
// everything else comes from the registry. Parity twin of the iOS
// `AddressCalendarCard`.

@Composable
@Suppress("CyclomaticComplexMethod")
private fun AddressCalendarCard(
    data: PlaceAddressCalendarData,
    viewModel: AddressCalendarActions?,
    openTrigger: Int = 0,
) {
    // The editor opens on demand ("Set pickup days", the schedule toggle), never by itself; a save closes it.
    var picking by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(data.pickupVersion) { picking = false }
    LaunchedEffect(openTrigger) { if (openTrigger > 0) picking = true }
    val busy = viewModel?.calendarBusy?.collectAsStateWithLifecycle()?.value ?: false
    val errorText = viewModel?.calendarError?.collectAsStateWithLifecycle()?.value
    Column(
        modifier = Modifier.fillMaxWidth().placeCard().padding(16.dp).testTag("place.today.addressCalendar"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        CalendarHeader(windowDays = data.windowDays, picking = picking, canPick = viewModel != null) { if (!busy) picking = !picking }
        // A tapped day shows only its dates; "Show every date" (or the day again) brings them all back.
        var selectedDay by rememberSaveable(data.today) { mutableStateOf<String?>(null) }
        if (!picking && data.upcoming.isNotEmpty()) {
            TodayCalendarStrip(
                data.today,
                data.windowDays,
                data.upcoming,
                selected = selectedDay?.let { runCatching { LocalDate.parse(it) }.getOrNull() },
                onSelect = { selectedDay = it?.toString() },
            )
        }
        when {
            picking && viewModel != null -> PickupScheduleEditor(data, viewModel, busy)
            data.needsPickupDay && viewModel != null -> PickupPrompt { picking = true }
        }
        errorText?.let { Text(it, fontSize = 12.5.sp, color = PantopusColors.error) }
        val day = selectedDay.takeUnless { picking }
        val shown = data.upcoming.filter { day == null || it.date.startsWith(day) }
        if (day != null && shown.isEmpty()) {
            Text("Nothing on this day.", fontSize = 13.5.sp, lineHeight = 19.sp, color = PantopusColors.appTextSecondary)
        } else {
            UpcomingEvents(data.copy(upcoming = shown), canSetPickupDay = viewModel != null)
        }
        if (day != null) TodayTextAction("Show every date", onClick = { selectedDay = null })
        data.taxNote?.let {
            Text(
                it,
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("addressCalendar.taxNote"),
            )
        }
    }
    if (viewModel != null) PickupReminderPrimer(viewModel)
}

@Composable
private fun CalendarHeader(
    windowDays: Int,
    picking: Boolean,
    canPick: Boolean,
    onToggle: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            "NEXT $windowDays DAYS AT THIS ADDRESS",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        if (canPick) {
            Text(
                if (picking) "Cancel" else "Pickup schedule",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier = Modifier.clickable(onClick = onToggle).testTag("addressCalendarPickupToggle"),
            )
        }
    }
}

@Composable
private fun PickupPrompt(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.homeBg)
                .clickable(onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(PantopusIcon.Trash2, null, size = 18.dp, strokeWidth = 2f, tint = PantopusColors.home)
        Text(
            "Add your pickup schedule to your household calendar.",
            fontSize = 13.sp,
            lineHeight = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, strokeWidth = 2.25f, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun UpcomingEvents(
    data: PlaceAddressCalendarData,
    canSetPickupDay: Boolean,
) {
    val setupMessage = data.pickupSetupMessage.takeIf { canSetPickupDay }
    setupMessage?.let { message ->
        Text(message, fontSize = 13.5.sp, lineHeight = 19.sp, color = PantopusColors.appTextSecondary)
    }
    if (data.upcoming.isEmpty()) {
        if (setupMessage != null) return
        Text(
            "Nothing on the calendar for the next two weeks.",
            fontSize = 13.5.sp,
            lineHeight = 19.sp,
            color = PantopusColors.appTextSecondary,
        )
        return
    }
    data.upcoming.forEach { event ->
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f)) {
                Text(event.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                event.detail?.takeIf { it.isNotBlank() }?.let {
                    Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
                }
                event.holidayMoveLine?.let { Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary) }
                Text(
                    event.source.orEmpty().ifBlank { "Pantopus registry" } +
                        if (event.confidence == "unverified") " · unconfirmed, please double-check" else "",
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Text(
                PlacePresentation.daysUntilLabel(event.daysUntil),
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (event.daysUntil <= 1) PantopusColors.error else PantopusColors.appTextSecondary,
            )
        }
    }
}

// Home UI preferences are separate from credential and management-token stores. Sign-out clears
// them (AccountDeviceData), so one DataStore instance serves both.
internal val android.content.Context.homeTodayPreferences by preferencesDataStore(name = "home_today")

internal object RadonToday {
    fun selected(tasks: List<HomeTaskDto>): HomeTaskDto? {
        val newest =
            tasks.filter { it.details?.get("suggestion") == "radon_test" }
                .sortedByDescending { instant(it.createdAt) ?: Instant.MIN }
        return newest.firstOrNull { it.status in setOf("open", "in_progress") } ?: newest.firstOrNull { it.status == "done" }
    }

    fun instant(value: String?): Instant? = value?.let { runCatching { Instant.parse(it) }.getOrNull() }

    fun date(value: String?): LocalDate? =
        value?.let {
            runCatching { LocalDate.parse(it) }.getOrNull() ?: instant(it)?.atZone(ZoneId.systemDefault())?.toLocalDate()
        }

    fun dueAt(
        date: LocalDate,
        zone: ZoneId = ZoneId.systemDefault(),
    ): String = date.atTime(RADON_MORNING_HOUR, 0).atZone(zone).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)

    fun payload(
        tested: Boolean,
        date: LocalDate,
        hasDate: Boolean,
        result: String,
    ): CreateHomeTaskRequest {
        val details = mutableMapOf<String, Any?>("suggestion" to "radon_test")
        if (tested && hasDate) details["tested_on"] = date.toString()
        if (tested && result.isNotBlank()) {
            val value = checkNotNull(result.trim().toDoubleOrNull()) { "Enter a numeric result." }
            check(value.isFinite() && value >= 0) { "Enter a nonnegative result." }
            details["result_pci"] = value
        }
        return CreateHomeTaskRequest(
            taskType = "reminder",
            title = if (tested) "Radon test" else "Test for radon",
            description =
                if (tested) {
                    null
                } else {
                    "The EPA recommends testing every home. " +
                        "Short-term test kits are sold at hardware stores and online. https://www.epa.gov/radon"
                },
            dueAt = if (tested && !hasDate) null else dueAt(date),
            status = if (tested) "done" else null,
            details = details,
            visibility = "members",
        )
    }

    fun label(value: String?): String? = date(value)?.format(DateTimeFormatter.ofPattern("MMM d"))

    fun message(task: HomeTaskDto): String {
        if (task.status != "done") {
            val prefix = if (instant(task.dueAt)?.isBefore(Instant.now()) == true) "Radon test was due" else "Radon test on your list for"
            return label(task.dueAt)?.let { "$prefix $it" } ?: "Radon test on your list"
        }
        val tested = task.details?.get("tested_on") as? String
        val prefix = if (tested != null || task.title == "Radon test") "Radon tested" else "Radon test done"
        val value = if (prefix == "Radon tested") tested else task.completedAt
        val text = label(value)?.let { "$prefix $it" } ?: if (prefix == "Radon tested") "$prefix · date not recorded" else prefix
        val result = (task.details?.get("result_pci") as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 }
        return if (prefix == "Radon tested" && result != null) "$text · $result pCi/L" else text
    }

    /** What the result field shows for a read value: 5.2, 4.05, 0.4 (at most two decimals, with a "."). */
    fun plain(value: Double): String = BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString()

    /**
     * A result against the EPA's action level of 4.0 pCi/L, in the EPA's own terms: what it recommends at each
     * level, and nothing about health. Mirrors iOS `RadonToday.explanation`.
     */
    fun explanation(
        pci: Double,
        testKind: String? = null,
    ): String =
        when {
            pci >= RADON_ACTION_LEVEL_PCI ->
                "That's at or above the EPA's action level of 4.0 pCi/L. The EPA recommends fixing a home at this level." +
                    if (testKind == "long_term") "" else " After a short-term test, it recommends testing again to confirm first."
            pci >= RADON_CONSIDER_LEVEL_PCI ->
                "That's below the EPA's action level of 4.0 pCi/L. The EPA suggests considering a fix between 2 and 4 pCi/L."
            else -> "That's below the EPA's action level of 4.0 pCi/L."
        }
}

private class RadonTodayState(
    val homeId: String,
    private val factory: HomeTaskCreationFactory,
    parent: CoroutineScope,
    private val contextGuard: suspend () -> Unit,
    private val events: PilotEvents,
    private val preferences: DataStore<Preferences>,
    val hasRadon: Boolean,
    private val memory: RadonTodayMemory?,
    private val reportReader: (suspend (Uri) -> RadonReportReading?)?,
) {
    val lifetime = CoroutineScope(parent.coroutineContext + Job(parent.coroutineContext[Job]))
    private var active = true
    private val dispatchContext: suspend () -> Unit = {
        lifetime.coroutineContext.ensureActive()
        check(active)
        contextGuard()
    }
    private var coordinator = factory.create(homeId, lifetime, dispatchContext)
    var task by mutableStateOf<HomeTaskDto?>(null)
    var loaded by mutableStateOf(false)
    var canCreate by mutableStateOf(false)
    var busy by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var dismissedUntil by mutableStateOf(0L)
    var firstUseDismissed by mutableStateOf(false)
    var preferencesLoaded by mutableStateOf(false)
    var sheet by mutableStateOf<String?>(null)
    var selectedDate by mutableStateOf(LocalDate.now())
    var hasDate by mutableStateOf(false)
    var result by mutableStateOf("")
    var retained by mutableStateOf<CreateHomeTaskRequest?>(null)

    /** "Read a lab report" in the yes sheet: the reading, what it found, and the test kind it saw. */
    val readsReports get() = reportReader != null
    var readingReport by mutableStateOf(false)
    var reportMessage by mutableStateOf<String?>(null)
    var reportFailed by mutableStateOf(false)
    var reportTestKind by mutableStateOf<String?>(null)

    /** The person is in the camera or a picker opened from the sheet: pausing for it doesn't end the sheet. */
    var choosingReport = false

    /** The viewer can't read the household's tasks (e.g. a guest): the card isn't theirs to answer. */
    var noTaskAccess by mutableStateOf(false)

    init {
        // Start from what the card showed last time; load() reads it again.
        memory?.byHome?.get(homeId)?.let { last ->
            task = last.task
            canCreate = last.canCreate
            loaded = last.loaded
            firstUseDismissed = last.firstUseDismissed
            dismissedUntil = last.dismissedUntil
            preferencesLoaded = true
        }
    }

    private fun keepSnapshot(readAt: Long = memory?.byHome?.get(homeId)?.readAt ?: 0L) {
        memory?.byHome?.set(homeId, RadonSnapshot(task, canCreate, loaded, firstUseDismissed, dismissedUntil, readAt))
    }

    val hidden get() = noTaskAccess || (task == null && dismissedUntil > Instant.now().toEpochMilli())

    private suspend fun requireCurrent() {
        lifetime.coroutineContext.ensureActive()
        check(active)
        contextGuard()
        coordinator.access.requireCurrent()
    }

    fun close() {
        active = false
        lifetime.cancel()
    }

    /** Reads the card's preferences and the home's tasks; [force] reads the tasks even inside their fresh window. */
    suspend fun load(force: Boolean = false) {
        try {
            requireCurrent()
            val saved = preferences.data.first()
            requireCurrent()
            firstUseDismissed = saved[booleanPreferencesKey("firstUse.dismissed.$homeId")] ?: false
            dismissedUntil = saved[longPreferencesKey("radonCard.dismissedUntil.$homeId")] ?: 0L
            preferencesLoaded = true
            if (!hasRadon) {
                keepSnapshot()
                return
            }
            val readAt = memory?.byHome?.get(homeId)?.readAt ?: 0L
            if (!force && loaded && System.currentTimeMillis() - readAt in 0 until RADON_TASKS_FRESH_MS) {
                keepSnapshot()
                return
            }
            val response = coordinator.access.list()
            requireCurrent()
            checkNotNull(response.collectionCapabilities)
            task = RadonToday.selected(response.tasks)
            canCreate = response.collectionCapabilities.canCreate
            loaded = true
            error = null
            keepSnapshot(readAt = System.currentTimeMillis())
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: NetworkError) {
            // API failures are Throwables, not Exceptions: unhandled, a 403 or an
            // outage here crashed the whole app on Today.
            if (runCatching { requireCurrent() }.isFailure) return
            loaded = false
            canCreate = false
            noTaskAccess = failure.code == HTTP_FORBIDDEN
            error = if (noTaskAccess) null else "Couldn't check your home's radon tasks. Try again."
            // Access ended or the read failed: nothing stale is shown next time.
            memory?.byHome?.remove(homeId)
        } catch (_: Exception) {
            if (runCatching { requireCurrent() }.isFailure) return
            loaded = false
            canCreate = false
            error = "Couldn't check your home's radon tasks. Try again."
        }
    }

    suspend fun open(kind: String) {
        try {
            requireCurrent()
            check(loaded && if (kind == "change") task?.capabilities?.canEdit == true else canCreate)
            if (kind != "change") {
                coordinator = factory.create(homeId, lifetime, dispatchContext)
                val pending = coordinator.load()?.request
                requireCurrent()
                check(pending == null || (pending.details?.get("suggestion") == "radon_test" && pending.visibility == "members")) {
                    "Reopen Tasks to recover your saved request."
                }
                retained = pending
            } else {
                retained = null
            }
            selectedDate = RadonToday.date(retained?.dueAt ?: if (kind == "change") task?.dueAt else null)
                ?: if (kind == "yes") LocalDate.now() else LocalDate.now().plusDays(RADON_REMINDER_DAYS)
            hasDate = retained?.details?.get("tested_on") != null
            result = retained?.details?.get("result_pci")?.toString().orEmpty()
            readingReport = false
            reportMessage = null
            reportFailed = false
            reportTestKind = null
            error = null
            sheet = retained?.let { if (it.status == "done") "yes" else "no" } ?: kind
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: NetworkError) {
            openFailed()
        } catch (_: Exception) {
            openFailed()
        }
    }

    private suspend fun openFailed() {
        if (runCatching { requireCurrent() }.isSuccess) {
            error = "Couldn't open this task action. Reopen Tasks to recover any saved request."
        }
    }

    private fun saveFailureMessage() =
        if (retained == null) {
            "Couldn't save this task. Check the date and result, then try again."
        } else {
            "Couldn't confirm your task. Your saved request is retained; try again."
        }

    suspend fun save() {
        val kind = sheet ?: return
        if (busy) return
        busy = true
        try {
            requireCurrent()
            check(kind == "yes" || retained != null || !selectedDate.isBefore(LocalDate.now()))
            if (kind == "change") {
                coordinator.access.edit(checkNotNull(task).id, HomeTaskEditPatch(mapOf("due_at" to RadonToday.dueAt(selectedDate))))
            } else {
                coordinator.submit(retained ?: RadonToday.payload(kind == "yes", selectedDate, hasDate, result))
            }
            requireCurrent()
            sheet = null
            retained = null
            load(force = true)
            requireCurrent()
            if (kind != "change") {
                events.send(
                    PilotEvents.Event.SuggestionDecision,
                    mapOf("suggestion" to "radon_test", "decision" to if (kind == "yes") "already_tested" else "reminder_added"),
                    expectedActor = coordinator.access.actorId,
                )
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: NetworkError) {
            if (runCatching { requireCurrent() }.isFailure) return
            retained = coordinator.pending?.request
            error = saveFailureMessage()
        } catch (_: Exception) {
            if (runCatching { requireCurrent() }.isFailure) return
            retained = coordinator.pending?.request
            error = saveFailureMessage()
        } finally {
            if (runCatching { requireCurrent() }.isSuccess) busy = false
        }
    }

    /** Fills the yes sheet from a photo or PDF of the lab's report. Nothing is saved: the person checks it and taps Save. */
    suspend fun readReport(report: Uri) {
        choosingReport = false
        val reader = reportReader
        if (reader == null || !readyForReport) return
        readingReport = true
        reportMessage = null
        try {
            requireCurrent()
            val reading = reader(report)
            requireCurrent()
            if (reading != null && sheet == "yes") show(reading)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (refused: IllegalStateException) {
            Timber.w(refused, "radon report reading skipped: the card is no longer current")
        } finally {
            if (runCatching { requireCurrent() }.isSuccess) readingReport = false
        }
    }

    /** Only the yes sheet's own answer is filled, and one reading at a time. */
    private val readyForReport get() = sheet == "yes" && retained == null && !busy && !readingReport

    private fun show(reading: RadonReportReading) {
        when (reading) {
            is RadonReportReading.Read -> fill(reading)
            is RadonReportReading.Failed -> {
                reportMessage = reading.message
                reportFailed = true
            }
        }
    }

    /** Only what the report shows changes: the result, and the test date when it has one. */
    private fun fill(reading: RadonReportReading.Read) {
        val read = reading.result
        read.valuePci?.takeIf { it.isFinite() && it >= 0 }?.let { result = RadonToday.plain(it) }
        read.testedOn?.let { runCatching { LocalDate.parse(it) }.getOrNull() }?.let {
            hasDate = true
            selectedDate = it
        }
        reportTestKind = read.testKind
        reportMessage = listOfNotNull(read.summary, reading.note, "Check the result and date, then tap Save.").joinToString(" ")
        reportFailed = false
    }

    suspend fun clearRadonDismissal() =
        whileCurrent {
            preferences.edit { it.remove(longPreferencesKey("radonCard.dismissedUntil.$homeId")) }
            requireCurrent()
            dismissedUntil = 0L
            keepSnapshot()
        }

    suspend fun dismiss() =
        whileCurrent {
            val until = Instant.now().atZone(ZoneId.systemDefault()).plusDays(RADON_DISMISS_DAYS).toInstant().toEpochMilli()
            preferences.edit { it[longPreferencesKey("radonCard.dismissedUntil.$homeId")] = until }
            requireCurrent()
            dismissedUntil = until
            keepSnapshot()
            events.send(
                PilotEvents.Event.SuggestionDecision,
                mapOf("suggestion" to "radon_test", "decision" to "not_now"),
                coordinator.access.actorId,
            )
        }

    /**
     * Runs a card action that has no error line of its own. When the card no longer belongs to what's on screen (the
     * home changed, the session ended, the app or phone locked), the guard refuses and the tap does nothing, instead
     * of the refusal escaping into the card's scope and closing the app.
     */
    private suspend fun whileCurrent(action: suspend () -> Unit) {
        try {
            requireCurrent()
            action()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (refused: IllegalStateException) {
            Timber.w(refused, "radon card action skipped: the card is no longer current")
        }
    }
}

@Composable
private fun rememberHomeTodayState(
    intel: PlaceIntelligence,
    actions: AddressCalendarActions?,
    factory: HomeTaskCreationFactory,
    events: PilotEvents,
    contextGuard: suspend () -> Unit,
    memory: RadonTodayMemory?,
): RadonTodayState? {
    val homeId = actions?.calendarHomeId ?: return null
    val hasRadon = intel.section(PlaceSectionId.LEAD_RADON)?.leadRadon?.radonZone in 1..3
    val reportReader: (suspend (Uri) -> RadonReportReading?)? = actions?.takeIf { it.readsRadonReports }?.let { it::readRadonReport }
    val context = LocalContext.current
    val parent = rememberCoroutineScope()
    var epoch by remember(homeId) { mutableStateOf(0) }
    var paused by remember(homeId) { mutableStateOf(false) }
    val state =
        remember(homeId, intel, epoch) {
            RadonTodayState(homeId, factory, parent, contextGuard, events, context.homeTodayPreferences, hasRadon, memory, reportReader)
        }
    DisposableEffect(state) { onDispose { state.close() } }
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) {
        // Choosing a lab report hands over to the camera or a system picker and comes back: the sheet stays.
        if (state.choosingReport) return@LifecycleEventEffect
        paused = true
        state.close()
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        if (paused) {
            paused = false
            epoch++
        }
    }
    // A pull (or Retry) reads the tasks now; otherwise the card's 2-minute window decides.
    val forcedReads = memory?.forcedReads ?: 0
    val forcedAtStart = remember(state) { forcedReads }
    LaunchedEffect(state, forcedReads) { state.load(force = forcedReads != forcedAtStart) }
    return state
}

@Composable
private fun RadonCardContent(
    state: RadonTodayState,
    data: PlaceLeadRadonData,
) {
    val uri = LocalUriHandler.current
    Column(
        modifier = Modifier.fillMaxWidth().placeCard().padding(16.dp).testTag("todayRadonCard"),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val task = state.task
        if (!state.loaded) {
            // A failed read says so below, with Try again; "Checking" only while a read can still answer.
            if (state.error == null) {
                Text("Checking your home's radon tasks…", fontSize = 14.sp, color = PantopusColors.appTextSecondary)
            }
        } else if (task != null) {
            Text(RadonToday.message(task), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            if (task.status != "done" && task.capabilities?.canEdit == true) {
                GhostButton("Change date", onClick = { state.lifetime.launch { state.open("change") } })
            }
        } else {
            Text(
                "Was radon tested during your inspection or since you moved in?",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            val zone =
                when (data.radonZone) {
                    1 -> "highest"
                    2 -> "moderate"
                    else -> "lowest"
                }
            Text(
                "${data.countyName ?: "Your county"} is in the EPA's $zone radon zone. " +
                    "The EPA recommends testing every home, whatever the zone.",
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
            )
            if (state.loaded) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // GhostButton fills the width it is given; equal weights keep both answers on screen.
                    GhostButton(
                        "Yes",
                        onClick = { state.lifetime.launch { state.open("yes") } },
                        modifier = Modifier.weight(1f),
                        isEnabled = state.canCreate,
                    )
                    GhostButton(
                        "No or not sure",
                        onClick = { state.lifetime.launch { state.open("no") } },
                        modifier = Modifier.weight(1f),
                        isEnabled = state.canCreate,
                    )
                }
                GhostButton("Not now", onClick = { state.lifetime.launch { state.dismiss() } })
            }
        }
        state.error?.let { Text(it, fontSize = 13.sp, color = PantopusColors.error) }
        if (!state.loaded) {
            GhostButton("Try again", onClick = {
                state.error = null
                state.lifetime.launch { state.load() }
            })
        }
        Text(
            "EPA radon zones",
            fontSize = 12.sp,
            color = PantopusColors.primary600,
            modifier = Modifier.clickable { uri.openUri("https://www.epa.gov/radon/epa-map-radon-zones-0") },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RadonTaskSheet(state: RadonTodayState) {
    val tested = state.sheet == "yes"
    val value = state.result.trim().toDoubleOrNull()
    val valid =
        if (tested) {
            state.result.isBlank() || (value != null && value.isFinite() && value >= 0)
        } else {
            !state.selectedDate.isBefore(LocalDate.now())
        }
    ModalBottomSheet(
        onDismissRequest = { if (!state.busy) state.sheet = null },
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.closesKeyboardOnTapOrScroll(),
    ) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(
                if (tested) "When was it tested?" else "Add a radon test to your list",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            if (state.retained != null) Text("An earlier task request is saved. Save retries that exact request.")
            if (tested) {
                RadonTestedFields(state, value)
            } else {
                RadonDateField(state, pastAllowed = false)
            }
            state.error?.let { Text(it, color = PantopusColors.error) }
            GhostButton(
                if (tested) "Save" else "Add reminder",
                isLoading = state.busy,
                isEnabled = !state.busy && !state.readingReport && (state.retained != null || valid),
                onClick = { state.lifetime.launch { state.save() } },
            )
            GhostButton("Close", isEnabled = !state.busy, onClick = { state.sheet = null })
        }
    }
}

/** The yes sheet's fields: a lab report to read, the test date and the result, explained against the EPA's action level. */
@Composable
private fun RadonTestedFields(
    state: RadonTodayState,
    value: Double?,
) {
    val links = LocalUriHandler.current
    // A reading in progress fills these fields; nothing is typed over it meanwhile.
    val editable = !state.busy && !state.readingReport && state.retained == null
    if (state.readsReports) {
        RadonReportControl(
            reading = state.readingReport,
            message = state.reportMessage,
            failed = state.reportFailed,
            enabled = editable,
            onLeave = { state.choosingReport = true },
            onCancel = { state.choosingReport = false },
        ) { report, afterwards ->
            state.lifetime.launch { state.readReport(report) }.invokeOnCompletion { afterwards() }
        }
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Test date (optional)", modifier = Modifier.weight(1f))
        Switch(checked = state.hasDate, onCheckedChange = { state.hasDate = it }, enabled = editable)
    }
    if (state.hasDate) RadonDateField(state, pastAllowed = true)
    OutlinedTextField(
        value = state.result,
        onValueChange = { state.result = it },
        label = { Text("Result (pCi/L)") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        enabled = editable,
    )
    value?.takeIf { it.isFinite() && it >= 0 }?.let { pci ->
        Text(
            RadonToday.explanation(pci, state.reportTestKind),
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.testTag("radonSheetExplanation"),
        )
        Text(
            "What the EPA's action level means",
            fontSize = 12.sp,
            color = PantopusColors.primary600,
            modifier = Modifier.clickable { links.openUri(RADON_ACTION_LEVEL_URL) },
        )
    }
}

@Composable
private fun RadonDateField(
    state: RadonTodayState,
    pastAllowed: Boolean,
) {
    val context = LocalContext.current
    GhostButton(
        "Date: ${state.selectedDate.format(DateTimeFormatter.ofPattern("MMM d"))}",
        isEnabled = !state.busy && !state.readingReport && state.retained == null,
        onClick = {
            val date = state.selectedDate
            android.app.DatePickerDialog(
                context,
                { _, year, month, day -> state.selectedDate = LocalDate.of(year, month + 1, day) },
                date.year,
                date.monthValue - 1,
                date.dayOfMonth,
            ).apply {
                if (!pastAllowed) datePicker.minDate = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            }.show()
        },
    )
}

/** The air reading for the sky: smoke veils it, and bad air leads the card. */
private fun skyAir(intel: PlaceIntelligence): SkyAir? =
    intel.section(PlaceSectionId.AIR_QUALITY)?.takeIf { it.isLive() }?.airQuality?.let {
        SkyAir(it.index, it.categoryLabel, smoky = it.dominantPollutant == "pm25")
    }

/** The sky and the sun card draw the place's hour; the phone's zone only when the place's is unknown. */
private fun placeSkyZone(intel: PlaceIntelligence): ZoneId = intel.homeZone ?: ZoneId.systemDefault()

/**
 * "Complete your home setup", folded (TPR brief 5.10): one row per real open item — pickup days (the existing editor,
 * on demand), the radon question (the existing card and sheet, every answer), and a saved place's reminders (Add your
 * home). A radon question put off with "Not now" stays here as an uncounted row, and a radon record (or a failed check)
 * keeps its card here; with nothing open the fold reads "Home setup". Gone when there is nothing at all.
 */
@Composable
@Suppress("LongMethod", "CyclomaticComplexMethod")
private fun TodayHomeSetup(
    state: RadonTodayState?,
    intel: PlaceIntelligence,
    needsPickup: Boolean,
    onPickup: () -> Unit,
    onAddHome: (() -> Unit)?,
) {
    val radonData = intel.section(PlaceSectionId.LEAD_RADON)?.leadRadon
    val radon = state?.takeIf { it.hasRadon && !it.noTaskAccess && radonData != null }
    val unanswered = radon != null && radon.loaded && radon.task == null
    val putOff = unanswered && radon?.hidden == true
    val radonOpen = unanswered && !putOff
    val record = radon?.task?.takeIf { radon.loaded }
    val failed = radon != null && !radon.loaded && radon.error != null
    val count = listOf(needsPickup, radonOpen, onAddHome != null).count { it }
    if (listOf(count > 0, putOff, record != null, failed).none { it }) return
    var open by rememberSaveable(state?.homeId) { mutableStateOf(false) }
    var radonShown by rememberSaveable(state?.homeId) { mutableStateOf(false) }
    val until = radon?.dismissedUntil?.takeIf { putOff }?.let { RadonToday.label(java.time.Instant.ofEpochMilli(it).toString()) }
    val summary =
        when {
            count > 0 -> if (count == 1) "1 optional item" else "$count optional items"
            record != null -> RadonToday.message(record)
            putOff -> "Radon question put off" + (until?.let { " until $it" } ?: "")
            else -> "Couldn't check your home's radon tasks"
        }
    TodayFold(
        title = if (count > 0) "Complete your home setup" else "Home setup",
        summary = summary,
        open = open,
        onToggle = { open = !open },
        modifier = Modifier.testTag("todayHomeSetup"),
    ) {
        onAddHome?.let {
            Column(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp).testTag("todaySavedPlaceReminders"),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Get reminders for this address", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Text(
                    "Pickup and radon reminders need your home on Pantopus.",
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.appTextSecondary,
                )
                GhostButton("Add your home", onClick = it, modifier = Modifier.fillMaxWidth())
            }
        }
        if (needsPickup) {
            TodayFoldRow(
                "Set pickup days",
                "Enter a schedule or import a flyer.",
                onClick = onPickup,
                modifier = Modifier.testTag("todaySetup.pickup"),
            )
        }
        if (radon != null && radonData != null) {
            if (unanswered) {
                TodayFoldRow(
                    "Add radon test information",
                    (until?.let { "Put off until $it. " } ?: "") + "Add a report, record that you are unsure, or come back later.",
                    onClick = {
                        radonShown = !radonShown
                        if (radonShown && putOff) radon.lifetime.launch { radon.clearRadonDismissal() }
                    },
                    modifier = Modifier.testTag("todaySetup.radon"),
                )
            }
            val showsRadonCard = record != null || failed || (unanswered && radonShown)
            if (showsRadonCard) {
                Column(modifier = Modifier.padding(bottom = 12.dp)) { RadonCardContent(radon, radonData) }
            }
        }
    }
}

/**
 * "Sources and full conditions", folded (TPR brief 5.11): the daily forecast, the AQI gauge with its full guidance and
 * source, every alert's official text (or the scoped all-clear with its check time), the sun arc, and the radon card
 * once answered. "Weather details" and the air and daylight sides open it at their card.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
@Suppress("LongParameterList")
private fun TodayFullConditions(
    intel: PlaceIntelligence,
    alertsCheck: TodayAlertsCheck,
    calendar: PlaceAddressCalendarData?,
    open: Boolean,
    onToggle: () -> Unit,
    targets: TodayTargets,
    now: ZonedDateTime,
) {
    TodayFold(
        title = "Sources and full conditions",
        summary = conditionsSummary(intel, alertsCheck),
        open = open,
        onToggle = onToggle,
        modifier = Modifier.bringIntoViewRequester(targets.conditions).testTag("today.fullConditions"),
    ) {
        intel.section(PlaceSectionId.WEATHER)?.weather?.daily?.takeIf { it.isNotEmpty() }?.let { DailyForecast(it, now) }
        Column(modifier = Modifier.bringIntoViewRequester(targets.air)) { TodayAirSection(intel) }
        TodayAlertsSection(intel, alertsCheck, now)
        Column(modifier = Modifier.bringIntoViewRequester(targets.sun)) { TodaySunSection(intel) }
        // The calendar's own source, also under the calendar view.
        calendar?.let {
            PlaceDetailSectionLabel("Calendar")
            PlaceSourceNote(it.source ?: "Pantopus registry", "next ${it.windowDays} days")
        }
        Spacer(modifier = Modifier.height(12.dp))
    }
}

/** The next days' sky, high and low and chance of rain, from the forecast Today already has (contract §2). */
@Composable
private fun DailyForecast(
    days: List<PlaceWeatherDay>,
    now: ZonedDateTime,
) {
    PlaceDetailSectionLabel("Forecast")
    Column(modifier = Modifier.fillMaxWidth().placeSurface().padding(horizontal = 14.dp).testTag("today.daily")) {
        days.forEachIndexed { index, day ->
            if (index > 0) TodayHairline()
            val date = runCatching { LocalDate.parse(day.date.substringBefore('T')) }.getOrNull()
            val name =
                when {
                    date == null -> day.date
                    date == now.toLocalDate() -> "Today"
                    else -> date.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.US)
                }
            val rain = day.precipChance.takeIf { it >= PRECIP_SHOWN_FROM }?.let { "${it.roundToInt()}%" }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clearAndSetSemantics {
                            val range = "high ${day.highF.roundToInt()}°, low ${day.lowF.roundToInt()}°"
                            contentDescription =
                                "$name: ${SkyScrub.label(day.conditionCode)}, $range" + (rain?.let { ", $it chance of rain" } ?: "")
                        }.padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    name,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appText,
                    modifier = Modifier.width(56.dp),
                )
                PantopusIconImage(conditionIcon(day.conditionCode, night = false), null, size = 18.dp, tint = PantopusColors.appTextStrong)
                Text(rain.orEmpty(), fontSize = 12.5.sp, color = PantopusColors.primary600, modifier = Modifier.weight(1f))
                Text(
                    "${day.highF.roundToInt()}° / ${day.lowF.roundToInt()}°",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
        }
    }
}

@Composable
private fun TodayAirSection(intel: PlaceIntelligence) {
    val env = intel.section(PlaceSectionId.AIR_QUALITY) ?: return
    PlaceDetailSectionLabel("Air quality")
    val data = env.airQuality
    if (data != null && env.isLive()) {
        AqiCard(data)
        // The server names the monitor, or says the reading is a model estimate.
        PlaceSourceNote(env.source.orEmpty().ifBlank { "AirNow · EPA" }, PlacePresentation.fmtTime(env.asOf, intel.homeZone))
    } else {
        PlaceDetailFallbackCard(env)
    }
}

@Composable
private fun TodayAlertsSection(
    intel: PlaceIntelligence,
    alertsCheck: TodayAlertsCheck,
    now: ZonedDateTime,
) {
    val env = intel.section(PlaceSectionId.ALERTS) ?: return
    PlaceDetailSectionLabel("Weather alerts")
    // "No active weather alerts" only for a list that was checked; an unavailable section is not an all-clear.
    val data = env.alerts
    if (alertsCheck != TodayAlertsCheck.CURRENT) {
        AlertsOutOfDateCard(checking = alertsCheck == TodayAlertsCheck.CHECKING)
    } else if (data != null && env.isLive()) {
        AlertsCard(data.active, checkedAt = PlacePresentation.fmtTime(env.asOf, intel.homeZone), source = env.source, now = now)
        PlaceSourceNote(env.source.orEmpty().ifBlank { "Source unavailable" }, "live")
    } else {
        PlaceDetailFallbackCard(env)
    }
}

@Composable
private fun TodaySunSection(intel: PlaceIntelligence) {
    val env = intel.section(PlaceSectionId.SUNRISE_SUNSET) ?: return
    PlaceDetailSectionLabel("Sun")
    val data = env.sunriseSunset
    if (data != null) {
        TodaySunArcCard(data, timeZone = placeSkyZone(intel))
        PlaceSourceNote("Your location", PlacePresentation.fmtSunDay(data, intel.homeZone))
    } else {
        PlaceDetailFallbackCard(env)
    }
}

/** "Forecast · air quality · no active weather alerts · sun and sources", the alerts part as checked now. */
private fun conditionsSummary(
    intel: PlaceIntelligence,
    alertsCheck: TodayAlertsCheck,
): String {
    val env = intel.section(PlaceSectionId.ALERTS)
    val active = env?.alerts?.active?.takeIf { alertsCheck == TodayAlertsCheck.CURRENT && env.isLive() }
    val alerts =
        when {
            env == null -> null
            active == null -> "weather alerts unavailable"
            active.isEmpty() -> "no active weather alerts"
            active.size == 1 -> "1 weather alert"
            else -> "${active.size} weather alerts"
        }
    return listOfNotNull("Forecast", "air quality", alerts, "sun and sources").joinToString(" · ")
}
