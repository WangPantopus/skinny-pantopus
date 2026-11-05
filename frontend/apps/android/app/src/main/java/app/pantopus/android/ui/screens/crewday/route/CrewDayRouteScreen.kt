@file:Suppress("LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.crewday.route

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.crewday.CrewDayHomeDto
import app.pantopus.android.data.api.models.crewday.CrewDayRouteDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.crewday.components.CrewDayTone
import app.pantopus.android.ui.screens.crewday.components.CrewDayToneChip
import app.pantopus.android.ui.screens.plans.components.PlanChoice
import app.pantopus.android.ui.screens.plans.components.PlanChoiceGroup
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTimePickerDialog
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.screens.plans.detail.PlanRoundButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

/** Where the route hands off. */
data class CrewDayRouteActions(
    val onBack: () -> Unit,
    /** One home (screen 17). */
    val onOpenHome: (crewDayId: String, bookingId: String, date: String?) -> Unit,
)

/**
 * The route (screen 16, boards `Route`, `AndroidRoute`): from 6 PM the evening before through the day. "6 homes ·
 * 9 AM–1 PM", "2 of 6 done", the homes in the crew's order with their status, On my way and Running late under the
 * next home, and a reorder mode (move up / move down, which TalkBack reads too).
 */
@Composable
fun CrewDayRouteScreen(
    actions: CrewDayRouteActions,
    viewModel: CrewDayRouteViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val working by viewModel.working.collectAsStateWithLifecycle()
    val order by viewModel.order.collectAsStateWithLifecycle()
    val notice by viewModel.notice.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    var onWay by remember { mutableStateOf<CrewDayHomeDto?>(null) }
    var late by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(notice) {
        notice?.let {
            toast.info(it)
            viewModel.noticeShown()
        }
    }
    val loaded = (state as? CrewDayRouteUiState.Loaded)?.route
    PlanPlainScaffold(
        onBack = actions.onBack,
        title = loaded?.let { "Route · ${CrewDayFormat.shortDate(it.date).orEmpty()}" } ?: "Route",
        modifier = Modifier.testTag("crewDayRoute"),
        footer =
            order?.let {
                {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PlanTonalButton(
                            title = "Cancel",
                            onClick = viewModel::cancelReorder,
                            height = 50.dp,
                            modifier = Modifier.weight(1f),
                        )
                        PrimaryButton(
                            title = "Save order",
                            onClick = viewModel::saveOrder,
                            isLoading = CrewDayRouteViewModel.ORDER in working,
                            modifier = Modifier.weight(1f).testTag("crewDayRouteSaveOrder"),
                        )
                    }
                }
            },
    ) {
        when (val current = state) {
            CrewDayRouteUiState.Loading -> CrewDayListPlaceholder(modifier = Modifier.testTag("crewDayLoading"))
            is CrewDayRouteUiState.Error ->
                ErrorState(
                    headline = "Couldn't load the route",
                    message = current.message,
                    onRetry = viewModel::retry,
                    modifier = Modifier.heightIn(min = 360.dp).testTag("crewDayLoadError"),
                )
            is CrewDayRouteUiState.Loaded ->
                RouteContent(
                    route = current.route,
                    order = order,
                    working = working,
                    onShowDate = viewModel::showDate,
                    onOpen = { home -> actions.onOpenHome(viewModel.crewDayId, home.id, current.route.date) },
                    onMyWay = { onWay = it },
                    onLate = { late = true },
                    onReorder = viewModel::startReorder,
                    onMove = viewModel::move,
                )
        }
    }
    onWay?.let { home ->
        OnMyWaySheet(
            home = home,
            zone = CrewDayFormat.zone(loaded?.timezone),
            onSend = { start, end ->
                onWay = null
                viewModel.onMyWay(home, start, end)
            },
            onDismiss = { onWay = null },
        )
    }
    if (late && loaded != null) {
        RunningLateSheet(
            route = loaded,
            onSend = { minutes ->
                late = false
                viewModel.runningLate(minutes)
            },
            onDismiss = { late = false },
        )
    }
    ToastHost(controller = toast)
}

@Composable
private fun RouteContent(
    route: CrewDayRouteDto,
    order: List<CrewDayHomeDto>?,
    working: Set<String>,
    onShowDate: (String) -> Unit,
    onOpen: (CrewDayHomeDto) -> Unit,
    onMyWay: (CrewDayHomeDto) -> Unit,
    onLate: () -> Unit,
    onReorder: () -> Unit,
    onMove: (Int, Int) -> Unit,
) {
    val homes = order ?: route.homes
    val next = route.homes.firstOrNull { it.isWaiting() && it.cantGetInAt == null }
    val zone = CrewDayFormat.zone(route.timezone)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        if (route.dates.size > 1) {
            PlanChoiceGroup(
                choices = route.dates.map { PlanChoice(it, CrewDayFormat.shortDate(it).orEmpty()) },
                isSelected = { it.id == route.date },
                onSelect = { onShowDate(it.id) },
                tagFor = { "crewDayRouteDate_${it.id}" },
            )
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .planCard()
                    .padding(Spacing.s4)
                    .testTag("crewDayRouteHeader")
                    .semantics(mergeDescendants = true) {},
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = listOfNotNull(homesWord(route.total), CrewDayFormat.window(route.windowStart, route.windowEnd)).joinToString(" · "),
                style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = "${route.done} of ${route.total} done",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("crewDayRouteDone"),
            )
        }
        PlanFormCard(modifier = Modifier.testTag("crewDayRouteHomes")) {
            homes.forEachIndexed { index, home ->
                RouteRow(
                    index = index,
                    home = home,
                    zone = zone,
                    first = index == 0,
                    reordering = order != null,
                    canMoveUp = index > 0,
                    canMoveDown = index < homes.lastIndex,
                    onOpen = { onOpen(home) },
                    onMove = { delta -> onMove(index, delta) },
                )
                if (order == null && home.id == next?.id) {
                    NextButtons(
                        onMyWay = { onMyWay(home) },
                        onLate = onLate,
                        onWayBusy = home.id in working,
                        lateBusy = CrewDayRouteViewModel.LATE in working,
                    )
                }
            }
        }
        if (order == null && route.homes.size > 1) {
            PlanTextButton(title = "Change the order", onClick = onReorder, modifier = Modifier.testTag("crewDayRouteReorder"))
        }
    }
}

/** On my way and Running late under the next home; stacked at the largest text sizes (board `RouteLarge`). */
@Composable
private fun NextButtons(
    onMyWay: () -> Unit,
    onLate: () -> Unit,
    onWayBusy: Boolean,
    lateBusy: Boolean,
) {
    val stacked = LocalDensity.current.fontScale >= STACK_SCALE
    val way: @Composable (Modifier) -> Unit = { modifier ->
        PrimaryButton(title = "On my way", onClick = onMyWay, isLoading = onWayBusy, modifier = modifier.testTag("crewDayRouteOnMyWay"))
    }
    val late: @Composable (Modifier) -> Unit = { modifier ->
        PlanTonalButton(
            title = "Running late",
            onClick = onLate,
            height = 50.dp,
            loading = lateBusy,
            modifier = modifier.testTag("crewDayRouteLate"),
        )
    }
    if (stacked) {
        Column(modifier = Modifier.padding(bottom = Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            way(Modifier.fillMaxWidth())
            late(Modifier.fillMaxWidth())
        }
    } else {
        Row(modifier = Modifier.padding(bottom = Spacing.s3), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            way(Modifier.weight(1f))
            late(Modifier.weight(1f))
        }
    }
}

private fun homesWord(total: Int): String = if (total == 1) "1 home" else "$total homes"

private fun CrewDayHomeDto.isDone(): Boolean = status in setOf("done", "paid", "payment_failed")

/** Still to visit on this date: booked or told "on the way", not done. */
private fun CrewDayHomeDto.isWaiting(): Boolean = status in setOf("booked", "on_the_way")

private fun CrewDayHomeDto.place(): String = address?.line ?: label.orEmpty()

@Composable
private fun RouteRow(
    index: Int,
    home: CrewDayHomeDto,
    zone: ZoneId,
    first: Boolean,
    reordering: Boolean,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    onOpen: () -> Unit,
    onMove: (Int) -> Unit,
) {
    val tone = routeTone(home)
    PlanOptionRow(
        first = first,
        onClick = if (reordering) null else onOpen,
        modifier = Modifier.testTag("crewDayRouteHome_${home.id}"),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape).background(badgeFill(home)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "${index + 1}",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                color = badgeInk(home),
            )
        }
        Column(
            modifier = Modifier.weight(1f).semantics(mergeDescendants = true) {},
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = listOfNotNull(home.place(), home.firstName).joinToString(" · "),
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            home.details?.takeIf { it.isNotBlank() }?.let {
                Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
            home.accessNote?.lineSequence()?.firstOrNull()?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextStrong,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                CrewDayToneChip(
                    text = routeStatus(home, zone),
                    tone = tone,
                    modifier = Modifier.testTag("crewDayRouteStatus_${home.id}"),
                )
                if (home.gateReadyAt != null && !home.isDone()) {
                    CrewDayToneChip(
                        text =
                            listOfNotNull("Gate is ready", CrewDayFormat.clock(CrewDayFormat.instant(home.gateReadyAt), zone))
                                .joinToString(" · "),
                        tone = CrewDayTone.Home,
                        modifier = Modifier.testTag("crewDayRouteGate_${home.id}"),
                    )
                }
            }
        }
        if (reordering) {
            PlanRoundButton(
                icon = PantopusIcon.ChevronUp,
                label = "Move ${home.place()} up",
                onClick = { if (canMoveUp) onMove(-1) },
                glass = false,
                modifier = Modifier.testTag("crewDayRouteUp_${home.id}"),
            )
            PlanRoundButton(
                icon = PantopusIcon.ChevronDown,
                label = "Move ${home.place()} down",
                onClick = { if (canMoveDown) onMove(1) },
                glass = false,
                modifier = Modifier.testTag("crewDayRouteDown_${home.id}"),
            )
        }
    }
}

private fun routeTone(home: CrewDayHomeDto): CrewDayTone =
    when {
        home.isDone() -> CrewDayTone.Ok
        home.cantGetInAt != null -> CrewDayTone.Warn
        home.status == "on_the_way" -> CrewDayTone.Info
        else -> CrewDayTone.Wait
    }

private fun badgeFill(home: CrewDayHomeDto): Color =
    when {
        home.isDone() -> PantopusColors.success
        home.cantGetInAt != null -> PantopusColors.warningLight
        home.status == "on_the_way" -> PantopusColors.primary600
        else -> PantopusColors.appSurfaceSunken
    }

private fun badgeInk(home: CrewDayHomeDto): Color =
    when {
        home.isDone() || (home.status == "on_the_way" && home.cantGetInAt == null) -> PantopusColors.appTextInverse
        home.cantGetInAt != null -> PantopusColors.warning
        else -> PantopusColors.appTextStrong
    }

/** "Done 9:48 AM · 2 photos", "On the way · told 10–11 AM", "Can't get in · 9:30 AM", "Waiting". */
internal fun routeStatus(
    home: CrewDayHomeDto,
    zone: ZoneId,
): String =
    when {
        home.isDone() -> {
            val at = CrewDayFormat.clock(CrewDayFormat.instant(home.doneAt), zone)
            val photos = home.photoCount.takeIf { it > 0 }?.let { if (it == 1) "1 photo" else "$it photos" }
            listOfNotNull(at?.let { "Done $it" } ?: "Done", photos).joinToString(" · ")
        }
        home.cantGetInAt != null ->
            listOfNotNull("Can't get in", CrewDayFormat.clock(CrewDayFormat.instant(home.cantGetInAt), zone)).joinToString(" · ")
        home.status == "on_the_way" ->
            CrewDayFormat.eta(home.eta?.start, home.eta?.end, zone)?.let { "On the way · told $it" } ?: "On the way"
        home.status == "new_dates" -> "Picking a new date"
        else -> "Waiting"
    }

/** "Riley" or "the household", for the sheets' words. */
private fun CrewDayHomeDto.who(): String = firstName?.takeIf { it.isNotBlank() } ?: "the household"

/**
 * "On my way to 127 Maple Lane" (board `Route`, sheet `way`): a one-hour window from now (rounded to the quarter
 * hour), which the crew can change, then **Tell Riley**.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OnMyWaySheet(
    home: CrewDayHomeDto,
    zone: ZoneId,
    onSend: (Instant, Instant) -> Unit,
    onDismiss: () -> Unit,
) {
    val now = ZonedDateTime.now(zone)
    val rounded = now.truncatedTo(ChronoUnit.HOURS).plusMinutes(((now.minute + QUARTER - 1) / QUARTER * QUARTER).toLong())
    var start by remember { mutableStateOf(rounded.toLocalTime()) }
    var picking by remember { mutableStateOf(false) }
    val startAt = now.with(start)
    val endAt = startAt.plusHours(1)
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, modifier = Modifier.testTag("crewDayRouteOnMyWaySheet")) {
        Column(
            modifier = Modifier.padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "On my way to ${home.place()}",
                style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text =
                    "${home.who().replaceFirstChar { it.uppercase() }} gets a push with this window and can tell you when " +
                        "the gate is ready.",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
            )
            PlanFormCard {
                PlanOptionRow(first = true, onClick = { picking = true }, modifier = Modifier.testTag("crewDayRouteOnMyWayTime")) {
                    Text(
                        text = "Expected",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = CrewDayFormat.window(start, endAt.toLocalTime()).orEmpty(),
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                }
            }
            PrimaryButton(
                title = "Tell ${home.who()}",
                onClick = { onSend(startAt.toInstant(), endAt.toInstant()) },
                modifier = Modifier.fillMaxWidth().testTag("crewDayRouteOnMyWaySend"),
            )
        }
    }
    if (picking) {
        PlanTimePickerDialog(
            initial = start,
            onPicked = { picked: LocalTime ->
                picking = false
                start = picked
            },
            onDismiss = { picking = false },
        )
    }
}

/**
 * "Running late?" (board `Route`, sheet `late`): 30, 60 or 90 minutes; every home that isn't done moves back by the
 * same amount and is told. "4 homes get a new arrival time. 123 Maple Lane moves to 10:30–11:30 AM."
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RunningLateSheet(
    route: CrewDayRouteDto,
    onSend: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    var minutes by remember { mutableIntStateOf(LATE_CHOICES.first()) }
    val zone = CrewDayFormat.zone(route.timezone)
    val waiting = route.homes.filter { it.isWaiting() }
    val first = waiting.firstOrNull()
    val moves = first?.let { shiftedWindow(it, minutes.toLong(), zone) }
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, modifier = Modifier.testTag("crewDayRouteLateSheet")) {
        Column(
            modifier = Modifier.padding(horizontal = Spacing.s4).padding(bottom = Spacing.s6),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Running late?",
                style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = "Every home that isn't done moves back by the same amount, and each one is told.",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
            )
            PlanOverline("How late")
            PlanChoiceGroup(
                choices = LATE_CHOICES.map { PlanChoice("$it", "$it min") },
                isSelected = { it.id == "$minutes" },
                onSelect = { minutes = it.id.toInt() },
                tagFor = { "crewDayRouteLate_${it.id}" },
            )
            Text(
                text =
                    (if (waiting.size == 1) "1 home gets a new arrival time." else "${waiting.size} homes get a new arrival time.") +
                        (if (first != null && moves != null) " ${first.place()} moves to $moves." else ""),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
                modifier = Modifier.testTag("crewDayRouteLatePreview"),
            )
            PrimaryButton(
                title = if (waiting.size == 1) "Tell 1 home" else "Tell ${waiting.size} homes",
                onClick = { onSend(minutes) },
                isEnabled = waiting.isNotEmpty(),
                modifier = Modifier.fillMaxWidth().testTag("crewDayRouteLateSend"),
            )
        }
    }
}

/** A home's told window (else its arrival window) moved back [minutes]: "10:30–11:30 AM". */
private fun shiftedWindow(
    home: CrewDayHomeDto,
    minutes: Long,
    zone: ZoneId,
): String? {
    val start = CrewDayFormat.instant(home.eta?.start)?.atZone(zone)?.toLocalTime() ?: CrewDayFormat.time(home.windowStart)
    val end = CrewDayFormat.instant(home.eta?.end)?.atZone(zone)?.toLocalTime() ?: CrewDayFormat.time(home.windowEnd)
    return CrewDayFormat.window(start?.plusMinutes(minutes), end?.plusMinutes(minutes))
}

private const val QUARTER = 15
private const val STACK_SCALE = 1.5f
private val LATE_CHOICES = listOf(30, 60, 90)
