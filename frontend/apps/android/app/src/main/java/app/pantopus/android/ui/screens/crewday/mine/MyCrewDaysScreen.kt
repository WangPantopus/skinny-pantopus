@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.crewday.mine

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.crewday.CrewDayCardDto
import app.pantopus.android.data.api.models.crewday.MyCrewDaysResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.data.crewday.CrewDaysRepository
import app.pantopus.android.data.crewday.crewDayMessage
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.crewday.components.CrewDaySection
import app.pantopus.android.ui.screens.crewday.components.CrewDayTile
import app.pantopus.android.ui.screens.plans.components.PlanRow
import app.pantopus.android.ui.screens.plans.components.PlanRowEnd
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject

sealed interface MyCrewDaysUiState {
    data object Loading : MyCrewDaysUiState

    data class Loaded(val data: MyCrewDaysResponse) : MyCrewDaysUiState {
        val isEmpty: Boolean get() = data.upcoming.isEmpty() && data.requests.isEmpty() && data.past.isEmpty()
    }

    data class Error(val message: String) : MyCrewDaysUiState
}

/** Your Crew Days (screen 10): `GET /api/crew-days/mine`, read again after any Crew Day write. */
@HiltViewModel
class MyCrewDaysViewModel
    @Inject
    constructor(
        private val repository: CrewDaysRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MyCrewDaysUiState>(MyCrewDaysUiState.Loading)
        val state: StateFlow<MyCrewDaysUiState> = _state.asStateFlow()

        init {
            viewModelScope.launch { repository.changes.drop(1).collect { load() } }
        }

        fun load() {
            viewModelScope.launch {
                when (val result = repository.mine()) {
                    is NetworkResult.Success -> _state.value = MyCrewDaysUiState.Loaded(result.data)
                    is NetworkResult.Failure ->
                        if (_state.value !is MyCrewDaysUiState.Loaded) _state.value = MyCrewDaysUiState.Error(result.error.crewDayMessage)
                }
            }
        }

        fun retry() {
            _state.value = MyCrewDaysUiState.Loading
            load()
        }
    }

/** Where Your Crew Days hands off. */
data class MyCrewDaysActions(
    val onBack: () -> Unit,
    val onOpenBooking: (bookingId: String) -> Unit,
    /** An invitation: "Book again", or a request's ready offer. */
    val onOpenInvitation: (code: String) -> Unit,
    /** "Ask for a Crew Day" (screen 11). */
    val onAsk: () -> Unit,
)

/**
 * Your Crew Days (screen 10, board `MyCrewDays`): Coming up (bookings with a status chip), Asked for (street requests:
 * Finding an option, Offer ready, No crew yet), and Done (date, price paid, photo count; Book again when the same
 * crew opened a new day nearby), then "Want a crew on your street?" and Ask for a Crew Day.
 */
@Composable
fun MyCrewDaysScreen(
    actions: MyCrewDaysActions,
    viewModel: MyCrewDaysViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    PlanPlainScaffold(onBack = actions.onBack, title = "Your Crew Days", modifier = Modifier.testTag("crewDaysMine")) {
        when (val current = state) {
            MyCrewDaysUiState.Loading -> CrewDayListPlaceholder(modifier = Modifier.testTag("crewDayLoading"))
            is MyCrewDaysUiState.Error ->
                ErrorState(
                    headline = "Couldn't load your Crew Days",
                    message = current.message,
                    onRetry = viewModel::retry,
                    modifier = Modifier.heightIn(min = 360.dp).testTag("crewDayLoadError"),
                )
            is MyCrewDaysUiState.Loaded ->
                if (current.isEmpty) {
                    EmptyState(
                        icon = PantopusIcon.CalendarCheck,
                        headline = "No Crew Days yet",
                        subcopy = "When a local crew comes to your street, you'll book it here.",
                        ctaTitle = "Ask for a Crew Day",
                        onCta = actions.onAsk,
                        modifier = Modifier.heightIn(min = 420.dp).testTag("crewDaysMineEmpty"),
                        tint = PantopusColors.homeBg,
                        accent = PantopusColors.home,
                    )
                } else {
                    MineContent(current.data, actions)
                }
        }
    }
}

@Composable
private fun MineContent(
    data: MyCrewDaysResponse,
    actions: MyCrewDaysActions,
) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        if (data.upcoming.isNotEmpty()) {
            CrewDaySection("Coming up") {
                data.upcoming.forEachIndexed { index, card ->
                    PlanRow(
                        title = card.title,
                        subtitle = CrewDayFormat.dateAndWindow(card.serviceDate, card.windowStart, card.windowEnd),
                        end = PlanRowEnd.Status(upcomingWord(card)),
                        first = index == 0,
                        leading = { CrewDayTile() },
                        onClick = { card.bookingId?.let(actions.onOpenBooking) },
                        modifier = Modifier.testTag("crewDaysMineBooking_${card.key}"),
                    )
                }
            }
        }
        if (data.requests.isNotEmpty()) {
            CrewDaySection("Asked for") {
                data.requests.forEachIndexed { index, request ->
                    PlanRow(
                        title = request.title.ifBlank { request.serviceLabel ?: CrewDayFormat.service(request.service) },
                        subtitle =
                            listOfNotNull(
                                CrewDayFormat.shortDate(CrewDayFormat.instant(request.createdAt), CrewDayFormat.DEFAULT_ZONE)
                                    ?.let { "Asked ${it.substringAfter(", ")}" },
                                monthsWords(request.months),
                            ).joinToString(" · "),
                        end = PlanRowEnd.Status(requestWord(request.status)),
                        first = index == 0,
                        leading = { CrewDayTile() },
                        onClick = request.offer?.code?.let { code -> { actions.onOpenInvitation(code) } },
                        modifier = Modifier.testTag("crewDaysMineRequest_${request.key}"),
                        below =
                            request.answerNote?.takeIf { it.isNotBlank() }?.let { note ->
                                { Text(text = "Pantopus: $note", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
                            },
                    )
                }
            }
        }
        if (data.past.isNotEmpty()) {
            CrewDaySection("Done") {
                data.past.forEachIndexed { index, card ->
                    PlanRow(
                        title = card.title,
                        subtitle = pastLine(card),
                        end = if (card.bookAgain?.code != null) PlanRowEnd.Note("Book again") else PlanRowEnd.Chevron,
                        first = index == 0,
                        leading = { CrewDayTile() },
                        onClick = { card.bookingId?.let(actions.onOpenBooking) },
                        modifier = Modifier.testTag("crewDaysMinePast_${card.key}"),
                        below =
                            card.bookAgain?.code?.let { code ->
                                {
                                    PlanTextButton(
                                        title = "Book again",
                                        onClick = { actions.onOpenInvitation(code) },
                                        modifier = Modifier.testTag("crewDaysMineBookAgain_${card.key}"),
                                    )
                                }
                            },
                    )
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = "Want a crew on your street?",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(
                text = "Tell us the service. We look for a local crew.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            PrimaryButton(
                title = "Ask for a Crew Day",
                onClick = actions.onAsk,
                modifier = Modifier.fillMaxWidth().testTag("crewDaysMineAsk"),
            )
        }
    }
}

/** The status chip for a coming-up booking (01-spec rule 10: honest words). */
private fun upcomingWord(card: CrewDayCardDto): String =
    when {
        card.problemStatus == "open" -> "Support has it"
        else ->
            when (card.status) {
                "price_pending" -> "Requested"
                "price_offered" -> "Price ready"
                "new_dates" -> "Pick a date"
                "on_the_way" -> "On the way"
                "done" -> "Done"
                "payment_failed" -> "Pay now"
                else -> "Booked"
            }
    }

private fun requestWord(status: String?): String =
    when (status) {
        "offer_ready" -> "Offer ready"
        "no_crew" -> "No crew yet"
        else -> "Finding an option"
    }

/** "March or April", "December, January or February", or "Any time" for a request's months (`2026-12`, `any`). */
private fun monthsWords(months: List<String>): String? {
    if (months.isEmpty()) return null
    if (months.contains("any")) return "Any time"
    val names =
        months.mapNotNull { m ->
            runCatching { YearMonth.parse(m).month.getDisplayName(TextStyle.FULL, Locale.US) }.getOrNull()
        }
    return if (names.size > 1) "${names.dropLast(1).joinToString(", ")} or ${names.last()}" else names.firstOrNull()
}

/** "Tue, Oct 27 · Paid $180 · 3 photos". */
private fun pastLine(card: CrewDayCardDto): String {
    val paid =
        when (card.status) {
            "paid" -> card.priceCents?.let { "Paid ${CrewDayFormat.price(it)}" }
            "refunded" -> "Refunded"
            "cancelled" -> "Cancelled"
            "declined" -> "Not taken"
            else -> null
        }
    val photos = card.photoCount.takeIf { it > 0 }?.let { if (it == 1) "1 photo" else "$it photos" }
    return listOfNotNull(CrewDayFormat.shortDate(card.serviceDate), paid, photos).joinToString(" · ")
}
