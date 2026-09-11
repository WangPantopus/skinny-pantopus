@file:Suppress("MagicNumber", "TooManyFunctions", "TooGenericExceptionCaught")

package app.pantopus.android.ui.screens.homes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistCarryoverDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistItemDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistProgressDto
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeDetail
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeDashboardRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.homes.settings.ownership_security.HomeOwnershipSecurityViewModel
import app.pantopus.android.ui.screens.shared.content_detail.GridTabsTab
import app.pantopus.android.ui.screens.shared.content_detail.HomeHeroStat
import app.pantopus.android.ui.screens.shared.content_detail.QuickActionTile
import app.pantopus.android.ui.screens.shared.content_detail.QuickActionTone
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Key used to read the home id from the nav backstack's SavedStateHandle. */
const val HOME_DASHBOARD_HOME_ID_KEY = "homeId"

/** Projection shown by [HomeDashboardScreen]. */
data class HomeDashboardContent(
    val address: String,
    /**
     * True when the home has any verified owner; drives the header
     * "Verified" badge and the summary status row. Distinct from
     * [isVerifiedOwner] because the home can have a verified owner who
     * isn't the signed-in user.
     */
    val verified: Boolean,
    /**
     * True when the signed-in user is the verified owner of this home.
     * Drives the claim-ownership banner gate: shown when this is false
     * regardless of whether anyone else is a verified owner.
     */
    val isVerifiedOwner: Boolean,
    val stats: List<HomeHeroStat>,
    val quickActions: List<QuickActionTile>,
    val tabs: List<GridTabsTab>,
    val overview: HomeDashboardOverviewContent,
    val attentionSummary: HomeDashboardAttentionSummary? = null,
    /**
     * Non-null when the home is in a non-normal security state and the
     * banner must render above the tabs. See [HomeSecurityBannerContent].
     */
    val securityBanner: HomeSecurityBannerContent? = null,
)

/**
 * Projection of the home's `security_state` guard rail onto the
 * dashboard banner. Mirrors RN `src/components/HomeStatusBanner.tsx`
 * (copy from `src/constants/ownershipCopy.ts`), which renders nothing
 * for `normal` / `frozen_silent`.
 *
 * Parity contract — mirrored in iOS `HomeSecurityBannerContent`.
 */
data class HomeSecurityBannerContent(
    /** Raw `home_security_state` value the banner was derived from. */
    val state: String,
    val icon: PantopusIcon,
    val title: String,
    val body: String,
    val ctaLabel: String?,
    val action: HomeSecurityBannerAction,
)

/**
 * Which action the security banner's CTA performs, or [NoAction] when
 * the state has no destination we can route to.
 */
enum class HomeSecurityBannerAction {
    InviteCoOwner,
    OpenSecuritySettings,
    NoAction,
}

data class HomeDashboardOverviewContent(
    val upcoming: List<HomeDashboardTimelineItem>,
    val activity: List<HomeDashboardActivityItem>,
    val emergency: HomeDashboardEmergencyInfo,
)

data class HomeDashboardTimelineItem(
    val id: String,
    val icon: PantopusIcon,
    val tone: QuickActionTone,
    val title: String,
    val subtitle: String,
    val trailing: String?,
)

data class HomeDashboardActivityItem(
    val id: String,
    val initials: String,
    val tone: QuickActionTone,
    val title: String,
    val detail: String,
    val time: String,
)

data class HomeDashboardEmergencyInfo(
    val title: String,
    val body: String,
    val isConfigured: Boolean,
)

data class HomeDashboardAttentionSummary(
    val message: String,
    val chips: List<HomeDashboardQuickJump>,
)

data class HomeDashboardQuickJump(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val actionId: String,
)

data class HomeDashboardBrandNewContent(
    val content: HomeDashboardContent,
    val onboardingSteps: List<HomeDashboardOnboardingStep>,
)

data class HomeDashboardOnboardingStep(
    val id: String,
    val title: String,
    val body: String,
    val cta: String,
    val icon: PantopusIcon,
    val tone: QuickActionTone,
    val actionId: String,
)

/**
 * Per-card state for the Home Intelligence stack. Each card renders its
 * own loading / loaded / absent / error surface so a failure in one read
 * never blanks the dashboard.
 *
 * Mirrors iOS `HomeIntelligenceCardState`.
 */
sealed interface HomeIntelligenceCardState<out T> {
    data object Loading : HomeIntelligenceCardState<Nothing>

    data class Loaded<T>(
        val value: T,
    ) : HomeIntelligenceCardState<T>

    /** The signed-in member isn't permitted to see this card (HTTP 403). */
    data object Forbidden : HomeIntelligenceCardState<Nothing>

    data class Failed(
        val message: String,
    ) : HomeIntelligenceCardState<Nothing>
}

/** Convenience accessor mirroring iOS's `HomeIntelligenceCardState.value`. */
fun <T> HomeIntelligenceCardState<T>.valueOrNull(): T? =
    when (this) {
        is HomeIntelligenceCardState.Loaded -> value
        else -> null
    }

/** Observed state for the Home Dashboard. */
sealed interface HomeDashboardUiState {
    data object Loading : HomeDashboardUiState

    data class Loaded(
        val content: HomeDashboardContent,
    ) : HomeDashboardUiState

    data class Empty(
        val brandNew: HomeDashboardBrandNewContent,
    ) : HomeDashboardUiState

    data class NeedsAttention(
        val content: HomeDashboardContent,
    ) : HomeDashboardUiState

    data class Error(
        val message: String,
    ) : HomeDashboardUiState

    data class Limited(val verificationKind: String?, val canOpenTasks: Boolean) : HomeDashboardUiState
}

/**
 * ViewModel for the Home Dashboard screen. Receives the home id via the
 * nav-backstack [SavedStateHandle].
 */
@HiltViewModel
@Suppress("TooManyFunctions")
class HomeDashboardViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        private val intelligenceRepo: HomeDashboardRepository,
        accessFactory: HomeDashboardAccessFactory,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String =
            requireNotNull(savedStateHandle[HOME_DASHBOARD_HOME_ID_KEY]) {
                "HomeDashboardViewModel requires a '$HOME_DASHBOARD_HOME_ID_KEY' nav arg."
            }

        private val _state = MutableStateFlow<HomeDashboardUiState>(HomeDashboardUiState.Loading)

        /** Observed state. */
        val state: StateFlow<HomeDashboardUiState> = _state.asStateFlow()

        // ── Home Intelligence (independent per-card state) ──────────

        private val _healthScore =
            MutableStateFlow<HomeIntelligenceCardState<HomeHealthScoreDto>>(HomeIntelligenceCardState.Loading)

        /** `GET /api/homes/:id/health-score`. */
        val healthScore: StateFlow<HomeIntelligenceCardState<HomeHealthScoreDto>> = _healthScore.asStateFlow()

        private val _checklist =
            MutableStateFlow<HomeIntelligenceCardState<SeasonalChecklistDto>>(HomeIntelligenceCardState.Loading)

        /** `GET /api/homes/:id/seasonal-checklist`. */
        val checklist: StateFlow<HomeIntelligenceCardState<SeasonalChecklistDto>> = _checklist.asStateFlow()

        private val _propertyValue =
            MutableStateFlow<HomeIntelligenceCardState<HomePropertyValueDto>>(HomeIntelligenceCardState.Loading)

        /** `GET /api/homes/:id/property-value`. */
        val propertyValue: StateFlow<HomeIntelligenceCardState<HomePropertyValueDto>> = _propertyValue.asStateFlow()

        private val _billTrends =
            MutableStateFlow<HomeIntelligenceCardState<HomeBillTrendsDto>>(HomeIntelligenceCardState.Loading)

        /** `GET /api/homes/:id/bill-trends`. */
        val billTrends: StateFlow<HomeIntelligenceCardState<HomeBillTrendsDto>> = _billTrends.asStateFlow()
        private val _billCurrency = MutableStateFlow("USD")
        val billCurrency: StateFlow<String> = _billCurrency.asStateFlow()
        private val _billCurrencies = MutableStateFlow(listOf("USD"))
        val billCurrencies: StateFlow<List<String>> = _billCurrencies.asStateFlow()
        private var billReadId = 0L

        private val _pendingChecklistItemIds = MutableStateFlow<Set<String>>(emptySet())

        /**
         * Checklist item ids with an in-flight PATCH — the row disables
         * while its mutation awaits the server's returned item state.
         */
        val pendingChecklistItemIds: StateFlow<Set<String>> = _pendingChecklistItemIds.asStateFlow()

        // Raw responses; [rebuild] composes the rendered content from them.
        private var detailData: HomeDetail? = null
        private var dashboardData: HomeDashboardResponse? = null

        /**
         * Current confirmed Home access gates private content and actions.
         * An unavailable or changed authority retires the shared overview.
         */
        private var accessData: HomeAccessDto? = null
        private val authority = accessFactory.create(homeId, viewModelScope)
        private var authoritySnapshot: HomeDashboardAuthorityDto? = null
        private var generation = 0L
        private var visible = false
        private var refreshJob: Job? = null
        private var canCreateTask = false

        fun can(permission: String): Boolean = visible && authority.isCurrent && accessData?.can(permission) == true

        fun canPerform(action: String): Boolean {
            if (!visible || !authority.isCurrent) return false
            if (action == "add_task") return canCreateTask
            if (action == "access_codes") return can("access.view_wifi") || can("access.view_codes")
            val permission =
                mapOf(
                    "track_bill" to "finance.manage", "track_package" to "packages.edit", "log_package" to "packages.edit",
                    "add_pet" to "home.edit", "create_poll" to "home.edit", "send_mail" to "mailbox.view",
                    "add_member" to "members.view", "view_bills" to "finance.view", "view_polls" to "home.view",
                    "view_maintenance" to "maintenance.view", "pets" to "home.view", "calendar" to "calendar.view",
                    "view_docs" to "docs.view", "view_emergency" to "sensitive.view", "view_packages" to "packages.view",
                    "view_tasks" to "tasks.view", "view_claims" to "ownership.view",
                )[action]
            return permission?.let(::can) == true
        }

        fun suspendContent() {
            generation += 1
            visible = false
            refreshJob?.cancel()
            clearPrivateData()
        }

        private fun clearPrivateData() {
            detailData = null
            dashboardData = null
            accessData = null
            authoritySnapshot = null
            canCreateTask = false
            _selectedTab.value = "overview"
            _healthScore.value = HomeIntelligenceCardState.Loading
            _checklist.value = HomeIntelligenceCardState.Loading
            _propertyValue.value = HomeIntelligenceCardState.Loading
            billReadId += 1
            _billTrends.value = HomeIntelligenceCardState.Loading
            _pendingChecklistItemIds.value = emptySet()
            _state.value = HomeDashboardUiState.Loading
        }

        private fun current(revision: Long): Boolean = visible && revision == generation && authority.isCurrent

        private fun requireCurrent(revision: Long) {
            if (!current(revision)) throw CancellationException("Obsolete Home read")
        }

        private fun retireAccess(revision: Long) {
            if (!visible || generation != revision) return
            generation += 1
            clearPrivateData()
            _state.value = HomeDashboardUiState.Error("Home access changed or could not be confirmed. Reload to check current access.")
        }

        private val _selectedTab = MutableStateFlow("overview")

        /** Currently-selected grid tab. */
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        init {
            viewModelScope.launch {
                authority.invalidated.collect { invalidated ->
                    if (invalidated) {
                        suspendContent()
                        _state.value = HomeDashboardUiState.Error("Your session changed. Reopen this Home to continue.")
                    }
                }
            }
        }

        /** Switch the active grid tab. */
        fun selectTab(id: String) {
            if (HomeDashboardProjection.gatedTabs(accessData).none { it.id == id }) return
            _selectedTab.value = id
        }

        /** Expose the home id so the screen can build outbound nav routes. */
        fun currentHomeId(): String? = homeId.takeIf { visible && authority.isCurrent }

        /**
         * Display name of the loaded home, used as the 2-line top-bar
         * subtitle on the Access codes destination. Returns null while
         * the dashboard is still loading.
         */
        fun currentHomeName(): String? =
            when (val current = _state.value) {
                is HomeDashboardUiState.Loaded -> current.content.address
                is HomeDashboardUiState.Empty -> current.brandNew.content.address
                is HomeDashboardUiState.NeedsAttention -> current.content.address
                HomeDashboardUiState.Loading, is HomeDashboardUiState.Error, is HomeDashboardUiState.Limited -> null
            }

        /** Recheck on every foreground or return to this Home. */
        fun load() {
            if (visible) return
            visible = true
            refresh()
        }

        fun refresh() {
            if (!visible) return
            refreshJob?.cancel()
            generation += 1
            val revision = generation
            clearPrivateData()
            HomeDashboardSampleData.stateFor(homeId)?.let { sample ->
                _state.value = sample
                return
            }
            if (!authority.isCurrent) {
                _state.value = HomeDashboardUiState.Error("Your session changed. Reopen this Home to continue.")
                return
            }
            refreshJob = viewModelScope.launch { fetchAll(revision) }
        }

        private suspend fun fetchAll(revision: Long) {
            try {
                requireCurrent(revision)
                val opening = authority.read()
                requireCurrent(revision)
                val access = opening.sharedAccess()
                if (access == null) {
                    val collection = readOptionalTasks()
                    requireCurrent(revision)
                    check(authority.read() == opening) { "Home authority changed" }
                    requireCurrent(revision)
                    canCreateTask = collection?.collectionCapabilities?.canCreate == true
                    _state.value = HomeDashboardUiState.Limited(opening.currentVerificationKind(), collection != null)
                    return
                }
                val (detail, dashboard) =
                    coroutineScope {
                        val detailRead = async { repo.detail(homeId).homeValue().home }
                        val dashboardRead = async { intelligenceRepo.dashboard(homeId).homeValue() }
                        detailRead.await() to dashboardRead.await()
                    }
                requireCurrent(revision)
                check(
                    detail.id == homeId && dashboard.home?.id == homeId &&
                        dashboard.myAccess?.permissions.orEmpty().toSet() == access.permissions.toSet() &&
                        dashboard.myAccess?.isOwner == access.isOwner,
                ) { "Unexpected Home information" }
                val collection = if (access.can("tasks.view")) readOptionalTasks() else null
                requireCurrent(revision)
                check(authority.read() == opening) { "Home authority changed" }
                requireCurrent(revision)
                authoritySnapshot = opening
                accessData = access
                detailData = detail
                dashboardData = dashboard
                canCreateTask = collection?.collectionCapabilities?.canCreate == true
                rebuild()
                coroutineScope {
                    launch { loadHealthScore() }
                    launch { loadChecklist() }
                    launch { loadPropertyValue() }
                    launch { loadBillTrends() }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                if (visible && revision == generation) {
                    clearPrivateData()
                    _state.value = HomeDashboardUiState.Error("Current Home information could not be confirmed. Reload to try again.")
                }
            }
        }

        private suspend fun readOptionalTasks() =
            try {
                authority.readTasks()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                null
            }

        private fun <T> NetworkResult<T>.homeValue(): T =
            when (this) {
                is NetworkResult.Success -> data
                is NetworkResult.Failure -> throw error
            }

        private suspend fun authorize(revision: Long) {
            requireCurrent(revision)
            val snapshot = authority.read()
            requireCurrent(revision)
            if (snapshot.sharedAccess() == null || snapshot != authoritySnapshot) throw NetworkError.Forbidden
        }

        private suspend fun <T> authorizedCard(
            permissions: List<String>,
            work: suspend () -> NetworkResult<T>,
        ): HomeIntelligenceCardState<T>? {
            val revision = generation
            if (!current(revision) || authoritySnapshot == null) return null
            if (!permissions.all { accessData?.can(it) == true }) return HomeIntelligenceCardState.Forbidden
            return try {
                authorize(revision)
                val result = work().toCardState()
                authorize(revision)
                if (result is HomeIntelligenceCardState.Forbidden) {
                    retireAccess(revision)
                    null
                } else {
                    result
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                retireAccess(revision)
                null
            }
        }

        // ── Home Intelligence reads ─────────────────────────────────

        /**
         * Mirrors RN's `useHomeIntelligence`, which always forces a server
         * recompute so a stale zero-score can't mask a populated home.
         */
        private suspend fun loadHealthScore() {
            _healthScore.value = authorizedCard(
                listOf("home.view", "maintenance.view", "finance.view", "members.view", "docs.view", "sensitive.view"),
            ) { intelligenceRepo.healthScore(homeId, force = true).validated { HomeIntelligenceValidation.health(it, homeId) } } ?: return
            // The Overview's emergency row reads the health breakdown.
            rebuild()
        }

        private suspend fun loadChecklist() {
            _checklist.value = authorizedCard(listOf("home.view")) {
                intelligenceRepo.seasonalChecklist(homeId).validated { HomeIntelligenceValidation.checklist(it, homeId) }
            } ?: return
        }

        private suspend fun loadPropertyValue() {
            _propertyValue.value = authorizedCard(listOf("home.view")) {
                intelligenceRepo.propertyValue(homeId).validated(HomeIntelligenceValidation::property)
            } ?: return
        }

        private fun <T> NetworkResult<T>.validated(valid: (T) -> Boolean): NetworkResult<T> =
            if (this is NetworkResult.Success && !valid(data)) {
                NetworkResult.Failure(NetworkError.Decoding(IllegalArgumentException("Invalid current Home information")))
            } else {
                this
            }

        private suspend fun loadBillTrends() {
            val readId = ++billReadId
            val currency = _billCurrency.value
            val result = authorizedCard(listOf("finance.view")) { intelligenceRepo.billTrends(homeId, currency) } ?: return
            if (readId != billReadId || currency != _billCurrency.value) return
            result.valueOrNull()?.let { data ->
                if (HomeBillPresentation.isCurrent(data, currency)) {
                    _billCurrencies.value = (data.availableCurrencies + listOf("USD", currency)).distinct().sorted()
                }
            }
            _billTrends.value = result
        }

        private fun <T> NetworkResult<T>.toCardState(): HomeIntelligenceCardState<T> =
            when (this) {
                is NetworkResult.Success -> HomeIntelligenceCardState.Loaded(data)
                is NetworkResult.Failure ->
                    if (error is NetworkError.Forbidden) {
                        HomeIntelligenceCardState.Forbidden
                    } else {
                        HomeIntelligenceCardState.Failed(
                            when (error) {
                                is NetworkError.Decoding -> "Current Home information is unavailable. Reload this card."
                                is NetworkError.Server -> "This Home information couldn't be loaded. Please retry."
                                else -> error.displayMessage("Couldn't load this card.")
                            },
                        )
                    }
            }

        // ── Seasonal checklist actions ──────────────────────────────

        /** `PATCH …/seasonal-checklist/:itemId { status: "completed" }`. */
        fun completeChecklistItem(itemId: String) {
            viewModelScope.launch { updateChecklistItem(itemId, "completed") }
        }

        /** `PATCH …/seasonal-checklist/:itemId { status: "skipped" }`. */
        fun skipChecklistItem(itemId: String) {
            viewModelScope.launch { updateChecklistItem(itemId, "skipped") }
        }

        /**
         * The GET is idempotent-generate: it creates the current season's
         * items when the home has none, so "Generate checklist" is a re-read.
         */
        fun generateChecklist() {
            _checklist.value = HomeIntelligenceCardState.Loading
            viewModelScope.launch { loadChecklist() }
        }

        /** Card-level retry for the health-score ring. */
        fun refreshHealthScore() {
            _healthScore.value = HomeIntelligenceCardState.Loading
            viewModelScope.launch { loadHealthScore() }
        }

        /** Card-level retry for the property-value card. */
        fun retryPropertyValue() {
            _propertyValue.value = HomeIntelligenceCardState.Loading
            viewModelScope.launch { loadPropertyValue() }
        }

        /** Card-level retry for the bill-trends card. */
        fun retryBillTrends() {
            _billTrends.value = HomeIntelligenceCardState.Loading
            viewModelScope.launch { loadBillTrends() }
        }

        fun selectBillCurrency(currency: String) {
            if (currency == _billCurrency.value || currency !in _billCurrencies.value) return
            _billCurrency.value = currency
            _billTrends.value = HomeIntelligenceCardState.Loading
            viewModelScope.launch { loadBillTrends() }
        }

        private suspend fun updateChecklistItem(
            itemId: String,
            status: String,
        ) {
            if (!can("home.edit") || _pendingChecklistItemIds.value.contains(itemId)) return
            val revision = generation
            _pendingChecklistItemIds.value = _pendingChecklistItemIds.value + itemId
            try {
                authorize(revision)
                val updated = intelligenceRepo.updateSeasonalChecklistItem(homeId, itemId, status).homeValue()
                authorize(revision)
                check(HomeIntelligenceValidation.item(updated, homeId) && updated.id == itemId && updated.status == status) {
                    "The checklist update was not confirmed."
                }
                applyChecklistItem(updated)
                loadHealthScore()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: NetworkError.Forbidden) {
                retireAccess(revision)
            } catch (_: Throwable) {
                if (current(revision)) {
                    _checklist.value = HomeIntelligenceCardState.Failed("Couldn't confirm that task update. Reload to try again.")
                }
            } finally {
                if (revision == generation) _pendingChecklistItemIds.value = _pendingChecklistItemIds.value - itemId
            }
        }

        /**
         * Splice the server's returned row back into the loaded checklist
         * and recompute progress the same way the backend does
         * (`home.js:7526`).
         */
        private fun applyChecklistItem(updated: SeasonalChecklistItemDto) {
            val current = _checklist.value.valueOrNull() ?: return
            val items = current.items.map { if (it.id == updated.id) updated else it }
            val carryover =
                current.carryover?.let { block ->
                    SeasonalChecklistCarryoverDto(
                        season = block.season,
                        items = block.items.map { if (it.id == updated.id) updated else it },
                    )
                }
            val completed = items.count { it.isResolved }
            _checklist.value =
                HomeIntelligenceCardState.Loaded(
                    current.copy(
                        items = items,
                        progress =
                            SeasonalChecklistProgressDto(
                                total = items.size,
                                completed = completed,
                                percentage = HomeDashboardProjection.percentage(completed, items.size),
                            ),
                        carryover = carryover,
                    ),
                )
        }

        // ── Projection ──────────────────────────────────────────────

        private fun rebuild() {
            val detail = detailData ?: return
            if (!can("home.view") || dashboardData == null) return
            _state.value =
                HomeDashboardUiState.Loaded(
                    content(
                        address = detail.address ?: detail.name ?: "Home",
                        verified = detail.ownershipStatus == "verified" || detail.owners.any { it.ownerStatus == "verified" },
                        isVerifiedOwner = detail.ownershipStatus == "verified",
                        securityBanner = securityBanner(detail.securityState, detail.claimWindowEndsAt),
                    ),
                )
        }

        private fun content(
            address: String,
            verified: Boolean,
            isVerifiedOwner: Boolean,
            securityBanner: HomeSecurityBannerContent?,
        ): HomeDashboardContent {
            val counts = dashboardData?.counts
            return HomeDashboardContent(
                address = address,
                verified = verified,
                isVerifiedOwner = isVerifiedOwner,
                stats =
                    HomeDashboardProjection.stats(counts).filter {
                        can(
                            when (it.id) {
                                "packages" -> "packages.view"
                                "bills" -> "finance.view"
                                else -> "tasks.view"
                            },
                        )
                    },
                quickActions = HomeDashboardProjection.quickActions(counts, accessData),
                tabs = HomeDashboardProjection.gatedTabs(accessData),
                overview =
                    HomeDashboardProjection.overview(
                        dashboard = dashboardData,
                        health = _healthScore.value.valueOrNull(),
                    ),
                attentionSummary = null,
                securityBanner = securityBanner,
            )
        }

        companion object {
            /**
             * Pure projection of `Home.security_state` onto the dashboard
             * banner. Copy is lifted verbatim from RN's
             * `ownershipCopy.ts` (`CLAIM_WINDOW` / `REVIEW_REQUIRED` /
             * `DISPUTE` / `FROZEN`) and the render gate matches
             * `HomeStatusBanner.tsx:33` — `normal` and `frozen_silent`
             * render nothing.
             *
             * Parity contract — mirrored in iOS
             * `HomeDashboardViewModel.securityBanner(state:claimWindowEndsAt:)`.
             */
            fun securityBanner(
                state: String?,
                claimWindowEndsAt: String?,
            ): HomeSecurityBannerContent? =
                when (state) {
                    "claim_window" -> {
                        val date = HomeOwnershipSecurityViewModel.formattedDate(claimWindowEndsAt)
                        HomeSecurityBannerContent(
                            state = state,
                            icon = PantopusIcon.Clock,
                            title = "Claim Window Active",
                            body =
                                if (date != null) {
                                    "Co-owners can verify ownership until $date."
                                } else {
                                    "Co-owners can verify ownership while the window is open."
                                },
                            ctaLabel = "Invite Co-Owner",
                            action = HomeSecurityBannerAction.InviteCoOwner,
                        )
                    }
                    "review_required" ->
                        HomeSecurityBannerContent(
                            state = state,
                            icon = PantopusIcon.Shield,
                            title = "Review Required",
                            body = "New owner claims require manual review.",
                            ctaLabel = "Learn Why",
                            action = HomeSecurityBannerAction.OpenSecuritySettings,
                        )
                    "disputed" ->
                        HomeSecurityBannerContent(
                            state = state,
                            icon = PantopusIcon.AlertTriangle,
                            title = "Verification dispute active",
                            body = "Some sensitive actions are temporarily restricted.",
                            ctaLabel = "View Details",
                            action = HomeSecurityBannerAction.OpenSecuritySettings,
                        )
                    "frozen" ->
                        // RN renders a "Contact support" label with no
                        // handler (`HomeStatusBanner.tsx:68-72`); we ship
                        // the copy without a dead button rather than a
                        // control that does nothing.
                        HomeSecurityBannerContent(
                            state = state,
                            icon = PantopusIcon.Lock,
                            title = "Home protections enabled",
                            body = "Some actions require support.",
                            ctaLabel = null,
                            action = HomeSecurityBannerAction.NoAction,
                        )
                    else -> null
                }
        }
    }
