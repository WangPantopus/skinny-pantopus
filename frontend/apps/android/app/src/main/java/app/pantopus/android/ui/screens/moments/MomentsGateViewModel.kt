package app.pantopus.android.ui.screens.moments

import androidx.lifecycle.ViewModel
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.moments.MomentsDot
import app.pantopus.android.data.moments.MomentsFeature
import app.pantopus.android.data.moments.MomentsPeopleRings
import app.pantopus.android.data.moments.MomentsPlayback
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
        private val people: MomentsPeopleRings,
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

        /** The rings around profile pictures: who has Moments the signed-in person may see, by account id. */
        val peopleRings: StateFlow<Map<String, MomentRingDto>> = people.rings

        /** Moments watched in this run of the app: their part of a ring goes gray at once. */
        val watched: StateFlow<Set<String>> = repository.watched

        /** A circle showing this person is on screen: their ring is read (at most once a minute). */
        fun wantRing(userId: String) = people.want(userId, feature.viewerId)

        /** Queues a person's ring for the viewer, from their first Moment not watched yet. */
        fun queueRing(ring: MomentRingDto) {
            repository.playback = MomentsPlayback(rings = listOf(ring), startIndex = 0, newOnly = false)
        }

        /** A push or link named a Moment that ended or can't be seen any more: the map says so. */
        fun ended() = repository.noteOnMap(ENDED)

        private companion object {
            const val ENDED = "This Moment has ended."
        }
    }
