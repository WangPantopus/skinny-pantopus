package app.pantopus.android.data.pulse

import app.pantopus.android.data.moments.MomentMotionClip
import app.pantopus.android.data.moments.MomentPostingOutcome
import app.pantopus.android.data.moments.MomentsPosting
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * "Pulse, reinvented" (PHASE-5 C, CONTRACT 10b): a motion photo's clip goes up beside its Moment once the photo is up
 * (the server takes it only then), in the background like the photo, and leaves the phone after. A clip whose Moment
 * never finished posting, or one the server refused, is dropped: the Moment stays a still, as today.
 */
@Singleton
class MomentMotionSender
    @Inject
    constructor(
        private val posting: MomentsPosting,
        private val studio: StudioRepository,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        /** Sends [clip] beside Moment [momentId] once its photo has finished posting. */
        fun send(
            momentId: String,
            clip: MomentMotionClip,
        ) {
            scope.launch {
                val done =
                    withTimeoutOrNull(WAIT_MS) {
                        posting.outcomes.first { outcome ->
                            when (outcome) {
                                is MomentPostingOutcome.Live -> outcome.moment.id == momentId
                                is MomentPostingOutcome.Held -> outcome.moment.id == momentId
                            }
                        }
                    }
                val kept = done != null && studio.uploadMotion(momentId, clip)
                Timber.tag("Moments").i("motion clip %s", if (kept) "kept" else "not kept")
                clip.delete()
            }
        }

        private companion object {
            /** A photo's upload waits out a lost connection; the clip waits as long, then gives up. */
            const val WAIT_MS = 30L * 60 * 1000
        }
    }
