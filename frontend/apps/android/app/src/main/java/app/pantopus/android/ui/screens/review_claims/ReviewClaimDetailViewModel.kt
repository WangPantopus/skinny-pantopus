@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.review_claims

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.admin.AdminRepository
import app.pantopus.android.data.api.models.admin.AdminClaimDetailResponse
import app.pantopus.android.data.api.models.admin.AdminClaimRecordDto
import app.pantopus.android.data.api.models.admin.AdminClaimReviewAction
import app.pantopus.android.data.api.models.admin.AdminClaimReviewRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.ui.screens.homes.claim_evidence.HomePrivateEvidenceAccessFactory
import app.pantopus.android.ui.screens.homes.claim_evidence.HomePrivateEvidenceController
import app.pantopus.android.ui.screens.homes.claim_review.CLAIM_DISPUTE_REVIEW
import app.pantopus.android.ui.screens.homes.claim_review.CLAIM_PENDING_DECISION
import app.pantopus.android.ui.screens.homes.claim_review.CLAIM_SESSION_CHANGED
import app.pantopus.android.ui.screens.homes.claim_review.CLAIM_SNAPSHOT_CHANGED
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimReviewSnapshot
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.homes.claim_review.isFinalHomeClaimFailure
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Tiny tone+text bundle the screen turns into a bottom-overlay toast. */
data class ReviewClaimToast(
    val text: String,
    val isError: Boolean,
)

/**
 * One pickable reason inside the Challenge composer. Labels are
 * word-for-word with the A13.3 design + the iOS mirror (`ChallengeReason`
 * in `ReviewClaimDetailViewModel.swift`).
 */
enum class ChallengeReason(val label: String) {
    IdentityUnclear("Identity unclear"),
    DocumentsAltered("Documents look altered"),
    ShareDisputed("Ownership share disputed"),
    DontRecognize("Don't recognize claimant"),
    Other("Other"),
}

/** Lifecycle state for the claim detail screen. */
sealed interface ReviewClaimDetailUiState {
    data object Loading : ReviewClaimDetailUiState

    data class Loaded(
        val detail: AdminClaimDetailResponse,
    ) : ReviewClaimDetailUiState

    data class Error(
        val message: String,
    ) : ReviewClaimDetailUiState
}

/**
 * P1.1 — Admin claim-detail view-model. Reads `claimId` from
 * [SavedStateHandle], loads the full claim payload (claimant + home +
 * evidence) and exposes [review] for the Accept / Challenge / Reject
 * actions. `Challenge` keeps the legacy backend wire value.
 */
@HiltViewModel
class ReviewClaimDetailViewModel
    @Inject
    constructor(
        private val repo: AdminRepository,
        savedStateHandle: SavedStateHandle,
        scopeFactory: HomeClaimSessionScopeFactory,
        private val evidenceFactory: HomePrivateEvidenceAccessFactory,
    ) : ViewModel() {
        private val claimId: String =
            savedStateHandle.get<String>(CLAIM_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<ReviewClaimDetailUiState>(ReviewClaimDetailUiState.Loading)
        val state: StateFlow<ReviewClaimDetailUiState> = _state.asStateFlow()

        private val _reviewingAction = MutableStateFlow<AdminClaimReviewAction?>(null)
        val reviewingAction: StateFlow<AdminClaimReviewAction?> = _reviewingAction.asStateFlow()

        private val _toast = MutableStateFlow<ReviewClaimToast?>(null)
        val toast: StateFlow<ReviewClaimToast?> = _toast.asStateFlow()

        // Challenge composer state -------------------------------------------
        private val _selectedReasons = MutableStateFlow<Set<ChallengeReason>>(emptySet())
        val selectedReasons: StateFlow<Set<ChallengeReason>> = _selectedReasons.asStateFlow()

        private val _challengeQuestion = MutableStateFlow("")
        val challengeQuestion: StateFlow<String> = _challengeQuestion.asStateFlow()

        private var loadedOnce: Boolean = false
        private val session = scopeFactory.create(viewModelScope)
        private var loadGeneration = 0
        private val _evidencePanel = MutableStateFlow<HomePrivateEvidenceController?>(null)
        val evidencePanel = _evidencePanel.asStateFlow()

        fun openEvidence() {
            if (!session.isCurrent || _reviewingAction.value != null) return
            if (pendingDecision != null || _evidencePanel.value != null) return
            val detail = (_state.value as? ReviewClaimDetailUiState.Loaded)?.detail ?: return
            if (detail.claim.id != claimId || !HomeClaimReviewSnapshot.validToken(detail.claim.reviewToken)) return
            _evidencePanel.value =
                HomePrivateEvidenceController(
                    viewModelScope,
                    evidenceFactory.create(session, detail.claim.homeId, claimId, true), false, detail.claim.reviewToken,
                )
        }

        fun closeEvidence() {
            _evidencePanel.value?.close()
            _evidencePanel.value = null
            load()
        }

        private data class PendingDecision(val claim: AdminClaimRecordDto, val action: AdminClaimReviewAction, val note: String?)

        private var pendingDecision: PendingDecision? = null

        init {
            viewModelScope.launch {
                session.invalidated.collect { if (it) _state.value = ReviewClaimDetailUiState.Error(CLAIM_SESSION_CHANGED) }
            }
        }

        fun load() {
            if (_reviewingAction.value != null) return
            if (claimId.isBlank() || !session.isCurrent) {
                _state.value = ReviewClaimDetailUiState.Error(if (claimId.isBlank()) "Missing claim id." else CLAIM_SESSION_CHANGED)
                return
            }
            if (!loadedOnce) _state.value = ReviewClaimDetailUiState.Loading
            viewModelScope.launch { reload() }
        }

        /**
         * Submit the reviewer decision. Returns `true` on success so the
         * host can dismiss its note sheet. Surfaces a toast either way.
         */
        suspend fun review(
            action: AdminClaimReviewAction,
            note: String? = null,
        ): Boolean {
            if (_reviewingAction.value != null || _evidencePanel.value != null) return false
            _reviewingAction.value = action
            return try {
                session.requireCurrent()
                val detail = (_state.value as? ReviewClaimDetailUiState.Loaded)?.detail
                check(detail != null && detail.claim.id == claimId && HomeClaimReviewSnapshot.validToken(detail.claim.reviewToken)) {
                    CLAIM_SNAPSHOT_CHANGED
                }
                check(!detail.claim.requiresDisputeReview) { CLAIM_DISPUTE_REVIEW }
                pendingDecision?.let {
                    check(
                        it.claim == detail.claim && it.action == action && it.note == note,
                    ) { CLAIM_PENDING_DECISION }
                }
                pendingDecision = PendingDecision(detail.claim, action, note)
                val request =
                    AdminClaimReviewRequest(
                        action = action.backendValue,
                        reviewToken = requireNotNull(detail.claim.reviewToken),
                        note = note,
                    )
                val result = repo.reviewClaim(claimId, request)
                session.requireCurrent()
                val receipt =
                    when (result) {
                        is NetworkResult.Success -> result.data
                        is NetworkResult.Failure -> throw result.error
                    }
                check(receipt.matches(detail.claim.homeId, claimId, detail.claim.claimantUserId, action.backendValue)) {
                    "Could not confirm the claim result. Please retry."
                }
                pendingDecision = null
                _toast.value = ReviewClaimToast(text = successCopy(action), isError = false)
                _reviewingAction.value = null
                reload()
                true
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: NetworkError) {
                reviewFailed(error)
            } catch (error: IllegalStateException) {
                reviewFailed(error)
            } catch (error: IllegalArgumentException) {
                reviewFailed(error)
            } finally {
                _reviewingAction.value = null
            }
        }

        fun dismissToast() {
            _toast.value = null
        }

        // Challenge composer -------------------------------------------------

        /** Toggle a reason chip in the Challenge composer. */
        fun toggleReason(reason: ChallengeReason) {
            _selectedReasons.update { current ->
                if (current.contains(reason)) current - reason else current + reason
            }
        }

        /** Hoisted text-field setter for the drafted question. */
        fun setChallengeQuestion(text: String) {
            _challengeQuestion.value = text
        }

        /** The Send-challenge CTA stays disabled until a question is drafted. */
        fun canSendChallenge(): Boolean = _challengeQuestion.value.isNotBlank()

        /**
         * Submit the drafted challenge. Folds the picked reasons + question
         * into the review note carried by the `Challenge` action. Clears the
         * composer on success so a re-open starts blank.
         */
        suspend fun submitChallenge(): Boolean {
            val note = composeChallengeNote(_selectedReasons.value, _challengeQuestion.value)
            val ok = review(AdminClaimReviewAction.Challenge, note = note)
            if (ok) resetChallengeComposer()
            return ok
        }

        /** Reset composer state — on send + on dismiss. */
        fun resetChallengeComposer() {
            _selectedReasons.value = emptySet()
            _challengeQuestion.value = ""
        }

        private suspend fun reload() {
            val revision = ++loadGeneration
            try {
                session.requireCurrent()
                val result = repo.claimDetail(claimId)
                session.requireCurrent()
                if (revision != loadGeneration) return
                val detail =
                    when (result) {
                        is NetworkResult.Success -> result.data
                        is NetworkResult.Failure -> throw result.error
                    }
                check(
                    detail.claim.id == claimId && detail.home?.id == detail.claim.homeId &&
                        detail.claimant?.id == detail.claim.claimantUserId && HomeClaimReviewSnapshot.validToken(detail.claim.reviewToken),
                ) { CLAIM_SNAPSHOT_CHANGED }
                _state.value = ReviewClaimDetailUiState.Loaded(detail)
                pendingDecision = null
                loadedOnce = true
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: NetworkError) {
                if (revision == loadGeneration) _state.value = ReviewClaimDetailUiState.Error(error.message)
            } catch (error: IllegalStateException) {
                if (revision == loadGeneration) _state.value = ReviewClaimDetailUiState.Error(error.message ?: CLAIM_SNAPSHOT_CHANGED)
            } catch (error: IllegalArgumentException) {
                if (revision == loadGeneration) _state.value = ReviewClaimDetailUiState.Error(error.message ?: CLAIM_SNAPSHOT_CHANGED)
            }
        }

        private fun reviewFailed(error: Throwable): Boolean {
            if (error.isFinalHomeClaimFailure() || !session.isCurrent) pendingDecision = null
            _toast.value = ReviewClaimToast(text = error.message ?: "Could not confirm the claim result. Please retry.", isError = true)
            return false
        }

        private fun successCopy(action: AdminClaimReviewAction): String =
            when (action) {
                AdminClaimReviewAction.Approve -> "Claim approved."
                AdminClaimReviewAction.Reject -> "Claim rejected."
                AdminClaimReviewAction.Challenge -> "Request for more information saved."
            }

        companion object {
            /** Nav-arg key matching `ChildRoutes.REVIEW_CLAIM_DETAIL_ID_KEY`. */
            const val CLAIM_ID_KEY = "claimId"

            /**
             * Fold the picked reasons + drafted question into a single review
             * note. Reasons lead (in declaration order, regardless of tap
             * order) so the claimant reads a tidy "Reasons: …" header before
             * the free-text. Returns `null` when both are empty.
             */
            fun composeChallengeNote(
                reasons: Set<ChallengeReason>,
                question: String,
            ): String? {
                val trimmed = question.trim()
                val reasonLabels =
                    ChallengeReason.entries
                        .filter { reasons.contains(it) }
                        .map { it.label }
                val parts = mutableListOf<String>()
                if (reasonLabels.isNotEmpty()) {
                    parts.add("Reasons: " + reasonLabels.joinToString(", "))
                }
                if (trimmed.isNotEmpty()) {
                    parts.add(trimmed)
                }
                return parts.joinToString("\n\n").ifEmpty { null }
            }
        }
    }
