@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeRelationshipScope
import app.pantopus.android.data.homes.HomeResidencyReviewScope
import app.pantopus.android.data.homes.PersistentPendingHomeRelationshipStore
import app.pantopus.android.data.homes.PersistentPendingHomeResidencyReviewStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import javax.inject.Inject

data class SavedReviewDecisions(
    val residency: Boolean = false,
    val relationship: Boolean = false,
)

/**
 * Whether this account has an unfinished residency or ownership (relationship) decision for this Home saved on this
 * device. Review claims shows those links only then, or when the saved decision can't be read, so the review can say why.
 */
@HiltViewModel
class SavedReviewDecisionsViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val residencyStore: PersistentPendingHomeResidencyReviewStore,
        private val relationshipStore: PersistentPendingHomeRelationshipStore,
        private val auth: AuthRepository,
        retrofit: Retrofit,
    ) : ViewModel() {
        private val homeId: String = savedStateHandle[HOME_CLAIM_REVIEW_HOME_ID_KEY] ?: ""
        private val origin = retrofit.baseUrl().toString()
        private val _saved = MutableStateFlow(SavedReviewDecisions())
        val saved = _saved.asStateFlow()

        fun refresh() {
            val actor = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id ?: return
            viewModelScope.launch {
                _saved.value =
                    SavedReviewDecisions(
                        residency = found { residencyStore.read(HomeResidencyReviewScope(origin, actor, homeId.lowercase())) },
                        relationship = found { relationshipStore.read(HomeRelationshipScope(origin, actor, homeId)) },
                    )
            }
        }

        private suspend fun found(read: suspend () -> Any?): Boolean =
            runCatching { read() != null }.getOrElse { error -> if (error is CancellationException) throw error else true }
    }

/** The review links at the top of Review claims: unfinished decisions only when saved, past decisions always. */
@Composable
internal fun ReviewDecisionLinks(
    saved: SavedReviewDecisions,
    onRelationship: () -> Unit,
    onResidency: () -> Unit,
    onHistory: () -> Unit,
) {
    if (saved.relationship) {
        TextButton(onClick = onRelationship, modifier = Modifier.testTag("homeClaimReview.relationshipRecovery")) {
            Text("Check an unfinished ownership decision")
        }
    }
    if (saved.residency) {
        TextButton(onClick = onResidency, modifier = Modifier.testTag("homeClaimReview.residencyRecovery")) {
            Text("Check an unfinished residency decision")
        }
    }
    TextButton(onClick = onHistory, modifier = Modifier.testTag("homeClaimReview.residencyHistory")) { Text("Your past decisions") }
}
