@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.review_claims

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.admin.AdminRepository
import app.pantopus.android.data.api.models.admin.AdminClaimDetailResponse
import app.pantopus.android.data.api.models.admin.AdminClaimReviewAction
import app.pantopus.android.data.api.models.admin.AdminClaimReviewRequest
import app.pantopus.android.data.api.net.NetworkResult
import dagger.hilt.android.lifecycle.HiltViewModel
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

        fun load() {
            if (claimId.isBlank()) {
                _state.value = ReviewClaimDetailUiState.Error("Missing claim id.")
                return
            }
            // Refetch on every appear so the admin always sees fresh state;
            // only flip back to the loading shimmer the first time.
            if (!loadedOnce) _state.value = ReviewClaimDetailUiState.Loading
            viewModelScope.launch {
                when (val result = repo.claimDetail(claimId)) {
                    is NetworkResult.Success -> {
                        _state.value = ReviewClaimDetailUiState.Loaded(result.data)
                        loadedOnce = true
                    }
                    is NetworkResult.Failure -> {
                        _state.value =
                            ReviewClaimDetailUiState.Error("Couldn't load claim details. Try again.")
                    }
                }
            }
        }

        /**
         * Submit the reviewer decision. Returns `true` on success so the
         * host can dismiss its note sheet. Surfaces a toast either way.
         */
        suspend fun review(
            action: AdminClaimReviewAction,
            note: String? = null,
        ): Boolean {
            if (_reviewingAction.value != null) return false
            _reviewingAction.value = action
            return try {
                val request = AdminClaimReviewRequest(action = action.backendValue, note = note)
                when (val result = repo.reviewClaim(claimId, request)) {
                    is NetworkResult.Success -> {
                        _toast.update {
                            ReviewClaimToast(text = successCopy(action), isError = false)
                        }
                        // Refresh detail so the body shows the new state.
                        viewModelScope.launch { reload() }
                        true
                    }
                    is NetworkResult.Failure -> {
                        _toast.update {
                            ReviewClaimToast(text = "Couldn't review this claim. Try again.", isError = true)
                        }
                        false
                    }
                }
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
            when (val result = repo.claimDetail(claimId)) {
                is NetworkResult.Success -> {
                    _state.value = ReviewClaimDetailUiState.Loaded(result.data)
                }
                is NetworkResult.Failure -> Unit
            }
        }

        private fun successCopy(action: AdminClaimReviewAction): String =
            when (action) {
                AdminClaimReviewAction.Approve -> "Claim accepted. The claimant is now a verified owner."
                AdminClaimReviewAction.Reject -> "Claim rejected. The claimant has been notified."
                AdminClaimReviewAction.Challenge -> "Challenge sent. The claimant has 14 days to respond."
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
