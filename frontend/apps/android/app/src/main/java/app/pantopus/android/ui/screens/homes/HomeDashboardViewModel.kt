@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homedashboard.HomeBillTrendsDto
import app.pantopus.android.data.api.models.homedashboard.HomeDashboardResponse
import app.pantopus.android.data.api.models.homedashboard.HomeHealthScoreDto
import app.pantopus.android.data.api.models.homedashboard.HomePropertyValueDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistCarryoverDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistItemDto
import app.pantopus.android.data.api.models.homedashboard.SeasonalChecklistProgressDto
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeDetail
import app.pantopus.android.data.api.models.homes.HomePublicProfile
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeAdminRepository
import app.pantopus.android.data.homes.HomeDashboardRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.homes.settings.ownership_security.HomeOwnershipSecurityViewModel
import app.pantopus.android.ui.screens.shared.content_detail.GridTabsTab
import app.pantopus.android.ui.screens.shared.content_detail.HomeHeroStat
import app.pantopus.android.ui.screens.shared.content_detail.QuickActionTile
import app.pantopus.android.ui.screens.shared.content_detail.QuickActionTone
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
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
        private val adminRepo: HomeAdminRepository,
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

        private val _pendingChecklistItemIds = MutableStateFlow<Set<String>>(emptySet())

        /**
         * Checklist item ids with an in-flight PATCH — the row disables
         * while its mutation awaits the server's returned item state.
         */
        val pendingChecklistItemIds: StateFlow<Set<String>> = _pendingChecklistItemIds.asStateFlow()

        // Raw responses; [rebuild] composes the rendered content from them.
        private var detailData: HomeDetail? = null
        private var publicData: HomePublicProfile? = null
        private var dashboardData: HomeDashboardResponse? = null

        /**
         * The viewer's own per-home access record. Gates the quick-action
         * tiles + tab strip exactly as RN gates its dashboard cards.
         * Best-effort: a 403 / offline read leaves this null and the
         * surface renders ungated rather than blank.
         */
        private var accessData: HomeAccessDto? = null

        private val _selectedTab = MutableStateFlow("overview")

        /** Currently-selected grid tab. */
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        /** Switch the active grid tab. */
        fun selectTab(id: String) {
            _selectedTab.value = id
        }

        /** Expose the home id so the screen can build outbound nav routes. */
        fun currentHomeId(): String? = homeId

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
                HomeDashboardUiState.Loading, is HomeDashboardUiState.Error -> null
            }

        /** Initial load; no-op when already loaded. */
        fun load() {
            if (_state.value is HomeDashboardUiState.Loaded ||
                _state.value is HomeDashboardUiState.Empty ||
                _state.value is HomeDashboardUiState.NeedsAttention
            ) {
                return
            }
            refresh()
        }

        /** Retry / pull-to-refresh. */
        fun refresh() {
            HomeDashboardSampleData.stateFor(homeId)?.let { sample ->
                _state.value = sample
                return
            }
            _state.value = HomeDashboardUiState.Loading
            viewModelScope.launch { fetchAll() }
        }

        private suspend fun fetchAll() =
            coroutineScope {
                val core = async { fetchCore() }
                val health = async { loadHealthScore() }
                val seasonal = async { loadChecklist() }
                val property = async { loadPropertyValue() }
                val trends = async { loadBillTrends() }
                core.await()
                health.await()
                seasonal.await()
                property.await()
                trends.await()
            }

        /**
         * Home detail (identity / ownership) + the dashboard aggregate +
         * the viewer's access record (`GET /api/homes/:id/me`, route
         * `backend/routes/homeIam.js:51`). The access read is
         * best-effort: a 403 there means "no access record", which must
         * not fail the dashboard.
         */
        private suspend fun fetchCore() =
            coroutineScope {
                val detailDeferred = async { repo.detail(homeId) }
                val dashboardDeferred = async { intelligenceRepo.dashboard(homeId) }
                val accessDeferred = async { adminRepo.myAccess(homeId) }
                val detailResult = detailDeferred.await()
                val dashboardResult = dashboardDeferred.await()
                val accessResult = accessDeferred.await()
                dashboardData = if (dashboardResult is NetworkResult.Success) dashboardResult.data else null
                // The 403 body decodes into the same shape with
                // hasAccess=false; treat that as "unknown" so the surface
                // stays ungated.
                accessData =
                    (accessResult as? NetworkResult.Success)?.data?.takeIf { it.hasAccess }

                when (detailResult) {
                    is NetworkResult.Success -> {
                        detailData = detailResult.data.home
                        publicData = null
                        rebuild()
                    }
                    is NetworkResult.Failure ->
                        if (detailResult.error is NetworkError.Forbidden ||
                            detailResult.error is NetworkError.NotFound
                        ) {
                            fetchPublic()
                        } else {
                            detailData = null
                            publicData = null
                            _state.value =
                                HomeDashboardUiState.Error(
                                    detailResult.error.displayMessage("Couldn't load this home."),
                                )
                        }
                }
            }

        private suspend fun fetchPublic() {
            when (val result = repo.publicProfile(homeId)) {
                is NetworkResult.Success -> {
                    publicData = result.data.home
                    detailData = null
                    rebuild()
                }
                is NetworkResult.Failure -> {
                    detailData = null
                    publicData = null
                    _state.value =
                        HomeDashboardUiState.Error(
                            result.error.displayMessage("Couldn't load this home."),
                        )
                }
            }
        }

        // ── Home Intelligence reads ─────────────────────────────────

        /**
         * Mirrors RN's `useHomeIntelligence`, which always forces a server
         * recompute so a stale zero-score can't mask a populated home.
         */
        private suspend fun loadHealthScore() {
            _healthScore.value = intelligenceRepo.healthScore(homeId, force = true).toCardState()
            // The Overview's emergency row reads the health breakdown.
            rebuild()
        }

        private suspend fun loadChecklist() {
            _checklist.value = intelligenceRepo.seasonalChecklist(homeId).toCardState()
        }

        private suspend fun loadPropertyValue() {
            _propertyValue.value = intelligenceRepo.propertyValue(homeId).toCardState()
        }

        private suspend fun loadBillTrends() {
            _billTrends.value = intelligenceRepo.billTrends(homeId).toCardState()
        }

        private fun <T> NetworkResult<T>.toCardState(): HomeIntelligenceCardState<T> =
            when (this) {
                is NetworkResult.Success -> HomeIntelligenceCardState.Loaded(data)
                is NetworkResult.Failure ->
                    if (error is NetworkError.Forbidden) {
                        HomeIntelligenceCardState.Forbidden
                    } else {
                        HomeIntelligenceCardState.Failed(
                            error.displayMessage("Couldn't load this card."),
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

        private suspend fun updateChecklistItem(
            itemId: String,
            status: String,
        ) {
            if (_pendingChecklistItemIds.value.contains(itemId)) return
            _pendingChecklistItemIds.value = _pendingChecklistItemIds.value + itemId
            try {
                when (val result = intelligenceRepo.updateSeasonalChecklistItem(homeId, itemId, status)) {
                    is NetworkResult.Success -> {
                        // Reflect exactly what the server returned, then
                        // re-read the score (seasonal progress is one of
                        // its six dimensions).
                        applyChecklistItem(result.data)
                        loadHealthScore()
                    }
                    is NetworkResult.Failure ->
                        _checklist.value =
                            HomeIntelligenceCardState.Failed(
                                result.error.displayMessage("Couldn't update that task. Try again."),
                            )
                }
            } finally {
                _pendingChecklistItemIds.value = _pendingChecklistItemIds.value - itemId
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
            val detail = detailData
            val publicProfile = publicData
            when {
                detail != null ->
                    _state.value =
                        HomeDashboardUiState.Loaded(
                            content(
                                address = detail.address ?: detail.name ?: "Home",
                                // Header / summary: home has any verified owner.
                                verified = detail.isOwner || detail.owners.any { it.ownerStatus == "verified" },
                                // Banner gate: I'm the verified owner only when
                                // isOwner is true and no claim is still in flight.
                                isVerifiedOwner = detail.isOwner && !detail.isPendingOwner,
                                securityBanner =
                                    securityBanner(
                                        state = detail.securityState,
                                        claimWindowEndsAt = detail.claimWindowEndsAt,
                                    ),
                            ),
                        )
                publicProfile != null ->
                    _state.value =
                        HomeDashboardUiState.Loaded(
                            content(
                                address = publicProfile.address,
                                verified = publicProfile.hasVerifiedOwner,
                                // Public-profile path is hit when the user is NOT
                                // a verified owner; detail returned 403/404 first.
                                isVerifiedOwner = false,
                                // The public preview carries no security_state.
                                securityBanner = null,
                            ),
                        )
            }
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
                stats = HomeDashboardProjection.stats(counts),
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
