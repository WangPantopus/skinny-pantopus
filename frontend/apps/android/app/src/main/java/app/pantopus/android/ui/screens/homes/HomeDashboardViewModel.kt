@file:Suppress("MagicNumber", "TooManyFunctions", "TooGenericExceptionCaught")

package app.pantopus.android.ui.screens.homes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardAuthorityDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
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
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreKind
import app.pantopus.android.data.store.Stored
import app.pantopus.android.ui.components.RefreshNotice
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
import kotlinx.coroutines.delay
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
        /** A change failed, not the read: the card's content had loaded. */
        val afterChange: Boolean = false,
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
        gates: HomeCopyGateFactory,
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
        private val _billSharing = MutableStateFlow(BillSharingState())

        /** The bill-sharing save in flight or its failure; the screen adds who may change it. */
        val billSharing: StateFlow<BillSharingState> = _billSharing.asStateFlow()

        private val _pendingChecklistItemIds = MutableStateFlow<Set<String>>(emptySet())
        private val checklistOriginals = mutableMapOf<String, SeasonalChecklistItemDto>()
        private val _checklistActionError = MutableStateFlow<String?>(null)
        val checklistActionError: StateFlow<String?> = _checklistActionError.asStateFlow()

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

        /** Founder decision 3: who may see this screen from the store's copy, and what leaves with the screen. */
        private val gate =
            gates.create(
                homeId,
                listOf(
                    HomeStoreKeys.detail(homeId),
                    StoreKeys.homeDashboard(homeId),
                    HomeStoreKeys.tasks(homeId),
                    HomeStoreKeys.healthScore(homeId),
                    HomeStoreKeys.seasonalChecklist(homeId),
                    HomeStoreKeys.propertyValue(homeId),
                ),
            )

        /** The quiet "Couldn't refresh. Showing 3:42 PM." line when a read fails on a copy past its max shown age. */
        private val _refreshNotice = MutableStateFlow<RefreshNotice?>(null)
        val refreshNotice: StateFlow<RefreshNotice?> = _refreshNotice.asStateFlow()
        private var authoritySnapshot: HomeDashboardAuthorityDto? = null
        private var generation = 0L
        private var visible = false
        private var refreshJob: Job? = null
        private var expiryJob: Job? = null
        private var accessExpiresAt: Long? = null
        private var canCreateTask = false

        private fun accessUnexpired(): Boolean = accessExpiresAt?.let { System.currentTimeMillis() < it } != false

        fun can(permission: String): Boolean = visible && authority.isCurrent && accessUnexpired() && accessData?.can(permission) == true

        fun canPerform(action: String): Boolean {
            if (!visible || !authority.isCurrent || !accessUnexpired()) return false
            if (action == "add_task") return canCreateTask
            if (action == "access_codes") return can("access.view_wifi") || can("access.view_codes")
            val permission =
                mapOf(
                    "track_bill" to "finance.manage", "track_package" to "packages.edit", "log_package" to "packages.edit",
                    "add_pet" to "home.edit", "create_poll" to "home.edit", "send_mail" to "mailbox.view",
                    "add_member" to "members.view", "view_bills" to "finance.view", "view_polls" to "home.view",
                    "view_maintenance" to "maintenance.view", "view_issues" to "maintenance.view", "pets" to "home.view",
                    "calendar" to "calendar.view",
                    "view_docs" to "docs.view", "view_emergency" to "sensitive.view", "view_packages" to "packages.view",
                    "view_tasks" to "tasks.view", "view_claims" to "ownership.view",
                )[action]
            // Launch cut: no action into a feature hidden for the first launch.
            return isLaunchAvailableAction(action) && permission?.let(::can) == true
        }

        /**
         * Pause and leave. Founder decision 3: owners and household roles keep what's on screen (shown again on return
         * while it is re-checked); guests, service providers and any access with an expiry are cleared now.
         */
        fun suspendContent() {
            checklistOriginals.values.toList().forEach { applyChecklistItem(it, remember = false) }
            checklistOriginals.clear()
            _pendingChecklistItemIds.value = emptySet()
            _checklistActionError.value = null
            generation += 1
            visible = false
            refreshJob?.cancel()
            billReadId += 1
            _billTrends.value = HomeIntelligenceCardState.Loading
            if (!gate.showsCopy) {
                clearPrivateData()
                gate.leave()
            }
        }

        override fun onCleared() {
            gate.leave()
        }

        private fun clearPrivateData() {
            expiryJob?.cancel()
            expiryJob = null
            accessExpiresAt = null
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
            checklistOriginals.clear()
            _checklistActionError.value = null
            _state.value = HomeDashboardUiState.Loading
        }

        private fun current(revision: Long): Boolean = visible && revision == generation && authority.isCurrent && accessUnexpired()

        private fun watchExpiry(
            expiry: Long?,
            revision: Long,
        ) {
            accessExpiresAt = expiry
            if (expiry == null) return
            expiryJob =
                viewModelScope.launch {
                    while (System.currentTimeMillis() < expiry) {
                        delay((expiry - System.currentTimeMillis()).coerceAtLeast(1))
                    }
                    retireAccess(revision)
                }
        }

        private fun requireCurrent(revision: Long) {
            if (!current(revision)) throw CancellationException("Obsolete Home read")
        }

        private fun retireAccess(revision: Long) {
            if (!visible || generation != revision) return
            generation += 1
            gate.invalidate()
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
                        clearPrivateData()
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
        fun currentHomeId(): String? = homeId.takeIf { visible && authority.isCurrent && accessUnexpired() }

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

        /**
         * Recheck on every foreground or return to this Home (Instant Screens): owners and household roles see the
         * stored dashboard at once and the store answers fresh copies without a request; anyone else re-checks first.
         */
        fun load() {
            if (visible) return
            visible = true
            if (detailData == null && gate.showsCopy) showStoredCopy()
            refresh(force = false)
        }

        /** Pull to refresh and Retry: read now. */
        fun refresh() = refresh(force = true)

        private fun refresh(force: Boolean) {
            if (_pendingChecklistItemIds.value.isNotEmpty()) return
            if (!visible) return
            refreshJob?.cancel()
            generation += 1
            val revision = generation
            // Blank-and-re-check unless an owner or household role is looking at a copy (decision 3).
            if (detailData == null || !gate.showsCopy) clearPrivateData()
            HomeDashboardSampleData.stateFor(homeId)?.let { sample ->
                _state.value = sample
                return
            }
            if (!authority.isCurrent) {
                _state.value = HomeDashboardUiState.Error("Your session changed. Reopen this Home to continue.")
                return
            }
            refreshJob = viewModelScope.launch { fetchAll(revision, force) }
        }

        /** The stored dashboard, shown before the re-check when every core piece checks out. */
        private fun showStoredCopy() {
            val opening = authority.storedAuthority() ?: return
            val access = opening.sharedAccess() ?: return
            val detail = repo.storedDetail(homeId)?.home ?: return
            val stored = intelligenceRepo.storedDashboard(homeId)
            val dashboard = stored.dashboard
            if (dashboard == null || !copiesAgree(detail, dashboard, access)) return
            authoritySnapshot = opening
            accessData = access
            detailData = detail
            dashboardData = dashboard
            canCreateTask = authority.storedTasks()?.collectionCapabilities?.canCreate == true
            _healthScore.value =
                storedCardCopy(HEALTH_PERMISSIONS, stored.healthScore) { HomeIntelligenceValidation.health(it, homeId) }
            _checklist.value = storedCardCopy(listOf("home.view"), stored.checklist) { HomeIntelligenceValidation.checklist(it, homeId) }
            _propertyValue.value = storedCardCopy(listOf("home.view"), stored.propertyValue, HomeIntelligenceValidation::property)
            rebuild()
        }

        /** The copies agree with each other as a fresh batch must ([fetchAll]), or nothing shows before the re-check. */
        private fun copiesAgree(
            detail: HomeDetail,
            dashboard: HomeDashboardResponse,
            access: HomeAccessDto,
        ): Boolean =
            detail.id == homeId &&
                dashboard.home?.id == homeId &&
                dashboard.myAccess?.permissions.orEmpty().toSet() == access.permissions.toSet() &&
                dashboard.myAccess?.isOwner == access.isOwner

        private fun <T> storedCardCopy(
            permissions: List<String>,
            copy: T?,
            valid: (T) -> Boolean,
        ): HomeIntelligenceCardState<T> =
            when {
                !permissions.all { accessData?.can(it) == true } -> HomeIntelligenceCardState.Forbidden
                copy != null && valid(copy) -> HomeIntelligenceCardState.Loaded(copy)
                else -> HomeIntelligenceCardState.Loading
            }

        /** The viewer's access for this batch: from the store (owners and household roles), else read now. */
        private suspend fun openingAuthority(fromCopy: Boolean): Stored<HomeDashboardAuthorityDto> {
            val stored = authority.readStored(force = !fromCopy)
            if (stored.data != null && !gate.showsCopy && stored.failure != null) throw stored.failure
            if (stored.data != null) return stored
            // No access: the direct read keeps the server's typed refusal (verification kind) for the limited view.
            if (stored.failure is NetworkError.Forbidden || stored.failure == NetworkError.NotFound) {
                gate.invalidate()
                clearPrivateData()
                return Stored(authority.read(), fetchedAt = System.currentTimeMillis())
            }
            throw stored.failure ?: NetworkError.NotFound
        }

        private suspend fun fetchAll(
            revision: Long,
            force: Boolean,
        ) {
            try {
                requireCurrent(revision)
                val fromCopy = gate.showsCopy && !force && detailData != null
                val batchStart = System.currentTimeMillis()
                val openingRead = openingAuthority(fromCopy)
                val opening = checkNotNull(openingRead.data)
                gate.observe(opening)
                if (!gate.showsCopy) {
                    gate.invalidate()
                    clearPrivateData()
                }
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
                watchExpiry(opening.expiryMillis(), revision)
                requireCurrent(revision)
                val readNow = !fromCopy || !gate.showsCopy
                val (detailRead, dashboardRead) =
                    coroutineScope {
                        val detailStored = async { repo.detailStored(homeId, readNow) }
                        val dashboardStored = async { intelligenceRepo.dashboardStored(homeId, readNow) }
                        detailStored.await() to dashboardStored.await()
                    }
                requireCurrent(revision)
                val detail = detailRead.value().home
                val dashboard = dashboardRead.value()
                check(
                    detail.id == homeId && dashboard.home?.id == homeId &&
                        dashboard.myAccess?.permissions.orEmpty().toSet() == access.permissions.toSet() &&
                        dashboard.myAccess?.isOwner == access.isOwner,
                ) { "Unexpected Home information" }
                val collection = if (access.can("tasks.view")) readOptionalTasksStored(readNow) else null
                requireCurrent(revision)
                // Anything read anew in this batch is composed only under the same authority: confirm it once more.
                val reads = listOfNotNull(openingRead, detailRead, dashboardRead, collection)
                if (reads.any { it.fetchedAt >= batchStart }) {
                    check(authority.readStored(force = true).data == opening) { "Home authority changed" }
                }
                requireCurrent(revision)
                authoritySnapshot = opening
                accessData = access
                detailData = detail
                dashboardData = dashboard
                canCreateTask = collection?.data?.collectionCapabilities?.canCreate == true
                rebuild()
                _refreshNotice.value =
                    RefreshNotice(detailRead.fetchedAt, ::refresh).takeIf { detailRead.showsRefreshFailure(StoreKind.HOMES) }
                coroutineScope {
                    launch { loadHealthScore(readNow) }
                    launch { loadChecklist(readNow) }
                    launch { loadPropertyValue(readNow) }
                    launch { loadBillTrends() }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                if (visible && revision == generation) {
                    gate.invalidate()
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

        /** The task collection through the store; null when it can't be read (the tasks entry point stays hidden). */
        private suspend fun readOptionalTasksStored(force: Boolean) =
            try {
                authority.readTasksStored(force).takeIf { it.data != null }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                null
            }

        private suspend fun authorize(revision: Long) {
            requireCurrent(revision)
            val snapshot = authority.read()
            requireCurrent(revision)
            if (snapshot.sharedAccess() == null || snapshot != authoritySnapshot) throw NetworkError.Forbidden
        }

        // ── Home Intelligence reads ─────────────────────────────────

        /**
         * Through the store (Instant Screens): a fresh copy answers without a request, [force] reads now (card retry,
         * own edits, pull). The server checks each card's permissions; its 403 retires this Home's access.
         */
        private suspend fun <T : Any> storedCard(
            permissions: List<String>,
            read: suspend () -> Stored<T>,
            valid: (T) -> Boolean,
        ): HomeIntelligenceCardState<T>? {
            val revision = generation
            if (!current(revision) || authoritySnapshot == null) return null
            if (!permissions.all { accessData?.can(it) == true }) return HomeIntelligenceCardState.Forbidden
            return try {
                val stored = read()
                if (!current(revision)) return null
                val data = stored.data
                when {
                    data != null && valid(data) -> HomeIntelligenceCardState.Loaded(data)
                    data != null -> HomeIntelligenceCardState.Failed("Current Home information is unavailable. Reload this card.")
                    stored.failure is NetworkError.Forbidden || stored.failure == NetworkError.NotFound -> {
                        retireAccess(revision)
                        null
                    }
                    else -> NetworkResult.Failure(stored.failure ?: NetworkError.NotFound).toCardState()
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Throwable) {
                retireAccess(revision)
                null
            }
        }

        /**
         * Mirrors RN's `useHomeIntelligence`, which always forces a server
         * recompute so a stale zero-score can't mask a populated home.
         */
        private suspend fun loadHealthScore(force: Boolean = true) {
            _healthScore.value =
                storedCard(HEALTH_PERMISSIONS, { intelligenceRepo.healthScoreStored(homeId, force) }) {
                    HomeIntelligenceValidation.health(it, homeId)
                } ?: return
            // The Overview's emergency row reads the health breakdown.
            rebuild()
        }

        private suspend fun loadChecklist(force: Boolean = true) {
            _checklist.value =
                storedCard(listOf("home.view"), { intelligenceRepo.seasonalChecklistStored(homeId, force) }) {
                    HomeIntelligenceValidation.checklist(it, homeId)
                } ?: return
        }

        private suspend fun loadPropertyValue(force: Boolean = true) {
            _propertyValue.value =
                storedCard(
                    listOf("home.view"),
                    { intelligenceRepo.propertyValueStored(homeId, force) },
                    HomeIntelligenceValidation::property,
                ) ?: return
        }

        /** Bills are sensitive: the endpoint checks access each visit, and the result lives only while open. */
        private suspend fun authorizedBillCard(
            work: suspend () -> NetworkResult<HomeBillTrendsDto>,
        ): HomeIntelligenceCardState<HomeBillTrendsDto>? {
            val revision = generation
            if (!current(revision) || authoritySnapshot == null) return null
            if (accessData?.can("finance.view") != true) return HomeIntelligenceCardState.Forbidden
            val result = work()
            if (!current(revision)) return null
            return if (result is NetworkResult.Failure &&
                (result.error is NetworkError.Forbidden || result.error == NetworkError.NotFound)
            ) {
                retireAccess(revision)
                null
            } else {
                // A failed direct bill read cannot blank the household dashboard or restore an old bill amount.
                result.toCardState()
            }
        }

        private suspend fun loadBillTrends() {
            val readId = ++billReadId
            val currency = _billCurrency.value
            val result =
                authorizedBillCard { intelligenceRepo.billTrends(homeId, currency) } ?: return
            if (readId != billReadId || currency != _billCurrency.value) return
            result.valueOrNull()?.let { data ->
                if (HomeBillPresentation.isCurrent(data, currency)) {
                    _billCurrencies.value = (data.availableCurrencies + listOf("USD", currency)).distinct().sorted()
                }
            }
            _billTrends.value = result
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
         * The score counts the checklist, so it reloads once the items exist.
         */
        fun generateChecklist() {
            _checklist.value = HomeIntelligenceCardState.Loading
            viewModelScope.launch {
                loadChecklist()
                loadHealthScore()
            }
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

        /** The anonymous neighborhood comparison is opt-in per Home (as on the web). */
        fun setBillBenchmarkOptIn(optedIn: Boolean) {
            if (!can("home.edit") || _billSharing.value.isSaving) return
            val revision = generation
            _billSharing.value = BillSharingState(isSaving = true)
            viewModelScope.launch {
                try {
                    authorize(revision)
                    intelligenceRepo.setBillBenchmarkOptIn(homeId, optedIn).homeValue()
                    authorize(revision)
                    // Show what the server saved.
                    loadBillTrends()
                    if (revision == generation) _billSharing.value = BillSharingState()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: NetworkError.Forbidden) {
                    retireAccess(revision)
                } catch (_: Throwable) {
                    if (current(revision)) _billSharing.value = BillSharingState(failed = true)
                } finally {
                    if (revision == generation && _billSharing.value.isSaving) _billSharing.value = BillSharingState()
                }
            }
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
            val checklist = _checklist.value.valueOrNull() ?: return
            val original = (checklist.items + checklist.carryover?.items.orEmpty()).firstOrNull { it.id == itemId } ?: return
            if (original.isResolved) return
            val revision = generation
            checklistOriginals[itemId] = original
            _checklistActionError.value = null
            _pendingChecklistItemIds.value = _pendingChecklistItemIds.value + itemId
            applyChecklistItem(original.copy(status = status), remember = false)
            try {
                authorize(revision)
                val updated = intelligenceRepo.updateSeasonalChecklistItem(homeId, itemId, status).homeValue()
                authorize(revision)
                check(HomeIntelligenceValidation.item(updated, homeId) && updated.id == itemId && updated.status == status) {
                    "The checklist update was not confirmed."
                }
                checklistOriginals.remove(itemId)
                applyChecklistItem(updated)
                loadHealthScore()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: NetworkError) {
                if (error.code in listOf(401, 403, 404)) {
                    retireAccess(revision)
                } else if (current(revision)) {
                    applyChecklistItem(original, remember = false)
                    _checklistActionError.value = error.displayMessage("Couldn't confirm that task update. Try again.")
                }
            } catch (_: Throwable) {
                if (current(revision)) {
                    applyChecklistItem(original, remember = false)
                    _checklistActionError.value = "Couldn't confirm that task update. Try again."
                }
            } finally {
                if (revision == generation) {
                    checklistOriginals.remove(itemId)
                    _pendingChecklistItemIds.value = _pendingChecklistItemIds.value - itemId
                }
            }
        }

        /**
         * Splice the server's returned row back into the loaded checklist
         * and recompute progress the same way the backend does
         * (`home.js:7526`).
         */
        private fun applyChecklistItem(
            updated: SeasonalChecklistItemDto,
            remember: Boolean = true,
        ) {
            val current = _checklist.value.valueOrNull() ?: return
            val spliced = current.replacingItems(mapOf(updated.id to updated))
            _checklist.value = HomeIntelligenceCardState.Loaded(spliced)
            // Own edit (contract §3): a return shows the confirmed change, not the copy from before it.
            if (remember) rememberConfirmedChecklist(spliced)
        }

        private fun rememberConfirmedChecklist(shown: SeasonalChecklistDto) {
            // A different row may still be pending; only confirmed rows enter the shared copy.
            intelligenceRepo.rememberChecklist(homeId, shown.replacingItems(checklistOriginals))
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
                        securityBanner =
                            securityBanner(detail.securityState, detail.claimWindowEndsAt, can("ownership.manage")),
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
            /** What the health score card needs (as the server's own check). */
            private val HEALTH_PERMISSIONS =
                listOf("home.view", "maintenance.view", "finance.view", "members.view", "docs.view", "sensitive.view")

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
                // Drops the claim window's CTA for viewers who can't invite an
                // owner (members, or a seller right after a transfer).
                canInviteCoOwner: Boolean = true,
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
                            ctaLabel = if (canInviteCoOwner) "Invite Co-Owner" else null,
                            action = if (canInviteCoOwner) HomeSecurityBannerAction.InviteCoOwner else HomeSecurityBannerAction.NoAction,
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


/** A stored read's data, kept even when its refresh failed; no data rethrows the failure. */
private fun <T : Any> Stored<T>.value(): T = data ?: throw (failure ?: NetworkError.NotFound)

private fun <T> NetworkResult<T>.homeValue(): T =
    when (this) {
        is NetworkResult.Success -> data
        is NetworkResult.Failure -> throw error
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

/** Launch cut (2026-09-27): "+" rows and tiles into features hidden for the first launch. */
private fun isLaunchAvailableAction(action: String): Boolean =
    when (action) {
        // Launch cut #7 (Household extras): bills, packages, pets, polls and the Home calendar.
        "track_bill", "track_package", "log_package", "add_pet", "create_poll",
        "view_bills", "view_packages", "view_polls", "pets", "calendar",
        -> LaunchFeatures.householdExtras
        // Launch cut #8 (Mail extras): "Send Mail" opens the letter composer.
        "send_mail" -> LaunchFeatures.mailExtras
        else -> true
    }

/** Apply confirmed or pending rows to the same checklist projection, including carryover and progress. */
private fun SeasonalChecklistDto.replacingItems(replacements: Map<String, SeasonalChecklistItemDto>): SeasonalChecklistDto {
    val updatedItems = items.map { replacements[it.id] ?: it }
    val completed = updatedItems.count { it.isResolved }
    return copy(
        items = updatedItems,
        progress = SeasonalChecklistProgressDto(
            total = updatedItems.size,
            completed = completed,
            percentage = HomeDashboardProjection.percentage(completed, updatedItems.size),
        ),
        carryover = carryover?.let { block -> block.copy(items = block.items.map { replacements[it.id] ?: it }) },
    )
}
