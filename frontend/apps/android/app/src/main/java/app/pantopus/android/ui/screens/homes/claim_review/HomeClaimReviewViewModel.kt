@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "MagicNumber",
)

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeClaimComparisonClaimDto
import app.pantopus.android.data.api.models.homes.HomeClaimComparisonDto
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimDto
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeClaimReviewRepository
import app.pantopus.android.ui.screens.homes.claim_evidence.HomePrivateEvidenceAccessFactory
import app.pantopus.android.ui.screens.homes.claim_evidence.HomePrivateEvidenceController
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlin.math.roundToInt

/** Nav arg key for the home id consumed via [SavedStateHandle]. */
const val HOME_CLAIM_REVIEW_HOME_ID_KEY = "homeId"

private const val MILLIS_PER_DAY = 86_400_000L
private const val MAX_INITIALS = 2

/** Which claim collection the screen is showing. */
enum class HomeClaimReviewTab { Ownership, Residency, Compare }

/** Tiny tone+text bundle the screen turns into a bottom-overlay toast. */
data class HomeClaimReviewToast(
    val text: String,
    val isError: Boolean,
)

/**
 * Which action row an ownership claim gets. Mirrors the RN branch at
 * `review-claim.tsx:258-315`.
 */
enum class HomeClaimReviewActionMode {
    /** Verified authority resolving a newcomer: invite / continue / flag. */
    Relationship,

    /** Claim already on the challenge path — owners can't decide it. */
    AdminReviewRequired,

    /** Plain approve / reject / flag verdict. */
    Verdict,
}

/** `action` values accepted by `reviewClaimSchema` (`homeOwnership.js:39`). */
enum class HomeClaimReviewVerdict(
    val wire: String,
    val title: String,
) {
    Approve("approve", "Approve"),
    Reject("reject", "Reject"),
    Flag("flag", "Flag as suspicious"),
    ;

    /** RN confirm body — `review-claim.tsx:65`. */
    val confirmBody: String get() = "Are you sure you want to $wire this claim?"

    /**
     * RN emits `Claim ${action}ed` verbatim, which renders "approveed".
     * Fixed here (and mirrored on iOS) rather than mirroring a typo.
     */
    val doneCopy: String
        get() =
            when (this) {
                Approve -> "Claim approved"
                Reject -> "Claim rejected"
                Flag -> "Claim flagged for review"
            }

    val isDestructive: Boolean get() = this != Approve
}

/**
 * `action` values accepted by `resolveRelationshipSchema`
 * (`homeOwnership.js:54`).
 */
enum class HomeClaimRelationshipAction(
    val wire: String,
) {
    InviteToHousehold("invite_to_household"),
    DeclineRelationship("decline_relationship"),
    FlagUnknownPerson("flag_unknown_person"),
    ;

    /** RN titles — `review-claim.tsx:94-98`. */
    fun title(isOwnerClaim: Boolean): String =
        when (this) {
            InviteToHousehold -> if (isOwnerClaim) "Invite As Owner" else "Invite To Household"
            DeclineRelationship -> "Let Review Continue"
            FlagUnknownPerson -> "Flag Unknown Person"
        }

    /** RN copy — `review-claim.tsx:99-105`. */
    fun body(isOwnerClaim: Boolean): String =
        when (this) {
            InviteToHousehold ->
                if (isOwnerClaim) {
                    "This sends a co-owner invitation. After identity confirmation, " +
                        "they become a verified owner of this home."
                } else {
                    "This sends the claimant a household invite so they can merge " +
                        "into the home after identity confirmation."
                }
            DeclineRelationship ->
                "This leaves the claim on its normal review path without changing its state."
            FlagUnknownPerson -> "This flags the claimant for admin review."
        }

    val isDestructive: Boolean get() = this == FlagUnknownPerson
}

/** One ownership claim row. */
data class HomeClaimReviewOwnershipItem(
    val id: String,
    val displayName: String,
    val initials: String,
    val subtitle: String?,
    val metaChips: List<String>,
    val accountAgeLabel: String?,
    val methodLabel: String?,
    val riskLabel: String?,
    val evidenceLabel: String?,
    val submittedLabel: String?,
    val isChallenged: Boolean,
    val claimType: String,
    val actionMode: HomeClaimReviewActionMode,
) {
    /** "Invite as owner" vs plain "Invite" — RN `review-claim.tsx:266`. */
    val inviteTitle: String get() = if (claimType == "owner") "Invite as owner" else "Invite"
}

/** One residency claim row. */
data class HomeClaimReviewResidencyItem(
    val id: String,
    val displayName: String,
    val initials: String,
    val roleLabel: String,
    val addressLabel: String?,
    val ageLabel: String?,
)

/** One column entry in the side-by-side compare view. */
data class HomeClaimReviewPartyCard(
    val id: String,
    val name: String,
    val initials: String,
    val lines: List<String>,
)

/** Side-by-side incumbent-vs-challenger payload. */
data class HomeClaimReviewComparison(
    val homeTitle: String,
    val resolutionLabel: String?,
    val hasVerifiedOwner: Boolean,
    val incumbents: List<HomeClaimReviewPartyCard>,
    val challengers: List<HomeClaimReviewPartyCard>,
)

/** Everything the loaded screen renders. */
data class HomeClaimReviewData(
    val ownership: List<HomeClaimReviewOwnershipItem>,
    val residency: List<HomeClaimReviewResidencyItem>,
    val comparison: HomeClaimReviewComparison?,
    val ownershipUnavailable: Boolean = false,
    val residencyUnavailable: Boolean = false,
)

/** Four-state rule: Loading / Empty / Loaded / Error. */
sealed interface HomeClaimReviewUiState {
    data object Loading : HomeClaimReviewUiState

    data object Empty : HomeClaimReviewUiState

    data class Loaded(
        val data: HomeClaimReviewData,
    ) : HomeClaimReviewUiState

    data class Error(
        val message: String,
    ) : HomeClaimReviewUiState
}

/**
 * H6 — Per-home **owner** claim review. NOT the platform-admin queue in
 * `ui/screens/review_claims/…` (that one reads `/api/admin/claims*`);
 * this screen is what a home owner sees when someone claims their
 * address.
 *
 * Mirrors iOS `HomeClaimReviewViewModel` field-for-field and RN
 * `src/app/homes/[id]/owners/review-claim.tsx`.
 */
@HiltViewModel
class HomeClaimReviewViewModel
    @Inject
    constructor(
        private val repo: HomeClaimReviewRepository,
        savedStateHandle: SavedStateHandle,
        scopeFactory: HomeClaimSessionScopeFactory,
        private val evidenceFactory: HomePrivateEvidenceAccessFactory,
    ) : ViewModel() {
        val homeId: String = savedStateHandle[HOME_CLAIM_REVIEW_HOME_ID_KEY] ?: ""

        private val _state = MutableStateFlow<HomeClaimReviewUiState>(HomeClaimReviewUiState.Loading)
        val state: StateFlow<HomeClaimReviewUiState> = _state.asStateFlow()

        /**
         * `"<claimId>:<action>"` while a mutation is in flight so the row
         * can swap its action row for a spinner (RN `actionLoading`).
         */
        private val _actionLoading = MutableStateFlow<String?>(null)
        val actionLoading: StateFlow<String?> = _actionLoading.asStateFlow()

        private val _toast = MutableStateFlow<HomeClaimReviewToast?>(null)
        val toast: StateFlow<HomeClaimReviewToast?> = _toast.asStateFlow()

        private val _selectedTab = MutableStateFlow(HomeClaimReviewTab.Ownership)
        val selectedTab: StateFlow<HomeClaimReviewTab> = _selectedTab.asStateFlow()

        private var loadedOnce = false
        private val session = scopeFactory.create(viewModelScope)
        private var readGeneration = 0
        private var prepared: HomeClaimReviewSnapshot? = null
        private var pendingDecision: Pair<HomeClaimReviewSnapshot, HomeClaimReviewVerdict>? = null
        private val _evidencePanel = MutableStateFlow<HomePrivateEvidenceController?>(null)
        val evidencePanel = _evidencePanel.asStateFlow()

        fun openEvidence(claimId: String) {
            if (!session.isCurrent || _actionLoading.value != null) return
            if (pendingDecision != null || _evidencePanel.value != null) return
            val current = (_state.value as? HomeClaimReviewUiState.Loaded)?.data ?: return
            if (current.ownership.none { it.id == claimId }) return
            _actionLoading.value = "$claimId:evidence"
            viewModelScope.launch {
                try {
                    session.requireCurrent()
                    val response = repo.ownershipClaimDetail(homeId, claimId)
                    session.requireCurrent()
                    val claim =
                        when (response) {
                            is NetworkResult.Success -> response.data.claim
                            is NetworkResult.Failure -> throw response.error
                        }
                    val snapshot = snapshotFor(claim, claimId)
                    prepared = null
                    _evidencePanel.value =
                        HomePrivateEvidenceController(
                            viewModelScope,
                            evidenceFactory.create(session, homeId, claimId), false, snapshot.reviewToken,
                        )
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: NetworkError) {
                    _toast.value = HomeClaimReviewToast(error.message, true)
                } catch (error: IllegalStateException) {
                    _toast.value = HomeClaimReviewToast(error.message ?: CLAIM_SNAPSHOT_CHANGED, true)
                } finally {
                    _actionLoading.value = null
                }
            }
        }

        fun closeEvidence() {
            _evidencePanel.value?.close()
            _evidencePanel.value = null
            refresh()
        }

        init {
            viewModelScope.launch {
                session.invalidated.collect { if (it) _state.value = HomeClaimReviewUiState.Error(CLAIM_SESSION_CHANGED) }
            }
        }

        /** Idempotent — re-running won't refetch once content is loaded. */
        fun load() {
            if (loadedOnce || _actionLoading.value != null) return
            reload()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() {
            if (_actionLoading.value == null) reload()
        }

        fun selectTab(tab: HomeClaimReviewTab) {
            _selectedTab.value = tab
        }

        fun clearToast() {
            _toast.value = null
        }

        // region Mutations

        /** `POST /api/homes/:id/ownership-claims/:claimId/review`. */
        suspend fun prepareReview(
            claimId: String,
            verdict: HomeClaimReviewVerdict,
        ): HomeClaimReviewSnapshot? {
            if (_actionLoading.value != null || _evidencePanel.value != null) return null
            return try {
                session.requireCurrent()
                pendingDecision?.let { pending ->
                    check(pending.first.claimId == claimId && pending.second == verdict) { CLAIM_PENDING_DECISION }
                    prepared = pending.first
                    return pending.first
                }
                val revision = ++readGeneration
                prepared = null
                _actionLoading.value = "$claimId:prepare"
                val result = repo.ownershipClaimDetail(homeId, claimId)
                session.requireCurrent()
                check(revision == readGeneration) { CLAIM_SNAPSHOT_CHANGED }
                val claim =
                    when (result) {
                        is NetworkResult.Success -> result.data.claim
                        is NetworkResult.Failure -> throw result.error
                    }
                snapshotFor(claim, claimId).also { prepared = it }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: NetworkError) {
                _toast.value = HomeClaimReviewToast(error.message, isError = true)
                null
            } catch (error: IllegalStateException) {
                _toast.value = HomeClaimReviewToast(error.message ?: CLAIM_SNAPSHOT_CHANGED, isError = true)
                null
            } catch (error: IllegalArgumentException) {
                _toast.value = HomeClaimReviewToast(error.message ?: CLAIM_SNAPSHOT_CHANGED, isError = true)
                null
            } finally {
                _actionLoading.value = null
            }
        }

        fun review(
            snapshot: HomeClaimReviewSnapshot,
            verdict: HomeClaimReviewVerdict,
        ) {
            if (_actionLoading.value != null || _evidencePanel.value != null) return
            _actionLoading.value = "${snapshot.claimId}:${verdict.wire}"
            viewModelScope.launch {
                try {
                    session.requireCurrent()
                    check(prepared == snapshot && snapshot.homeId == homeId) { CLAIM_SNAPSHOT_CHANGED }
                    pendingDecision?.let { check(it.first == snapshot && it.second == verdict) { CLAIM_PENDING_DECISION } }
                    pendingDecision = snapshot to verdict
                    val result = repo.reviewOwnershipClaim(homeId, snapshot.claimId, verdict.wire, snapshot.reviewToken)
                    session.requireCurrent()
                    val receipt =
                        when (result) {
                            is NetworkResult.Success -> result.data
                            is NetworkResult.Failure -> throw result.error
                        }
                    check(
                        receipt.matches(homeId, snapshot.claimId, snapshot.claimantId, verdict.wire),
                    ) { "Could not confirm the claim result. Please retry." }
                    prepared = null
                    pendingDecision = null
                    _toast.value = HomeClaimReviewToast(verdict.doneCopy, isError = false)
                    fetch()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: NetworkError) {
                    reviewFailed(error)
                } catch (error: IllegalStateException) {
                    reviewFailed(error)
                } catch (error: IllegalArgumentException) {
                    reviewFailed(error)
                } finally {
                    _actionLoading.value = null
                }
            }
        }

        private fun snapshotFor(
            claim: HomeOwnershipClaimDto,
            claimId: String,
        ): HomeClaimReviewSnapshot {
            check(claim.id == claimId && claim.homeId == homeId && !claim.claimantUserId.isNullOrBlank()) { CLAIM_SNAPSHOT_CHANGED }
            check(HomeClaimReviewSnapshot.validToken(claim.reviewToken) && claim.state in PENDING_LEGACY_STATES) { CLAIM_SNAPSHOT_CHANGED }
            check(
                claim.claimPhaseV2 != "challenged" && claim.challengeState != "challenged" &&
                    claim.routingClassification != "challenge_claim",
            ) { CLAIM_DISPUTE_REVIEW }
            return HomeClaimReviewSnapshot(
                homeId,
                claimId,
                requireNotNull(claim.claimantUserId),
                requireNotNull(claim.reviewToken),
                claim.claimType ?: "Claim",
                claim.evidence.orEmpty().count { it.eligibleForReview == true },
                claim.evidence.orEmpty().size,
            )
        }

        private fun reviewFailed(error: Throwable) {
            if (error.isFinalHomeClaimFailure() || !session.isCurrent) {
                prepared = null
                pendingDecision = null
            }
            _toast.value = HomeClaimReviewToast(error.message ?: "Could not confirm the claim result. Please retry.", isError = true)
        }

        /**
         * `POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship`.
         */
        fun resolveRelationship(
            claimId: String,
            action: HomeClaimRelationshipAction,
        ) {
            if (_actionLoading.value != null || !session.isCurrent) return
            _actionLoading.value = "$claimId:${action.wire}"
            viewModelScope.launch {
                if (!session.confirmCurrent()) {
                    _actionLoading.value = null
                    return@launch
                }
                val result = repo.resolveOwnershipClaimRelationship(homeId, claimId, action.wire)
                if (!session.confirmCurrent()) {
                    _actionLoading.value = null
                    return@launch
                }
                when (result) {
                    is NetworkResult.Success -> {
                        _toast.value =
                            HomeClaimReviewToast(
                                if (action == HomeClaimRelationshipAction.InviteToHousehold) {
                                    "Invitation created."
                                } else {
                                    "Claim updated."
                                },
                                isError = false,
                            )
                        fetch()
                    }
                    is NetworkResult.Failure ->
                        _toast.value =
                            HomeClaimReviewToast(
                                result.error.displayMessage(
                                    "Failed to update claimant relationship",
                                ),
                                isError = true,
                            )
                }
                _actionLoading.value = null
            }
        }

        /** `POST /api/homes/:id/claim/:claimId/approve|reject`. */
        fun reviewResidency(
            claimId: String,
            approve: Boolean,
        ) {
            if (_actionLoading.value != null || !session.isCurrent) return
            _actionLoading.value = claimId
            viewModelScope.launch {
                if (!session.confirmCurrent()) {
                    _actionLoading.value = null
                    return@launch
                }
                val result =
                    if (approve) {
                        repo.approveResidencyClaim(homeId, claimId)
                    } else {
                        repo.rejectResidencyClaim(homeId, claimId)
                    }
                if (!session.confirmCurrent()) {
                    _actionLoading.value = null
                    return@launch
                }
                when (result) {
                    is NetworkResult.Success -> {
                        _toast.value =
                            HomeClaimReviewToast(
                                if (approve) "Claim approved" else "Claim rejected",
                                isError = false,
                            )
                        fetch()
                    }
                    is NetworkResult.Failure ->
                        _toast.value =
                            HomeClaimReviewToast(
                                result.error.displayMessage(
                                    if (approve) {
                                        "Failed to approve claim"
                                    } else {
                                        "Failed to reject claim"
                                    },
                                ),
                                isError = true,
                            )
                }
                _actionLoading.value = null
            }
        }

        // endregion

        private fun reload() {
            if (!session.isCurrent) {
                _state.value = HomeClaimReviewUiState.Error(CLAIM_SESSION_CHANGED)
                return
            }
            _state.value = HomeClaimReviewUiState.Loading
            viewModelScope.launch { fetch() }
        }

        /**
         * Three independent reads, each tolerated on its own — the
         * ownership list is gated on `ownership.manage`, the residency
         * list on `members.manage`, and `compare` additionally sits behind
         * a server feature flag. RN uses `Promise.allSettled` for the same
         * reason (`review-claim.tsx:34`). Only a total wipe-out surfaces
         * the error state.
         */
        private suspend fun fetch() {
            if (!session.confirmCurrent()) {
                _state.value = HomeClaimReviewUiState.Error(CLAIM_SESSION_CHANGED)
                return
            }
            val revision = ++readGeneration
            _state.value = HomeClaimReviewUiState.Loading
            val results =
                coroutineScope {
                    val ownershipDeferred = async { repo.ownershipClaims(homeId) }
                    val residencyDeferred = async { repo.residencyClaims(homeId) }
                    val comparisonDeferred = async { repo.ownershipClaimComparison(homeId) }
                    Triple(
                        ownershipDeferred.await(),
                        residencyDeferred.await(),
                        comparisonDeferred.await(),
                    )
                }
            if (revision != readGeneration || !session.confirmCurrent()) return
            prepared = null
            pendingDecision = null
            val ownershipResult = results.first
            val residencyResult = results.second
            val comparisonResult = results.third

            val ownershipClaims =
                (ownershipResult as? NetworkResult.Success)?.data?.claims
            val residencyClaims =
                (residencyResult as? NetworkResult.Success)?.data?.claims
            val comparisonDto = (comparisonResult as? NetworkResult.Success)?.data

            if (ownershipClaims == null && residencyClaims == null && comparisonDto == null) {
                _state.value =
                    HomeClaimReviewUiState.Error("We couldn't load the claims on this home.")
                return
            }
            loadedOnce = true

            val ownership = ownershipItems(comparisonDto, ownershipClaims.orEmpty())
            val residency = residencyItems(residencyClaims.orEmpty())
            val comparisonModel = comparisonDto?.let { comparison(it) }

            val ownershipUnavailable = ownershipClaims == null && comparisonDto == null
            val residencyUnavailable = residencyClaims == null
            val bothCollectionsAvailable = !ownershipUnavailable && !residencyUnavailable
            val noClaims = ownership.isEmpty() && residency.isEmpty() && comparisonModel == null
            if (bothCollectionsAvailable && noClaims) {
                _selectedTab.value = HomeClaimReviewTab.Ownership
                _state.value = HomeClaimReviewUiState.Empty
                return
            }
            if (comparisonModel == null && _selectedTab.value == HomeClaimReviewTab.Compare) {
                _selectedTab.value = HomeClaimReviewTab.Ownership
            }
            _state.value =
                HomeClaimReviewUiState.Loaded(
                    HomeClaimReviewData(
                        ownership = ownership,
                        residency = residency,
                        comparison = comparisonModel,
                        ownershipUnavailable = ownershipUnavailable,
                        residencyUnavailable = residencyUnavailable,
                    ),
                )
        }

        companion object {
            /**
             * Reviewable legacy states for the non-comparison fallback list
             * — mirrors RN `review-claim.tsx:175-177` and the backend's
             * `reviewableStates` guard (`homeOwnership.js:692`).
             */
            val PENDING_LEGACY_STATES =
                setOf(
                    "submitted",
                    "pending_review",
                    "pending_challenge_window",
                    "needs_more_info",
                )

            /** Comparison phases the owner still has a say in. */
            val PENDING_PHASES =
                setOf("initiated", "evidence_submitted", "under_review", "challenged")

            /** Phases where a verified incumbent can resolve instead of decide. */
            val RELATIONSHIP_PHASES = setOf("initiated", "evidence_submitted", "under_review")

            /**
             * Prefer the comparison payload (hydrated claimants + phase-v2
             * routing); fall back to the masked list. RN does the same at
             * `review-claim.tsx:171-177`.
             */
            fun ownershipItems(
                comparison: HomeClaimComparisonDto?,
                fallback: List<HomeOwnershipClaimDto>,
            ): List<HomeClaimReviewOwnershipItem> {
                if (comparison != null && comparison.claims.isNotEmpty()) {
                    val hasVerifiedOwner = comparison.incumbent?.hasVerifiedOwner ?: false
                    return comparison.claims
                        .filter { PENDING_PHASES.contains(it.claimPhaseV2.orEmpty()) }
                        .map { item(it, hasVerifiedOwner) }
                }
                return fallback
                    .filter { PENDING_LEGACY_STATES.contains(it.state) }
                    .map { item(it) }
            }

            private fun item(
                claim: HomeClaimComparisonClaimDto,
                hasVerifiedOwner: Boolean,
            ): HomeClaimReviewOwnershipItem {
                val phase = claim.claimPhaseV2.orEmpty()
                val claimType = claim.claimType ?: "owner"
                val isChallenged = phase == "challenged"
                val mode =
                    when {
                        hasVerifiedOwner && RELATIONSHIP_PHASES.contains(phase) ->
                            HomeClaimReviewActionMode.Relationship
                        isChallenged -> HomeClaimReviewActionMode.AdminReviewRequired
                        else -> HomeClaimReviewActionMode.Verdict
                    }
                val name = displayName(claim.claimant?.name, claim.claimant?.username)
                val chips = mutableListOf<String>()
                chips += if (claimType == "owner") "Owner claim" else humanise(claimType)
                claim.claimStrength?.takeIf { it.isNotEmpty() }?.let {
                    chips += "Strength: ${humanise(it)}"
                }
                claim.routingClassification?.takeIf { it.isNotEmpty() }?.let {
                    chips += "Route: ${humanise(it)}"
                }
                return HomeClaimReviewOwnershipItem(
                    id = claim.id,
                    displayName = name,
                    initials = initials(name),
                    subtitle = claim.claimant?.email?.takeIf { it.isNotEmpty() },
                    metaChips = chips,
                    accountAgeLabel = accountAgeLabel(claim.claimant?.createdAt),
                    methodLabel = claim.method?.let { methodLabel(it) },
                    riskLabel = riskLabel(claim.riskScore),
                    evidenceLabel = evidenceLabel(claim.evidence?.size ?: 0),
                    submittedLabel = submittedLabel(claim.createdAt),
                    isChallenged = isChallenged,
                    claimType = claimType,
                    actionMode = mode,
                )
            }

            private fun item(claim: HomeOwnershipClaimDto): HomeClaimReviewOwnershipItem {
                val claimType = claim.claimType ?: "owner"
                // The list endpoint masks the claimant outright
                // (`homeOwnership.js:513`), so there is no name to render.
                val name = "Masked claimant"
                val chips = mutableListOf<String>()
                chips += if (claimType == "owner") "Owner claim" else humanise(claimType)
                chips += "Status: ${humanise(claim.state)}"
                return HomeClaimReviewOwnershipItem(
                    id = claim.id,
                    displayName = name,
                    initials = "?",
                    subtitle = null,
                    metaChips = chips,
                    accountAgeLabel = claim.claimant?.accountAgeDays?.let { "Account ${it}d old" },
                    methodLabel = (claim.claimant?.method ?: claim.method)?.let { methodLabel(it) },
                    riskLabel = riskLabel(claim.claimant?.riskScore ?: claim.riskScore),
                    evidenceLabel = evidenceLabel(claim.evidence?.size ?: 0),
                    submittedLabel = submittedLabel(claim.createdAt),
                    isChallenged = false,
                    claimType = claimType,
                    actionMode = HomeClaimReviewActionMode.Verdict,
                )
            }

            fun residencyItems(claims: List<HomeResidencyClaimDto>): List<HomeClaimReviewResidencyItem> =
                claims
                    .filter { it.status == "pending" }
                    .map { claim ->
                        val name =
                            displayName(
                                claim.claimant?.name,
                                claim.claimant?.username,
                                fallback = "User",
                            )
                        HomeClaimReviewResidencyItem(
                            id = claim.id,
                            displayName = name,
                            initials = initials(name),
                            roleLabel = "Requesting: ${roleLabel(claim.claimedRole)}",
                            addressLabel = claim.claimedAddress?.takeIf { it.isNotEmpty() },
                            ageLabel = dayAgeLabel(claim.createdAt),
                        )
                    }

            fun comparison(dto: HomeClaimComparisonDto): HomeClaimReviewComparison {
                val incumbents =
                    dto.incumbent?.owners.orEmpty().map { owner ->
                        val name =
                            displayName(
                                owner.user?.name,
                                owner.user?.username,
                                fallback = "Owner",
                            )
                        val lines = mutableListOf<String>()
                        if (owner.isPrimaryOwner == true) lines += "Primary owner"
                        owner.verificationTier?.takeIf { it.isNotEmpty() }?.let {
                            lines += "Tier: ${humanise(it)}"
                        }
                        owner.addedVia?.takeIf { it.isNotEmpty() }?.let {
                            lines += "Added via ${humanise(it)}"
                        }
                        shortDate(owner.createdAt)?.let { lines += "Owner since $it" }
                        HomeClaimReviewPartyCard(
                            id = owner.id,
                            name = name,
                            initials = initials(name),
                            lines = lines,
                        )
                    }
                val challengers =
                    dto.claims.map { claim ->
                        val name = displayName(claim.claimant?.name, claim.claimant?.username)
                        val lines = mutableListOf<String>()
                        claim.claimPhaseV2?.takeIf { it.isNotEmpty() }?.let { lines += humanise(it) }
                        claim.claimStrength?.takeIf { it.isNotEmpty() }?.let {
                            lines += "Strength: ${humanise(it)}"
                        }
                        val evidenceCount = claim.evidence?.size ?: 0
                        lines +=
                            if (evidenceCount == 1) {
                                "1 evidence file"
                            } else {
                                "$evidenceCount evidence files"
                            }
                        submittedLabel(claim.createdAt)?.let { lines += it }
                        HomeClaimReviewPartyCard(
                            id = claim.id,
                            name = name,
                            initials = initials(name),
                            lines = lines,
                        )
                    }
                val homeTitle =
                    dto.home?.name?.takeIf { it.isNotEmpty() }
                        ?: dto.home?.address?.takeIf { it.isNotEmpty() }
                        ?: "This home"
                val resolutionRaw =
                    (dto.householdResolutionState ?: dto.home?.householdResolutionState)
                        ?.takeIf { it.isNotEmpty() }
                return HomeClaimReviewComparison(
                    homeTitle = homeTitle,
                    resolutionLabel = resolutionRaw?.let { humanise(it) },
                    hasVerifiedOwner = dto.incumbent?.hasVerifiedOwner ?: false,
                    incumbents = incumbents,
                    challengers = challengers,
                )
            }

            fun displayName(
                name: String?,
                username: String?,
                fallback: String = "Claimant",
            ): String {
                name?.takeIf { it.isNotEmpty() }?.let { return it }
                username?.takeIf { it.isNotEmpty() }?.let { return "@$it" }
                return fallback
            }

            fun initials(name: String): String {
                val cleaned = name.removePrefix("@")
                val parts =
                    cleaned
                        .split(" ")
                        .mapNotNull { it.firstOrNull()?.toString() }
                if (parts.isEmpty()) return "?"
                return parts.take(MAX_INITIALS).joinToString("").uppercase(Locale.US)
            }

            /** `owner_claim` → `owner claim`. */
            fun humanise(raw: String): String = raw.replace("_", " ")

            fun roleLabel(raw: String?): String =
                when (raw) {
                    "owner" -> "Owner"
                    "renter" -> "Renter"
                    "household" -> "Household"
                    "property_manager" -> "Property Mgr"
                    "guest" -> "Guest"
                    "member" -> "Member"
                    else -> "Member"
                }

            fun methodLabel(raw: String): String? =
                when (raw) {
                    "postcard" -> "Postcard"
                    "doc_upload" -> "Document upload"
                    "fast_track" -> "Fast-track invite"
                    "id_verification" -> "ID verification"
                    else -> raw.takeIf { it.isNotEmpty() }?.let { humanise(it).replaceFirstChar(Char::uppercase) }
                }

            fun riskLabel(score: Double?): String? = score?.let { "Risk ${it.roundToInt()}" }

            fun evidenceLabel(count: Int): String? =
                when {
                    count <= 0 -> null
                    count == 1 -> "1 file"
                    else -> "$count files"
                }

            fun accountAgeLabel(iso: String?): String? = dayDelta(iso)?.let { "Account ${it}d old" }

            fun dayAgeLabel(iso: String?): String? = dayDelta(iso)?.let { "${it}d ago" }

            fun submittedLabel(iso: String?): String? =
                dayDelta(iso)?.let { days ->
                    when (days) {
                        0L -> "Submitted today"
                        1L -> "Submitted 1d ago"
                        else -> "Submitted ${days}d ago"
                    }
                }

            fun shortDate(iso: String?): String? {
                val instant = parseInstant(iso) ?: return null
                return DateTimeFormatter
                    .ofPattern("MMM yyyy", Locale.US)
                    .withZone(ZoneId.systemDefault())
                    .format(instant)
            }

            private fun dayDelta(iso: String?): Long? {
                val instant = parseInstant(iso) ?: return null
                val delta = (System.currentTimeMillis() - instant.toEpochMilli()) / MILLIS_PER_DAY
                return if (delta < 0) 0 else delta
            }

            private fun parseInstant(iso: String?): Instant? {
                if (iso.isNullOrEmpty()) return null
                return runCatching { Instant.parse(iso) }.getOrNull()
            }
        }
    }
