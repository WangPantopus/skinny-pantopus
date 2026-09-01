@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.settings.leave_home

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
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

const val LEAVE_HOME_HOME_ID_KEY = "homeId"

sealed interface LeaveHomeUiState {
    data object Ready : LeaveHomeUiState

    data object Submitting : LeaveHomeUiState

    data class Error(val message: String) : LeaveHomeUiState
}

@HiltViewModel
class LeaveHomeViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val homeId: String = requireNotNull(savedStateHandle[LEAVE_HOME_HOME_ID_KEY])

        private val _state = MutableStateFlow<LeaveHomeUiState>(LeaveHomeUiState.Ready)
        val state: StateFlow<LeaveHomeUiState> = _state.asStateFlow()

        private val _completed = MutableStateFlow(false)
        val completed: StateFlow<Boolean> = _completed.asStateFlow()

        fun submit() {
            if (_completed.value || _state.value is LeaveHomeUiState.Submitting) return
            _state.value = LeaveHomeUiState.Submitting
            viewModelScope.launch {
                when (val result = repo.moveOut(homeId)) {
                    // Stay in Submitting until the host pops — avoids a second tap.
                    is NetworkResult.Success -> _completed.value = true
                    is NetworkResult.Failure ->
                        _state.value = LeaveHomeUiState.Error(result.error.message)
                }
            }
        }
    }

@Composable
fun LeaveHomeScreen(
    onBack: () -> Unit,
    onLeft: () -> Unit,
    viewModel: LeaveHomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val completed by viewModel.completed.collectAsStateWithLifecycle()
    val submitting = state is LeaveHomeUiState.Submitting
    val error = state as? LeaveHomeUiState.Error

    LaunchedEffect(completed) {
        if (completed) onLeft()
    }

    Box(modifier = Modifier.fillMaxSize().testTag("leaveHome")) {
        FormShell(
            title = "Leave home",
            rightActionLabel = null,
            bottomActionLabel = if (submitting) "Leaving…" else "Leave this home",
            isValid = !submitting && !completed,
            isDirty = false,
            isSaving = submitting,
            leading = FormShellLeading.Back,
            onClose = onBack,
            onCommit = viewModel::submit,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg)
                        .padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                if (error != null) {
                    Text(
                        text = error.message,
                        color = PantopusColors.error,
                        fontSize = 14.sp,
                        modifier = Modifier.testTag("leaveHomeError"),
                    )
                }
                Text(
                    text = "Leave this home?",
                    modifier = Modifier.semantics { heading() },
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                )
                Text(
                    text =
                        "You will lose access to mail, tasks, and household features " +
                            "for this address. You can request to join again later.",
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}
