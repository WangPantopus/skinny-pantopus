package app.pantopus.android.ui.screens.homes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.MyHome
import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeResidencyProgressRepository
import app.pantopus.android.data.homes.HomesRepository
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

/** Current household access, private setup and personal verification are separate destinations. */
@HiltViewModel
class MyHomesListViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        private val adminRepo: HomeAdminRepository,
        sessions: HomeClaimSessionScopeFactory,
        private val residencyRepo: HomeResidencyProgressRepository,
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
        private var onOpenHome: (String) -> Unit = {}
        private var onOpenTasks: ((String) -> Unit)? = null
        private var onAddHome: () -> Unit = {}
        private var onUploadOwnershipEvidence: ((String) -> Unit)? = null
        private var onVerifyResidency: ((String) -> Unit)? = null

        init {
            viewModelScope.launch {
                session.invalidated.collect { invalid ->
                    if (invalid) {
                        suspendContent()
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
        ) {
            this.onOpenHome = onOpenHome
            this.onAddHome = onAddHome
            this.onOpenTasks = onOpenTasks
            this.onUploadOwnershipEvidence = onUploadOwnershipEvidence
            this.onVerifyResidency = onVerifyResidency
        }

        fun suspendContent() {
            generation++
            visible = false
            refreshJob?.cancel()
            refreshJob = null
            entries = emptyList()
            historyJob?.cancel()
            historyJob = null
            requests = emptyList()
            nextCursor = null
            homesError = null
            historyError = null
            loadingHistory = false
            _state.value = ListOfRowsUiState.Loading
            _banner.value = null
            _pendingEvent.value = null
            _actionError.value = null
        }

        private fun current(revision: Long) = visible && revision == generation && session.isCurrent

        fun load() = refresh()

        fun refresh() {
            suspendContent()
            visible = true
            val revision = generation
            refreshJob =
                viewModelScope.launch {
                    try {
                        session.requireCurrent()
                        val result = repo.myHomes()
                        session.requireCurrent()
                        if (!current(revision)) return@launch
                        when (result) {
                            is NetworkResult.Success -> {
                                val homes = result.data.homes
                                if (homes.any { !it.hasValidListContext } || homes.map { it.id }.distinct().size != homes.size) {
                                    homesError = "Your Home list could not be verified. Retry."
                                } else {
                                    entries = homes
                                }
                            }
                            is NetworkResult.Failure -> {
                                homesError = result.error.displayMessage("Could not load your Homes. Retry.")
                            }
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
                    if (pendingVerificationFor(home) == PendingVerification.Owner) {
                        onUploadOwnershipEvidence?.invoke(
                            home.id,
                        )
                    } else {
                        onVerifyResidency?.invoke(home.id)
                    }
            }
        }

        private fun personalRequest(home: MyHome): PersonalHomeResidencyRequest? =
            if (pendingVerificationFor(home) == PendingVerification.Residency) requests.firstOrNull { it.homeId == home.id } else null

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

        private fun rowFor(
            home: MyHome,
            revision: Long,
        ): RowModel {
            val personal = personalRequest(home)
            val title = homeRowTitle(home, personal)
            val locality = listOfNotNull(home.city, home.state).filter { it.isNotBlank() }.joinToString(", ").takeIf { it.isNotBlank() }
            val pending = pendingVerificationFor(home)
            val chips =
                buildList {
                    if (home.accessKind == "private_setup") {
                        add(
                            RowChip("Private setup", PantopusIcon.Home, RowChip.Tint.Status(StatusChipVariant.Warning)),
                        )
                    }
                    if (home.hasSharedAccess && home.ownershipStatus == "verified") {
                        add(
                            RowChip("Ownership verified", PantopusIcon.ShieldCheck, RowChip.Tint.Status(StatusChipVariant.Success)),
                        )
                    }
                    if (home.hasSharedAccess && home.occupancy?.verificationStatus == "verified") {
                        add(
                            RowChip("Residency verified", PantopusIcon.Home, RowChip.Tint.Status(StatusChipVariant.Success)),
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
            val canDelete = home.canDeleteHome == true
            val footerTitle =
                when {
                    home.accessKind == "private_setup" -> "My tasks"
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
                footer =
                    footerTitle?.let {
                        RowFooter(
                            listOf(
                                RowFooterAction(
                                    title = it,
                                    icon = PantopusIcon.ArrowRight,
                                    variant = CompactButtonVariant.Primary,
                                    testTag = "myHomes.row_${home.id}.continue",
                                    onClick = { open(home, revision) },
                                ),
                            ),
                        )
                    },
            )
        }

        private fun unitLabel(home: MyHome): String? {
            if (home.accessKind == "verification") return null
            return home.address2?.trim()?.takeIf { it.isNotEmpty() }?.let { "Unit $it" }
        }

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
