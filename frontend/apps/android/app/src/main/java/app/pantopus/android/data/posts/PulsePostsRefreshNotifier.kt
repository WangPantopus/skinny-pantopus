package app.pantopus.android.data.posts

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Broadcast when a Pulse post is created or edited so feed + My Posts
 * lists refetch without shared view-model references.
 */
@Singleton
class PulsePostsRefreshNotifier
    @Inject
    constructor() {
        private val _ticks = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
        val ticks: SharedFlow<Unit> = _ticks.asSharedFlow()

        fun notifyPostsDidChange() {
            _ticks.tryEmit(Unit)
        }
    }
