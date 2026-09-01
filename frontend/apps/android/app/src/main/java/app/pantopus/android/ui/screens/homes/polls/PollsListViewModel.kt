@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.homes.polls

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.PollDto
import app.pantopus.android.data.api.models.homes.UpdatePollRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Canonical poll-row chip status. */
enum class PollChipStatus { Active, Closing, Closed }

/** Tab identifiers for the Polls shell. */
enum class PollsTab(val id: String) {
    Active("active"),
    Closed("closed"),
    ;

    companion object {
        fun fromId(id: String): PollsTab = entries.firstOrNull { it.id == id } ?: Active
    }
}

/** Pure projection of one poll into a row's display fields. */
data class PollRowProjection(
    val title: String,
    val subtitle: String,
    val kind: PollKind,
    val chipStatus: PollChipStatus,
    val chipText: String,
    val chipVariant: StatusChipVariant,
    val chipIcon: PantopusIcon?,
    val votedChip: RowChip?,
    val leadingChip: RowChip?,
    val timeMeta: String?,
)

/** Banner summary projection. */
data class PollsBannerSummary(
    val awaitingViewerVote: Int,
    val totalActive: Int,
) {
    val hasContent: Boolean get() = totalActive > 0
}

/**
 * One-shot event the screen turns into a confirm dialog. The VM never
 * presents UI itself — same contract as `MyHomesListEvent`.
 */
sealed interface PollsListEvent {
    /** "Close" tapped on an active poll card. */
    data class ConfirmClose(
        val pollId: String,
        val title: String,
    ) : PollsListEvent

    /** "Delete" tapped on an active poll card. */
    data class ConfirmDelete(
        val pollId: String,
        val title: String,
    ) : PollsListEvent
}

/** Nav arg key for the Polls list route. */
const val POLLS_HOME_ID_KEY = "homeId"

/**
 * ViewModel for the Polls list (T6.3e / P13). Fetches
 * `GET /api/homes/:id/polls` and projects each `PollDto` into a
 * poll-kind-tinted `RowLeading.TypeIcon` + `RowTrailing.Chevron` row
 * with a "Leading: <option>" chip derived from
 * [PollDto.optionCounts].
 *
 *  - Tab filtering: Active = chip is Active/Closing; Closed = chip is Closed.
 *  - Chip derivation: closed (`status` ∈ {`closed`,`canceled`} or
 *    `closes_at` is past) → Closing (active + `closes_at` ≤ 24 h) →
 *    Active.
 *  - Top-bar action: `null` by design — design's filter glyph isn't
 *    wired yet.
 *  - FAB: secondary-create + home tint, routes to the `onStartPoll`
 *    callback.
 */
@HiltViewModel
class PollsListViewModel
    internal constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
        private val viewerId: String? = null,
        private val clock: () -> Instant = Instant::now,
    ) : ViewModel() {
        @Inject
        constructor(
            repo: HomesRepository,
            savedStateHandle: SavedStateHandle,
        ) : this(repo, savedStateHandle, null, Instant::now)

        private val homeId: String =
            checkNotNull(savedStateHandle.get<String>(POLLS_HOME_ID_KEY)) {
                "PollsListViewModel requires a $POLLS_HOME_ID_KEY nav argument"
            }

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(PollsTab.Active.id)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(initialTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        /**
         * Set when a card's Close / Delete footer button fires. The
         * screen drains it into an `AlertDialog` and calls
         * [acknowledgeEvent].
         */
        private val _pendingEvent = MutableStateFlow<PollsListEvent?>(null)
        val pendingEvent: StateFlow<PollsListEvent?> = _pendingEvent.asStateFlow()

        /** Surfaced by the screen when a close / delete fails. */
        private val _actionError = MutableStateFlow<String?>(null)
        val actionError: StateFlow<String?> = _actionError.asStateFlow()

        /** Poll id whose mutation is in flight — repeat taps are ignored. */
        private var mutatingPollId: String? = null

        private var polls: List<PollDto>? = null
        private var onOpenPoll: (String) -> Unit = {}
        private var onStartPoll: () -> Unit = {}

        fun configureNavigation(
            onOpenPoll: (String) -> Unit = {},
            onStartPoll: () -> Unit = {},
        ) {
            this.onOpenPoll = onOpenPoll
            this.onStartPoll = onStartPoll
        }

        fun load() {
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.getHomePolls(homeId)) {
                    is NetworkResult.Success -> applySuccess(result.data.polls)
                    is NetworkResult.Failure -> {
                        polls = null
                        _banner.value = null
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                    }
                }
            }
        }

        fun selectTab(id: String) {
            _selectedTab.value = id
            polls?.let(::renderForCurrentTab)
        }

        fun fab(): FabAction =
            FabAction(
                icon = PantopusIcon.Plus,
                contentDescription = "Start a poll",
                variant = FabVariant.SecondaryCreate,
                tint = FabTint.Home,
                onClick = { onStartPoll() },
            )

        /** T6.3e: top-bar action is `null` by design. */
        val topBarAction: TopBarAction? = null

        /**
         * Compute the banner summary for the currently-loaded polls.
         * Exposed `internal` so tests can exercise it without going
         * through the Compose layer.
         */
        fun currentBannerSummary(): PollsBannerSummary {
            val loaded = polls ?: return PollsBannerSummary(0, 0)
            return summarize(loaded, viewerId, clock())
        }

        /**
         * "Close" tapped — hand the confirm to the screen. RN raises the
         * same prompt from the active poll card
         * (`src/app/homes/[id]/polls.tsx:75-83`).
         */
        fun requestClose(pollId: String) {
            val poll = polls?.firstOrNull { it.id == pollId } ?: return
            _pendingEvent.value = PollsListEvent.ConfirmClose(pollId, poll.title)
        }

        /**
         * "Delete" tapped — hand the confirm to the screen
         * (`src/app/homes/[id]/polls.tsx:85-93`).
         */
        fun requestDelete(pollId: String) {
            val poll = polls?.firstOrNull { it.id == pollId } ?: return
            _pendingEvent.value = PollsListEvent.ConfirmDelete(pollId, poll.title)
        }

        /** Clears [pendingEvent] once the screen has opened its dialog. */
        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        /** Clears the mutation-failure alert. */
        fun clearActionError() {
            _actionError.value = null
        }

        /**
         * Close a poll to further votes — `PUT /api/homes/:id/polls/:pollId`
         * with `status = "closed"` (route `backend/routes/home.js:7381`;
         * `updatePollSchema` accepts `open / closed / canceled`).
         */
        fun closePoll(pollId: String) {
            mutate(pollId, "closed", "Couldn't close that poll. Try again.")
        }

        /**
         * Retire a poll — same route with `status = "canceled"`, the
         * schema's removal value. The backend exposes no DELETE for
         * polls, so this is the strongest retire the API offers; a
         * canceled poll drops out of the Active tab just like a closed
         * one.
         */
        fun deletePoll(pollId: String) {
            mutate(pollId, "canceled", "Couldn't delete that poll. Try again.")
        }

        private fun mutate(
            pollId: String,
            status: String,
            failureCopy: String,
        ) {
            if (mutatingPollId != null) return
            mutatingPollId = pollId
            viewModelScope.launch {
                val result =
                    repo.updateHomePoll(
                        homeId = homeId,
                        pollId = pollId,
                        request = UpdatePollRequest(status = status),
                    )
                mutatingPollId = null
                when (result) {
                    // RN re-fetches after the mutation rather than
                    // patching locally, so vote counts stay
                    // server-authoritative.
                    is NetworkResult.Success -> refresh()
                    is NetworkResult.Failure ->
                        _actionError.value = result.error.displayMessage(failureCopy)
                }
            }
        }

        private fun applySuccess(loaded: List<PollDto>) {
            polls = loaded
            _tabs.value = tabsWithCounts(loaded)
            renderForCurrentTab(loaded)
        }

        private fun renderForCurrentTab(loaded: List<PollDto>) {
            val now = clock()
            val tab = PollsTab.fromId(_selectedTab.value)
            val active = loaded.filter { passes(it, tab, now) }
            if (active.isEmpty()) {
                _banner.value = null
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCircle,
                        headline = emptyHeadline(tab),
                        subcopy = emptySubcopy(tab),
                        ctaTitle = if (tab == PollsTab.Active) "Start a poll" else null,
                        onCta = if (tab == PollsTab.Active) ({ onStartPoll() }) else null,
                    )
                return
            }
            val rows = active.map { rowFor(it, now) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "polls", rows = rows)),
                    hasMore = false,
                )
            _banner.value = bannerFor(tab, loaded, now)
        }

        private fun bannerFor(
            tab: PollsTab,
            loaded: List<PollDto>,
            now: Instant,
        ): BannerConfig? {
            if (tab != PollsTab.Active) return null
            val summary = summarize(loaded, viewerId, now)
            if (!summary.hasContent) return null
            return BannerConfig(
                icon = PantopusIcon.CheckCircle,
                title = bannerTitle(summary),
                subtitle = bannerSubtitle(summary),
                tint = BannerCtaTint.Home,
            )
        }

        private fun bannerTitle(summary: PollsBannerSummary): String =
            when {
                summary.awaitingViewerVote == 1 -> "1 poll needs your vote"
                summary.awaitingViewerVote > 0 ->
                    "${summary.awaitingViewerVote} polls need your vote"
                else -> "You're caught up on votes"
            }

        private fun bannerSubtitle(summary: PollsBannerSummary): String? {
            if (summary.totalActive == 0) return null
            return if (summary.totalActive == 1) {
                "1 active in this household"
            } else {
                "${summary.totalActive} active in this household"
            }
        }

        private fun rowFor(
            poll: PollDto,
            now: Instant,
        ): RowModel {
            val projection = project(poll, now)
            val chips =
                mutableListOf<RowChip>(
                    RowChip(
                        text = projection.chipText,
                        icon = projection.chipIcon,
                        tint = RowChip.Tint.Status(projection.chipVariant),
                    ),
                )
            projection.leadingChip?.let { chips += it }
            projection.votedChip?.let { chips += it }
            return RowModel(
                id = poll.id,
                title = projection.title,
                subtitle = projection.subtitle,
                template = RowTemplate.FileChevron,
                leading =
                    RowLeading.TypeIcon(
                        icon = projection.kind.icon,
                        background = projection.kind.background,
                        foreground = projection.kind.foreground,
                    ),
                trailing = RowTrailing.Chevron,
                onTap = { onOpenPoll(poll.id) },
                chips = chips,
                timeMeta = projection.timeMeta,
                highlight = if (projection.chipStatus == PollChipStatus.Closed) RowHighlight.Muted else null,
                footer = footerFor(projection, poll.id),
            )
        }

        /**
         * RN renders a Close + Delete action strip under every **active**
         * poll card (`src/app/homes/[id]/polls.tsx:198-209`); closed
         * polls carry no actions. Rendered here as the shell's
         * [RowFooter].
         */
        private fun footerFor(
            projection: PollRowProjection,
            pollId: String,
        ): RowFooter? {
            if (projection.chipStatus == PollChipStatus.Closed) return null
            return RowFooter(
                actions =
                    listOf(
                        RowFooterAction(
                            title = "Close",
                            icon = PantopusIcon.Lock,
                            variant = CompactButtonVariant.Ghost,
                            testTag = "polls.row_$pollId.close",
                            onClick = { requestClose(pollId) },
                        ),
                        RowFooterAction(
                            title = "Delete",
                            icon = PantopusIcon.Trash,
                            variant = CompactButtonVariant.Destructive,
                            testTag = "polls.row_$pollId.delete",
                            onClick = { requestDelete(pollId) },
                        ),
                    ),
            )
        }

        private fun passes(
            poll: PollDto,
            tab: PollsTab,
            now: Instant,
        ): Boolean {
            val status = chipStatus(poll, now)
            return when (tab) {
                PollsTab.Active -> status != PollChipStatus.Closed
                PollsTab.Closed -> status == PollChipStatus.Closed
            }
        }

        private fun tabsWithCounts(loaded: List<PollDto>): List<ListOfRowsTab> {
            val now = clock()
            var active = 0
            var closed = 0
            for (poll in loaded) {
                when (chipStatus(poll, now)) {
                    PollChipStatus.Closed -> closed += 1
                    PollChipStatus.Active, PollChipStatus.Closing -> active += 1
                }
            }
            return listOf(
                ListOfRowsTab(PollsTab.Active.id, "Active", active),
                ListOfRowsTab(PollsTab.Closed.id, "Closed", closed),
            )
        }

        private fun initialTabs(): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(PollsTab.Active.id, "Active"),
                ListOfRowsTab(PollsTab.Closed.id, "Closed"),
            )

        private fun emptyHeadline(tab: PollsTab): String =
            when (tab) {
                PollsTab.Active -> "No active polls"
                PollsTab.Closed -> "No closed polls yet"
            }

        private fun emptySubcopy(tab: PollsTab): String =
            when (tab) {
                PollsTab.Active ->
                    "Ask the household. Paint colours, weekend plans, whether to replace " +
                        "the dishwasher — get a quick read instead of a long thread."
                PollsTab.Closed ->
                    "Closed polls show up here once a vote wraps up or a member closes it manually."
            }

        companion object {
            /**
             * Derive the chip status per the T6.3e contract:
             *  - [PollChipStatus.Closed] when `status` is "closed"/"canceled"
             *    OR `closes_at` is in the past.
             *  - [PollChipStatus.Closing] when active AND `closes_at` is
             *    within the next 24 h.
             *  - [PollChipStatus.Active] otherwise.
             */
            @JvmStatic
            fun chipStatus(
                poll: PollDto,
                now: Instant,
            ): PollChipStatus {
                val normalised = poll.status.lowercase()
                if (normalised == "closed" || normalised == "canceled" || normalised == "cancelled") {
                    return PollChipStatus.Closed
                }
                val closesAt = poll.closesAt?.let(::parseInstant)
                return when {
                    closesAt != null && closesAt.isBefore(now) -> PollChipStatus.Closed
                    closesAt != null && !closesAt.isAfter(now.plus(Duration.ofHours(24))) ->
                        PollChipStatus.Closing
                    else -> PollChipStatus.Active
                }
            }

            /** Pure mapping from a poll + clock to display strings. */
            @JvmStatic
            fun project(
                poll: PollDto,
                now: Instant,
            ): PollRowProjection {
                val kind = PollKind.from(poll.pollType, poll.title)
                val status = chipStatus(poll, now)
                val voteWord = if (poll.voteCount == 1) "vote" else "votes"
                val subtitle = "${poll.voteCount} $voteWord · ${poll.options.size} options"
                val timeMeta = timeMetaText(poll, status, now)
                val chipText: String
                val chipVariant: StatusChipVariant
                val chipIcon: PantopusIcon?
                when (status) {
                    PollChipStatus.Active -> {
                        chipText = "Active"
                        chipVariant = StatusChipVariant.Success
                        chipIcon = PantopusIcon.Circle
                    }
                    PollChipStatus.Closing -> {
                        chipText = "Closes soon"
                        chipVariant = StatusChipVariant.Warning
                        chipIcon = PantopusIcon.Clock
                    }
                    PollChipStatus.Closed -> {
                        chipText = "Closed"
                        chipVariant = StatusChipVariant.Neutral
                        chipIcon = PantopusIcon.Lock
                    }
                }
                return PollRowProjection(
                    title = poll.title,
                    subtitle = subtitle,
                    kind = kind,
                    chipStatus = status,
                    chipText = chipText,
                    chipVariant = chipVariant,
                    chipIcon = chipIcon,
                    votedChip = votedChip(poll),
                    leadingChip = leadingChip(poll, status),
                    timeMeta = timeMeta,
                )
            }

            /** Pure summary projection. Public-static for tests. */
            @JvmStatic
            fun summarize(
                polls: List<PollDto>,
                viewerId: String?,
                now: Instant,
            ): PollsBannerSummary {
                @Suppress("UNUSED_PARAMETER")
                val viewerHint = viewerId
                var awaiting = 0
                var totalActive = 0
                for (poll in polls) {
                    when (chipStatus(poll, now)) {
                        PollChipStatus.Closed -> continue
                        PollChipStatus.Active, PollChipStatus.Closing -> totalActive += 1
                    }
                    if (poll.myVote.isNullOrEmpty()) {
                        awaiting += 1
                    }
                }
                return PollsBannerSummary(
                    awaitingViewerVote = awaiting,
                    totalActive = totalActive,
                )
            }

            private fun votedChip(poll: PollDto): RowChip? {
                val firstKey = poll.myVote?.firstOrNull() ?: return null
                val label = poll.options.firstOrNull { it.id == firstKey }?.label ?: firstKey
                return RowChip(
                    text = "Voted: $label",
                    icon = PantopusIcon.Check,
                    tint = RowChip.Tint.Status(StatusChipVariant.Info),
                )
            }

            private fun leadingChip(
                poll: PollDto,
                status: PollChipStatus,
            ): RowChip? {
                val leading = leadingOption(poll) ?: return null
                val voteWord = if (leading.second == 1) "vote" else "votes"
                val prefix = if (status == PollChipStatus.Closed) "Winner" else "Leading"
                return RowChip(
                    text = "$prefix: ${leading.first} · ${leading.second} $voteWord",
                    icon = if (status == PollChipStatus.Closed) PantopusIcon.BadgeCheck else null,
                    tint =
                        if (status == PollChipStatus.Closed) {
                            RowChip.Tint.Status(StatusChipVariant.Success)
                        } else {
                            RowChip.Tint.Custom(
                                background = PollLeadingChipTint.background,
                                foreground = PollLeadingChipTint.foreground,
                            )
                        },
                )
            }

            private fun leadingOption(poll: PollDto): Pair<String, Int>? {
                if (poll.options.isEmpty()) return null
                var topLabel: String? = null
                var topVotes = 0
                for (option in poll.options) {
                    val votes =
                        poll.optionCounts[option.id]
                            ?: poll.optionCounts[option.label]
                            ?: 0
                    if (votes > topVotes) {
                        topVotes = votes
                        topLabel = option.label
                    }
                }
                if (topVotes == 0 || topLabel == null) return null
                return topLabel to topVotes
            }

            private fun timeMetaText(
                poll: PollDto,
                status: PollChipStatus,
                now: Instant,
            ): String? {
                val closes = poll.closesAt?.let(::parseInstant) ?: return null
                return when (status) {
                    PollChipStatus.Closed -> formatDateShort(poll.closesAt)?.let { "Closed $it" }
                    PollChipStatus.Closing -> {
                        val seconds = Duration.between(now, closes).seconds
                        when {
                            seconds <= 0 -> "Closes today"
                            seconds < 3600 -> "Closes in ${(seconds / 60).coerceAtLeast(1)} min"
                            else -> "Closes in ${seconds / 3600} hr"
                        }
                    }
                    PollChipStatus.Active -> formatDateShort(poll.closesAt)?.let { "Closes $it" }
                }
            }

            @JvmStatic
            fun formatDateShort(iso: String?): String? {
                if (iso.isNullOrBlank()) return null
                val instant = parseInstant(iso) ?: return null
                val local = instant.atZone(ZoneId.of("UTC"))
                return DateTimeFormatter.ofPattern("MMM d", Locale.US).format(local)
            }

            private fun parseInstant(iso: String): Instant? =
                runCatching { Instant.parse(iso) }
                    .recoverCatching {
                        DateTimeFormatter
                            .ofPattern("yyyy-MM-dd")
                            .parse(iso, java.time.LocalDate::from)
                            .atStartOfDay(ZoneId.of("UTC"))
                            .toInstant()
                    }.getOrNull()
        }
    }
