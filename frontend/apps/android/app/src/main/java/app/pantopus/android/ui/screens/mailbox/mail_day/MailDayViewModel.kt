@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.mail_day

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.MailDayNudgeDto
import app.pantopus.android.data.api.models.mailbox.v2.MailDayRecapDto
import app.pantopus.android.data.api.models.mailbox.v2.MailDayReviewedDto
import app.pantopus.android.data.api.models.mailbox.v2.MailDayTodayResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailDayUnreviewedDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.mailday.MailDayRepository
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg key for the variant (`populated` or `empty`) — kept for the
 *  deep-link route; the live screen derives the frame from the data. */
const val MAIL_DAY_VARIANT_KEY = "variant"

private const val UNDO_SECONDS = 5

/**
 * A13.16 — Backs the My Mail Day physical-mail triage editor.
 *
 * `load()` fetches the day frame from `GET /api/mailbox/v2/mailday/today`
 * (unreviewed + reviewed pieces, streak, last-scan, yesterday recap, setup
 * nudges). Accepting a suggestion optimistically moves the card to the
 * reviewed rail and POSTs `/items/:id/route`, rolling back on failure.
 * Finishing the day POSTs `/finish` and reflects the bumped streak. Counts
 * are derived client-side from the rendered content.
 */
@HiltViewModel
class MailDayViewModel
    @Inject
    constructor(
        private val repository: MailDayRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MailDayUiState>(MailDayUiState.Loading)
        val state: StateFlow<MailDayUiState> = _state.asStateFlow()

        private var onScanRequested: () -> Unit = {}

        fun configure(onScanRequested: () -> Unit) {
            this.onScanRequested = onScanRequested
        }

        fun load() {
            _state.value = MailDayUiState.Loading
            viewModelScope.launch {
                _state.value =
                    when (val result = repository.today()) {
                        is NetworkResult.Success -> project(result.data)
                        is NetworkResult.Failure -> MailDayUiState.Error(result.error.displayMessage("Couldn't load Mail Day."))
                    }
            }
        }

        fun refresh() = load()

        /**
         * Build a render frame from the day response. A day with any piece
         * (reviewed or unreviewed) stays populated so the reviewed rail +
         * finish bar show; only a day with no pieces at all falls to the
         * empty hero (recap + setup nudges).
         */
        private fun project(dto: MailDayTodayResponse): MailDayUiState {
            val content =
                MailDayContent(
                    dateLabel = dto.dateLabel,
                    streakDays = dto.streakDays,
                    lastScanLabel = dto.lastScanLabel,
                    unreviewed = dto.unreviewed.map(::mapUnreviewed),
                    reviewed = dto.reviewed.map(::mapReviewed),
                    yesterdayRecap = dto.yesterdayRecap?.let(::mapRecap),
                    setupNudges = dto.setupNudges.map(::mapNudge),
                )
            return if (content.unreviewed.isEmpty() && content.reviewed.isEmpty()) {
                MailDayUiState.Empty(content)
            } else {
                MailDayUiState.Populated(content)
            }
        }

        fun requestScan() {
            onScanRequested()
        }

        /**
         * Accept the AI suggestion: optimistically move the card to the
         * reviewed list, then `POST /items/:id/route`. On failure the
         * previous content is restored.
         */
        fun acceptSuggestion(id: String) {
            val current = _state.value as? MailDayUiState.Populated ?: return
            val target = current.content.unreviewed.firstOrNull { it.id == id } ?: return
            val previous = current.content
            val firstName = target.suggestedName.substringBefore(" ", target.suggestedName)
            val newReviewed =
                listOf(
                    ReviewedMailDayItem(
                        id = target.id,
                        kind = target.kind,
                        label = target.label,
                        action = ReviewedMailAction.Routed,
                        routedTo = firstName,
                        routedTint =
                            when (target.suggestedAvatar) {
                                MailDaySuggestedAvatar.PersonalSky -> MailDayRoutedTint.PersonPrimary
                                MailDaySuggestedAvatar.HouseholdGreen -> MailDayRoutedTint.HouseholdHome
                            },
                        whenLabel = "just now",
                        undoCountdown = UNDO_SECONDS,
                    ),
                ) + current.content.reviewed.map { it.copy(undoCountdown = null) }
            _state.value =
                MailDayUiState.Populated(
                    current.content.copy(
                        unreviewed = current.content.unreviewed.filterNot { it.id == id },
                        reviewed = newReviewed,
                    ),
                )
            viewModelScope.launch {
                if (repository.route(id) is NetworkResult.Failure) {
                    _state.value = MailDayUiState.Populated(previous)
                }
            }
        }

        /** Finish-day commit — `POST /finish` bumps the streak server-side. */
        fun finishDay() {
            if (!canFinishDay) return
            val current = _state.value as? MailDayUiState.Populated ?: return
            viewModelScope.launch {
                when (val result = repository.finish()) {
                    is NetworkResult.Success ->
                        _state.value =
                            MailDayUiState.Populated(current.content.copy(streakDays = result.data.streakDays))
                    is NetworkResult.Failure -> Unit
                }
            }
        }

        fun tickUndo() {
            val current = _state.value as? MailDayUiState.Populated ?: return
            val reviewed = current.content.reviewed.toMutableList()
            val index = reviewed.indexOfFirst { (it.undoCountdown ?: 0) > 0 }
            if (index == -1) return
            val next = (reviewed[index].undoCountdown ?: 0) - 1
            reviewed[index] = reviewed[index].copy(undoCountdown = if (next > 0) next else null)
            _state.value = MailDayUiState.Populated(current.content.copy(reviewed = reviewed))
        }

        // ---- DTO → render-model mapping ----

        private fun mapUnreviewed(dto: MailDayUnreviewedDto): UnreviewedMailDayItem =
            UnreviewedMailDayItem(
                id = dto.id,
                kind = mapKind(dto.kind),
                label = dto.label,
                sender = dto.sender,
                suggestedName = dto.suggestedName,
                suggestedAvatar = mapAvatar(dto.suggestedAvatar),
                confidencePercent = dto.confidencePercent.coerceIn(0, 100),
                secondaryLabel = dto.secondaryLabel,
            )

        private fun mapReviewed(dto: MailDayReviewedDto): ReviewedMailDayItem =
            ReviewedMailDayItem(
                id = dto.id,
                kind = mapKind(dto.kind),
                label = dto.label,
                action = mapAction(dto.action),
                routedTo = dto.routedTo,
                routedTint = mapRoutedTint(dto.routedTint),
                whenLabel = dto.whenLabel,
                undoCountdown = dto.undoCountdown,
            )

        private fun mapRecap(dto: MailDayRecapDto): YesterdayRecap =
            YesterdayRecap(
                dateLabel = dto.dateLabel,
                pieces = dto.pieces,
                closedAtLabel = dto.closedAtLabel,
                segments =
                    dto.segments.map { segment ->
                        YesterdayRecap.Segment(
                            id = segment.id,
                            percent = segment.percent.toFloat(),
                            label = segment.label,
                            tint = mapSegmentTint(segment.tint),
                        )
                    },
            )

        private fun mapNudge(dto: MailDayNudgeDto): MailDaySetupNudge {
            // The id is stable; the icon + tint are the client's design.
            val autoRoute = dto.id == "auto-route"
            return MailDaySetupNudge(
                id = dto.id,
                icon = if (autoRoute) PantopusIcon.Users else PantopusIcon.Bell,
                tint = if (autoRoute) MailDaySetupNudge.NudgeTint.Home else MailDaySetupNudge.NudgeTint.Primary,
                title = dto.title,
                subtitle = dto.subtitle,
            )
        }

        private fun mapKind(raw: String): MailDayKind =
            when (raw) {
                "magazine" -> MailDayKind.Magazine
                "postcard" -> MailDayKind.Postcard
                "bill" -> MailDayKind.Bill
                "package" -> MailDayKind.Package
                "flyer" -> MailDayKind.Flyer
                else -> MailDayKind.Envelope
            }

        private fun mapAvatar(raw: String): MailDaySuggestedAvatar =
            if (raw == "household_green") MailDaySuggestedAvatar.HouseholdGreen else MailDaySuggestedAvatar.PersonalSky

        private fun mapAction(raw: String): ReviewedMailAction =
            when (raw) {
                "junked" -> ReviewedMailAction.Junked
                "returned" -> ReviewedMailAction.Returned
                else -> ReviewedMailAction.Routed
            }

        private fun mapRoutedTint(raw: String?): MailDayRoutedTint? =
            when (raw) {
                "household_home" -> MailDayRoutedTint.HouseholdHome
                "person_primary" -> MailDayRoutedTint.PersonPrimary
                else -> null
            }

        private fun mapSegmentTint(raw: String): YesterdayRecap.SegmentTint =
            when (raw) {
                "household" -> YesterdayRecap.SegmentTint.Household
                "junked" -> YesterdayRecap.SegmentTint.Junked
                "returned" -> YesterdayRecap.SegmentTint.Returned
                else -> YesterdayRecap.SegmentTint.PersonPrimary
            }

        // ---- Derived counters used by the FinishDay bar + DayHeader ----

        val total: Int
            get() {
                val populated = _state.value as? MailDayUiState.Populated ?: return 0
                return populated.content.unreviewed.size + populated.content.reviewed.size
            }

        val done: Int
            get() = (_state.value as? MailDayUiState.Populated)?.content?.reviewed?.size ?: 0

        val remaining: Int
            get() = (_state.value as? MailDayUiState.Populated)?.content?.unreviewed?.size ?: 0

        val routedCount: Int
            get() =
                (_state.value as? MailDayUiState.Populated)
                    ?.content
                    ?.reviewed
                    ?.count { it.action == ReviewedMailAction.Routed } ?: 0

        val junkedCount: Int
            get() =
                (_state.value as? MailDayUiState.Populated)
                    ?.content
                    ?.reviewed
                    ?.count { it.action == ReviewedMailAction.Junked } ?: 0

        val returnedCount: Int
            get() =
                (_state.value as? MailDayUiState.Populated)
                    ?.content
                    ?.reviewed
                    ?.count { it.action == ReviewedMailAction.Returned } ?: 0

        val canFinishDay: Boolean
            get() = _state.value is MailDayUiState.Populated && remaining == 0 && total > 0
    }
