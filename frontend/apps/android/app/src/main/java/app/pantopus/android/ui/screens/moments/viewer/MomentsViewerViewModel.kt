@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.viewer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentBriefDto
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.api.models.moments.MomentViewersResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.moments.MomentsRepository
import app.pantopus.android.data.moments.serverCode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

/** One ring in the viewer's queue: the Moments it plays (all of them, or only the new ones for Play all). */
data class ViewerRing(
    val ring: MomentRingDto,
    val moments: List<MomentBriefDto>,
    /** Where it opens: its first new Moment, or its first. */
    val startAt: Int,
)

/** A person muted from the viewer, for the note with Undo. */
data class MutedAuthor(
    val authorId: String,
    val text: String,
)

/** Where the current Moment stands. */
sealed interface ViewerLoad {
    data object Loading : ViewerLoad

    data class Ready(
        val moment: MomentDto,
    ) : ViewerLoad

    /** It ended (time up, deleted, removed) or can't be seen any more: the viewer moves on. */
    data object Ended : ViewerLoad

    data object Failed : ViewerLoad
}

data class MomentsViewerUiState(
    val rings: List<ViewerRing> = emptyList(),
    val ringIndex: Int = 0,
    val momentIndex: Int = 0,
    val load: ViewerLoad = ViewerLoad.Loading,
    /** Nothing (more) to play: the viewer closes. */
    val finished: Boolean = false,
    val viewers: MomentViewersResponse? = null,
    val viewersLoading: Boolean = false,
) {
    val ring: ViewerRing? get() = rings.getOrNull(ringIndex)
    val brief: MomentBriefDto? get() = ring?.moments?.getOrNull(momentIndex)
    val moment: MomentDto? get() = (load as? ViewerLoad.Ready)?.moment
}

/**
 * The viewer (boards V1 to V5): plays the queue the map handed over ([MomentsRepository.playback]) ring by ring,
 * records each view once, and carries out reactions, replies, reports, mutes, blocks, Seen by and Delete.
 */
@HiltViewModel
class MomentsViewerViewModel
    @Inject
    constructor(
        private val repository: MomentsRepository,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(MomentsViewerUiState())
        val state: StateFlow<MomentsViewerUiState> = _state.asStateFlow()

        private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 2)

        /** One-line notices for the viewer's toast ("Sent to Elena in Messages"). */
        val messages: SharedFlow<String> = _messages.asSharedFlow()

        private val _muted = MutableSharedFlow<MutedAuthor>(extraBufferCapacity = 1)

        /** A person just muted: the viewer offers Undo (MOMLEAD 22:10Z: no confirm, a note with Undo, as on iPhone). */
        val muted: SharedFlow<MutedAuthor> = _muted.asSharedFlow()

        /** Your photo, for the header of your own Moment. */
        val avatarUrl: String? get() = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.avatarUrl

        private val loaded = mutableMapOf<String, Pair<MomentDto, Long>>()
        private val viewed = mutableSetOf<String>()

        init {
            val playback = repository.playback
            val watched = repository.watched.value
            val rings =
                playback?.rings.orEmpty().mapNotNull { ring ->
                    val fresh = { brief: MomentBriefDto -> !brief.seen && brief.id !in watched && !ring.mine }
                    val moments = if (playback?.newOnly == true) ring.moments.filter(fresh) else ring.moments
                    if (moments.isEmpty()) return@mapNotNull null
                    ViewerRing(ring, moments, startAt = moments.indexOfFirst(fresh).coerceAtLeast(0))
                }
            val start = (playback?.startIndex ?: 0).coerceIn(0, (rings.size - 1).coerceAtLeast(0))
            _state.value =
                MomentsViewerUiState(
                    rings = rings,
                    ringIndex = start,
                    momentIndex = rings.getOrNull(start)?.startAt ?: 0,
                    finished = rings.isEmpty(),
                )
            load()
        }

        /** Tap on the right: the next Moment, or the next ring after the last one. */
        fun next() {
            val current = _state.value
            val ring = current.ring ?: return finish()
            if (current.momentIndex < ring.moments.size - 1) {
                _state.update { it.copy(momentIndex = it.momentIndex + 1, viewers = null) }
                load()
            } else {
                nextRing()
            }
        }

        /** Tap on the left: the Moment before, or the ring before at its start. */
        fun previous() {
            val current = _state.value
            when {
                current.momentIndex > 0 -> _state.update { it.copy(momentIndex = it.momentIndex - 1, viewers = null) }
                current.ringIndex > 0 -> _state.update { it.copy(ringIndex = it.ringIndex - 1, momentIndex = 0, viewers = null) }
                else -> _state.update { it.copy(load = (it.load as? ViewerLoad.Ready) ?: it.load) }
            }
            load()
        }

        /** Swipe left: the next ring nearby. */
        fun nextRing() {
            val current = _state.value
            if (current.ringIndex >= current.rings.size - 1) return finish()
            val next = current.ringIndex + 1
            _state.update { it.copy(ringIndex = next, momentIndex = it.rings[next].startAt, viewers = null) }
            load()
        }

        /** Swipe right: the ring before. */
        fun previousRing() {
            val current = _state.value
            if (current.ringIndex == 0) return
            val back = current.ringIndex - 1
            _state.update { it.copy(ringIndex = back, momentIndex = it.rings[back].startAt, viewers = null) }
            load()
        }

        fun retry() = load()

        private fun finish() {
            _state.update { it.copy(finished = true) }
        }

        /** Reads the current Moment (signed links last 15 minutes, so a copy older than 10 is read again). */
        private fun load() {
            val brief = _state.value.brief ?: return finish()
            val cached = loaded[brief.id]?.takeIf { System.currentTimeMillis() - it.second < LINK_REUSE_MS }?.first
            if (cached != null) {
                _state.update { it.copy(load = ViewerLoad.Ready(cached)) }
                prefetchNext()
                return
            }
            _state.update { it.copy(load = ViewerLoad.Loading) }
            viewModelScope.launch {
                val result = repository.moment(brief.id)
                if (_state.value.brief?.id != brief.id) return@launch
                when (result) {
                    is NetworkResult.Success -> {
                        loaded[brief.id] = result.data to System.currentTimeMillis()
                        _state.update { it.copy(load = ViewerLoad.Ready(result.data)) }
                        prefetchNext()
                    }
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(load = if (result.error.isGone()) ViewerLoad.Ended else ViewerLoad.Failed)
                        }
                }
            }
        }

        /** Reads the next Moment ahead, so it opens at once. */
        private fun prefetchNext() {
            val current = _state.value
            val ring = current.ring ?: return
            val nextBrief =
                ring.moments.getOrNull(current.momentIndex + 1)
                    ?: current.rings.getOrNull(current.ringIndex + 1)?.let { it.moments.getOrNull(it.startAt) }
                    ?: return
            if (loaded[nextBrief.id] != null) return
            viewModelScope.launch {
                (repository.moment(nextBrief.id) as? NetworkResult.Success)?.data?.let {
                    loaded[nextBrief.id] = it to System.currentTimeMillis()
                }
            }
        }

        /** The Moment is on screen (its picture loaded or its video started): one view, once, never your own. */
        fun shown(moment: MomentDto) {
            if (_state.value.ring?.ring?.mine == true || !viewed.add(moment.id)) return
            viewModelScope.launch { repository.recordView(moment.id) }
        }

        /** A quick reaction: the same emoji again takes it back. */
        fun react(emoji: String) {
            val moment = _state.value.moment ?: return
            val next = if (moment.myReaction == emoji) null else emoji
            replaceMoment(moment.copy(myReaction = next))
            viewModelScope.launch {
                when (val result = repository.react(moment.id, next)) {
                    is NetworkResult.Success -> replaceMoment(moment.copy(myReaction = result.data))
                    is NetworkResult.Failure -> {
                        replaceMoment(moment)
                        _messages.tryEmit(result.error.viewerMessage("Couldn't send that reaction."))
                    }
                }
            }
        }

        /** A reply lands in Messages, a direct chat with the author, with the Moment above it. */
        fun reply(
            text: String,
            onSent: () -> Unit,
        ) {
            val moment = _state.value.moment ?: return
            val body = text.trim().take(MAX_REPLY)
            if (body.isEmpty()) return
            viewModelScope.launch {
                when (val result = repository.reply(moment.id, body)) {
                    is NetworkResult.Success -> {
                        onSent()
                        _messages.tryEmit("Sent to ${moment.author.firstName ?: moment.author.name ?: "them"} in Messages")
                    }
                    is NetworkResult.Failure -> _messages.tryEmit(result.error.viewerMessage("Couldn't send your reply."))
                }
            }
        }

        fun report(reason: String) {
            val moment = _state.value.moment ?: return
            viewModelScope.launch {
                when (val result = repository.report(moment.id, reason)) {
                    is NetworkResult.Success -> _messages.tryEmit("Thanks. The Pantopus team will look at it.")
                    is NetworkResult.Failure -> _messages.tryEmit(result.error.viewerMessage("Couldn't send your report."))
                }
            }
        }

        /** Mutes this person's Moments at once: their rings leave the queue and the map, and the viewer offers Undo. */
        fun muteAuthor() {
            val author = _state.value.ring?.ring?.author ?: return
            viewModelScope.launch {
                when (val result = repository.mute(author.id)) {
                    is NetworkResult.Success -> {
                        val who = author.firstName ?: author.name
                        _muted.tryEmit(
                            MutedAuthor(author.id, if (who != null) "You won't see $who's Moments." else "You won't see their Moments."),
                        )
                        dropAuthor(author.id, lingering = true)
                    }
                    is NetworkResult.Failure -> _messages.tryEmit(result.error.viewerMessage("Couldn't mute them."))
                }
            }
        }

        /** Undo after muting: their Moments come back on the map. */
        fun unmute(authorId: String) {
            viewModelScope.launch {
                when (val result = repository.unmute(authorId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> _messages.tryEmit(result.error.viewerMessage("Couldn't undo that."))
                }
            }
        }

        /** Blocks this person (the existing blocks): their rings leave the queue and the map. */
        fun blockAuthor() {
            val author = _state.value.ring?.ring?.author ?: return
            viewModelScope.launch {
                when (val result = repository.block(author.id)) {
                    is NetworkResult.Success -> {
                        _messages.tryEmit("Blocked ${author.name ?: "them"}.")
                        dropAuthor(author.id)
                    }
                    is NetworkResult.Failure -> _messages.tryEmit(result.error.viewerMessage("Couldn't block them."))
                }
            }
        }

        /**
         * Takes [authorId]'s rings out of the queue and plays on. With [lingering] (a mute, whose note offers Undo) the
         * viewer stays open a moment when nothing is left, so the note can be read.
         */
        private fun dropAuthor(
            authorId: String,
            lingering: Boolean = false,
        ) {
            val current = _state.value
            val kept = current.rings.filter { it.ring.author.id != authorId }
            val nextIndex = current.rings.drop(current.ringIndex).firstOrNull { it.ring.author.id != authorId }?.let { kept.indexOf(it) }
            if (kept.isEmpty() || nextIndex == null) {
                if (!lingering) return finish()
                _state.update { it.copy(rings = emptyList(), load = ViewerLoad.Loading) }
                viewModelScope.launch {
                    kotlinx.coroutines.delay(LINGER_MS)
                    finish()
                }
                return
            }
            _state.update { it.copy(rings = kept, ringIndex = nextIndex, momentIndex = kept[nextIndex].startAt, viewers = null) }
            load()
        }

        /** Seen by (V5): who watched your Moment, newest first, with their reaction or "Replied". */
        fun loadViewers() {
            val moment = _state.value.moment ?: return
            _state.update { it.copy(viewersLoading = true) }
            viewModelScope.launch {
                val result = repository.viewers(moment.id)
                _state.update {
                    it.copy(viewersLoading = false, viewers = (result as? NetworkResult.Success)?.data ?: it.viewers)
                }
                if (result is NetworkResult.Failure) _messages.tryEmit(result.error.viewerMessage("Couldn't load who saw it."))
            }
        }

        /** Deletes your Moment: it leaves the map now, and the viewer moves on. */
        fun delete(onDeleted: () -> Unit) {
            val moment = _state.value.moment ?: return
            viewModelScope.launch {
                when (val result = repository.delete(moment.id)) {
                    is NetworkResult.Success -> {
                        onDeleted()
                        _messages.tryEmit("Moment deleted")
                        removeCurrent()
                    }
                    is NetworkResult.Failure -> _messages.tryEmit(result.error.viewerMessage("Couldn't delete it."))
                }
            }
        }

        /** The current Moment ended or was deleted: drop it and play what's next. */
        fun removeCurrent() {
            val current = _state.value
            val ring = current.ring ?: return finish()
            val left = ring.moments.filterIndexed { index, _ -> index != current.momentIndex }
            if (left.isEmpty()) {
                val rings = current.rings.filterIndexed { index, _ -> index != current.ringIndex }
                if (current.ringIndex >= rings.size) return finish()
                _state.update { it.copy(rings = rings, momentIndex = rings[it.ringIndex].startAt, viewers = null) }
            } else {
                val rings = current.rings.toMutableList().also { it[current.ringIndex] = ring.copy(moments = left, startAt = 0) }
                _state.update { it.copy(rings = rings, momentIndex = it.momentIndex.coerceAtMost(left.size - 1), viewers = null) }
            }
            load()
        }

        private fun replaceMoment(moment: MomentDto) {
            loaded[moment.id] = moment to (loaded[moment.id]?.second ?: System.currentTimeMillis())
            _state.update { state -> if (state.moment?.id == moment.id) state.copy(load = ViewerLoad.Ready(moment)) else state }
        }

        private companion object {
            const val LINK_REUSE_MS = 10 * 60 * 1000L
            const val MAX_REPLY = 1000
            const val LINGER_MS = 4_000L
        }
    }

/** Ended, removed or no longer visible: not an error to show, the viewer moves on. */
private fun NetworkError.isGone(): Boolean = code == 410 || this == NetworkError.NotFound || serverCode == "MOMENT_ENDED"

private fun NetworkError.viewerMessage(fallback: String): String =
    when (serverCode) {
        "MOMENT_ENDED" -> "This Moment has ended."
        "MOMENT_REPLY_UNAVAILABLE" -> "Pantopus Moments don't take replies."
        "MOMENT_OWN" -> "That's your own Moment."
        else -> if (this is NetworkError.Transport) message else fallback
    }

/** "2h ago" from a Moment's start (board V1). */
internal fun agoLabel(
    iso: String?,
    now: Instant = Instant.now(),
): String? {
    val then = iso?.let { runCatching { Instant.parse(it.replace("+00:00", "Z")) }.getOrNull() } ?: return null
    val minutes = java.time.Duration.between(then, now).toMinutes().coerceAtLeast(0)
    return when {
        minutes < 1 -> "just now"
        minutes < 60 -> "${minutes}m ago"
        minutes < 24 * 60 -> "${minutes / 60}h ago"
        else -> "${minutes / (24 * 60)}d ago"
    }
}

/** "22h left" until a Moment ends (board V1). */
internal fun leftLabel(
    iso: String?,
    now: Instant = Instant.now(),
): String? {
    val end = iso?.let { runCatching { Instant.parse(it.replace("+00:00", "Z")) }.getOrNull() } ?: return null
    val minutes = java.time.Duration.between(now, end).toMinutes()
    return when {
        minutes <= 0 -> "ending"
        minutes < 60 -> "${minutes}m left"
        else -> "${minutes / 60}h left"
    }
}
