@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "PackageNaming",
    "TooManyFunctions",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.review_claims

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.admin.AdminRepository
import app.pantopus.android.data.api.models.admin.AdminClaimBucket
import app.pantopus.android.data.api.models.admin.AdminClaimCountsResponse
import app.pantopus.android.data.api.models.admin.AdminClaimDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerConfig
import app.pantopus.android.ui.screens.shared.list_of_rows.BannerCtaTint
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
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
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Stable tab ids — match the backend's `bucket` enum. */
object ReviewClaimsTab {
    val PENDING: String = AdminClaimBucket.Pending.backendValue
    val APPROVED: String = AdminClaimBucket.Approved.backendValue
    val REJECTED: String = AdminClaimBucket.Rejected.backendValue
}

/**
 * Drives the P1.1 admin Review-claims queue — three tabs (Pending /
 * Approved / Rejected) on top of the shared `ListOfRows` shell. Pending
 * tab carries a warning-tinted banner summarising queue depth + age of
 * the oldest claim. Mirrors iOS `ReviewClaimsViewModel` exactly: same
 * per-bucket row cache, four list states, chip + footer projection.
 */
@HiltViewModel
class ReviewClaimsViewModel
    @Inject
    constructor(
        private val repo: AdminRepository,
    ) : ViewModel() {
        private val rowsCache: MutableMap<AdminClaimBucket, List<AdminClaimDto>> = mutableMapOf()
        private var oldestAgeSeconds: Int? = null

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _selectedTab = MutableStateFlow(ReviewClaimsTab.PENDING)
        val selectedTab: StateFlow<String> = _selectedTab.asStateFlow()

        private val _counts = MutableStateFlow<AdminClaimCountsResponse?>(null)
        val counts: StateFlow<AdminClaimCountsResponse?> = _counts.asStateFlow()

        private val _banner = MutableStateFlow<BannerConfig?>(null)
        val banner: StateFlow<BannerConfig?> = _banner.asStateFlow()

        private val _tabs = MutableStateFlow(buildTabs(null))
        val tabs: StateFlow<List<ListOfRowsTab>> = _tabs.asStateFlow()

        /** Set by the screen; invoked when a row / footer button is tapped. */
        var onOpenClaim: (String) -> Unit = {}
            set(value) {
                field = value
                // Re-project so the new callback is wired into every row's
                // onTap / footer handler.
                rebuild()
            }

        private val bucket: AdminClaimBucket
            get() = AdminClaimBucket.fromBackend(_selectedTab.value)

        /** Always (re)fetch on appear — claim state changes server-side. */
        fun load() {
            if (rowsCache[bucket] == null) {
                _state.value = ListOfRowsUiState.Loading
            }
            viewModelScope.launch { fetchCounts() }
            viewModelScope.launch { fetchClaims(bucket) }
        }

        fun refresh() {
            viewModelScope.launch { fetchCounts() }
            viewModelScope.launch { fetchClaims(bucket) }
        }

        fun selectTab(id: String) {
            if (_selectedTab.value == id) return
            _selectedTab.value = id
            // Re-render immediately with the cached state, then refetch in
            // the background so transitions feel snappy.
            rebuild()
            viewModelScope.launch { fetchClaims(bucket) }
        }

        // MARK: - Fetching

        private suspend fun fetchCounts() {
            when (val result = repo.claimCounts()) {
                is NetworkResult.Success -> {
                    _counts.value = result.data
                    _tabs.value = buildTabs(result.data)
                    recomputeBanner()
                }
                is NetworkResult.Failure -> Unit // Counts are decorative; ignore.
            }
        }

        private suspend fun fetchClaims(target: AdminClaimBucket) {
            when (val result = repo.claims(target)) {
                is NetworkResult.Success -> {
                    rowsCache[target] = result.data.claims
                    if (target == AdminClaimBucket.Pending) {
                        oldestAgeSeconds = result.data.oldestAgeSeconds
                    }
                    // Only rerender if the bucket is still selected — a
                    // fast tab swap shouldn't blow the user's current tab
                    // away with a late background response.
                    if (target == bucket) rebuild()
                }
                is NetworkResult.Failure -> {
                    if (target == bucket) {
                        _state.value = ListOfRowsUiState.Error("Couldn't load claims. Try again.")
                        _banner.value = null
                    }
                }
            }
        }

        // MARK: - Projection

        private fun rebuild() {
            val cached = rowsCache[bucket]
            if (cached == null) {
                _state.value = ListOfRowsUiState.Loading
                recomputeBanner()
                return
            }
            if (cached.isEmpty()) {
                _state.value = emptyState(bucket)
                recomputeBanner()
                return
            }
            val rows = cached.map { rowFor(it, bucket) }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "claims", rows = rows)),
                    hasMore = false,
                )
            recomputeBanner()
        }

        private fun recomputeBanner() {
            // Only Pending tab + non-empty cache shows the triage banner.
            val cached = rowsCache[AdminClaimBucket.Pending] ?: emptyList()
            if (bucket != AdminClaimBucket.Pending || cached.isEmpty()) {
                _banner.value = null
                return
            }
            val pending = _counts.value?.pending ?: cached.size
            val title = "$pending ${if (pending == 1) "claim" else "claims"} awaiting review"
            _banner.value =
                BannerConfig(
                    icon = PantopusIcon.Gavel,
                    title = title,
                    subtitle = "Oldest in queue: ${AdminClaimTimeFormat.oldestAge(oldestAgeSeconds)}",
                    tint = BannerCtaTint.Warning,
                )
        }

        private fun rowFor(
            claim: AdminClaimDto,
            forBucket: AdminClaimBucket,
        ): RowModel {
            val chip = AdminClaimChip.descriptor(claim, forBucket)
            val claimantName =
                claim.claimant?.name
                    ?: claim.claimant?.username
                    ?: "Unknown claimant"
            val address = AdminClaimAddressFormat.full(claim.home)
            val evidenceText = "${claim.evidenceCount} doc${if (claim.evidenceCount == 1) "" else "s"}"
            val openCallback = onOpenClaim
            val id = claim.id
            val gradientSeed = claim.claimantUserId.ifEmpty { claim.id }

            val footer =
                RowFooter(
                    actions =
                        listOf(
                            RowFooterAction(
                                title = "Review claim",
                                icon = PantopusIcon.ArrowRight,
                                variant = CompactButtonVariant.Primary,
                            ) { openCallback(id) },
                        ),
                )

            return RowModel(
                id = claim.id,
                title = claimantName,
                subtitle = address,
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.AvatarWithBadge(
                        name = claimantName,
                        imageUrl = claim.claimant?.profilePictureUrl,
                        background = AvatarBackground.Gradient(AdminClaimAvatarGradient.gradient(gradientSeed)),
                        size = AvatarBadgeSize.Medium,
                        verified = false,
                    ),
                trailing = RowTrailing.None,
                onTap = { openCallback(id) },
                chips =
                    listOf(
                        RowChip(text = chip.text, icon = chip.icon, tint = RowChip.Tint.Status(chip.variant)),
                        RowChip(
                            text = evidenceText,
                            icon = PantopusIcon.Paperclip,
                            tint = RowChip.Tint.Status(StatusChipVariant.Neutral),
                        ),
                    ),
                timeMeta = AdminClaimTimeFormat.submittedAgo(claim.createdAt),
                highlight = if (forBucket == AdminClaimBucket.Rejected) RowHighlight.Muted else null,
                footer = footer,
            )
        }

        private fun emptyState(forBucket: AdminClaimBucket): ListOfRowsUiState.Empty =
            when (forBucket) {
                AdminClaimBucket.Pending ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCheck,
                        headline = "No claims to review",
                        subcopy =
                            "You're all caught up. New ownership claims will appear here when " +
                                "neighbors submit address verification.",
                        ctaTitle = "View approved",
                        onCta = { selectTab(ReviewClaimsTab.APPROVED) },
                    )
                AdminClaimBucket.Approved ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CheckCircle,
                        headline = "No approved claims yet",
                        subcopy =
                            "Approved ownership claims will appear here once the team works " +
                                "through the queue.",
                        ctaTitle = null,
                        onCta = null,
                    )
                AdminClaimBucket.Rejected ->
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.CircleSlash,
                        headline = "No rejected claims",
                        subcopy =
                            "Rejected claims will appear here. Rejecting a claim notifies the " +
                                "claimant.",
                        ctaTitle = null,
                        onCta = null,
                    )
            }

        private fun buildTabs(counts: AdminClaimCountsResponse?): List<ListOfRowsTab> =
            listOf(
                ListOfRowsTab(id = ReviewClaimsTab.PENDING, label = "Pending", count = counts?.pending),
                ListOfRowsTab(id = ReviewClaimsTab.APPROVED, label = "Approved", count = counts?.approved),
                ListOfRowsTab(id = ReviewClaimsTab.REJECTED, label = "Rejected", count = counts?.rejected),
            )
    }
