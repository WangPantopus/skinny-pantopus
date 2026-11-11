@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.compose

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.CreateMomentBody
import app.pantopus.android.data.api.models.moments.MomentLocationBody
import app.pantopus.android.data.api.models.moments.MomentPlaceChoiceDto
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
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import app.pantopus.android.ui.screens.compose.pulse.MediaLocationAccess
import app.pantopus.android.ui.screens.compose.pulse.readPickedPlace
import app.pantopus.android.ui.screens.moments.MomentsRoutes
import app.pantopus.android.ui.screens.moments.components.MomentCardBackground
import app.pantopus.android.ui.screens.moments.components.takenLabel
import app.pantopus.android.ui.screens.moments.components.takenLongAgo
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

/**
 * A venue picked in the place picker (the Pulse composer's, around the pin): the Moment pins at it under its name.
 * Only its id goes to the server, which finds it again near the pin (contract v3.3 `venue_id`).
 */
data class MomentVenue(
    val placeId: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
)

/** How far from the pin the place picker's venues may be when the server doesn't say (contract v3.3). */
internal const val DEFAULT_PICK_WITHIN_M = 1500

/** What the chip says at home (board P4: the Post sheet's "Your home"). */
internal const val HOME_CHIP = "Your home"

/** What the chip and the place row say for a Moment with no location. */
internal const val NO_LOCATION = "No location"

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
    /** A problem to show on the sheet or the camera ("Couldn't open that file."). */
    val notice: String? = null,
    /** Done: close posting (the Moment is up, or uploading in the background). */
    val done: Boolean = false,
    /** A library photo hides where it was taken: ask once for `ACCESS_MEDIA_LOCATION`, as the Pulse composer does. */
    val askMediaLocation: Boolean = false,
    /** The place's name picked on the Post sheet (a key from [MomentPlacePreviewDto.places]); null: the automatic one. */
    val placeKey: String? = null,
    /** When the album photo or video was taken (any time); null for the camera, a text card, or a file that never said. */
    val takenAt: Instant? = null,
    /** A venue picked in the place picker; null: the name from [placeKey] or the automatic one. */
    val venue: MomentVenue? = null,
    /** The place picker (search and the places around the pin) is open. */
    val findingPlace: Boolean = false,
    /** "Don't show where" (founder 2026-11-11): no pin, not on the map, connections only. */
    val noLocation: Boolean = false,
    /** Whether you have a connection (place-preview's `has_connections`); null until known. */
    val hasConnections: Boolean? = null,
) {
    val kind: String
        get() =
            when (media) {
                is MomentMediaFile.Photo -> "photo"
                is MomentMediaFile.Video -> "video"
                null -> "text"
            }

    /**
     * The camera's and the card's chip: where it will pin, or "Your home" at home, as the Post sheet says (others read
     * the town, never the place the home sits at).
     */
    val chipPlace: String?
        get() =
            when {
                here == null && gate == ComposeGate.Open -> NO_LOCATION
                herePlace?.atHome == true -> HOME_CHIP
                else -> herePlace?.placeLabel
            }

    /** The names that fit the pin, the automatic one first (contract v3); empty from a server without them. */
    val placeChoices: List<MomentPlaceChoiceDto> get() = place?.places.orEmpty()

    /** More than one name fits an exact pin away from home: the place row opens the list. */
    val canPickPlace: Boolean get() = !showArea && !noLocationOn && place?.atHome != true && placeChoices.size > 1

    /** The picked name, while it is still one of [placeChoices]. */
    val pickedPlace: MomentPlaceChoiceDto? get() = placeKey?.let { key -> placeChoices.firstOrNull { it.key == key } }

    /** A name picked stays only while the Moment pins at the same spot (Retake and Edit keep it, a new spot drops it). */
    fun placeKeyFor(newPin: ComposePin?): String? = placeKey?.takeIf { samePin(newPin) }

    /** A venue picked stays only while the Moment pins at the same spot, like [placeKeyFor]. */
    fun venueFor(newPin: ComposePin?): MomentVenue? = venue?.takeIf { samePin(newPin) }

    private fun samePin(newPin: ComposePin?): Boolean =
        pin != null && newPin != null && pin.latitude == newPin.latitude && pin.longitude == newPin.longitude

    /** No location: switched on, or there's no pin at all (location off and nothing in the file). */
    val noLocationOn: Boolean get() = noLocation || pin == null

    /** With no pin at all the switch stays on: there's nowhere to pin the Moment. */
    val noLocationLocked: Boolean get() = pin == null

    /** An exact pin can name a venue from the place picker (around the photo's spot, or where you are). */
    val canFindPlace: Boolean get() = !showArea && pin != null && !noLocationOn

    /** The venue that names the Moment: only for an exact pin. */
    val pickedVenue: MomentVenue? get() = venue?.takeIf { !showArea }

    /** How far from the pin the picker's places may be (the server's number, else 1500 m). */
    val pickWithinM: Int get() = place?.pickWithinM ?: DEFAULT_PICK_WITHIN_M

    /** "Taken Oct 3" on the Post sheet: an album photo or video taken more than a day ago (everyone will see it). */
    val takenLine: String? get() = takenAt?.takeIf { media != null && takenLongAgo(it) }?.let { takenLabel(it) }
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
                                hasConnections = preview.data.hasConnections ?: it.hasConnections,
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

        /**
         * "Post with no location" on the location card: the camera, the library and a text card work as usual, and the
         * Moment goes to your connections only, with no pin (founder 2026-11-11). Needs a connection and the 18+ answer.
         */
        fun continueWithoutLocation() {
            viewModelScope.launch {
                when (val preview = repository.postingPreview()) {
                    is NetworkResult.Success -> {
                        val info = preview.data
                        if (info.hasConnections == false) {
                            _state.update { it.copy(hasConnections = false, notice = NEEDS_CONNECTION) }
                            return@launch
                        }
                        _state.update {
                            it.copy(
                                here = null,
                                herePlace = null,
                                noLocation = true,
                                hasConnections = info.hasConnections ?: it.hasConnections,
                                gate = if (info.adultConfirmed) ComposeGate.Open else ComposeGate.NeedsAdult,
                                notice = null,
                            )
                        }
                    }
                    is NetworkResult.Failure -> _state.update { it.copy(notice = preview.error.message) }
                }
            }
        }

        /** The Post sheet's "Don't show where". It can't come off when there's no pin; it needs a connection. */
        fun setNoLocation(on: Boolean) =
            _state.update {
                when {
                    !on && it.noLocationLocked -> it
                    on && it.hasConnections == false -> it.copy(notice = NEEDS_CONNECTION)
                    else -> it.copy(noLocation = on, notice = null)
                }
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
        fun captured(
            media: MomentMediaFile,
            takenAt: Instant? = null,
        ) {
            val current = _state.value
            _state.update {
                it.copy(
                    media = media,
                    pin = current.here,
                    place = current.herePlace,
                    placeKey = it.placeKeyFor(current.here),
                    venue = it.venueFor(current.here),
                    takenAt = takenAt,
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
         * hides where things were taken), from any time (founder, 2026-11-11): it pins where it was taken when the file
         * says, and one taken more than a day ago says when on the Moment.
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
                // A file that never says when it was taken posts like one taken now (no date on the Moment).
                val takenAt = capture.takenAt
                val media = if (video) MomentMediaFile.Video(copy, duration, recordedHere = false) else MomentMediaFile.Photo(copy)
                val lat = capture.latitude
                val lng = capture.longitude
                if (lat != null && lng != null) {
                    val pin = ComposePin(lat, lng, takenAt ?: Instant.now(), capture = true)
                    val place = (repository.placePreview(lat, lng) as? NetworkResult.Success)?.data
                    _state.update {
                        it.copy(
                            media = media,
                            pin = pin,
                            place = place,
                            hasConnections = place?.hasConnections ?: it.hasConnections,
                            placeKey = it.placeKeyFor(pin),
                            venue = it.venueFor(pin),
                            takenAt = takenAt,
                            step = ComposeStep.Review,
                            caption = "",
                            notice = null,
                        )
                    }
                } else {
                    // Android hides where it was taken, or the file never said: it pins where you are, as the sheet shows.
                    captured(media, takenAt)
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
                val pin = ComposePin(located.latitude, located.longitude, takenAt, capture = true)
                _state.update {
                    it.copy(
                        pin = pin,
                        place = place,
                        placeKey = it.placeKeyFor(pin),
                        venue = it.venueFor(pin),
                        takenAt = it.takenAt ?: located.capturedAt,
                    )
                }
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
            _state.update {
                it.copy(
                    media = null,
                    pin = it.here,
                    place = it.herePlace,
                    placeKey = it.placeKeyFor(it.here),
                    venue = it.venueFor(it.here),
                    takenAt = null,
                    step = ComposeStep.Review,
                    notice = null,
                )
            }
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

        /** A name from the place list: the first (automatic) one goes back to no pick. */
        fun pickPlace(key: String) =
            _state.update { current ->
                current.copy(placeKey = if (key == current.placeChoices.firstOrNull()?.key) null else key, venue = null)
            }

        /** The place row's "Find a place": search and the places around the pin (the Pulse composer's picker). */
        fun findPlace(open: Boolean) = _state.update { it.copy(findingPlace = open && it.canFindPlace) }

        /**
         * A place picked in the picker: a venue near the pin names the Moment and moves its pin there (the server finds
         * it again by its id). The town or an address isn't a venue: those rows aren't offered (see the sheet).
         */
        fun pickVenue(tag: PostPlaceTag) {
            val id = tag.placeId?.takeIf { it.startsWith("osm:") } ?: return
            _state.update {
                it.copy(venue = MomentVenue(id, tag.name, tag.latitude, tag.longitude), placeKey = null, findingPlace = false)
            }
        }

        /** "Remove location" in the picker: back to the name the spot gets by itself. */
        fun clearVenue() = _state.update { it.copy(venue = null, findingPlace = false) }

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
            if (current.noLocationOn) return postWithoutLocation(current)
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
                        // Only a name picked for an exact pin away from home goes: the server works the list out again.
                        placeKey = current.pickedPlace?.key?.takeIf { current.canPickPlace && current.pickedVenue == null },
                        // An album item pinned where you are says when it was taken (a capture pin carries its own).
                        takenAt = current.takenAt?.toString()?.takeIf { current.media != null && !usable.capture },
                        venueId = current.pickedVenue?.placeId,
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

        /** A Moment with no location: connections only, no pin, no place (contract v3.4). */
        private fun postWithoutLocation(current: MomentsComposeUiState) {
            _state.update { it.copy(posting = true, notice = null) }
            viewModelScope.launch {
                val body =
                    CreateMomentBody(
                        kind = current.kind,
                        hours = current.hours,
                        audience = "connections",
                        showArea = false,
                        caption = current.caption.trim().takeIf { it.isNotEmpty() && current.media != null },
                        text = current.text.trim().takeIf { current.media == null },
                        background = current.background.wire.takeIf { current.media == null },
                        location = MomentLocationBody(source = "none"),
                        clientRequestId = requestId,
                        takenAt = current.takenAt?.toString()?.takeIf { current.media != null },
                    )
                when (val result = repository.create(body)) {
                    is NetworkResult.Success -> {
                        val moment = result.data
                        val media = current.media
                        if (media != null) posting.start(moment, media, null, null) else posting.posted(moment)
                        choices.edit().putInt("$accountId.hours", current.hours).apply()
                        _state.update { it.copy(posting = false, done = true) }
                    }
                    is NetworkResult.Failure -> handlePostFailure(result.error, retried = true)
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
                "PLACE_NOT_NEARBY" -> _state.update { it.copy(venue = null, notice = FAR_PLACE) }
                "NO_CONNECTIONS" -> _state.update { it.copy(hasConnections = false, noLocation = false, notice = NEEDS_CONNECTION) }
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
            const val FAR_PLACE = "That place is too far from this Moment's pin. Pick one nearby."
            const val NEEDS_CONNECTION = "A Moment with no location goes only to your connections. Add a connection first."
        }
    }
