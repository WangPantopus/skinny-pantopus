@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.support_trains

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.support_trains.SupportTrainListItemDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsTab
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Stable tab ids for tests + screen wiring. */
object SupportTrainsTab {
    const val MINE = "mine"
    const val NEARBY = "nearby"
    const val INVITATIONS = "invitations"
}

/**
 * Per-archetype tile palette. Maps the backend `support_train_type` enum
 * onto an icon + gradient pair driven from existing theme tokens.
 */
enum class SupportTrainType(
    val label: String,
    val icon: PantopusIcon,
) {
    Meals("Meal train", PantopusIcon.Utensils),
    Rides("Ride train", PantopusIcon.Navigation),
    Childcare("Childcare", PantopusIcon.Baby),
    PetCare("Pet care", PantopusIcon.PawPrint),
    Errands("Errand train", PantopusIcon.ShoppingBag),
    Visits("Visit train", PantopusIcon.Heart),
    Generic("Support train", PantopusIcon.HandCoins),
    ;

    val gradient: GradientPair
        get() =
            when (this) {
                Meals -> GradientPair(PantopusColors.handyman, PantopusColors.error)
                Rides -> GradientPair(PantopusColors.primary500, PantopusColors.primary700)
                Childcare -> GradientPair(PantopusColors.warning, PantopusColors.handyman)
                PetCare -> GradientPair(PantopusColors.error, PantopusColors.business)
                Errands -> GradientPair(PantopusColors.business, PantopusColors.goods)
                Visits -> GradientPair(PantopusColors.error, PantopusColors.business)
                Generic -> GradientPair(PantopusColors.appTextSecondary, PantopusColors.appTextStrong)
            }

    companion object {
        /**
         * Backend `support_train_type` enum mirror. Returns [Generic] for
         * empty/unknown values so the My-trains feed (which doesn't yet
         * project the type column) renders a neutral mutual-aid glyph
         * instead of mis-labeling every train as "Meal train".
         */
        fun from(raw: String?): SupportTrainType =
            when (raw) {
                "meal_support", "meals" -> Meals
                "ride_support", "rides" -> Rides
                "childcare" -> Childcare
                "pet_care", "petcare", "pet" -> PetCare
                "errands", "errand_support" -> Errands
                "visits", "visit_support" -> Visits
                else -> Generic
            }
    }
}

/**
 * Drives the T6.6c (P26.5) Support Trains screen. Mirrors iOS
 * `SupportTrainsViewModel` — same three tabs (My trains / Nearby /
 * Invitations), same row mapping, same FAB ("Start a train" as an
 * extended-nav pill).
 */
@HiltViewModel
class SupportTrainsViewModel
    @Inject
    constructor(
        private val repo: SupportTrainsRepository,
    ) : ViewModel() {
        private var mine: List<SupportTrainListItemDto> = emptyList()
        private var nearbyRows: List<SupportTrainListItemDto> = emptyList()
        private var loadedOnce: Boolean = false

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(SupportTrainsTab.MINE)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _tabs = MutableStateFlow(makeTabs())
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        private val _topBarAction = MutableStateFlow<TopBarAction?>(makeTopBarAction({ }))
        val topBarAction: StateFlow<TopBarAction?> = _topBarAction.asStateFlow()

        private val _fab = MutableStateFlow<FabAction?>(makeFab({ }))
        val fab: StateFlow<FabAction?> = _fab.asStateFlow()

        /**
         * Routing callbacks. Set by the screen before [load]. Defaults are
         * no-ops so the VM is safe to construct in isolation (tests,
         * previews).
         */
        var onStartTrain: () -> Unit = {}
            set(value) {
                field = value
                _fab.value = makeFab(value)
            }
        var onOpenTrain: (String) -> Unit = {}
            set(value) {
                field = value
                applyState()
            }
        var onSearch: () -> Unit = {}
            set(value) {
                field = value
                _topBarAction.value = makeTopBarAction(value)
            }

        /**
         * Caller-supplied location accessor (suspend so the host can
         * trampoline to a CoroutineScope-friendly API). Returning null
         * gracefully skips the Nearby fetch — the My-trains tab still
         * renders.
         */
        var locationProvider: suspend () -> Pair<Double, Double>? = { null }

        fun load() {
            if (loadedOnce) return
            reload()
        }

        fun refresh() = reload()

        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            applyState()
        }

        private fun reload() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                val mineDeferred = async { fetchMine() }
                val nearbyDeferred = async { fetchNearby() }
                val mineOk = mineDeferred.await()
                val nearbyOk = nearbyDeferred.await()
                if (!mineOk && !nearbyOk) {
                    _state.value =
                        ListOfRowsUiState.Error("Couldn't load support trains. Try again.")
                    return@launch
                }
                loadedOnce = true
                applyState()
            }
        }

        private suspend fun fetchMine(): Boolean =
            when (val result = repo.mine()) {
                is NetworkResult.Success -> {
                    mine = result.data.supportTrains
                    true
                }
                is NetworkResult.Failure -> false
            }

        private suspend fun fetchNearby(): Boolean {
            val loc =
                locationProvider() ?: run {
                    nearbyRows = emptyList()
                    return true
                }
            return when (val result = repo.nearby(latitude = loc.first, longitude = loc.second)) {
                is NetworkResult.Success -> {
                    nearbyRows = result.data.supportTrains
                    true
                }
                is NetworkResult.Failure -> {
                    nearbyRows = emptyList()
                    false
                }
            }
        }

        private fun applyState() {
            _tabs.value = makeTabs()
            val activeRows =
                when (_selectedTab.value) {
                    SupportTrainsTab.NEARBY -> nearbyRows
                    SupportTrainsTab.INVITATIONS -> invitations()
                    else -> mineRows()
                }
            if (activeRows.isEmpty()) {
                _state.value = emptyState(_selectedTab.value)
                return
            }
            val rows = activeRows.map(::rowFor)
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "trains", rows = rows)),
                    hasMore = false,
                )
        }

        private fun mineRows(): List<SupportTrainListItemDto> = mine.filter { (it.status ?: "") != "invited" }

        private fun invitations(): List<SupportTrainListItemDto> = mine.filter { (it.status ?: "") == "invited" }

        private fun makeTabs(): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(id = SupportTrainsTab.MINE, label = "My trains", count = mineRows().size),
                ListOfRowsTab(id = SupportTrainsTab.NEARBY, label = "Nearby", count = nearbyRows.size),
                ListOfRowsTab(id = SupportTrainsTab.INVITATIONS, label = "Invitations", count = invitations().size),
            )

        private fun makeTopBarAction(handler: () -> Unit): TopBarAction =
            TopBarAction(
                icon = PantopusIcon.Search,
                contentDescription = "Search support trains",
                onClick = handler,
            )

        private fun makeFab(handler: () -> Unit): FabAction =
            FabAction(
                icon = PantopusIcon.Plus,
                contentDescription = "Start a train",
                variant = FabVariant.ExtendedNav(label = "Start a train"),
                onClick = handler,
            )

        private fun rowFor(train: SupportTrainListItemDto): RowModel {
            // The My-trains feed doesn't (yet) project `support_train_type`
            // — `SupportTrainType.from(null)` returns Generic so the leading
            // tile reads as a neutral mutual-aid glyph instead of mis-labeling
            // every train as "Meal train". The Nearby RPC populates the
            // field and the tile lights up to the per-archetype gradient.
            val type = SupportTrainType.from(train.supportTrainType)
            val title = train.recipientName ?: train.title ?: "Support train"
            val chip = statusChip(train.status)
            return RowModel(
                id = train.id,
                title = title,
                subtitle = subtitleLine(train, type),
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.CategoryGradientIcon(
                        icon = type.icon,
                        gradient = type.gradient,
                    ),
                trailing =
                    RowTrailing.Status(
                        text = chip.first,
                        variant = chip.second,
                    ),
                metaTail = rowMetaTail(train),
                onTap = { onOpenTrain(train.id) },
            )
        }

        private fun subtitleLine(
            train: SupportTrainListItemDto,
            type: SupportTrainType,
        ): String? {
            val parts =
                listOfNotNull(
                    if (train.supportTrainType != null) type.label else null,
                    roleLabel(train.myRole),
                    if (train.recipientName != null) train.title else null,
                ).filter { it.isNotBlank() }
            return parts.joinToString(" · ").ifBlank { null }
        }

        private fun roleLabel(role: String?): String? =
            when (role) {
                "organizer" -> "You organize"
                "co_organizer" -> "You co-organize"
                "helper" -> "Helper"
                else -> null
            }

        /**
         * Meta-tail line. Prefers slot progress when projected, falls
         * back to the date range, then distance for the Nearby tab,
         * otherwise null so the chip line collapses cleanly.
         */
        private fun rowMetaTail(train: SupportTrainListItemDto): String? {
            slotsLabel(train)?.let { return it }
            if (!train.startsOn.isNullOrBlank() && !train.endsOn.isNullOrBlank()) {
                return "${train.startsOn} — ${train.endsOn}"
            }
            distanceLabel(train)?.let { return it }
            return null
        }

        private fun slotsLabel(train: SupportTrainListItemDto): String? {
            val total = train.slotsTotal ?: return null
            val filled = train.slotsFilled ?: 0
            val left = (total - filled).coerceAtLeast(0)
            return if (left == 0) "$filled / $total slots" else "$filled / $total slots · $left open"
        }

        private fun distanceLabel(train: SupportTrainListItemDto): String? {
            val metres = train.distanceMeters ?: return null
            val miles = metres / 1609.34
            return if (miles < 1) "<1 mi" else "${miles.toInt()} mi"
        }

        private fun statusChip(status: String?): Pair<String, StatusChipVariant> =
            when (status) {
                "active" -> "Active" to StatusChipVariant.Success
                "filling" -> "Filling up" to StatusChipVariant.Info
                "full" -> "Slots full" to StatusChipVariant.Neutral
                "wrapping" -> "Wrapping up" to StatusChipVariant.Warning
                "complete" -> "Complete" to StatusChipVariant.Neutral
                "invited" -> "Invited" to StatusChipVariant.Business
                "proposed" -> "Proposed" to StatusChipVariant.Neutral
                else -> "Active" to StatusChipVariant.Info
            }

        private fun emptyState(tab: String): ListOfRowsUiState.Empty =
            when (tab) {
                SupportTrainsTab.NEARBY ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Heart,
                        headline = "No trains nearby right now",
                        subcopy =
                            "When a neighbor starts a meal, ride, or pet-care train within 25 mi, you'll see it here.",
                        ctaTitle = "Start a train",
                        onCta = { onStartTrain() },
                    )
                SupportTrainsTab.INVITATIONS ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Mail,
                        headline = "No invitations",
                        subcopy = "When a coordinator invites you to help with their support train, the invite will land here.",
                        ctaTitle = null,
                        onCta = null,
                    )
                else ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.HandCoins,
                        headline = "No support trains yet",
                        subcopy =
                            "A support train is a calendar of neighbors taking turns helping someone " +
                                "through a life event. Start one for someone, or join one nearby.",
                        ctaTitle = "Start a train",
                        onCta = { onStartTrain() },
                    )
            }
    }
