@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.compose

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.CreateMomentBody
import app.pantopus.android.data.api.models.moments.MomentLocationBody
import app.pantopus.android.data.api.models.moments.MomentPlacePreviewDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.moments.MomentMedia
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.moments.MomentsPosting
import app.pantopus.android.data.moments.MomentsRepository
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.ui.screens.compose.pulse.MediaLocationAccess
import app.pantopus.android.ui.screens.compose.pulse.readPickedPlace
import app.pantopus.android.ui.screens.moments.MomentsRoutes
import app.pantopus.android.ui.screens.moments.components.MomentCardBackground
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import javax.inject.Inject

/** Which part of posting shows (boards P1 to P4). */
enum class ComposeStep { Camera, Text, Review }

/** Where the Moment pins: the phone's fresh fix, or where a library item was taken. */
data class ComposePin(
    val latitude: Double,
    val longitude: Double,
    /** The fix's time (`gps`) or the capture time (`capture`). */
    val at: Instant,
    val capture: Boolean,
)

/** Before anything can be captured: location, then the one-time 18+ confirmation (contract v2). */
enum class ComposeGate { Locating, NeedsLocation, NeedsAdult, NotEligible, Open }

data class MomentsComposeUiState(
    val gate: ComposeGate = ComposeGate.Locating,
    val step: ComposeStep = ComposeStep.Camera,
    /** The fix the camera's chip and a text card pin at. */
    val here: ComposePin? = null,
    val herePlace: MomentPlacePreviewDto? = null,
    /** Where this Moment pins (a library item can pin where it was taken). */
    val pin: ComposePin? = null,
    val place: MomentPlacePreviewDto? = null,
    val media: MomentMediaFile? = null,
    val text: String = "",
    val background: MomentCardBackground = MomentCardBackground.Teal,
    val hours: Int = 24,
    val audience: String = "nearby",
    val showArea: Boolean = false,
    val caption: String = "",
    val posting: Boolean = false,
    /** A problem to show on the sheet or the camera ("This was taken more than a day ago."). */
    val notice: String? = null,
    /** Done: close posting (the Moment is up, or uploading in the background). */
    val done: Boolean = false,
    /** A library photo hides where it was taken: ask once for `ACCESS_MEDIA_LOCATION`, as the Pulse composer does. */
    val askMediaLocation: Boolean = false,
) {
    val kind: String
        get() =
            when (media) {
                is MomentMediaFile.Photo -> "photo"
                is MomentMediaFile.Video -> "video"
                null -> "text"
            }
}

/**
 * Posting a Moment (boards P1 to P4): finds where it pins and what the place is called, asks once for the 18+
 * confirmation, takes the photo, video or text card, and posts it with the Post sheet's choices. A photo or video then
 * uploads in the background ([MomentsPosting]) while the map shows its progress.
 */
@HiltViewModel
class MomentsComposeViewModel
    @Inject
    constructor(
        savedState: SavedStateHandle,
        private val repository: MomentsRepository,
        private val posting: MomentsPosting,
        private val locations: PlanLocationResolver,
        private val auth: AuthRepository,
        @ApplicationContext private val context: Context,
    ) : ViewModel() {
        /** The sheet opens with the "How long" and "Who sees it" this person posted with last time (on this phone). */
        private val choices = context.getSharedPreferences(CHOICES_PREFS, Context.MODE_PRIVATE)
        private val accountId: String? = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        private val _state =
            MutableStateFlow(
                MomentsComposeUiState(
                    step = if (savedState.get<String>(MomentsRoutes.MODE_KEY) == "text") ComposeStep.Text else ComposeStep.Camera,
                    hours = choices.getInt("$accountId.hours", DEFAULT_HOURS).takeIf { it in ALLOWED_HOURS } ?: DEFAULT_HOURS,
                    audience = choices.getString("$accountId.audience", null).takeIf { it in ALLOWED_AUDIENCES } ?: "nearby",
                ),
            )
        val state: StateFlow<MomentsComposeUiState> = _state.asStateFlow()

        /** Your photo, for the pin on the Post sheet. */
        val avatarUrl: String? get() = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.avatarUrl

        /** One id per Moment being posted: a retry of the same Post gets back the Moment it made (contract v2+). */
        private var requestId: String = java.util.UUID.randomUUID().toString()

        /** Opening (or coming back with location allowed): a fresh fix, the place it pins at, and the 18+ state. */
        fun start() {
            if (!locations.hasLocationPermission()) {
                _state.update { it.copy(gate = ComposeGate.NeedsLocation) }
                return
            }
            _state.update { it.copy(gate = ComposeGate.Locating) }
            viewModelScope.launch {
                val fix = locations.newFix()
                if (fix == null) {
                    _state.update { it.copy(gate = ComposeGate.NeedsLocation, notice = NO_FIX) }
                    return@launch
                }
                val here = ComposePin(fix.latitude, fix.longitude, fix.at, capture = false)
                when (val preview = repository.placePreview(here.latitude, here.longitude)) {
                    is NetworkResult.Success ->
                        _state.update {
                            it.copy(
                                here = here,
                                herePlace = preview.data,
                                gate = if (preview.data.adultConfirmed) ComposeGate.Open else ComposeGate.NeedsAdult,
                                notice = null,
                            )
                        }
                    is NetworkResult.Failure ->
                        // The chip can do without a name; the server checks everything again on Post.
                        _state.update { it.copy(here = here, gate = ComposeGate.Open, notice = null) }
                }
            }
        }

        fun locationRefused() {
            _state.update { it.copy(gate = ComposeGate.NeedsLocation) }
        }

        /** "I'm 18 or older" (the one-time confirmation, shared with Pulse's). */
        fun confirmAdult(then: (() -> Unit)? = null) {
            viewModelScope.launch {
                when (val result = repository.adultConfirm()) {
                    is NetworkResult.Success -> {
                        _state.update { it.copy(gate = ComposeGate.Open, herePlace = it.herePlace?.copy(adultConfirmed = true)) }
                        then?.invoke()
                    }
                    is NetworkResult.Failure ->
                        if (result.error.serverCode == "AGE_NOT_ELIGIBLE") {
                            _state.update { it.copy(gate = ComposeGate.NotEligible) }
                        } else {
                            _state.update { it.copy(notice = result.error.message) }
                        }
                }
            }
        }

        fun showStep(step: ComposeStep) {
            _state.update { it.copy(step = step, notice = null) }
        }

        /** The in-app camera took a photo or recorded a video here: it pins at the fresh fix. */
        fun captured(media: MomentMediaFile) {
            val current = _state.value
            _state.update {
                it.copy(
                    media = media,
                    pin = current.here,
                    place = current.herePlace,
                    step = ComposeStep.Review,
                    caption = "",
                    notice = null,
                )
            }
        }

        /** The library item last picked, to read its place again once Android lets the app see it. */
        private var pickedSource: Pair<Uri, String>? = null

        /**
         * A photo or video from the library (the document picker, as the Pulse composer picks: the system photo picker
         * hides where things were taken), taken in the last 24 hours: it pins where it was taken when the file says.
         */
        fun picked(uri: Uri) {
            viewModelScope.launch {
                val video = MomentMedia.isVideo(context, uri)
                val mime = context.contentResolver.getType(uri) ?: if (video) "video/mp4" else "image/jpeg"
                val copy = MomentMedia.copyIn(context, uri, if (video) "mp4" else "jpg")
                if (copy == null) {
                    _state.update { it.copy(notice = "Couldn't open that file.") }
                    return@launch
                }
                val duration = if (video) MomentMedia.videoDurationMs(copy) else 0L
                if (video && duration > MomentMedia.MAX_VIDEO_MS + DURATION_SLACK_MS) {
                    copy.delete()
                    _state.update { it.copy(notice = "Videos can be up to 30 seconds.") }
                    return@launch
                }
                val place = withContext(Dispatchers.IO) { readPickedPlace(context, uri, mime) }
                val capture = MomentMedia.capture(context, uri, copy, video, place.captured, place.mayBeHidden)
                val takenAt = capture.takenAt
                if (takenAt == null || Instant.now().toEpochMilli() - takenAt.toEpochMilli() > MomentMedia.LIBRARY_WINDOW_MS) {
                    copy.delete()
                    _state.update {
                        it.copy(
                            notice =
                                if (takenAt == null) {
                                    "We can't tell when that was taken. Choose a photo or video from the last 24 hours."
                                } else {
                                    TOO_OLD
                                },
                        )
                    }
                    return@launch
                }
                val media = if (video) MomentMediaFile.Video(copy, duration, recordedHere = false) else MomentMediaFile.Photo(copy)
                val lat = capture.latitude
                val lng = capture.longitude
                if (lat != null && lng != null) {
                    val pin = ComposePin(lat, lng, takenAt, capture = true)
                    val place = (repository.placePreview(lat, lng) as? NetworkResult.Success)?.data
                    _state.update {
                        it.copy(media = media, pin = pin, place = place, step = ComposeStep.Review, caption = "", notice = null)
                    }
                } else {
                    // Android hides where it was taken, or the file never said: it pins where you are, as the sheet shows.
                    captured(media)
                    // A photo whose location Android hides can still pin where it was taken once the app may read it.
                    if (capture.hidden && !video && MediaLocationAccess.mayAsk(context)) {
                        pickedSource = uri to mime
                        _state.update { it.copy(askMediaLocation = true) }
                    }
                }
            }
        }

        /** The answer to "Pin where this photo was taken?" (asked once on a phone). */
        fun mediaLocationAnswered() {
            MediaLocationAccess.markAsked(context)
            _state.update { it.copy(askMediaLocation = false) }
        }

        /** `ACCESS_MEDIA_LOCATION` was allowed: read the picked item's place again and pin it there. */
        fun rereadPickedPlace() {
            val (uri, mime) = pickedSource ?: return
            viewModelScope.launch {
                val located = withContext(Dispatchers.IO) { readPickedPlace(context, uri, mime) }.captured ?: return@launch
                val current = _state.value
                if (current.step != ComposeStep.Review || current.media == null) return@launch
                val takenAt = located.capturedAt ?: current.pin?.at ?: return@launch
                val place = (repository.placePreview(located.latitude, located.longitude) as? NetworkResult.Success)?.data
                _state.update { it.copy(pin = ComposePin(located.latitude, located.longitude, takenAt, capture = true), place = place) }
            }
        }

        fun setText(text: String) {
            _state.update { it.copy(text = text.take(MAX_TEXT)) }
        }

        fun setBackground(background: MomentCardBackground) {
            _state.update { it.copy(background = background) }
        }

        /** P2's Next: the text card pins at the fresh fix. */
        fun textNext() {
            if (_state.value.text.isBlank()) return
            _state.update { it.copy(media = null, pin = it.here, place = it.herePlace, step = ComposeStep.Review, notice = null) }
        }

        /** P3's Retake (a photo or video) or Edit (a text card). */
        fun backFromReview() {
            requestId = java.util.UUID.randomUUID().toString()
            val current = _state.value
            current.media?.file?.delete()
            _state.update {
                it.copy(media = null, step = if (current.media == null) ComposeStep.Text else ComposeStep.Camera, notice = null)
            }
        }

        fun setHours(hours: Int) = _state.update { it.copy(hours = hours) }

        fun setAudience(audience: String) = _state.update { it.copy(audience = audience) }

        fun setShowArea(on: Boolean) = _state.update { it.copy(showArea = on) }

        fun setCaption(caption: String) = _state.update { it.copy(caption = caption.take(MAX_CAPTION)) }

        fun clearNotice() = _state.update { it.copy(notice = null) }

        /** A short notice over the camera ("Couldn't take the photo."), gone after a few seconds. */
        fun showNotice(message: String) {
            _state.update { it.copy(notice = message) }
            viewModelScope.launch {
                kotlinx.coroutines.delay(NOTICE_MS)
                _state.update { if (it.notice == message) it.copy(notice = null) else it }
            }
        }

        /** Post: makes the Moment now (so its location is checked while fresh); a photo or video then uploads. */
        fun post(retried: Boolean = false) {
            val current = _state.value
            if (current.posting) return
            val pin = current.pin ?: return
            _state.update { it.copy(posting = true, notice = null) }
            viewModelScope.launch {
                // A fix older than about 4 minutes is read again: the server takes one no older than 5.
                val usable =
                    if (!pin.capture && Instant.now().toEpochMilli() - pin.at.toEpochMilli() > FIX_REFRESH_MS) {
                        locations.newFix()?.let { ComposePin(it.latitude, it.longitude, it.at, capture = false) } ?: pin
                    } else {
                        pin
                    }
                val body =
                    CreateMomentBody(
                        kind = current.kind,
                        hours = current.hours,
                        audience = current.audience,
                        showArea = current.showArea,
                        caption = current.caption.trim().takeIf { it.isNotEmpty() && current.media != null },
                        text = current.text.trim().takeIf { current.media == null },
                        background = current.background.wire.takeIf { current.media == null },
                        location =
                            MomentLocationBody(
                                source = if (usable.capture) "capture" else "gps",
                                latitude = usable.latitude,
                                longitude = usable.longitude,
                                fixAt = usable.at.toString().takeIf { !usable.capture },
                                takenAt = usable.at.toString().takeIf { usable.capture },
                            ),
                        clientRequestId = requestId,
                    )
                when (val result = repository.create(body)) {
                    is NetworkResult.Success -> {
                        val moment = result.data
                        val media = current.media
                        if (media != null) {
                            posting.start(moment, media, moment.latitude ?: usable.latitude, moment.longitude ?: usable.longitude)
                        } else {
                            posting.posted(moment)
                        }
                        choices
                            .edit()
                            .putInt("$accountId.hours", current.hours)
                            .putString("$accountId.audience", current.audience)
                            .apply()
                        _state.update { it.copy(posting = false, done = true) }
                    }
                    is NetworkResult.Failure -> handlePostFailure(result.error, retried)
                }
            }
        }

        private fun handlePostFailure(
            error: NetworkError,
            retried: Boolean,
        ) {
            _state.update { it.copy(posting = false) }
            when (error.serverCode) {
                "ADULT_CONFIRM_REQUIRED" -> _state.update { it.copy(gate = ComposeGate.NeedsAdult) }
                "AGE_NOT_ELIGIBLE" -> _state.update { it.copy(gate = ComposeGate.NotEligible) }
                "LOCATION_TOO_OLD" ->
                    if (!retried) {
                        viewModelScope.launch {
                            locations.newFix()?.let { fix ->
                                _state.update { it.copy(pin = ComposePin(fix.latitude, fix.longitude, fix.at, capture = false)) }
                                post(retried = true)
                            } ?: _state.update { it.copy(notice = NO_FIX) }
                        }
                    } else {
                        _state.update { it.copy(notice = NO_FIX) }
                    }
                "CAPTURE_TOO_OLD" -> _state.update { it.copy(notice = TOO_OLD) }
                "MOMENTS_DAILY_LIMIT" -> _state.update { it.copy(notice = "You've posted 20 Moments today. Try again tomorrow.") }
                "MEDIA_TOO_LONG" -> _state.update { it.copy(notice = "Videos can be up to 30 seconds.") }
                else -> _state.update { it.copy(notice = error.message) }
            }
        }

        override fun onCleared() {
            // A capture that was never posted doesn't stay on the phone.
            val current = _state.value
            if (!current.done) current.media?.file?.delete()
            super.onCleared()
        }

        private companion object {
            const val MAX_TEXT = 200
            const val MAX_CAPTION = 100
            const val CHOICES_PREFS = "pantopus.moments.post"
            const val DEFAULT_HOURS = 24
            val ALLOWED_HOURS = setOf(1, 6, 24, 48)
            val ALLOWED_AUDIENCES = setOf("nearby", "connections")
            const val FIX_REFRESH_MS = 4 * 60 * 1000L
            const val DURATION_SLACK_MS = 500L
            const val NOTICE_MS = 4_000L
            const val NO_FIX = "We couldn't find where you are. Try again in a moment."
            const val TOO_OLD = "That was taken more than a day ago. Moments are for the last 24 hours."
        }
    }
