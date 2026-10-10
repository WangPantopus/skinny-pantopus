package app.pantopus.android.ui.screens.homes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.MyHomesResponse
import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyRequest
import app.pantopus.android.data.api.models.homes.showsCopyBeforeRecheck
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeResidencyProgressRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowChip
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val REQUEST_REFERENCE_LENGTH = 8

sealed interface MyHomesListEvent {
    data class ConfirmDelete(val homeId: String, val name: String) : MyHomesListEvent
}

enum class PendingVerification { Owner, Residency }

fun pendingVerificationFor(home: MyHome): PendingVerification? =
    if (home.accessKind != "verification") {
        null
    } else if (home.ownershipStatus == "pending" || home.pendingClaimId != null) {
        PendingVerification.Owner
    } else {
        PendingVerification.Residency
    }

/**
 * An ownership claim is already filed for this Home. Its status lives in the
 * Waiting Room (which also offers "Update evidence"), not a blank upload.
 */
private fun showsClaimStatus(
    home: MyHome,
    openWaitingRoom: ((String) -> Unit)?,
): Boolean = home.pendingClaimId != null && openWaitingRoom != null

/** Status chips for one My Homes row (kept out of the row builder's complexity). */
private fun myHomeChips(
    home: MyHome,
    personal: PersonalHomeResidencyRequest?,
    pending: PendingVerification?,
): List<RowChip> =
    buildList {
        if (home.accessKind == "private_setup") {
            add(
                RowChip("Private setup", PantopusIcon.Home, RowChip.Tint.Status(StatusChipVariant.Warning)),
            )
        }
        // Ownership requests already say "Verification in progress".
        if (home.accessKind != "verification" && home.pendingClaimId != null) {
            add(
                RowChip("Ownership in review", PantopusIcon.Clock, RowChip.Tint.Status(StatusChipVariant.Warning)),
            )
        }
        if (home.hasSharedAccess && home.ownershipStatus == "verified") {
            add(
                RowChip("Ownership verified", PantopusIcon.ShieldCheck, RowChip.Tint.Status(StatusChipVariant.Success)),
            )
        }
        if (home.hasSharedAccess && home.occupancy?.verificationStatus == "verified") {
            // Verified occupancy confirms household admission. The
            // list contract carries no independent residency proof.
            add(
                RowChip("Household access", PantopusIcon.Home, RowChip.Tint.Status(StatusChipVariant.Success)),
            )
        }
        if (pending != null) {
            add(
                RowChip(
                    personal?.reviewLabel ?: "Verification in progress",
                    PantopusIcon.Clock,
                    RowChip.Tint.Status(StatusChipVariant.Warning),
                ),
            )
        }
    }

/** A resident (e.g. address-verified by mail) whose ownership claim still waits. */
private fun claimStatusFooter(
    homeId: String,
    onClick: () -> Unit,
): RowFooter =
    RowFooter(
        listOf(
            RowFooterAction(
                title = "Check ownership claim",
                icon = PantopusIcon.ArrowRight,
                variant = CompactButtonVariant.Ghost,
                testTag = "myHomes.row_$homeId.claim",
                onClick = onClick,
            ),
        ),
    )

/**
 * "301" reads "Unit 301"; a unit stored with its own designator ("Apt 4B",
 * "Unit 12", "#3") stays as it is instead of "Unit Apt 4B".
 */
internal fun homeUnitText(unit: String): String = if (unitDesignator.containsMatchIn(unit)) unit else "Unit $unit"

// USPS secondary-unit designators (and their long forms), or a leading "#".
private val unitDesignator =
    Regex(
        listOf(
            "apt", "apartment", "unit", "ste", "suite", "bldg", "building", "fl", "floor", "rm", "room",
            "lot", "spc", "space", "trlr", "trailer", "ph", "penthouse", "bsmt", "basement", "dept", "ofc",
            "office", "lowr", "lower", "uppr", "upper", "frnt", "front", "rear", "side", "pier", "slip",
            "hngr", "hangar", "lbby", "lobby", "key", "stop",
        ).joinToString("|", prefix = "^(#|(", postfix = ")(?=[\\s.#0-9]|$))"),
        RegexOption.IGNORE_CASE,
    )

/** Current household access, private setup and personal verification are separate destinations. */
@HiltViewModel
class MyHomesListViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        private val adminRepo: HomeAdminRepository,
        sessions: HomeClaimSessionScopeFactory,
        private val residencyRepo: HomeResidencyProgressRepository,
        private val store: ScreenStore,
    ) : ViewModel() {
        private val session = sessions.create(viewModelScope)
        private var generation = 0L
        private var visible = false
        private var refreshJob: Job? = null
        private var entries: List<MyHome> = emptyList()
        private var requests: List<PersonalHomeResidencyRequest> = emptyList()
        private var nextCursor: String? = null
        private var homesError: String? = null
        private var historyError: String? = null
        private var loadingHistory = false
        private var historyJob: Job? = null
        private var deleting = false
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state = _state.asStateFlow()
        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner = _banner.asStateFlow()
        private val _pendingEvent = MutableStateFlow<MyHomesListEvent?>(null)
        val pendingEvent = _pendingEvent.asStateFlow()
        private val _actionError = MutableStateFlow<String?>(null)
        val actionError = _actionError.asStateFlow()

        /** Pull to refresh is reading while the rows stay (Instant Screens): the pull indicator only. */
        private val _refreshing = MutableStateFlow(false)
        val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past its max shown age. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()
        private var onOpenHome: (String) -> Unit = {}
        private var onOpenTasks: ((String) -> Unit)? = null
        private var onAddHome: () -> Unit = {}
        private var onUploadOwnershipEvidence: ((String) -> Unit)? = null
        private var onVerifyResidency: ((String) -> Unit)? = null
        private var onOpenWaitingRoom: ((String) -> Unit)? = null

        init {
            viewModelScope.launch {
                session.invalidated.collect { invalid ->
                    if (invalid) {
                        suspendContent()
                        entries = emptyList()
                        _state.value = ListOfRowsUiState.Error("Your session changed. Reopen your Homes list to continue.")
                    }
                }
            }
        }

        fun configureNavigation(
            onOpenHome: (String) -> Unit,
            onAddHome: () -> Unit,
            onUploadOwnershipEvidence: ((String) -> Unit)? = null,
            onVerifyResidency: ((String) -> Unit)? = null,
            onOpenTasks: ((String) -> Unit)? = null,
            onOpenWaitingRoom: ((String) -> Unit)? = null,
        ) {
            this.onOpenHome = onOpenHome
            this.onAddHome = onAddHome
            this.onOpenTasks = onOpenTasks
            this.onUploadOwnershipEvidence = onUploadOwnershipEvidence
            this.onVerifyResidency = onVerifyResidency
            this.onOpenWaitingRoom = onOpenWaitingRoom
        }

        /**
         * Pause and leave. Instant Screens: the Homes rows stay (shown again at once, then re-read) while every row is
         * an owner's or household home (founder decision 3); a guest's or expiring home blanks the list and re-checks.
         * The residency requests (verification) are read again on every visit.
         */
        fun suspendContent() {
            generation++
            visible = false
            refreshJob?.cancel()
            refreshJob = null
            historyJob?.cancel()
            historyJob = null
            requests = emptyList()
            nextCursor = null
            homesError = null
            historyError = null
            loadingHistory = false
            if (!entries.all { it.showsCopyBeforeRecheck }) {
                store.remove(StoreKeys.myHomes)
                entries = emptyList()
            }
            _state.value =
                if (entries.isEmpty()) {
                    ListOfRowsUiState.Loading
                } else {
                    ListOfRowsUiState.Loaded(
                        listOf(RowSection(id = "my-homes", rows = entries.map { rowFor(it, generation) })),
                        hasMore = false,
                    )
                }
            _banner.value = null
            _pendingEvent.value = null
            _actionError.value = null
            _refreshing.value = false
        }

        private fun current(revision: Long) = visible && revision == generation && session.isCurrent

        /** Entry and every return (Instant Screens): the stored Homes show at once and are re-read quietly. */
        fun load() {
            if (!visible) read(force = false)
        }

        /** A change signal while visible bypasses the duplicate-entry guard and reads quietly. */
        fun recheck() {
            if (visible) read(force = false)
        }

        /** Pull to refresh, Retry and after a delete: read now. */
        fun refresh() = read(force = true)

        private fun read(force: Boolean) {
            suspendContent()
            visible = true
            val revision = generation
            if (entries.isEmpty()) {
                val stored = repo.myHomesCopy()?.homes
                if (stored != null && listChecksOut(stored) && stored.all { it.showsCopyBeforeRecheck }) entries = stored
            }
            if (entries.isNotEmpty()) render(revision)
            _refreshing.value = force && entries.isNotEmpty()
            refreshJob =
                viewModelScope.launch {
                    try {
                        session.requireCurrent()
                        val mayReuse = repo.myHomesCopy()?.homes?.all { it.showsCopyBeforeRecheck } == true
                        val stored = repo.myHomesStored(force || !mayReuse)
                        session.requireCurrent()
                        if (!current(revision)) return@launch
                        _refreshing.value = false
                        _refreshNotice.value =
                            RefreshNotice(stored.fetchedAt, ::refresh).takeIf { stored.showsRefreshFailure(StoreKind.HOMES) }
                        val homes = stored.homesForPresentation(store)
                        when {
                            homes == null -> {
                                entries = emptyList()
                                homesError = (stored.failure ?: NetworkError.NotFound).displayMessage("Could not load your Homes. Retry.")
                            }
                            !listChecksOut(homes) -> {
                                entries = emptyList()
                                homesError = "Your Home list could not be verified. Retry."
                            }
                            else -> entries = homes
                        }
                        loadHistory(revision, null)
                    } catch (error: CancellationException) {
                        throw error
                    } catch (_: IllegalStateException) {
                        if (visible && generation == revision) {
                            _state.value = ListOfRowsUiState.Error("Your session changed. Reopen your Homes list to continue.")
                        }
                    }
                }
        }

        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        fun clearActionError() {
            _actionError.value = null
        }

        fun deleteHome(homeId: String) {
            val revision = generation
            if (!current(revision) || deleting) return
            if (entries.none { it.id == homeId && it.canDeleteHome == true }) return
            deleting = true
            _actionError.value = null
            viewModelScope.launch {
                try {
                    session.requireCurrent()
                    val result = adminRepo.deleteHome(homeId)
                    session.requireCurrent()
                    if (!current(revision)) return@launch
                    when (result) {
                        is NetworkResult.Success -> refresh()
                        is NetworkResult.Failure -> {
                            _actionError.value = result.error.displayMessage("Failed to delete. Reload your Homes to check.")
                        }
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (_: IllegalStateException) {
                    if (current(revision)) _actionError.value = "Reopen your Homes list to check current access."
                } finally {
                    deleting = false
                }
            }
        }

        fun loadMoreRequests() {
            val revision = generation
            if (!current(revision) || loadingHistory) return
            historyJob = viewModelScope.launch { loadHistory(revision, nextCursor) }
        }

        private suspend fun loadHistory(
            revision: Long,
            cursor: String?,
        ) {
            if (!current(revision) || loadingHistory) return
            loadingHistory = true
            historyError = null
            render(revision)
            try {
                session.requireCurrent()
                val result = residencyRepo.requests(cursor)
                session.requireCurrent()
                if (!current(revision)) return
                when (result) {
                    is NetworkResult.Success -> {
                        val page = result.data
                        check(page.follows(cursor) && requests.none { old -> page.requests.any { it.id == old.id } })
                        requests = requests + page.requests
                        nextCursor = page.nextCursor
                    }
                    is NetworkResult.Failure -> historyError = "Your residency requests could not be checked. Retry."
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: IllegalStateException) {
                if (!current(revision)) return
                historyError = "Your residency requests could not be checked. Retry."
            }
            if (!current(revision)) return
            loadingHistory = false
            render(revision)
        }

        private fun render(revision: Long) {
            if (!current(revision)) return
            val noUsableRows = entries.isEmpty() && requests.isEmpty()
            if (homesError != null && historyError != null && noUsableRows) {
                _state.value = ListOfRowsUiState.Error("Your Homes and residency requests could not be checked. Retry.")
                return
            }
            val sections =
                buildList {
                    if (entries.isNotEmpty()) add(RowSection(id = "my-homes", rows = entries.map { rowFor(it, revision) }))
                    homesError?.let { message ->
                        add(
                            RowSection(
                                id = "homes-error",
                                rows =
                                    listOf(
                                        homeResidencyRecoveryRow(
                                            "homes-retry",
                                            message,
                                            "Retry saved Homes",
                                        ) { if (current(revision)) refresh() },
                                    ),
                            ),
                        )
                    }
                    historySection(revision)?.let { add(it) }
                }
            _state.value =
                if (sections.isEmpty()) {
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.Home, headline = "No saved Homes yet",
                        subcopy = "Add a Home to organize your private tasks, or continue a household invitation.",
                        ctaTitle = "Add a home", onCta = { if (current(revision)) onAddHome() },
                    )
                } else {
                    ListOfRowsUiState.Loaded(sections = sections, hasMore = false)
                }
            _banner.value =
                if (entries.isEmpty() && requests.isEmpty()) {
                    null
                } else {
                    BannerConfig(
                        icon = PantopusIcon.Home, title = if (entries.size == 1) "1 saved Home" else "${entries.size} saved Homes",
                        subtitle = "Open your household, private tasks or verification progress", tint = BannerCtaTint.Home,
                    )
                }
        }

        private fun historySection(revision: Long): RowSection? {
            val represented = entries.filter { pendingVerificationFor(it) == PendingVerification.Residency }.map { it.id }.toSet()
            val history =
                requests.filter { it.homeId !in represented }.map { request ->
                    personalResidencyRow(request) {
                        if (current(revision)) request.homeId?.let { onVerifyResidency?.invoke(it) }
                    }
                }.toMutableList()
            when {
                loadingHistory ->
                    history.add(
                        RowModel("residency-loading", "Checking residency requests…", template = RowTemplate.AvatarKebab),
                    )
                historyError != null ->
                    history.add(
                        homeResidencyRecoveryRow(
                            "residency-retry",
                            historyError.orEmpty(),
                            "Retry residency requests",
                        ) { if (current(revision)) loadMoreRequests() },
                    )
                nextCursor != null ->
                    history.add(
                        homeResidencyRecoveryRow(
                            "residency-more",
                            "More personal requests are available.",
                            "Load more requests",
                        ) { if (current(revision)) loadMoreRequests() },
                    )
            }
            return if (history.isEmpty()) {
                null
            } else {
                RowSection(
                    id = "residency-history",
                    header = "Your residency requests",
                    footer = "Saved requests do not grant current household access.",
                    rows = history,
                )
            }
        }

        private fun open(
            home: MyHome,
            revision: Long,
        ) {
            if (!current(revision)) return
            when (home.accessKind) {
                "shared" -> onOpenHome(home.id)
                "private_setup" -> onOpenTasks?.invoke(home.id)
                "verification" ->
                    when {
                        pendingVerificationFor(home) != PendingVerification.Owner -> onVerifyResidency?.invoke(home.id)
                        showsClaimStatus(home, onOpenWaitingRoom) -> onOpenWaitingRoom?.invoke(home.id)
                        else -> onUploadOwnershipEvidence?.invoke(home.id)
                    }
            }
        }

        private fun personalRequest(home: MyHome): PersonalHomeResidencyRequest? =
            if (pendingVerificationFor(home) == PendingVerification.Residency) requests.firstOrNull { it.homeId == home.id } else null

        private fun rowFor(
            home: MyHome,
            revision: Long,
        ): RowModel {
            val personal = personalRequest(home)
            val title = homeRowTitle(home, personal)
            val locality = listOfNotNull(home.city, home.state).filter { it.isNotBlank() }.joinToString(", ").takeIf { it.isNotBlank() }
            val pending = pendingVerificationFor(home)
            val chips = myHomeChips(home, personal, pending)
            val canDelete = home.canDeleteHome == true
            val footerTitle =
                when {
                    home.accessKind == "private_setup" -> "Home tasks"
                    pending == PendingVerification.Owner && showsClaimStatus(home, onOpenWaitingRoom) -> "Check ownership claim"
                    pending == PendingVerification.Owner -> "Continue ownership verification"
                    pending == PendingVerification.Residency -> "Check residency status"
                    else -> null
                }
            return RowModel(
                id = home.id, title = title,
                subtitle =
                    listOfNotNull(
                        unitLabel(home),
                        roleLabel(home),
                        locality,
                    ).joinToString(" · "),
                template = RowTemplate.AvatarKebab,
                leading = RowLeading.TypeIcon(PantopusIcon.Home, PantopusColors.homeBg, PantopusColors.home),
                trailing = if (canDelete) RowTrailing.Kebab else RowTrailing.Chevron, onTap = { open(home, revision) },
                onSecondary =
                    if (canDelete) {
                        { if (current(revision)) _pendingEvent.value = MyHomesListEvent.ConfirmDelete(home.id, title) }
                    } else {
                        null
                    },
                chips = chips.takeIf { it.isNotEmpty() },
                // Status chips wrap instead of squeezing "Household access" into a sliver at large text.
                wrapChips = true,
                footer =
                    if (home.accessKind == "shared" && showsClaimStatus(home, onOpenWaitingRoom)) {
                        claimStatusFooter(home.id) { if (current(revision)) onOpenWaitingRoom?.invoke(home.id) }
                    } else {
                        footerTitle?.let { homeFooter(home, it, revision) }
                    },
            )
        }

        private fun homeFooter(
            home: MyHome,
            title: String,
            revision: Long,
        ): RowFooter =
            RowFooter(
                buildList {
                    add(
                        RowFooterAction(
                            title = title,
                            icon = PantopusIcon.ArrowRight,
                            variant = CompactButtonVariant.Primary,
                            testTag = "myHomes.row_${home.id}.continue",
                            onClick = { open(home, revision) },
                        ),
                    )
                    if (home.accessKind == "private_setup" && onVerifyResidency != null) {
                        add(
                            RowFooterAction(
                                title = "Check status",
                                icon = PantopusIcon.ShieldCheck,
                                variant = CompactButtonVariant.Ghost,
                                testTag = "myHomes.row_${home.id}.verification",
                                onClick = {
                                    if (current(revision)) {
                                        val claim = showsClaimStatus(home, onOpenWaitingRoom)
                                        (if (claim) onOpenWaitingRoom else onVerifyResidency)?.invoke(home.id)
                                    }
                                },
                            ),
                        )
                    }
                },
            )

        private fun roleLabel(home: MyHome): String? =
            when (home.accessKind) {
                "private_setup" -> "Your private Home"
                "verification" -> {
                    if (pendingVerificationFor(home) == PendingVerification.Owner) "Ownership request" else "Residency request"
                }
                else ->
                    when (home.roleBase) {
                        "owner" -> "Owner role"
                        "admin" -> "Administrator"
                        "manager" -> "Manager"
                        "lease_resident" -> "Tenant"
                        "member" -> "Member"
                        "restricted_member" -> "Restricted member"
                        "guest" -> "Guest"
                        "service_provider" -> "Service provider"
                        else -> null
                    }
            }
    }

private fun homeRowTitle(
    home: MyHome,
    personal: PersonalHomeResidencyRequest?,
): String {
    val fallback =
        if (pendingVerificationFor(home) == PendingVerification.Residency) {
            "Residency request · ${home.id.takeLast(REQUEST_REFERENCE_LENGTH)}"
        } else {
            "Home"
        }
    return personal?.label ?: home.name?.takeIf(String::isNotBlank) ?: home.address?.takeIf(String::isNotBlank) ?: fallback
}

private fun unitLabel(home: MyHome): String? {
    if (home.accessKind == "verification") return null
    return home.address2?.trim()?.takeIf { it.isNotEmpty() }?.let { homeUnitText(it) }
}

/** A failed guest or expiring read never reuses a list from a previous visit. */
private fun Stored<MyHomesResponse>.homesForPresentation(store: ScreenStore): List<MyHome>? {
    val rows = data?.homes ?: return null
    if (failure != null && rows.any { !it.showsCopyBeforeRecheck }) {
        store.remove(StoreKeys.myHomes)
        return null
    }
    return rows
}

private fun listChecksOut(homes: List<MyHome>): Boolean =
    homes.none { !it.hasValidListContext } && homes.map { it.id }.distinct().size == homes.size
