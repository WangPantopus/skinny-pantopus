package app.pantopus.android.data.posts

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Broadcast when a Pulse post is created or edited so feed + My Posts
 * lists refetch without shared view-model references.
 *
 * A quiet refetch keeps the rows already on screen (Instant Screens), so a post the person ended on another screen
 * (closed, deleted, archived, or found gone on its own page) is also recorded here. A list hides it when it next looks
 * and shows it again only after it is restored.
 */
@Singleton
class PulsePostsRefreshNotifier
    @Inject
    constructor() {
        private val _ticks = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
        val ticks: SharedFlow<Unit> = _ticks.asSharedFlow()

        /** The latest ended-or-restored change per post, in the order they happened. */
        private val postEvents = LinkedHashMap<String, PostEvent>()
        private var lastSequence = 0L

        fun notifyPostsDidChange() {
            _ticks.tryEmit(Unit)
        }

        /** The person closed, deleted or archived [postId], or its page found it gone: lists stop showing it. */
        fun notifyPostEnded(postId: String) = record(postId, ended = true)

        /** The person restored [postId] from My posts: lists may show it again. */
        fun notifyPostRestored(postId: String) = record(postId, ended = false)

        /** The changes recorded after [sequence], oldest first, and the sequence to pass next time. */
        fun postEventsAfter(sequence: Long): Pair<Long, List<PostEvent>> =
            synchronized(postEvents) {
                lastSequence to postEvents.values.filter { it.sequence > sequence }
            }

        private fun record(
            postId: String,
            ended: Boolean,
        ) {
            synchronized(postEvents) {
                postEvents.remove(postId)
                postEvents[postId] = PostEvent(sequence = ++lastSequence, postId = postId, ended = ended)
            }
            _ticks.tryEmit(Unit)
        }

        /** One post ended ([ended]) or restored. */
        data class PostEvent(
            val sequence: Long,
            val postId: String,
            val ended: Boolean,
        )
    }
