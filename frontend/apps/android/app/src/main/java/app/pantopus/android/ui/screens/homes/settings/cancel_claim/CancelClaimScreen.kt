@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.settings.cancel_claim

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

const val CANCEL_CLAIM_HOME_ID_KEY = "homeId"

sealed interface CancelClaimUiState {
    data object Loading : CancelClaimUiState

    data object Ready : CancelClaimUiState

    data object Submitting : CancelClaimUiState

    data class Error(val message: String) : CancelClaimUiState

    data object NoClaim : CancelClaimUiState
}

@HiltViewModel
class CancelClaimViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String = requireNotNull(savedStateHandle[CANCEL_CLAIM_HOME_ID_KEY])

        private val _state = MutableStateFlow<CancelClaimUiState>(CancelClaimUiState.Loading)
        val state: StateFlow<CancelClaimUiState> = _state.asStateFlow()

        private val _submitError = MutableStateFlow<String?>(null)
        val submitError: StateFlow<String?> = _submitError.asStateFlow()

        private val _completed = MutableStateFlow(false)
        val completed: StateFlow<Boolean> = _completed.asStateFlow()

        private var claimId: String? = null

        fun load() {
            _state.value = CancelClaimUiState.Loading
            _submitError.value = null
            viewModelScope.launch {
                when (val result = repo.myOwnershipClaims()) {
                    is NetworkResult.Success -> {
                        val claim = result.data.claims.firstOrNull { it.homeId == homeId }
                        if (claim == null) {
                            _state.value = CancelClaimUiState.NoClaim
                        } else {
                            claimId = claim.id
                            _state.value = CancelClaimUiState.Ready
                        }
                    }
                    is NetworkResult.Failure ->
                        _state.value = CancelClaimUiState.Error(result.error.message)
                }
            }
        }

        fun submit() {
            if (_completed.value || _state.value is CancelClaimUiState.Submitting) return
            val id = claimId
            if (id == null) {
                // Load failed previously — retry fetch.
                if (_state.value is CancelClaimUiState.Error) load()
                return
            }
            if (_state.value !is CancelClaimUiState.Ready) return
            _state.value = CancelClaimUiState.Submitting
            _submitError.value = null
            viewModelScope.launch {
                when (val result = repo.deleteOwnershipClaim(homeId, id)) {
                    // Stay in Submitting until the host pops.
                    is NetworkResult.Success -> _completed.value = true
                    is NetworkResult.Failure -> {
                        _submitError.value = result.error.message
                        _state.value = CancelClaimUiState.Ready
                    }
                }
            }
        }
    }

@Composable
fun CancelClaimScreen(
    onBack: () -> Unit,
    onCancelled: () -> Unit,
    viewModel: CancelClaimViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val submitError by viewModel.submitError.collectAsStateWithLifecycle()
    val completed by viewModel.completed.collectAsStateWithLifecycle()
    val ready = state is CancelClaimUiState.Ready
    val submitting = state is CancelClaimUiState.Submitting
    val loadError = state as? CancelClaimUiState.Error

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(completed) {
        if (completed) onCancelled()
    }

    Box(modifier = Modifier.fillMaxSize().testTag("cancelClaim")) {
        FormShell(
            title = "Cancel claim",
            rightActionLabel = null,
            bottomActionLabel =
                when {
                    submitting -> "Cancelling…"
                    loadError != null -> "Try again"
                    else -> "Cancel claim"
                },
            isValid = (ready || loadError != null) && !submitting && !completed,
            isDirty = false,
            isSaving = submitting,
            leading = FormShellLeading.Back,
            onClose = onBack,
            onCommit = viewModel::submit,
        ) {
            CancelClaimBody(state = state, submitError = submitError)
        }
    }
}

/** Confirmation copy / load states rendered inside the [FormShell] scroll. */
@Composable
private fun CancelClaimBody(
    state: CancelClaimUiState,
    submitError: String?,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        if (submitError != null) {
            Text(
                text = submitError,
                color = PantopusColors.error,
                fontSize = 14.sp,
                modifier = Modifier.testTag("cancelClaimError"),
            )
        }
        when (state) {
            is CancelClaimUiState.Loading ->
                Shimmer(width = 320.dp, height = 120.dp, cornerRadius = Radii.lg)
            is CancelClaimUiState.Error ->
                Text(
                    text = state.message,
                    color = PantopusColors.error,
                    fontSize = 14.sp,
                    modifier = Modifier.testTag("cancelClaimLoadError"),
                )
            is CancelClaimUiState.NoClaim ->
                Text(
                    text = "No open ownership claim for this home.",
                    fontSize = 14.sp,
                    color = PantopusColors.appTextSecondary,
                )
            is CancelClaimUiState.Ready, is CancelClaimUiState.Submitting -> {
                Text(
                    text = "Cancel this ownership claim?",
                    modifier = Modifier.semantics { heading() },
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text =
                        "Your pending claim will be withdrawn. You can start a new claim " +
                            "later if you still need to verify ownership.",
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}
