@file:Suppress("LongMethod", "TooManyFunctions", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.crewday.dates

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayCrewViewDto
import app.pantopus.android.data.api.models.crewday.CrewDayHomeDto
import app.pantopus.android.data.api.models.crewday.CrewDayProposedDateDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.crewday.CrewDayRoutes
import app.pantopus.android.ui.screens.crewday.components.CrewDayFlowScaffold
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.crewday.components.CrewDayTone
import app.pantopus.android.ui.screens.crewday.components.CrewDayToneChip
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanLockLine
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** One arrival window a proposed date can take. */
data class ProposedWindow(val start: LocalTime, val end: LocalTime) {
    val words: String get() = CrewDayFormat.window(start, end).orEmpty()
}

data class ProposeDatesState(
    val view: CrewDayCrewViewDto? = null,
    val loadError: String? = null,
    /** The picked dates, each with its window. */
    val picks: Map<LocalDate, ProposedWindow> = emptyMap(),
    val sending: Boolean = false,
    val error: String? = null,
) {
    val dates: List<LocalDate> get() = picks.keys.sorted()

    /** The day's own window: what a newly picked date starts with. */
    val dayWindow: ProposedWindow
        get() =
            ProposedWindow(
                CrewDayFormat.time(view?.windowStart) ?: DEFAULT_START,
                CrewDayFormat.time(view?.windowEnd) ?: DEFAULT_END,
            )

    /** The day's window, an hour earlier, an hour later (board `ProposeDates`: 8–12, 9–1, 10–2). */
    val windowChoices: List<ProposedWindow>
        get() = listOf(-1L, 0L, 1L).map { ProposedWindow(dayWindow.start.plusHours(it), dayWindow.end.plusHours(it)) }

    val canSend: Boolean get() = !sending && picks.size in MIN_DATES..MAX_DATES

    companion object {
        const val MIN_DATES = 2
        const val MAX_DATES = 3
        const val DAYS_AHEAD = 14L
    }
}

/**
 * Propose new dates (screen 18): two or three dates in the next 14 days, each with an arrival window, and Send to N
 * homes (`POST /:id/propose-dates`). Once sent, each home's answer (`new_date_choice`), the deadline, and the route
 * for each date.
 */
@HiltViewModel
class CrewDayProposeDatesViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val crewDayId: String = savedStateHandle.get<String>(CrewDayRoutes.CREW_DAY_ID_KEY).orEmpty()
        private val _state = MutableStateFlow(ProposeDatesState())
        val state: StateFlow<ProposeDatesState> = _state.asStateFlow()

        fun load() {
            viewModelScope.launch {
                when (val result = repository.crewDay(crewDayId)) {
                    is NetworkResult.Success -> _state.update { it.copy(view = result.data, loadError = null) }
                    is NetworkResult.Failure -> _state.update { it.copy(loadError = result.error.crewDayMessage) }
                }
            }
        }

        fun toggle(date: LocalDate) =
            _state.update {
                when {
                    date in it.picks -> it.copy(picks = it.picks - date, error = null)
                    it.picks.size >= ProposeDatesState.MAX_DATES -> it
                    else -> it.copy(picks = it.picks + (date to it.dayWindow), error = null)
                }
            }

        fun setWindow(
            date: LocalDate,
            window: ProposedWindow,
        ) = _state.update { if (date in it.picks) it.copy(picks = it.picks + (date to window)) else it }

        fun send() {
            val s = _state.value
            if (!s.canSend) return
            _state.update { it.copy(sending = true, error = null) }
            viewModelScope.launch {
                val dates =
                    s.dates.map { date ->
                        val window = s.picks.getValue(date)
                        CrewDayProposedDateDto(date.toString(), window.start.toString(), window.end.toString())
                    }
                when (val result = repository.proposeDates(crewDayId, dates, null)) {
                    is NetworkResult.Success -> {
                        _state.update { it.copy(sending = false, picks = emptyMap()) }
                        load()
                    }
                    is NetworkResult.Failure -> _state.update { it.copy(sending = false, error = result.error.crewDayMessage) }
                }
            }
        }
    }

/** Propose new dates (board `ProposeDates`), then the answers (`DatesAnswers`). */
@Composable
fun CrewDayProposeDatesScreen(
    onBack: () -> Unit,
    onOpenRoute: (crewDayId: String, date: String) -> Unit,
    viewModel: CrewDayProposeDatesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    val view = state.view
    val proposal = view?.proposal
    val homes = view?.bookings.orEmpty().count { it.status in setOf("booked", "new_dates") }
    CrewDayFlowScaffold(
        title = if (proposal != null) "New dates" else "Propose new dates",
        onBack = onBack,
        modifier = Modifier.testTag(if (proposal != null) "crewDayDatesAnswers" else "crewDayProposeDates"),
        footer =
            if (view != null && proposal == null) {
                {
                    state.error?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error) }
                    PrimaryButton(
                        title = "Send to ${homesWord(homes)}",
                        onClick = viewModel::send,
                        isEnabled = state.canSend && homes > 0,
                        isLoading = state.sending,
                        modifier = Modifier.fillMaxWidth().testTag("crewDayProposeDatesSend"),
                    )
                }
            } else {
                null
            },
    ) {
        when {
            view == null && state.loadError != null ->
                ErrorState(
                    headline = "Couldn't load this Crew Day",
                    message = state.loadError.orEmpty(),
                    onRetry = viewModel::load,
                    modifier = Modifier.heightIn(min = 360.dp).testTag("crewDayLoadError"),
                )
            view == null -> CrewDayListPlaceholder(modifier = Modifier.testTag("crewDayLoading"))
            proposal != null -> Answers(view, onOpenRoute = { date -> onOpenRoute(viewModel.crewDayId, date) })
            else -> Proposal(state, homes, viewModel)
        }
    }
}

private fun homesWord(count: Int): String = if (count == 1) "1 home" else "$count homes"

@Composable
private fun Proposal(
    state: ProposeDatesState,
    homes: Int,
    viewModel: CrewDayProposeDatesViewModel,
) {
    val view = state.view ?: return
    val zone = CrewDayFormat.zone(view.timezone)
    val today = LocalDate.now(zone)
    val days = (1..ProposeDatesState.DAYS_AHEAD).map { today.plusDays(it) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s5)) {
        Text(
            text = "Rain? Offer 2 or 3 dates. Each household picks one or cancels at no charge. Nobody is moved without saying yes.",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextStrong,
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PlanOverline("Next 14 days", modifier = Modifier.weight(1f))
                Text(
                    text = "${state.picks.size} of ${ProposeDatesState.MAX_DATES} picked",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("crewDayProposeDatesCount"),
                )
            }
            days.chunked(DAYS_PER_ROW).forEach { week ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    week.forEach { day ->
                        DayChip(
                            day = day,
                            picked = day in state.picks,
                            onToggle = { viewModel.toggle(day) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    repeat(DAYS_PER_ROW - week.size) { Box(modifier = Modifier.weight(1f)) }
                }
            }
        }
        if (state.picks.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanOverline("Arrival windows")
                PlanFormCard(modifier = Modifier.testTag("crewDayProposeDatesWindows")) {
                    state.dates.forEachIndexed { index, date ->
                        WindowRow(
                            date = date,
                            window = state.picks.getValue(date),
                            choices = state.windowChoices,
                            first = index == 0,
                            onPick = { viewModel.setWindow(date, it) },
                        )
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanOverline("What each household gets")
                Row(
                    modifier = Modifier.fillMaxWidth().planCard().padding(14.dp).semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    PlanIconTile(PantopusIcon.CloudRain, PantopusColors.warningLight, PantopusColors.warning)
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = "Rain changed the plan",
                            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appText,
                        )
                        Text(
                            text = preview(state, zone),
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextStrong,
                            modifier = Modifier.testTag("crewDayProposeDatesPreview"),
                        )
                    }
                }
            }
        }
        PlanBanner(
            title = "Goes to ${homesWord(homes)}.",
            subtitle =
                "Your ${CrewDayFormat.weekday(CrewDayFormat.date(view.serviceDate)) ?: "planned"} visit is called off for everyone " +
                    "when you send.",
            icon = PantopusIcon.TriangleAlert,
            tone = PlanBannerTone.Warning,
            modifier = Modifier.testTag("crewDayProposeDatesWarning"),
        )
    }
}

/** "Your crew can come Thu, Nov 19 or Sat, Nov 21 at the same price. … If you don't answer by Wed 9 AM, …" */
private fun preview(
    state: ProposeDatesState,
    zone: ZoneId,
): String {
    val names = state.dates.map { CrewDayFormat.shortDate(it).orEmpty() }
    val list = if (names.size > 1) "${names.dropLast(1).joinToString(", ")} or ${names.last()}" else names.firstOrNull().orEmpty()
    val first = state.dates.firstOrNull()?.let { state.picks.getValue(it).start.atDate(it).atZone(zone).minusHours(DEADLINE_HOURS) }
    val deadline = first?.let { "${it.format(WEEKDAY)} ${CrewDayFormat.clock(it.toLocalTime())}" }
    val crew = state.view?.crew?.name?.takeIf { it.isNotBlank() } ?: "Your crew"
    return "$crew can come $list at the same price. No payment has been taken." +
        (deadline?.let { " If you don't answer by $it, we won't book a new date." } ?: "")
}

@Composable
private fun DayChip(
    day: LocalDate,
    picked: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier =
            modifier
                .heightIn(min = 56.dp)
                .clip(shape)
                .background(if (picked) PantopusColors.primary600 else PantopusColors.appSurface)
                .border(1.dp, if (picked) PantopusColors.primary600 else PantopusColors.appBorder, shape)
                .toggleable(value = picked, role = Role.Checkbox, onValueChange = { onToggle() })
                .semantics { contentDescription = day.format(SPOKEN) }
                .testTag("crewDayProposeDatesDate_$day"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = day.format(WEEKDAY),
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
            color = if (picked) PantopusColors.primary100 else PantopusColors.appTextSecondary,
        )
        Text(
            text = "${day.dayOfMonth}",
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = if (picked) PantopusColors.appTextInverse else PantopusColors.appText,
        )
    }
}

@Composable
private fun WindowRow(
    date: LocalDate,
    window: ProposedWindow,
    choices: List<ProposedWindow>,
    first: Boolean,
    onPick: (ProposedWindow) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    PlanOptionRow(first = first, onClick = { open = true }, modifier = Modifier.testTag("crewDayProposeDatesWindow_$date")) {
        Text(
            text = CrewDayFormat.shortDate(date).orEmpty(),
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Box {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(text = window.words, style = PantopusTextStyle.body, color = PantopusColors.appText)
                PantopusIconImage(PantopusIcon.ChevronDown, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextSecondary)
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                choices.forEach { choice ->
                    DropdownMenuItem(
                        text = { Text(choice.words) },
                        onClick = {
                            open = false
                            onPick(choice)
                        },
                        modifier = Modifier.testTag("crewDayProposeDatesWindowChoice_${choice.start}"),
                    )
                }
            }
        }
    }
}

/** A home's answer to the proposal: a date, "cancel", or null (no answer yet). */
private fun CrewDayHomeDto.answer(proposalId: String): String? =
    newDateChoice?.takeIf { it["proposal_id"] == proposalId }?.get("date") as? String

/**
 * The answers (board `DatesAnswers`): "Rain moved Tue, Nov 17", the deadline, the counts, each home's answer, the
 * route for each date, and what happens to homes that don't answer.
 */
@Composable
private fun Answers(
    view: CrewDayCrewViewDto,
    onOpenRoute: (String) -> Unit,
) {
    val proposal = view.proposal ?: return
    val zone = CrewDayFormat.zone(view.timezone)
    val homes = (view.bookings + view.ended).filter { it.newDateChoice != null || it.status == "new_dates" }
    val picked = homes.filter { it.answer(proposal.id).let { a -> a != null && a != "cancel" } }
    val cancelled = homes.filter { it.answer(proposal.id) == "cancel" }
    val waiting = homes.filter { it.answer(proposal.id) == null }
    val deadline = CrewDayFormat.instant(proposal.deadlineAt)
    val deadlineWords = deadline?.let { "${CrewDayFormat.shortDate(it, zone)}, ${CrewDayFormat.clock(it, zone)}" }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s5)) {
        Column(
            modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4).semantics(mergeDescendants = true) {},
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            CrewDayToneChip(
                text = if (waiting.isEmpty()) "Everyone answered" else "Waiting for answers",
                tone = if (waiting.isEmpty()) CrewDayTone.Ok else CrewDayTone.Warn,
            )
            Text(
                text = "Rain moved ${CrewDayFormat.shortDate(view.serviceDate).orEmpty()}",
                style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            deadlineWords?.let {
                Text(text = "Answers due $it", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
            Text(
                text = "${picked.size} picked a date · ${cancelled.size} cancelled · ${waiting.size} no answer yet",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextStrong,
                modifier = Modifier.testTag("crewDayDatesAnswersCounts"),
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PlanOverline("Answers")
            PlanFormCard {
                homes.forEachIndexed { index, home ->
                    val answer = home.answer(proposal.id)
                    PlanOptionRow(
                        first = index == 0,
                        modifier = Modifier.testTag("crewDayDatesAnswer_${home.id}").semantics(mergeDescendants = true) {},
                    ) {
                        Text(
                            text = home.label ?: "A home",
                            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appText,
                            modifier = Modifier.weight(1f),
                        )
                        when (answer) {
                            null -> CrewDayToneChip("No answer yet", CrewDayTone.Warn)
                            "cancel" -> CrewDayToneChip("Cancelled", CrewDayTone.Wait)
                            else -> CrewDayToneChip(CrewDayFormat.shortDate(answer).orEmpty(), CrewDayTone.Info)
                        }
                    }
                }
                PlanLockLine(
                    text = "Addresses show at 6 PM the evening before each date.",
                    modifier = Modifier.padding(vertical = Spacing.s3),
                )
            }
        }
        val byDate = picked.groupBy { it.answer(proposal.id).orEmpty() }
        if (byDate.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanOverline("Route for each date")
                proposal.dates.filter { it.date in byDate }.forEach { date ->
                    val list = byDate.getValue(date.date)
                    Column(
                        modifier = Modifier.fillMaxWidth().planCard().padding(14.dp).testTag("crewDayDatesRoute_${date.date}"),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Column(modifier = Modifier.semantics(mergeDescendants = true) {}) {
                            Text(
                                text = CrewDayFormat.dateAndWindow(date.date, date.windowStart, date.windowEnd),
                                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                                color = PantopusColors.appText,
                            )
                            Text(
                                text = "${homesWord(list.size)}: ${list.joinToString(", ") { it.label ?: "A home" }}",
                                style = PantopusTextStyle.small,
                                color = PantopusColors.appTextSecondary,
                            )
                        }
                        PlanTonalButton(
                            title = "Open route",
                            onClick = { onOpenRoute(date.date) },
                            height = 40.dp,
                            modifier = Modifier.fillMaxWidth().testTag("crewDayDatesOpenRoute_${date.date}"),
                        )
                    }
                }
            }
        }
        if (waiting.isNotEmpty() && deadline != null) {
            Text(
                text =
                    "If ${waiting.joinToString(", ") { it.label ?: "a home" }} " +
                        "${if (waiting.size == 1) "doesn't" else "don't"} answer by " +
                        "${CrewDayFormat.shortDate(deadline, zone)} at ${CrewDayFormat.clock(deadline, zone)}, " +
                        "${if (waiting.size == 1) "its booking is" else "their bookings are"} cancelled at no charge.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

private val DEFAULT_START: LocalTime = LocalTime.of(9, 0)
private val DEFAULT_END: LocalTime = LocalTime.of(13, 0)
private const val DAYS_PER_ROW = 7
private const val DEADLINE_HOURS = 24L
private val WEEKDAY = DateTimeFormatter.ofPattern("EEE", Locale.US)
private val SPOKEN = DateTimeFormatter.ofPattern("EEEE, MMMM d", Locale.US)
