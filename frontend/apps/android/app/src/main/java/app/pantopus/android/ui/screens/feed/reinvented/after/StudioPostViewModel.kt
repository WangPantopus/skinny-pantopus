package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.posts.PostCreateRequest
import app.pantopus.android.data.api.models.posts.PostMediaLocation
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.data.pulse.StudioPostRepository
import app.pantopus.android.ui.screens.moments.compose.ComposePin
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.screens.moments.studio.sentStamps
import app.pantopus.android.ui.screens.moments.studio.stampElevation
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID
import javax.inject.Inject

/**
 * Post, for a picture or words made into one of today's Pulse posts ("+ Ask / Kind", CONTRACT 6d; iPhone's
 * `MomentsStudioPostKind+Posting`): today's request with the Studio's `studio` field, then the photo, marks drawn in, as
 * today's post photo. Sent while the switch is off for the author, nothing is posted and the switch turns off at once.
 */
@HiltViewModel
class StudioPostViewModel
    @Inject
    constructor(
        private val repository: StudioPostRepository,
        private val locations: PlanLocationResolver,
        private val postsRefresh: PulsePostsRefreshNotifier,
    ) : ViewModel() {
        private val _posting = MutableStateFlow(false)
        val posting: StateFlow<Boolean> = _posting.asStateFlow()

        private val _note = MutableStateFlow<String?>(null)

        /** Why Post couldn't go, in today's composer's words or the server's. */
        val note: StateFlow<String?> = _note.asStateFlow()

        fun pick(
            state: MomentsComposeUiState,
            kind: StudioPostKind,
        ) {
            // A picture's caption is the post's words until they are changed in the sheet; a text card's are the card.
            StudioPostState.draft.value = StudioPostState.draft.value.copy(kind = kind.takeIf { it in state.studioKindChoices })
            _note.value = null
        }

        /** Back to a Moment (the composer's caption was never changed). */
        fun clear() {
            StudioPostState.draft.value = StudioPostDraft(askDeclined = StudioPostState.draft.value.askDeclined)
            _note.value = null
        }

        fun edit(change: (StudioPostDraft) -> StudioPostDraft) {
            StudioPostState.draft.value = change(StudioPostState.draft.value)
        }

        /**
         * Post tapped in the Studio: true when it posts as a kind (and [onDone] closes the composer once it is made),
         * false for a Moment, which today's Post makes.
         */
        fun post(
            state: MomentsComposeUiState,
            onDone: () -> Unit,
        ): Boolean {
            val draft = StudioPostState.draft.value
            val kind = state.studioPostKind(draft) ?: return false
            if (_posting.value) return true
            state.studioKindBlocker(draft)?.let { blocker ->
                _note.value = blocker
                return true
            }
            val requestId = draft.requestId ?: UUID.randomUUID().toString()
            StudioPostState.draft.value = draft.copy(requestId = requestId)
            _posting.value = true
            _note.value = null
            viewModelScope.launch {
                if (send(state, kind, draft.copy(requestId = requestId))) {
                    StudioPostState.reset()
                    onDone()
                }
                _posting.value = false
            }
            return true
        }

        private suspend fun send(
            state: MomentsComposeUiState,
            kind: StudioPostKind,
            draft: StudioPostDraft,
        ): Boolean {
            val placed = !state.noLocationOn && (state.audience == "nearby" || state.madeUp)
            val pin = state.pin
            // A fix older than about 4 minutes is read again, as the Moment's Post does.
            val fresh = pin?.takeIf { placed && !it.capture }?.let { freshFix(it) }
            val photo = (state.media as? MomentMediaFile.Photo)?.file
            val request = request(state, kind, draft, placed, pin, fresh)
            val studio = studioFields(state, kind, draft, pin.takeIf { placed }, fresh, photo != null)
            return when (val made = repository.create(request, studio)) {
                is NetworkResult.Failure -> {
                    _note.value = made.error.displayMessage("Couldn't post. Try again.")
                    false
                }
                is NetworkResult.Success -> {
                    val postId = made.data
                    when {
                        postId == null -> {
                            _note.value = "Post could not be confirmed. Try again."
                            false
                        }
                        photo != null && !repository.sendPhoto(postId, photo) -> {
                            // The post is made: Post again sends the same request (its id), then the photo again.
                            _note.value = "Post saved. The photo could not be confirmed. Try again."
                            false
                        }
                        else -> {
                            postsRefresh.notifyPostsDidChange()
                            true
                        }
                    }
                }
            }
        }

        private suspend fun freshFix(pin: ComposePin): ComposePin {
            if (Instant.now().toEpochMilli() - pin.at.toEpochMilli() <= FIX_REFRESH_MS) return pin
            val fix = locations.newFix() ?: return pin
            return pin.copy(latitude = fix.latitude, longitude = fix.longitude, at = fix.at)
        }

        @Suppress("LongParameterList") // What one post is made of, each read once.
        private fun request(
            state: MomentsComposeUiState,
            kind: StudioPostKind,
            draft: StudioPostDraft,
            placed: Boolean,
            pin: ComposePin?,
            fresh: ComposePin?,
        ): PostCreateRequest {
            val madeUp = state.madeUp
            val venue = state.pickedVenue
            val at = venue?.let { it.latitude to it.longitude } ?: pin?.let { it.latitude to it.longitude }
            val event = kind == StudioPostKind.EVENT
            val lost = kind == StudioPostKind.LOST_FOUND
            return PostCreateRequest(
                clientRequestId = draft.requestId,
                content = state.studioPostWords(draft).trim(),
                postType = kind.wire,
                visibility = if (placed) "neighborhood" else "connections",
                postAs = if (madeUp) "pen_name" else "personal",
                latitude = at?.first?.takeIf { placed },
                longitude = at?.second?.takeIf { placed },
                locationName = venue?.name?.takeIf { placed },
                // The picked venue's key, so a Spot or an Event at a venue keeps its tag, as the web sends it (and Eyes on needs it).
                geocodePlaceId = venue?.placeId?.takeIf { placed && it.startsWith("osm:") },
                gpsTimestamp = fresh?.at?.toString(),
                gpsLatitude = fresh?.latitude,
                gpsLongitude = fresh?.longitude,
                // Under a made-up name: no profile (today's composer leaves these out there).
                showOnProfile = true.takeIf { !madeUp },
                profileVisibilityScope = "local_context".takeIf { !madeUp },
                eventDate = draft.eventStart?.takeIf { event }?.let(::eventWire),
                eventEndDate = draft.eventEnd?.takeIf { event }?.let(::eventWire),
                eventVenue = draft.venue.trim().takeIf { event && it.isNotEmpty() },
                safetyAlertKind = draft.alertKind.key.takeIf { kind == StudioPostKind.ALERT },
                lostFoundType = (if (draft.found) "found" else "lost").takeIf { lost },
                contactPref = draft.contact.takeIf { lost },
                contactPhone = draft.phone.filter(Char::isDigit).takeIf { lost && draft.contact == "phone" },
                audience = if (placed) "nearby" else "connections",
                purpose = kind.purpose,
                mediaLocations =
                    pin?.takeIf { placed && it.capture }?.let { listOf(PostMediaLocation(it.latitude, it.longitude, it.at.toString())) },
            )
        }

        /** The `studio` field: the stamps on the photo, and what the server checks to keep the "now" stamps. */
        @Suppress("LongParameterList") // What the field is made of, each read once.
        private fun studioFields(
            state: MomentsComposeUiState,
            kind: StudioPostKind,
            draft: StudioPostDraft,
            pin: ComposePin?,
            fresh: ComposePin?,
            photo: Boolean,
        ): Map<String, Any?> {
            val stamps = if (photo) state.sentStamps.orEmpty() else emptyList()
            val elevation = pin?.takeIf { photo }?.let { state.stampElevation(it) }
            // The camera's own shot, here, now (the Live mark's checks); an album pick says its own time instead.
            val takenHere = photo && state.shot != null && state.takenAt == null && fresh != null
            return mapOf(
                "stamps" to
                    stamps.map {
                        mapOf("kind" to it.kind, "x" to it.x, "y" to it.y, "scale" to it.scale, "rotation" to it.rotation)
                    },
                "elevation" to elevation?.let { mapOf("meters" to it.meters, "accuracy_m" to it.accuracyM, "speed_mps" to it.speedMps) },
                "explore" to true.takeIf { draft.explore && kind.mayGoToExplore },
                "eyes_on" to true.takeIf { draft.eyesOn && kind == StudioPostKind.ASK && !state.madeUp },
                "taken_at" to state.takenAt?.takeIf { photo }?.toString(),
                "taken_here" to true.takeIf { takenHere },
                "fix" to fresh?.takeIf { takenHere }?.let { fixField(it) },
            )
        }

        private fun fixField(fix: ComposePin): Map<String, Any> =
            mapOf("latitude" to fix.latitude, "longitude" to fix.longitude, "fix_at" to fix.at.toString())

        override fun onCleared() {
            StudioPostState.reset()
        }

        private companion object {
            const val FIX_REFRESH_MS = 4 * 60 * 1000L
        }
    }
