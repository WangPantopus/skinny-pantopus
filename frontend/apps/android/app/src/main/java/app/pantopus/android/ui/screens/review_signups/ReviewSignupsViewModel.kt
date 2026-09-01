@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "LongParameterList",
    "ComplexMethod",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.review_signups

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.support_trains.SupportTrainReservationsStore
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.ChipStripConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/** Stable filter ids for tests + the screen. */
object ReviewSignupsFilter {
    const val ALL = "all"
    const val PENDING = "pending"
    const val CONFIRMED = "confirmed"
    const val EDITED = "edited"
    const val CANCELED = "canceled"
}

/**
 * Drives the T6.6c (P26.5) Review-signups screen. Mirrors iOS
 * `ReviewSignupsViewModel` exactly — same filter chips, same row
 * mapping, same optimistic confirm pattern with rollback delegated to
 * the host callback.
 */
@HiltViewModel
class ReviewSignupsViewModel
    @Inject
    constructor(
        private val repo: SupportTrainsRepository,
        private val reservationsStore: SupportTrainReservationsStore,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val supportTrainId: String =
            savedStateHandle.get<String>(SUPPORT_TRAIN_ID_KEY).orEmpty()

        private var reservations: List<SupportTrainReservationDto> = emptyList()
        private var loadedOnce: Boolean = false

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedFilter = MutableStateFlow(ReviewSignupsFilter.ALL)
        val selectedFilter: StateFlow<String> = _selectedFilter.asStateFlow()

        private val _topBarAction = MutableStateFlow<TopBarAction?>(makeTopBarAction({ }))
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        private val _chipStrip = MutableStateFlow(makeChipStrip(ReviewSignupsFilter.ALL))
        val chipStrip: StateFlow<ChipStripConfig> = _chipStrip.asStateFlow()

        /**
         * Bumps every time `EditSignupFormScreen` writes a patch into
         * the shared store. The screen watches this in a
         * `LaunchedEffect` and re-applies pending edits — keeps the
         * row in sync without a re-fetch.
         */
        val pendingEditsRevision: StateFlow<Int> = reservationsStore.revision

        var onShareTrain: () -> Unit = {}
            set(value) {
                field = value
                _topBarAction.value = makeTopBarAction(value)
            }
        var onConfirmReservation: (String) -> Unit = {}
        var onEditSignup: (String) -> Unit = {}
            set(value) {
                field = value
                applyState()
            }
        var onMessageHelper: (String) -> Unit = {}
            set(value) {
                field = value
                applyState()
            }

        fun load() {
            if (loadedOnce) return
            reload()
        }

        fun refresh() = reload()

        fun selectFilter(id: String) {
            if (_selectedFilter.value == id) return
            _selectedFilter.value = id
            _chipStrip.value = makeChipStrip(id)
            applyState()
        }

        /**
         * Stage the row's reservation in the shared store and fire
         * [onEditSignup] so the host can navigate. The Edit Signup
         * form reads the seed from the store on init — keeps the
         * navigation URL clean (just a reservation id) without
         * round-tripping the row through the backend.
         */
        fun handleEdit(reservation: SupportTrainReservationDto) {
            reservationsStore.stage(reservation)
            onEditSignup(reservation.id)
        }

        /**
         * Drain pending optimistic patches from the shared store and
         * replay them into the in-memory cache. Called by the screen
         * on resume so an Edit committed in `EditSignupFormScreen` is
         * reflected the moment the user lands back on this screen.
         */
        fun applyPendingEdits() {
            var changed = false
            reservations =
                reservations.map { current ->
                    val patch = reservationsStore.consumePatch(current.id)
                    if (patch != null) {
                        changed = true
                        patch
                    } else {
                        current
                    }
                }
            if (changed) applyState()
        }

        /**
         * Optimistic confirm — patches the local row to "confirmed",
         * fires the real `POST /:id/reservations/:reservationId/confirm`
         * (`backend/routes/supportTrains.js:3214`, S1) and still notifies
         * the host via [onConfirmReservation] for navigation / analytics.
         */
        fun confirm(reservationId: String) {
            val idx = reservations.indexOfFirst { it.id == reservationId }
            if (idx >= 0) {
                reservations =
                    reservations.toMutableList().apply {
                        this[idx] = this[idx].copy(status = "confirmed")
                    }
                applyState()
            }
            viewModelScope.launch { repo.confirmDelivery(supportTrainId, reservationId) }
            onConfirmReservation(reservationId)
        }

        private fun reload() {
            if (supportTrainId.isBlank()) {
                _state.value = ListOfRowsUiState.Error("Missing support train id.")
                return
            }
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.reservations(supportTrainId)) {
                    is NetworkResult.Success -> {
                        reservations = result.data.reservations
                        loadedOnce = true
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        _state.value = ListOfRowsUiState.Error("Couldn't load signups. Try again.")
                    }
                }
            }
        }

        private fun applyState() {
            val filtered = filteredReservations()
            if (filtered.isEmpty()) {
                _state.value = emptyState(_selectedFilter.value)
                return
            }
            val rows = filtered.map(::rowFor)
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "signups", rows = rows)),
                    hasMore = false,
                )
        }

        /**
         * Visible-to-the-organizer filter projection. Canceled rows are
         * hidden from every filter except [ReviewSignupsFilter.CANCELED].
         */
        private fun filteredReservations(): List<SupportTrainReservationDto> =
            when (_selectedFilter.value) {
                ReviewSignupsFilter.PENDING -> reservations.filter { it.status == "pending" }
                ReviewSignupsFilter.CONFIRMED -> reservations.filter { it.status == "confirmed" }
                ReviewSignupsFilter.EDITED -> reservations.filter { it.wasEdited && it.status != "canceled" }
                ReviewSignupsFilter.CANCELED -> reservations.filter { it.status == "canceled" }
                else -> reservations.filter { it.status != "canceled" }
            }

        private fun rowFor(r: SupportTrainReservationDto): RowModel {
            val chip = statusChipFor(r)
            val metaParts =
                listOfNotNull(
                    dropWindowLabel(r),
                    contributionMetaLabel(r),
                )

            return RowModel(
                id = r.id,
                title = r.displayName,
                subtitle = subtitleLine(r),
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = r.displayName,
                        imageUrl = r.helper?.profilePictureUrl,
                        background = AvatarBackground.Gradient(avatarGradient(r.helper?.id ?: r.id)),
                        size = AvatarBadgeSize.Medium,
                        verified = false,
                    ),
                trailing = RowTrailing.Status(text = chip.first, variant = chip.second),
                onTap = { handleEdit(r) },
                body = r.noteToRecipient?.let { "“$it”" },
                timeMeta = shortDateLabel(r),
                metaTail = metaParts.joinToString(" · ").ifBlank { null },
                footer = footerFor(r),
            )
        }

        private fun subtitleLine(r: SupportTrainReservationDto): String? =
            when {
                !r.dishTitle.isNullOrBlank() -> r.dishTitle
                !r.restaurantName.isNullOrBlank() -> r.restaurantName
                !r.contributionMode.isNullOrBlank() -> humanize(r.contributionMode)
                else -> null
            }

        private fun dropWindowLabel(r: SupportTrainReservationDto): String? {
            val iso = r.estimatedArrivalAt ?: return null
            return runCatching {
                val instant = Instant.parse(iso)
                "Drop ${TIME_FMT.format(instant.atZone(ZoneId.systemDefault()))}"
            }.getOrNull()
        }

        private fun shortDateLabel(r: SupportTrainReservationDto): String? {
            val iso = r.estimatedArrivalAt ?: return null
            return runCatching {
                val instant = Instant.parse(iso)
                DATE_FMT.format(instant.atZone(ZoneId.systemDefault()))
            }.getOrNull()
        }

        private fun contributionMetaLabel(r: SupportTrainReservationDto): String? {
            val mode = r.contributionMode ?: return null
            if (!r.dishTitle.isNullOrBlank() || !r.restaurantName.isNullOrBlank()) return null
            return humanize(mode)
        }

        private fun statusChipFor(r: SupportTrainReservationDto): Pair<String, StatusChipVariant> =
            when (r.status) {
                "confirmed" -> if (r.wasEdited) "Edited" to StatusChipVariant.Info else "Confirmed" to StatusChipVariant.Success
                "pending" -> "Pending" to StatusChipVariant.Warning
                "canceled" -> "Canceled" to StatusChipVariant.Neutral
                else -> "Pending" to StatusChipVariant.Warning
            }

        private fun footerFor(r: SupportTrainReservationDto): RowFooter? =
            when (r.status) {
                "pending" ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Confirm",
                                    icon = PantopusIcon.Check,
                                    variant = CompactButtonVariant.Primary,
                                ) { confirm(r.id) },
                                RowFooterAction(
                                    title = "Edit",
                                    icon = PantopusIcon.Pencil,
                                    variant = CompactButtonVariant.Ghost,
                                ) { handleEdit(r) },
                            ),
                    )
                "confirmed" ->
                    RowFooter(
                        actions =
                            listOf(
                                RowFooterAction(
                                    title = "Message",
                                    icon = PantopusIcon.MessageCircle,
                                    variant = CompactButtonVariant.Ghost,
                                ) { onMessageHelper(r.id) },
                            ),
                    )
                else -> null
            }

        private fun avatarGradient(seed: String): GradientPair {
            val palette =
                listOf(
                    GradientPair(PantopusColors.primary500, PantopusColors.primary700),
                    GradientPair(PantopusColors.success, PantopusColors.home),
                    GradientPair(PantopusColors.warning, PantopusColors.handyman),
                    GradientPair(PantopusColors.error, PantopusColors.business),
                    GradientPair(PantopusColors.business, PantopusColors.goods),
                )
            var hash = 0
            for (ch in seed) hash += ch.code
            return palette[(hash % palette.size + palette.size) % palette.size]
        }

        private fun humanize(snakeCase: String): String =
            snakeCase
                .replace('_', ' ')
                .replaceFirstChar { it.uppercase() }

        private fun makeTopBarAction(handler: () -> Unit): TopBarAction =
            TopBarAction(
                icon = PantopusIcon.Share,
                contentDescription = "Share train",
                onClick = handler,
            )

        private fun makeChipStrip(selected: String): ChipStripConfig =
            ChipStripConfig(
                chips =
                    listOf(
                        ChipStripConfig.Chip(
                            id = ReviewSignupsFilter.ALL,
                            label = "All",
                            icon = PantopusIcon.ListChecks,
                        ),
                        ChipStripConfig.Chip(
                            id = ReviewSignupsFilter.PENDING,
                            label = "Pending",
                            icon = PantopusIcon.Clock,
                        ),
                        ChipStripConfig.Chip(
                            id = ReviewSignupsFilter.CONFIRMED,
                            label = "Confirmed",
                            icon = PantopusIcon.Check,
                        ),
                        ChipStripConfig.Chip(
                            id = ReviewSignupsFilter.EDITED,
                            label = "Edited",
                            icon = PantopusIcon.Pencil,
                        ),
                        ChipStripConfig.Chip(
                            id = ReviewSignupsFilter.CANCELED,
                            label = "Canceled",
                            icon = PantopusIcon.X,
                        ),
                    ),
                selectedId = selected,
                onSelect = ::selectFilter,
            )

        private fun emptyState(filter: String): ListOfRowsUiState.Empty =
            when (filter) {
                ReviewSignupsFilter.PENDING ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Clock,
                        headline = "No pending signups",
                        subcopy = "When a neighbor signs up for a slot, they'll appear here for you to review.",
                        ctaTitle = null,
                        onCta = null,
                    )
                ReviewSignupsFilter.CONFIRMED ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Check,
                        headline = "No confirmed signups yet",
                        subcopy = "Confirmed slots will show up here once you approve their signup.",
                        ctaTitle = null,
                        onCta = null,
                    )
                ReviewSignupsFilter.EDITED ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Pencil,
                        headline = "No recent edits",
                        subcopy = "When a helper updates their slot, the edit will appear here for confirmation.",
                        ctaTitle = null,
                        onCta = null,
                    )
                ReviewSignupsFilter.CANCELED ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.X,
                        headline = "No canceled signups",
                        subcopy = "When a helper cancels their slot, it moves here so you can backfill.",
                        ctaTitle = null,
                        onCta = null,
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ClipboardList,
                        headline = "No signups yet",
                        subcopy =
                            "Share the train so neighbors can grab a slot. You'll see new signups here " +
                                "for review before they're confirmed.",
                        ctaTitle = "Share train",
                        onCta = { onShareTrain() },
                    )
            }

        companion object {
            /**
             * Nav-arg key for the Support Train UUID this screen reviews.
             * Mirrors `ChildRoutes.REVIEW_SIGNUPS_ID_KEY` in
             * `RootTabScreen.kt`.
             */
            const val SUPPORT_TRAIN_ID_KEY = "supportTrainId"

            private val TIME_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a")
            private val DATE_FMT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE MMM d")
        }
    }
