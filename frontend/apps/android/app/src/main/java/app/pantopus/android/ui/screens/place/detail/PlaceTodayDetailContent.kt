package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
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
import app.pantopus.android.data.analytics.PilotEvents
import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.place.PlaceAddressCalendarData
import app.pantopus.android.data.api.models.place.PlaceAirQualityData
import app.pantopus.android.data.api.models.place.PlaceCalendarEvent
import app.pantopus.android.data.api.models.place.PlaceGoodDayTile
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceLeadRadonData
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceWeatherAlert
import app.pantopus.android.data.api.models.place.WeatherAlertSeverity
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.homes.HomeTaskEditPatch
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.screens.ballot.BallotPlacement
import app.pantopus.android.ui.screens.ballot.BallotTodayCard
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskCreationFactory
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.placeCard
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
import java.net.HttpURLConnection.HTTP_FORBIDDEN
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/** The row shows at most five tiles; the rest stay in the group page. */
private const val GOOD_DAY_TILE_CAP = 5

/** Up to this many tiles share the row; more scroll sideways. */
private const val GOOD_DAY_SHARED_ROW = 3

/** From this font scale the tiles always scroll, widening up to [GOOD_DAY_MAX_WIDEN] times. */
private const val GOOD_DAY_LARGE_FONT = 1.3f
private const val GOOD_DAY_MAX_WIDEN = 1.6f

/** A scrolling tile's width in dp at the default font size. */
private const val GOOD_DAY_TILE_WIDTH = 128f
private const val RADON_MORNING_HOUR = 9
private const val RADON_REMINDER_DAYS = 14L
private const val RADON_DISMISS_DAYS = 30L

/**
 * What the radon and first-use cards last knew, per home, for one screen's lifetime: a card built again (coming back
 * to the tab, the app returning from the background) starts from it while it is read again, so it doesn't grow from
 * "One thing…" to "Two things…" a moment after showing.
 */
class RadonTodayMemory {
    internal val byHome = mutableMapOf<String, RadonSnapshot>()
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

/**
 * [onOpenBallot] takes the Ballot P0 card's "Open your ballot" to the
 * Place card; without it the button is left out. [alertsCheck] replaces the
 * alerts with an honest line once the check on screen is out of date.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
@Suppress("LongParameterList")
fun PlaceTodayDetailContent(
    intel: PlaceIntelligence,
    viewModel: AddressCalendarActions? = null,
    radonFactory: HomeTaskCreationFactory? = null,
    pilotEvents: PilotEvents? = null,
    radonContext: (suspend () -> Unit)? = null,
    onOpenBallot: (() -> Unit)? = null,
    alertsCheck: TodayAlertsCheck = TodayAlertsCheck.CURRENT,
    radonMemory: RadonTodayMemory? = null,
) {
    val homeState =
        if (radonFactory != null && pilotEvents != null && radonContext != null) {
            rememberHomeTodayState(intel, viewModel, radonFactory, pilotEvents, radonContext, radonMemory)
        } else {
            null
        }
    val calendarFocus = remember { BringIntoViewRequester() }
    val radonFocus = remember { BringIntoViewRequester() }
    var pickupOpenTrigger by remember(viewModel?.calendarHomeId) { mutableStateOf(0) }
    var calendarFallback by remember(intel, viewModel?.calendarHomeId) { mutableStateOf<PlaceAddressCalendarData?>(null) }
    val calendar = intel.section(PlaceSectionId.ADDRESS_CALENDAR)
    val shownCalendar = calendar?.addressCalendar?.takeIf { calendar.isLive() } ?: calendarFallback
    val needsPickup = shownCalendar?.needsPickupDay == true
    if (homeState != null) {
        HomeFirstUseCard(homeState, needsPickup, onPickup = {
            pickupOpenTrigger++
            homeState.lifetime.launch { calendarFocus.bringIntoView() }
        }, onRadon = {
            homeState.lifetime.launch {
                homeState.clearRadonDismissal()
                withFrameNanos { }
                radonFocus.bringIntoView()
            }
        })
    }
    val scope = rememberCoroutineScope()
    TodayWeatherSection(intel, shownCalendar?.upcoming.orEmpty()) { scope.launch { calendarFocus.bringIntoView() } }
    // Ballot P0 (ballot_p0): ballot week and "Moved this year?", only when
    // the server says either applies.
    BallotPlacement.today(intel)?.let { card ->
        BallotTodayCard(card = card, onOpenBallot = onOpenBallot, modifier = Modifier.padding(top = Spacing.s4))
    }
    intel.section(PlaceSectionId.GOOD_DAY_TO)?.let { env ->
        val data = env.goodDayTo
        if (data != null && env.isLive() && data.tiles.isNotEmpty()) {
            PlaceDetailSectionLabel("Good day to\u2026")
            GoodDayRow(data.tiles)
            PlaceSourceNote("Derived from today's conditions", PlacePresentation.fmtTime(env.asOf))
        }
        // Deliberately silent when there is nothing to answer: an empty
        // verdict row is worse than no row.
    }
    // The calendar is the reason the Today tab exists; it sits above the
    // fold, after what it is like now and what to do with it.
    Column(modifier = Modifier.bringIntoViewRequester(calendarFocus)) {
        AddressCalendarSection(intel, viewModel, pickupOpenTrigger) { calendarFallback = it }
    }
    if (homeState != null && homeState.hasRadon && !homeState.hidden) {
        Column(modifier = Modifier.bringIntoViewRequester(radonFocus)) {
            PlaceDetailSectionLabel("Radon")
            intel.section(PlaceSectionId.LEAD_RADON)?.leadRadon?.let { RadonCardContent(homeState, it) }
        }
        if (homeState.sheet != null) RadonTaskSheet(homeState)
    }
    TodayAirAlertsSunSections(intel, alertsCheck)
}

/**
 * "Good day to…" — verdicts, not readings. Tapping a tile reveals the
 * numbers behind it: an opinionated tile that won't show its inputs is
 * worse than no tile, because one visibly wrong verdict discredits every
 * other card here.
 */
@Composable
private fun GoodDayRow(tiles: List<PlaceGoodDayTile>) {
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    val shown = tiles.take(GOOD_DAY_TILE_CAP)
    val open = shown.firstOrNull { it.id == openId }
    val reduced = rememberMotionReduced()
    var appeared by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Up to three tiles share the row; more scroll, with the next one peeking in.
        // At large font sizes the tiles scroll and widen with the text, so answers wrap by word.
        val fontScale = LocalDensity.current.fontScale
        val shared = shown.size <= GOOD_DAY_SHARED_ROW && fontScale < GOOD_DAY_LARGE_FONT
        val tileWidth = (GOOD_DAY_TILE_WIDTH * fontScale.coerceIn(1f, GOOD_DAY_MAX_WIDEN)).dp
        val row = if (shared) Modifier.fillMaxWidth() else Modifier.horizontalScroll(rememberScrollState())
        Row(modifier = row.height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            shown.forEachIndexed { index, tile ->
                val pop = rememberPopIn(tile.id, index, animate = !reduced && !appeared)
                val size = if (shared) Modifier.weight(1f) else Modifier.width(tileWidth)
                TodayGoodDayTile(
                    tile = tile,
                    open = openId == tile.id,
                    modifier =
                        size
                            .popIn(pop)
                            .clip(RoundedCornerShape(16.dp))
                            .clickable(onClickLabel = tile.because) { openId = if (openId == tile.id) null else tile.id }
                            .clearAndSetSemantics {
                                contentDescription = "${tile.label}: ${tile.answer}"
                                selected = openId == tile.id
                            },
                )
            }
        }
        if (open != null) {
            PlaceDetailCard {
                Text(
                    open.label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
                Text(open.because, fontSize = 13.5.sp, color = PantopusColors.appTextStrong)
            }
        }
    }
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

@Composable
private fun AlertsCard(active: List<PlaceWeatherAlert>) {
    if (active.isEmpty()) {
        PlaceDetailCard {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                TodayAllClearBadge()
                Column {
                    Text("No active alerts", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                    Text("Nothing to watch for on your block right now.", fontSize = 13.sp, color = PantopusColors.appTextMuted)
                }
            }
        }
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            active.forEach { AlertRow(it) }
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
private fun AlertRow(alert: PlaceWeatherAlert) {
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
                if (alert.headline.isNotEmpty()) Text(alert.headline, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = fg)
                if (alert.description.isNotEmpty()) {
                    Text(
                        alert.description,
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

// ─── The address calendar (Wedge v2 D6) ──────────────────────
// Pickup days, tax dates, council meetings — the reason Today earns a
// tab. The one thing the resident must tell us is the pickup day;
// everything else comes from the registry. Parity twin of the iOS
// `AddressCalendarCard`.

@Composable
private fun AddressCalendarSection(
    intel: PlaceIntelligence,
    viewModel: AddressCalendarActions?,
    openTrigger: Int = 0,
    onCalendar: (PlaceAddressCalendarData?) -> Unit = {},
) {
    val env = intel.section(PlaceSectionId.ADDRESS_CALENDAR) ?: return
    PlaceDetailSectionLabel("At this address")
    var fallback by remember(intel.generatedAt, viewModel?.calendarHomeId) { mutableStateOf<PlaceAddressCalendarData?>(null) }
    LaunchedEffect(intel.generatedAt, env.status, viewModel?.calendarHomeId) {
        if (env.status == app.pantopus.android.data.api.models.place.PlaceSectionStatus.UNAVAILABLE && viewModel != null) {
            fallback = viewModel.loadAddressCalendar()
        }
    }
    val data = env.addressCalendar?.takeIf { env.isLive() } ?: fallback
    LaunchedEffect(data) { onCalendar(data) }
    if (data != null) {
        AddressCalendarCard(data, viewModel, openTrigger)
        PlaceSourceNote(data.source ?: "Pantopus registry", "next ${data.windowDays} days")
    } else {
        PlaceDetailFallbackCard(env)
    }
}

@Composable
private fun AddressCalendarCard(
    data: PlaceAddressCalendarData,
    viewModel: AddressCalendarActions?,
    openTrigger: Int = 0,
) {
    var picking by rememberSaveable { mutableStateOf(data.needsPickupDay) }
    LaunchedEffect(data.pickupVersion, data.needsPickupDay) { picking = data.needsPickupDay }
    LaunchedEffect(openTrigger) { if (openTrigger > 0) picking = true }
    val busy = viewModel?.calendarBusy?.collectAsStateWithLifecycle()?.value ?: false
    val errorText = viewModel?.calendarError?.collectAsStateWithLifecycle()?.value
    Column(
        modifier = Modifier.fillMaxWidth().placeCard().padding(16.dp).testTag("place.today.addressCalendar"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        CalendarHeader(windowDays = data.windowDays, picking = picking, canPick = viewModel != null) { if (!busy) picking = !picking }
        if (!picking && data.upcoming.isNotEmpty()) TodayCalendarStrip(data.today, data.windowDays, data.upcoming)
        when {
            picking && viewModel != null -> PickupScheduleEditor(data, viewModel, busy)
            data.needsPickupDay && viewModel != null -> PickupPrompt { picking = true }
        }
        errorText?.let { Text(it, fontSize = 12.5.sp, color = PantopusColors.error) }
        UpcomingEvents(data, canSetPickupDay = viewModel != null)
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
            dueAt = dueAt(if (tested && !hasDate) LocalDate.now() else date),
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
        val value = if (prefix == "Radon tested") tested ?: task.dueAt else task.completedAt
        val text = label(value)?.let { "$prefix $it" } ?: prefix
        val result = (task.details?.get("result_pci") as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 }
        return if (prefix == "Radon tested" && result != null) "$text · $result pCi/L" else text
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

    suspend fun hideFirstUse() {
        requireCurrent()
        preferences.edit { it[booleanPreferencesKey("firstUse.dismissed.$homeId")] = true }
        requireCurrent()
        firstUseDismissed = true
        keepSnapshot()
    }

    suspend fun clearRadonDismissal() {
        requireCurrent()
        preferences.edit { it.remove(longPreferencesKey("radonCard.dismissedUntil.$homeId")) }
        requireCurrent()
        dismissedUntil = 0L
        keepSnapshot()
    }

    suspend fun dismiss() {
        requireCurrent()
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
    val context = LocalContext.current
    val parent = rememberCoroutineScope()
    var epoch by remember(homeId) { mutableStateOf(0) }
    var paused by remember(homeId) { mutableStateOf(false) }
    val state =
        remember(homeId, intel, epoch) {
            RadonTodayState(homeId, factory, parent, contextGuard, events, context.homeTodayPreferences, hasRadon, memory)
        }
    DisposableEffect(state) { onDispose { state.close() } }
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) {
        paused = true
        state.close()
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        if (paused) {
            paused = false
            epoch++
        }
    }
    LaunchedEffect(state) { state.load() }
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
            Text("Checking your home's radon tasks…", fontSize = 14.sp, color = PantopusColors.appTextSecondary)
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
        if (!state.loaded) GhostButton("Try again", onClick = { state.lifetime.launch { state.load() } })
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
    ModalBottomSheet(onDismissRequest = { if (!state.busy) state.sheet = null }, containerColor = PantopusColors.appSurface) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(
                if (tested) "When was it tested?" else "Add a radon test to your list",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            if (state.retained != null) Text("An earlier task request is saved. Save retries that exact request.")
            if (tested) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Test date (optional)", modifier = Modifier.weight(1f))
                    Switch(
                        checked = state.hasDate,
                        onCheckedChange = { state.hasDate = it },
                        enabled = !state.busy && state.retained == null,
                    )
                }
                if (state.hasDate) RadonDateField(state, pastAllowed = true)
                OutlinedTextField(
                    value = state.result,
                    onValueChange = { state.result = it },
                    label = { Text("Result (pCi/L)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    enabled = !state.busy && state.retained == null,
                )
            } else {
                RadonDateField(state, pastAllowed = false)
            }
            state.error?.let { Text(it, color = PantopusColors.error) }
            GhostButton(
                if (tested) "Save" else "Add reminder",
                isLoading = state.busy,
                isEnabled = !state.busy && (state.retained != null || valid),
                onClick = { state.lifetime.launch { state.save() } },
            )
            GhostButton("Close", isEnabled = !state.busy, onClick = { state.sheet = null })
        }
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
        isEnabled = !state.busy && state.retained == null,
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

@Composable
private fun TodayWeatherSection(
    intel: PlaceIntelligence,
    pickups: List<PlaceCalendarEvent>,
    onBins: () -> Unit,
) {
    intel.section(PlaceSectionId.WEATHER)?.let { env ->
        val data = env.weather
        Row(verticalAlignment = Alignment.Bottom) {
            Box(modifier = Modifier.weight(1f)) { PlaceDetailSectionLabel("Weather") }
            if (data != null && env.isLive() && intel.place.city.isNotEmpty()) {
                SkyShareLink(
                    SkyShareCard(
                        data,
                        intel.section(PlaceSectionId.SUNRISE_SUNSET)?.sunriseSunset,
                        skyAir(intel),
                        intel.place.city,
                        ZonedDateTime.now(),
                    ),
                )
            }
        }
        if (data != null && env.isLive()) {
            val air = skyAir(intel)
            TodaySkyHero(
                data,
                intel.section(PlaceSectionId.SUNRISE_SUNSET)?.sunriseSunset,
                pickups,
                air,
                home = SkyHome.of(intel.section(PlaceSectionId.YOUR_HOME)?.yourHome?.homeType),
                streetLights = SkyStreet.lights(intel.section(PlaceSectionId.BLOCK_DENSITY)?.blockDensity?.bucket?.name?.lowercase()),
                onBins = onBins,
            )
            PlaceSourceNote(env.source.orEmpty().ifBlank { "Source unavailable" }, PlacePresentation.fmtTime(env.asOf))
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
}

@Composable
private fun HomeFirstUseCard(
    state: RadonTodayState,
    needsPickup: Boolean,
    onPickup: () -> Unit,
    onRadon: () -> Unit,
) {
    val needsRadon = state.hasRadon && state.loaded && state.task == null
    if (!state.preferencesLoaded || state.firstUseDismissed) return
    if (!needsPickup && !needsRadon) return
    Column(
        modifier = Modifier.padding(bottom = 12.dp).fillMaxWidth().placeCard().padding(16.dp).testTag("todayHomeFirstUse"),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Rows drop out as they're handled; the heading counts what's left.
        Text(
            if (needsPickup && needsRadon) "Two things for your home" else "One thing for your home",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        if (needsPickup) GhostButton("Set your pickup day", onClick = onPickup)
        if (needsRadon) GhostButton("Was radon tested?", onClick = onRadon)
        GhostButton("Later", onClick = { state.lifetime.launch { state.hideFirstUse() } })
    }
}

@Composable
private fun TodayAirAlertsSunSections(
    intel: PlaceIntelligence,
    alertsCheck: TodayAlertsCheck,
) {
    intel.section(PlaceSectionId.AIR_QUALITY)?.let { env ->
        PlaceDetailSectionLabel("Air quality")
        val data = env.airQuality
        if (data != null && env.isLive()) {
            AqiCard(data)
            PlaceSourceNote("AirNow · EPA", PlacePresentation.fmtTime(env.asOf))
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
    intel.section(PlaceSectionId.ALERTS)?.let { env ->
        PlaceDetailSectionLabel("Alerts")
        // "No active alerts" only for a list that was checked; an unavailable section is not an all-clear.
        val data = env.alerts
        if (alertsCheck != TodayAlertsCheck.CURRENT) {
            AlertsOutOfDateCard(checking = alertsCheck == TodayAlertsCheck.CHECKING)
        } else if (data != null && env.isLive()) {
            AlertsCard(data.active)
            PlaceSourceNote(env.source.orEmpty().ifBlank { "Source unavailable" }, "live")
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
    intel.section(PlaceSectionId.SUNRISE_SUNSET)?.let { env ->
        PlaceDetailSectionLabel("Sun")
        val data = env.sunriseSunset
        if (data != null) {
            TodaySunArcCard(data)
            PlaceSourceNote("Your location", PlacePresentation.fmtSunDay(data.sunrise))
        } else {
            PlaceDetailFallbackCard(env)
        }
    }
}
