package app.pantopus.android.ui.screens.moments

import androidx.lifecycle.ViewModel
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
    ) : ViewModel() {
        val on: StateFlow<Boolean> = feature.on

        /** False until [on] holds the signed-in person's answer ([MomentsFeature.settled]). */
        val settled: StateFlow<Boolean> = feature.settled

        /** Queues one Moment for the viewer (a chat reply's quote): false when it ended or can't be seen any more. */
        suspend fun queue(momentId: String): Boolean = repository.queueSingle(momentId, feature.viewerId)
    }
