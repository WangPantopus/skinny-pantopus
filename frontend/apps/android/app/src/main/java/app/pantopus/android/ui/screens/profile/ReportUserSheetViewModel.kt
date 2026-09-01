@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.profile.UserReportRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.profile.UserReportsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Report reasons surfaced by the design's radio group. Each carries the
 * backend-accepted [backendKey] — the backend Joi schema
 * (`users.js:4137`) only accepts `spam · harassment · inappropriate ·
 * misinformation · safety · other`, so design-only categories
 * (impersonation, fraud, hate speech) collapse to a backend bucket and
 * prefix the moderator-visible `details` with [detailsPrefix].
 */
enum class ReportReason(
    val key: String,
    val label: String,
    val backendKey: String,
    val detailsPrefix: String?,
) {
    Spam("spam", "Spam", "spam", null),
    Harassment("harassment", "Harassment", "harassment", null),
    Impersonation("impersonation", "Impersonation", "other", "[Impersonation]"),
    Fraud("fraud", "Fraud", "other", "[Fraud]"),
    HateSpeech("hate_speech", "Hate speech", "harassment", "[Hate speech]"),
    Other("other", "Other", "other", null),
}

/** Submission state for the Report-User sheet. */
sealed interface ReportSheetUiState {
    data object Idle : ReportSheetUiState

    data object Submitting : ReportSheetUiState

    data object Succeeded : ReportSheetUiState

    data class Failed(val message: String) : ReportSheetUiState
}

/**
 * View-model behind [ReportUserSheet]. Holds the radio selection +
 * details, and exposes a submit lifecycle that POSTs to
 * `/api/users/:userId/report` via [UserReportsRepository].
 */
@HiltViewModel
class ReportUserSheetViewModel
    @Inject
    constructor(
        private val repo: UserReportsRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ReportSheetUiState>(ReportSheetUiState.Idle)
        val state: StateFlow<ReportSheetUiState> = _state.asStateFlow()

        private val _selectedReason = MutableStateFlow<ReportReason?>(null)
        val selectedReason: StateFlow<ReportReason?> = _selectedReason.asStateFlow()

        private val _details = MutableStateFlow("")
        val details: StateFlow<String> = _details.asStateFlow()

        fun selectReason(reason: ReportReason) {
            _selectedReason.value = reason
        }

        fun updateDetails(value: String) {
            _details.value = value
        }

        /** True when a reason is chosen and — for `Other` — details are non-empty. */
        fun canSubmit(): Boolean {
            val reason = _selectedReason.value ?: return false
            val requiresDetails = reason == ReportReason.Other
            return !requiresDetails || _details.value.trim().isNotEmpty()
        }

        fun submit(userId: String) {
            val reason = _selectedReason.value ?: return
            val current = _state.value
            if (current is ReportSheetUiState.Submitting || current is ReportSheetUiState.Succeeded) return
            if (!canSubmit()) return

            _state.value = ReportSheetUiState.Submitting
            val trimmed = _details.value.trim()
            val payloadDetails = composeDetails(reason, trimmed)
            val body = UserReportRequest(reason = reason.backendKey, details = payloadDetails)

            viewModelScope.launch {
                when (val result = repo.report(userId, body)) {
                    is NetworkResult.Success -> {
                        _state.value = ReportSheetUiState.Succeeded
                    }
                    is NetworkResult.Failure -> {
                        _state.value = ReportSheetUiState.Failed(friendlyMessage(result.error))
                    }
                }
            }
        }

        private fun composeDetails(
            reason: ReportReason,
            userDetails: String,
        ): String? {
            val prefix = reason.detailsPrefix
            return when {
                prefix == null && userDetails.isEmpty() -> null
                prefix == null -> userDetails
                userDetails.isEmpty() -> prefix
                else -> "$prefix $userDetails"
            }
        }

        private fun friendlyMessage(error: NetworkError): String =
            when (error) {
                NetworkError.NotFound -> "We couldn't find that user."
                NetworkError.Forbidden -> "You don't have permission to do that."
                is NetworkError.Transport -> "Check your connection and try again."
                else -> "Couldn't submit your report."
            }
    }
