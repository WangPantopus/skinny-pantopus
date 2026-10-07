package app.pantopus.android.ui.screens.homes.members

import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Whether the signed-in account has an unfinished member removal saved on this device. Members and My Homes show
 * "Check an unfinished removal" only then, or when the saved removal can't be read, so the recovery screen can say why.
 */
@HiltViewModel
class SavedHomeMemberRemovalViewModel
    @Inject
    constructor(
        private val factory: HomeMemberRemovalFactory,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private val _saved = MutableStateFlow(false)
        val saved = _saved.asStateFlow()

        fun refresh() {
            val actorId = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
            viewModelScope.launch { _saved.value = actorId != null && factory.hasSaved(actorId) }
        }
    }

/** "Check an unfinished removal", shown only while this account has a removal saved on this device. */
@Composable
fun SavedRemovalLink(
    dialogOpen: Boolean,
    testTag: String,
    savedRemoval: SavedHomeMemberRemovalViewModel = hiltViewModel(),
    onOpen: () -> Unit,
) {
    val saved by savedRemoval.saved.collectAsStateWithLifecycle()
    LaunchedEffect(dialogOpen) { if (!dialogOpen) savedRemoval.refresh() }
    if (saved) {
        TextButton(onClick = onOpen, modifier = Modifier.testTag(testTag)) { Text("Check an unfinished removal") }
    }
}
