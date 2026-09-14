@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.leave_home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.homes.members.HomeMemberRemovalDialog
import app.pantopus.android.ui.screens.homes.members.HomeMemberRemovalTarget
import app.pantopus.android.ui.screens.homes.members.HomeMemberRemovalViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

const val LEAVE_HOME_HOME_ID_KEY = "homeId"

@HiltViewModel
class LeaveHomeViewModel
    @Inject
    constructor(savedStateHandle: SavedStateHandle) : ViewModel() {
        val homeId: String = requireNotNull(savedStateHandle[LEAVE_HOME_HOME_ID_KEY])
    }

/** Existing Settings/waiting-room arrival now reviews the current actor's protected removal. */
@Composable
fun LeaveHomeScreen(
    onBack: () -> Unit,
    onLeft: () -> Unit,
    viewModel: LeaveHomeViewModel = hiltViewModel(),
    removal: HomeMemberRemovalViewModel = hiltViewModel(),
) {
    val state by removal.state.collectAsStateWithLifecycle()
    HomeMemberRemovalDialog(
        target = HomeMemberRemovalTarget(viewModel.homeId, self = true),
        onClose = onBack,
        onAcknowledged = { if (state.outcome?.state == "completed") onLeft() else onBack() },
        viewModel = removal,
    )
}
