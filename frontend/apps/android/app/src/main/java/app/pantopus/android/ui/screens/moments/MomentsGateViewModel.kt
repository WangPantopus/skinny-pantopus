package app.pantopus.android.ui.screens.moments

import androidx.lifecycle.ViewModel
import app.pantopus.android.data.moments.MomentsDot
import app.pantopus.android.data.moments.MomentsFeature
import app.pantopus.android.data.moments.MomentsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/** Lets the tab bar ask whether Moments is on for the signed-in person (the `moments` flag), as Plans' gate does. */
@HiltViewModel
class MomentsGateViewModel
    @Inject
    constructor(
        private val feature: MomentsFeature,
        private val repository: MomentsRepository,
        private val momentsDot: MomentsDot,
    ) : ViewModel() {
        val on: StateFlow<Boolean> = feature.on

        /** False until [on] holds the signed-in person's answer ([MomentsFeature.settled]). */
        val settled: StateFlow<Boolean> = feature.settled

        /** The dot on the Moments tab: something new near you since the tab was last open. */
        val dot: StateFlow<Boolean> = momentsDot.shown

        /** The Moments tab came on screen or left it: opening clears the dot, and both move "new since" to now. */
        fun tabShown(showing: Boolean) = momentsDot.tabShown(showing)

        /** Queues one Moment for the viewer (a chat reply's quote): false when it ended or can't be seen any more. */
        suspend fun queue(momentId: String): Boolean = repository.queueSingle(momentId, feature.viewerId)

        /** A push or link named a Moment that ended or can't be seen any more: the map says so. */
        fun ended() = repository.noteOnMap(ENDED)

        private companion object {
            const val ENDED = "This Moment has ended."
        }
    }
