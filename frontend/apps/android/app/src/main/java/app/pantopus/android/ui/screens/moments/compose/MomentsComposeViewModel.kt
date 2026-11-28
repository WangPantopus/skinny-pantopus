@file:Suppress("MagicNumber", "TooManyFunctions", "TooGenericExceptionCaught", "LargeClass")

package app.pantopus.android.ui.screens.moments.compose

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.provider.MediaStore
import androidx.compose.ui.unit.IntSize
import androidx.core.content.FileProvider
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.CreateMomentBody
import app.pantopus.android.data.api.models.moments.MomentAltitudeBody
import app.pantopus.android.data.api.models.moments.MomentDotDto
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentLocationBody
import app.pantopus.android.data.api.models.moments.MomentPlaceChoiceDto
import app.pantopus.android.data.api.models.moments.MomentPlacePreviewDto
import app.pantopus.android.data.api.models.moments.MomentPlayItemDto
import app.pantopus.android.data.api.models.moments.MomentSeriesDto
import app.pantopus.android.data.api.models.moments.MomentStampPlacement
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.location.HeightReading
import app.pantopus.android.data.moments.MomentBeforeAfterPicture
import app.pantopus.android.data.moments.MomentHeight
import app.pantopus.android.data.moments.MomentLimits
import app.pantopus.android.data.moments.MomentMedia
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.moments.MomentPhotostrip
import app.pantopus.android.data.moments.MomentsPosting
import app.pantopus.android.data.moments.MomentsRepository
import app.pantopus.android.data.moments.PreparedVideo
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.data.plans.PlanGpsFix
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.pulse.PulseReinventedFeature
import app.pantopus.android.sharein.shareInFile
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import app.pantopus.android.ui.screens.compose.pulse.MediaLocationAccess
import app.pantopus.android.ui.screens.compose.pulse.PickedPlace
import app.pantopus.android.ui.screens.compose.pulse.readPickedPlace
import app.pantopus.android.ui.screens.feed.living.livingHeading
import app.pantopus.android.ui.screens.feed.reinvented.after.TogetherCreate
import app.pantopus.android.ui.screens.feed.reinvented.after.sentExplore
import app.pantopus.android.ui.screens.moments.MomentsRoutes
import app.pantopus.android.ui.screens.moments.components.MomentCardBackground
import app.pantopus.android.ui.screens.moments.components.line
import app.pantopus.android.ui.screens.moments.components.takenLabel
import app.pantopus.android.ui.screens.moments.components.takenLongAgo
import app.pantopus.android.ui.screens.moments.compose.marks.MomentCutout
import app.pantopus.android.ui.screens.moments.compose.marks.MomentCutoutLift
import app.pantopus.android.ui.screens.moments.compose.marks.MomentCutoutStore
import app.pantopus.android.ui.screens.moments.compose.marks.MomentLook
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarks
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarksEditing
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarksKeeper
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarksPainter
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarksTool
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacement
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacementPainter
import app.pantopus.android.ui.screens.moments.compose.marks.shape
import app.pantopus.android.ui.screens.moments.map.metersBetween
import app.pantopus.android.ui.screens.moments.studio.StudioMention
import app.pantopus.android.ui.screens.moments.studio.StudioMotion
import app.pantopus.android.ui.screens.moments.studio.StudioPair
import app.pantopus.android.ui.screens.moments.studio.holdsStudioChoices
import app.pantopus.android.ui.screens.moments.studio.sentBackdrop
import app.pantopus.android.ui.screens.moments.studio.sentDots
import app.pantopus.android.ui.screens.moments.studio.sentGuess
import app.pantopus.android.ui.screens.moments.studio.sentMentions
import app.pantopus.android.ui.screens.moments.studio.sentPlay
import app.pantopus.android.ui.screens.moments.studio.sentStamps
import app.pantopus.android.ui.screens.moments.studio.sentWhole
import app.pantopus.android.ui.screens.moments.studio.stampElevation
import app.pantopus.android.ui.screens.moments.studio.studioPair
import app.pantopus.android.ui.screens.moments.studio.studioTrimmedParts
import app.pantopus.android.ui.screens.moments.studio.wholeMoved
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Instant
import javax.inject.Inject

/** As many photos and videos as can be picked together in the library. */
const val MOMENTS_PICK_LIMIT = 10

/** Which part of posting shows (boards P1 to P4). */
enum class ComposeStep { Camera, Text, Review }

/** Where the Moment pins: the phone's fresh fix, or where a library item was taken. */
data class ComposePin(
    val latitude: Double,
    val longitude: Double,
    /** The fix's time (`gps`) or the capture time (`capture`). */
    val at: Instant,
    val capture: Boolean,
    /** How high the fix, or the library photo, says this is; read only where "Show elevation" may be offered. */
    val height: HeightReading? = null,
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

/**
 * The Live mark (API v4.1): when the in-app camera took the photo or finished the video, and the fix the draft pinned at
 * then. A Moment says "taken here" only while that is still true for the pin it is sent with (both phones, 2026-11-20).
 */
data class CameraShot(
    val at: Instant,
    val latitude: Double,
    val longitude: Double,
) {
    /** No more than 10 minutes since the shot, and the pin sent within 150 m of the fix it had then. */
    fun holdsFor(
        pin: ComposePin,
        now: Instant,
    ): Boolean =
        now.toEpochMilli() - at.toEpochMilli() <= LIVE_SHOT_MS &&
            metersBetween(latitude, longitude, pin.latitude, pin.longitude) <= LIVE_SHOT_M

    companion object {
        /** How long after the shot a Moment may still say "taken here". */
        const val LIVE_SHOT_MS = 10 * 60 * 1000L

        /** How far the pin sent may be from the fix at the shot. */
        const val LIVE_SHOT_M = 150.0
    }
}

/** How far from the pin the place picker's venues may be when the server doesn't say (contract v3.3). */
internal const val DEFAULT_PICK_WITHIN_M = 1500

/** What the chip says at home (board P4: the Post sheet's "Your home"). */
internal const val HOME_CHIP = "Your home"

/** What the chip and the place row say for a Moment with no location. */
internal const val NO_LOCATION = "No location"

/** A video made ready to post: its file (or its parts' files), or why it can't be posted. */
private sealed interface VideoReady {
    data class Ready(
        val videos: List<PreparedVideo>,
    ) : VideoReady

    data class Failed(
        val message: String,
    ) : VideoReady
}

/** Worth another try: no connection, a timeout, the server busy or briefly failing. */
private fun NetworkError.isPassing(): Boolean =
    this is NetworkError.Transport || this is NetworkError.Server || this == NetworkError.RetriesExhausted || code == 408 || code == 429

/** Before anything can be captured: location, then the one-time 18+ confirmation (contract v2). */
enum class ComposeGate { Locating, NeedsLocation, NeedsAdult, NotEligible, Open }

data class MomentsComposeUiState(
    val gate: ComposeGate = ComposeGate.Locating,
    /** A photo or video shared from another app is on its way to the Post screen: the camera isn't asked for meanwhile. */
    val sharedWaiting: Boolean = false,
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
    /** Several picked together: how many, and which one the sheet is on (1 first); 0 for one on its own. */
    val pickedTogether: Int = 0,
    val pickedAt: Int = 0,
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
    /** "Show elevation" (board H1): the Moment says how high above sea level it was made. Kept for your next Moments. */
    val showHeight: Boolean = false,
    /** What a Moment may be (contract v3.11), read as posting opens; an older server's until then. */
    val limits: MomentLimits = MomentLimits(),
    /** How many Moments the video on the sheet posts as: a library video longer than one Moment goes in parts. */
    val videoParts: Int = 1,
    /** Post is waiting for the video to be made ready: how far along, 0 to 1; null while it isn't waiting. */
    val readying: Float? = null,
    /** The Sky (`MomentsComposeSky.kt`, while the preview answers `sky: true`): "Pin it at a place" is on. */
    val pinsAtPlace: Boolean = false,
    /** The Sky's "Share later": the choice picked (`1h`, `3h`, `tonight`); null posts now. */
    val shareLaterKey: String? = null,
    /** Text and Draw: the marks drawn into the photo on the sheet, kept to change again. */
    val marks: MomentMarks = MomentMarks(),
    /** Resize: where the photo sits on the 9:16 canvas it posts as; null while it is as taken. */
    val placement: MomentPlacement? = null,
    /** The marks editor while it is open. */
    val marking: MomentMarksEditing? = null,
    /**
     * The Live mark (API v4.1): the photo or video on the sheet came from the in-app camera (when, and the fix it pinned at
     * then); null for the album, a text card, and once 10 minutes have passed or Post found the pin had moved on.
     */
    val shot: CameraShot? = null,
    /** "Show the weather": on unless this person turned it off last time (kept per account on this phone). */
    val showWeather: Boolean = true,
    /**
     * "Pulse, reinvented"'s Studio: under the person's made-up name. People nearby only, with a place; no height, no
     * Live mark, no weather (made-up-names contract, "Moments"). Only the Studio sets it.
     */
    val madeUp: Boolean = false,
    /** "Pulse, reinvented"'s Studio: the stamps placed on the picture (CONTRACT 2b). Only the Studio sets them. */
    val stamps: List<MomentStampPlacement> = emptyList(),
    /** "Pulse, reinvented"'s Studio: "Guess the spot" picked (CONTRACT 5a). Only the Studio sets it. */
    val guess: Boolean = false,
    /** "Pulse, reinvented"'s Studio: people picked after "@" in the caption (CONTRACT 7h). Only the Studio sets it. */
    val mentions: List<StudioMention> = emptyList(),
    /** "Pulse, reinvented"'s Studio: before and after (CONTRACT 7g). Only the Studio sets it. */
    val pair: StudioPair? = null,
    /** "Pulse, reinvented"'s Studio: Illuminate's dots (CONTRACT 7c). Only the Studio sets them. */
    val dots: List<MomentDotDto> = emptyList(),
    /** "Pulse, reinvented"'s Studio: playable items placed on the picture (CONTRACT 7b, 7k). Only the Studio sets them. */
    val items: List<MomentPlayItemDto> = emptyList(),
    /** "Pulse, reinvented"'s Studio (PHASE-5 A, CONTRACT 10c): the photo posts whole, on these colours. Only the Studio sets it. */
    val whole: Boolean = false,
    val wholeBackdrop: MomentPlacementPainter.Backdrop? = null,
    /** "Pulse, reinvented"'s Studio (PHASE-5 A): the part of the video that posts, in ms; null is all of it. Only the Studio sets it. */
    val trim: LongRange? = null,
) {
    val kind: String
        get() =
            when (media) {
                is MomentMediaFile.Photo -> "photo"
                is MomentMediaFile.Video -> "video"
                null -> "text"
            }

    /**
     * Retake, Edit and Back can leave the Post sheet: not while a Post is making its Moment, whose upload needs the photo
     * or video on the sheet. A video still getting ready can be left (no Moment yet: Post just stops waiting).
     */
    val canRetake: Boolean get() = !posting || readying != null

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
    val canPickPlace: Boolean get() = !sky && !showArea && !noLocationOn && place?.atHome != true && placeChoices.size > 1

    /** The picked name, while it is still one of [placeChoices]. */
    val pickedPlace: MomentPlaceChoiceDto? get() = placeKey?.let { key -> placeChoices.firstOrNull { it.key == key } }

    /** A name picked stays only while the Moment pins at the same spot (Retake and Edit keep it, a new spot drops it). */
    fun placeKeyFor(newPin: ComposePin?): String? = placeKey?.takeIf { samePin(newPin) }

    /** A venue picked stays only while the Moment pins at the same spot, like [placeKeyFor]. */
    fun venueFor(newPin: ComposePin?): MomentVenue? = venue?.takeIf { samePin(newPin) }

    /** The Sky's "Pin it at a place" stays on only while the Moment pins at the same spot, like [venueFor]. */
    fun pinsAtPlaceFor(newPin: ComposePin?): Boolean = pinsAtPlace && samePin(newPin)

    private fun samePin(newPin: ComposePin?): Boolean =
        pin != null && newPin != null && pin.latitude == newPin.latitude && pin.longitude == newPin.longitude

    /** No location: switched on, or there's no pin at all (location off and nothing in the file). */
    val noLocationOn: Boolean get() = noLocation || pin == null

    /** With no pin at all the switch stays on: there's nowhere to pin the Moment. */
    val noLocationLocked: Boolean get() = pin == null

    /** An exact pin can name a venue from the place picker (around the photo's spot, or where you are). */
    val canFindPlace: Boolean get() = (if (sky) place?.canPin == true else !showArea) && pin != null && !noLocationOn

    /** The venue that names the Moment: only for an exact pin. */
    val pickedVenue: MomentVenue? get() = venue?.takeIf { !showArea }

    /** How far from the pin the picker's places may be (the server's number, else 1500 m). */
    val pickWithinM: Int get() = place?.pickWithinM ?: DEFAULT_PICK_WITHIN_M

    /** "Taken Oct 3" on the Post sheet: an album photo or video taken more than a day ago (everyone will see it). */
    val takenLine: String? get() = takenAt?.takeIf { media != null && takenLongAgo(it) }?.let { takenLabel(it) }

    /** The feet the "Show elevation" row shows and everyone will read; null with no reading the server would keep. */
    val heightFeet: Int?
        get() = pin?.height?.let { MomentHeight.feet(it.meters, it.accuracyMeters, it.speedMps, step = if (sky && floats) 100 else 10) }

    /**
     * The "Show elevation" row is on the sheet: only where the server allows it (heights are on for you and the spot
     * isn't your home), for an exact pin, with a reading. Never for an area or with no location.
     */
    val offersHeight: Boolean
        get() = place?.canShowHeight == true && (sky || !showArea) && !noLocationOn && heightFeet != null && !madeUp

    /** What goes with the post: the reading, only while the row is on the sheet and switched on. */
    val shownHeight: MomentAltitudeBody?
        get() = pin?.height?.takeIf { offersHeight && showHeight }?.let { MomentAltitudeBody(it.meters, it.accuracyMeters, it.speedMps) }

    /**
     * The Live line (board L1, API v4.1): a photo or video the camera just took, pinned at the fix, shown at its exact
     * pin and known to be away from home: where the server keeps the mark. Never for the album, an area, a floating
     * Moment, no location, or at home (nor when the preview couldn't say whether this is home). Post checks [shot] again
     * against the pin it sends ([liveFor]).
     */
    val offersLive: Boolean
        get() =
            shot != null && media != null && pin?.capture == false && takenAt == null && !noLocationOn && !floats &&
                place?.atHome == false && !madeUp

    /** "31°F · Snow" for "Show the weather": the preview's reading at the fix, while the Live line shows; null without one. */
    val weatherLine: String? get() = place?.weather?.takeIf { offersLive }?.line()?.first

    /** What goes with the post: `show_weather` only while the row is on the sheet (so with the Live line) and switched on. */
    val sendsWeather: Boolean get() = weatherLine != null && showWeather

    /** `taken_here` for the pin being sent now: the Live line shows and the shot still holds for that pin. */
    fun liveFor(
        sent: ComposePin,
        now: Instant,
    ): Boolean = offersLive && shot?.holdsFor(sent, now) == true

    /** `show_weather` for the pin being sent now: only with `taken_here`. */
    fun weatherFor(
        sent: ComposePin,
        now: Instant,
    ): Boolean = sendsWeather && liveFor(sent, now)
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
        private val pulse: PulseReinventedFeature,
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
                    showHeight = choices.getBoolean("$accountId.showHeight", false),
                    showWeather = choices.getBoolean("$accountId.showWeather", true),
                ),
            )
        val state: StateFlow<MomentsComposeUiState> = _state.asStateFlow()

        init {
            // Shared from another app: taken once nothing stands before taking, picking or writing (where you are,
            // then 18+), exactly as if picked from the library. Each of several is its own Moment.
            val shared =
                savedState.get<String>(MomentsRoutes.SHARED_KEY).orEmpty().split(',').mapNotNull { name ->
                    shareInFile(context, name)?.let { FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", it) }
                }
            if (shared.isNotEmpty()) {
                _state.update { it.copy(sharedWaiting = true) }
                viewModelScope.launch {
                    _state.first { it.gate == ComposeGate.Open }
                    picked(shared)
                    // On the Post screen, or it couldn't be opened and a notice says so: the camera is the camera again.
                    _state.first { it.step == ComposeStep.Review || it.notice != null }
                    _state.update { it.copy(sharedWaiting = false) }
                }
            }
        }

        /** Your photo, for the pin on the Post sheet. */
        val avatarUrl: String? get() = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.avatarUrl

        /** One id per Moment being posted: a retry of the same Post gets back the Moment it made (contract v2+). */
        private var requestId: String = java.util.UUID.randomUUID().toString()

        /** Ends the sheet's Live line 10 minutes after the camera's shot ([endLiveAfter]). */
        private var liveTimer: Job? = null

        /** The limits, read once as posting opens (contract v3.11); the state carries them for the camera and the sheet. */
        private val limitsRead: Deferred<MomentLimits> =
            viewModelScope.async { repository.limits().also { read -> _state.update { it.copy(limits = read) } } }

        /** The limits, waiting a little for the server's answer; what is known so far when it is slow. */
        private suspend fun limits(): MomentLimits = withTimeoutOrNull(LIMITS_WAIT_MS) { limitsRead.await() } ?: _state.value.limits

        /**
         * The video on the sheet being made ready to post, from the moment it lands there: sized to fit an upload, split
         * into parts when it is longer than one Moment, each with its poster and frames. Post waits for it, so a Moment is
         * never made for a video that can't be sent.
         */
        private var preparation: Deferred<VideoReady>? = null

        /** What [preparation] made, until Post hands it to the upload (or it's dropped and its files deleted). */
        private var readyVideos: List<PreparedVideo>? = null

        /** How far [preparation] has come, 0 to 1. */
        private var readyProgress = 0f

        /** Text and Draw's photo as it came, the editor's copy of it, and the marks being drawn into the one that posts. */
        private val marksKeeper = MomentMarksKeeper(context, viewModelScope)

        /** The marks editor's picture, once read. */
        val marksPicture: StateFlow<Bitmap?> = marksKeeper.picture

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
                // Without the weather: the pin and the camera never wait on it (it's asked once a camera draft lands).
                when (val preview = repository.placePreview(here.latitude, here.longitude)) {
                    is NetworkResult.Success -> {
                        val height = fixHeightFor(preview.data)
                        _state.update {
                            it.copy(
                                here = here.copy(height = height),
                                herePlace = preview.data,
                                hasConnections = preview.data.hasConnections ?: it.hasConnections,
                                gate = if (preview.data.adultConfirmed) ComposeGate.Open else ComposeGate.NeedsAdult,
                                notice = null,
                            )
                        }
                    }
                    is NetworkResult.Failure ->
                        // The chip can do without a name; the server checks everything again on Post.
                        _state.update { it.copy(here = here, gate = ComposeGate.Open, notice = null) }
                }
            }
        }

        /**
         * How high the fix just taken says the phone is, read only where the server says "Show elevation" may be offered:
         * while heights are off for the person, nothing new runs.
         */
        private suspend fun fixHeightFor(place: MomentPlacePreviewDto?): HeightReading? =
            if (place?.canShowHeight == true) locations.fixHeight() else null

        /** The library photo's own height, which goes with a pin where it was taken; read only where it may be shown. */
        private suspend fun photoHeightFor(
            place: MomentPlacePreviewDto?,
            picked: PickedPlace,
        ): HeightReading? = if (place?.canShowHeight == true) withContext(Dispatchers.IO) { picked.height } else null

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
            /** The in-app camera made it just now (the Live mark); an album item pinned here passes false. */
            fromCamera: Boolean = false,
        ) {
            forgetMarks()
            val current = _state.value
            val shot = current.here?.takeIf { fromCamera }?.let { CameraShot(Instant.now(), it.latitude, it.longitude) }
            _state.update {
                it.copy(
                    media = media,
                    pin = current.here,
                    place = current.herePlace,
                    placeKey = it.placeKeyFor(current.here),
                    venue = it.venueFor(current.here),
                    pinsAtPlace = it.pinsAtPlaceFor(current.here),
                    takenAt = takenAt,
                    shot = shot,
                    step = ComposeStep.Review,
                    caption = "",
                    notice = null,
                    videoParts = 1,
                )
            }
            prepare(media)
            liveTimer?.cancel()
            if (shot != null) {
                liveTimer = viewModelScope.launch { endLiveAfter(shot) }
                askWeather(shot, current.herePlace)
            }
        }

        /** The sheet's Live line and weather row go 10 minutes after the shot (Post checks the clock again). */
        private suspend fun endLiveAfter(shot: CameraShot) {
            kotlinx.coroutines.delay(CameraShot.LIVE_SHOT_MS)
            _state.update { if (it.shot == shot) it.copy(shot = null) else it }
        }

        /**
         * The weather "Show the weather" offers (API v4.1), asked once a camera draft lands on the sheet away from home,
         * with a preview at the fix it pins at; a retake at the same fix reuses it. Never at home, never for the album.
         */
        private fun askWeather(
            shot: CameraShot,
            herePlace: MomentPlacePreviewDto?,
        ) {
            if (herePlace?.atHome != false || herePlace.weather != null) return
            viewModelScope.launch {
                val preview = repository.placePreview(shot.latitude, shot.longitude, weather = true)
                val weather = (preview as? NetworkResult.Success)?.data?.weather ?: return@launch
                _state.update {
                    val sameFix = it.here?.latitude == shot.latitude && it.here?.longitude == shot.longitude
                    it.copy(
                        // Only the draft it was asked for; a retake meanwhile asks again.
                        place = if (it.shot == shot) it.place?.copy(weather = weather) else it.place,
                        herePlace = if (sameFix) it.herePlace?.copy(weather = weather) else it.herePlace,
                    )
                }
            }
        }

        /**
         * A video on the sheet starts getting ready to post at once, while the person picks its place, hours and caption:
         * exported to about 720p at a bit rate that fits the largest upload, in parts of equal length when it runs longer
         * than one Moment (contract v3.11), each with its poster and two frames. A photo is prepared as it uploads.
         */
        private fun prepare(media: MomentMediaFile) {
            dropPreparation()
            if (media !is MomentMediaFile.Video) return
            readyProgress = 0f
            // Text and Draw on the video go over every frame of every part, and so does where Resize placed it.
            val marks = _state.value.marks
            val placement = _state.value.placement
            // "Pulse, reinvented"'s Studio: only the trimmed part posts (null everywhere else: all of it, as today).
            val trim = _state.value.trim
            preparation =
                viewModelScope.async {
                    val limits = limits()
                    val parts = trim?.let { studioTrimmedParts(it, limits) } ?: MomentMedia.parts(media.durationMs, limits)
                    _state.update { if (it.media == media) it.copy(videoParts = parts.size) else it }
                    val made = mutableListOf<PreparedVideo>()
                    val ready =
                        try {
                            parts.forEachIndexed { at, part ->
                                // A video posted as one Moment is exported whole (the camera's may go up as it is).
                                val stretch = part.takeIf { parts.size > 1 || trim != null }
                                made +=
                                    MomentMedia.prepareVideo(context, media, stretch, limits.videoBytes, marks, placement) { done ->
                                        readyProgress = (at + done) / parts.size
                                        _state.update { if (it.readying != null) it.copy(readying = readyProgress) else it }
                                    }
                            }
                            // Said here, before any Moment is made, not after the upload is refused.
                            if (made.any { it.video.length() > limits.videoBytes }) VideoReady.Failed(TOO_LARGE) else VideoReady.Ready(made)
                        } catch (cancelled: CancellationException) {
                            made.forEach { deleteFiles(it, keep = media.file) }
                            throw cancelled
                        } catch (failure: Exception) {
                            timber.log.Timber.tag("Moments").w(failure, "couldn't prepare the video")
                            VideoReady.Failed(NOT_READY)
                        }
                    if (ready is VideoReady.Ready) readyVideos = ready.videos else made.forEach { deleteFiles(it, keep = media.file) }
                    ready
                }
        }

        /** The video's preparation is no longer wanted (Retake, another item, closing): it stops and its files go. */
        private fun dropPreparation() {
            preparation?.cancel()
            preparation = null
            readyVideos?.forEach { deleteFiles(it, keep = _state.value.media?.file) }
            readyVideos = null
        }

        private fun deleteFiles(
            video: PreparedVideo,
            keep: java.io.File?,
        ) {
            runCatching {
                (listOf(video.video, video.poster) + video.frames).filter { it != keep }.forEach { it.delete() }
            }
        }

        /**
         * Post waits for the video's preparation, showing how far along it is: the videos ready to upload, or null with
         * the reason on the sheet (too large to post, or it couldn't be read).
         */
        private suspend fun awaitVideo(media: MomentMediaFile.Video): List<PreparedVideo>? {
            if (preparation == null) prepare(media)
            val job = preparation ?: return null
            _state.update { it.copy(readying = readyProgress) }
            val ready =
                try {
                    job.await()
                } catch (cancelled: CancellationException) {
                    // Retake or another item while Post waited: the sheet is free again.
                    _state.update { it.copy(posting = false, readying = null) }
                    throw cancelled
                }
            // Retake in the instant the video got ready (before this resumed): that Post ends here too, no Moment made.
            if (_state.value.media != media) {
                _state.update { it.copy(posting = false, readying = null) }
                return null
            }
            _state.update { it.copy(readying = null) }
            return when (ready) {
                is VideoReady.Ready -> ready.videos
                is VideoReady.Failed -> {
                    // One that couldn't be read is tried again on the next Post; one too large stays too large.
                    if (ready.message != TOO_LARGE) preparation = null
                    _state.update { it.copy(posting = false, notice = ready.message) }
                    null
                }
            }
        }

        /** The library item last picked, to read its place again once Android lets the app see it. */
        private var pickedSource: Pair<Uri, String>? = null

        /**
         * A photo or video from the library, from any time (founder, 2026-11-11): it pins where it was taken when the
         * file says, and one taken more than a day ago says when on the Moment. Android's photo picker (the library
         * since 2026-11-11, for its Albums tab) never says where: its item pins where you are, and the place row and
         * "Don't show where" on the sheet change that. A phone without the photo picker picks from the document picker,
         * which says where once Android lets the app read it.
         */
        fun picked(uri: Uri) = picked(listOf(uri))

        /**
         * Several picked together in the photo picker (founder, 2026-11-11): each is its own Moment. The first takes
         * the Post sheet; when it has posted, the next takes it with its own place and caption, under the same "How
         * long" and "Who sees it" ([postedOne]). Back from the sheet drops the ones still waiting.
         */
        fun picked(uris: List<Uri>) {
            val first = uris.firstOrNull() ?: return
            waiting = uris.drop(1).take(MOMENTS_PICK_LIMIT - 1)
            viewModelScope.launch {
                val opened = open(first)
                if (opened) {
                    _state.update { it.copy(pickedTogether = waiting.size + 1, pickedAt = 1) }
                } else {
                    waiting = emptyList()
                }
            }
        }

        /** The ones picked together that haven't had the sheet yet. */
        private var waiting: List<Uri> = emptyList()

        /**
         * A Moment was made for the one on the sheet: the next one picked with it takes the sheet (one that can't be
         * opened is passed over), or with none left the composer closes.
         */
        private fun postedOne() {
            viewModelScope.launch {
                requestId = java.util.UUID.randomUUID().toString()
                while (waiting.isNotEmpty()) {
                    val next = waiting.first()
                    waiting = waiting.drop(1)
                    if (open(next)) {
                        _state.update {
                            it.copy(
                                posting = false,
                                pickedAt = it.pickedTogether - waiting.size,
                                stamps = emptyList(),
                                guess = false,
                            )
                        }
                        return@launch
                    }
                }
                _state.update { it.copy(posting = false, done = true) }
            }
        }

        /**
         * A library video of [durationMs] can be posted: as one Moment, or as several up to the server's number of them
         * (contract v3.11). One longer says so ("Videos can be up to 5 minutes.").
         */
        private suspend fun fitsLibrary(durationMs: Long): Boolean {
            val limits = limits()
            if (MomentMedia.fits(durationMs, limits)) return true
            _state.update { it.copy(notice = limits.tooLongMessage) }
            return false
        }

        /** Puts one library item on the Post sheet; false when it can't be opened or runs too long (a notice says so). */
        private suspend fun open(uri: Uri): Boolean {
            val video = MomentMedia.isVideo(context, uri)
            val mime = context.contentResolver.getType(uri) ?: if (video) "video/mp4" else "image/jpeg"
            val copy = MomentMedia.copyIn(context, uri, if (video) "mp4" else "jpg")
            if (copy == null) {
                _state.update { it.copy(notice = "Couldn't open that file.") }
                return false
            }
            val duration = if (video) MomentMedia.videoDurationMs(copy) else 0L
            if (video && !fitsLibrary(duration)) {
                copy.delete()
                return false
            }
            val picked = withContext(Dispatchers.IO) { readPickedPlace(context, uri, mime) }
            val capture = MomentMedia.capture(context, uri, copy, video, picked.captured, picked.mayBeHidden)
            // A file that never says when it was taken posts like one taken now (no date on the Moment).
            val takenAt = capture.takenAt
            val media = if (video) MomentMediaFile.Video(copy, duration, recordedHere = false) else MomentMediaFile.Photo(copy)
            val lat = capture.latitude
            val lng = capture.longitude
            if (lat != null && lng != null) {
                val place = (repository.placePreview(lat, lng) as? NetworkResult.Success)?.data
                val pin = ComposePin(lat, lng, takenAt ?: Instant.now(), capture = true, height = photoHeightFor(place, picked))
                forgetMarks()
                _state.update {
                    it.copy(
                        media = media,
                        // From the album: never the Live mark.
                        shot = null,
                        pin = pin,
                        place = place,
                        hasConnections = place?.hasConnections ?: it.hasConnections,
                        placeKey = it.placeKeyFor(pin),
                        venue = it.venueFor(pin),
                        pinsAtPlace = it.pinsAtPlaceFor(pin),
                        takenAt = takenAt,
                        step = ComposeStep.Review,
                        caption = "",
                        notice = null,
                        videoParts = 1,
                    )
                }
                prepare(media)
            } else {
                // Android hides where it was taken, or the file never said: it pins where you are, as the sheet shows.
                captured(media, takenAt)
                // A photo whose location Android hides can still pin where it was taken once the app may read it.
                // The photo picker's items never give it up, whatever is allowed: asking would get the person nothing.
                val couldRead = capture.hidden && !video && !fromPhotoPicker(uri)
                if (couldRead && MediaLocationAccess.mayAsk(context)) {
                    pickedSource = uri to mime
                    _state.update { it.copy(askMediaLocation = true) }
                }
            }
            return true
        }

        /** `content://media/picker/…`: an item Android's photo picker handed over. */
        private fun fromPhotoPicker(uri: Uri): Boolean =
            uri.authority == MediaStore.AUTHORITY && uri.pathSegments.firstOrNull()?.startsWith("picker") == true

        /** The answer to "Pin where this photo was taken?" (asked once on a phone). */
        fun mediaLocationAnswered() {
            MediaLocationAccess.markAsked(context)
            _state.update { it.copy(askMediaLocation = false) }
        }

        /** `ACCESS_MEDIA_LOCATION` was allowed: read the picked item's place again and pin it there. */
        fun rereadPickedPlace() {
            val (uri, mime) = pickedSource ?: return
            viewModelScope.launch {
                val picked = withContext(Dispatchers.IO) { readPickedPlace(context, uri, mime) }
                val located = picked.captured ?: return@launch
                val current = _state.value
                if (current.step != ComposeStep.Review || current.media == null) return@launch
                val takenAt = located.capturedAt ?: current.pin?.at ?: return@launch
                val place = (repository.placePreview(located.latitude, located.longitude) as? NetworkResult.Success)?.data
                val pin = ComposePin(located.latitude, located.longitude, takenAt, capture = true, height = photoHeightFor(place, picked))
                _state.update {
                    it.copy(
                        pin = pin,
                        place = place,
                        placeKey = it.placeKeyFor(pin),
                        venue = it.venueFor(pin),
                        pinsAtPlace = it.pinsAtPlaceFor(pin),
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
                    pinsAtPlace = it.pinsAtPlaceFor(it.here),
                    takenAt = null,
                    step = ComposeStep.Review,
                    notice = null,
                )
            }
        }

        /** P3's Retake (a photo or video) or Edit (a text card); never while a Post is making its Moment ([canRetake]). */
        fun backFromReview() {
            val current = _state.value
            if (!current.canRetake) return
            requestId = java.util.UUID.randomUUID().toString()
            dropPreparation()
            current.media?.file?.delete()
            marksKeeper.drop()
            // The ones picked with it that were still waiting go too.
            waiting = emptyList()
            _state.update {
                it.copy(
                    media = null,
                    marks = MomentMarks(),
                    placement = null,
                    marking = null,
                    step = if (current.media == null) ComposeStep.Text else ComposeStep.Camera,
                    notice = null,
                    pickedTogether = 0,
                    pickedAt = 0,
                    stamps = emptyList(),
                    guess = false,
                )
            }
        }

        /** The Post screen's Text, Draw or Resize pill: the editor opens on the marks (never while a Post is in flight). */
        fun openMarks(tool: MomentMarksTool) {
            val current = _state.value
            val media = current.media ?: return
            if (current.posting || current.marking != null) return
            _state.update { it.copy(marking = marksKeeper.editing(tool, it.marks, it.placement)) }
            marksKeeper.read(media) { _state.update { it.copy(marking = null, notice = MARKS_UNREADABLE) } }
        }

        /** A change in the open editor: a line drawn or undone, an ink or a width picked, the picture moved. */
        fun editMarks(change: (MomentMarksEditing) -> MomentMarksEditing) =
            _state.update { current -> current.marking?.let { current.copy(marking = change(it)) } ?: current }

        /**
         * The editor's Done ([keep]) or its X. Done draws the marks into a new copy of the photo (on the 9:16 canvas where
         * Resize placed it), which then posts (Post waits for it); the photo as it came is kept, to change them again. On a
         * video it exports the video again with the marks over every frame (and every part); Post waits for that as for any
         * video. Nothing changes under a Post in flight.
         */
        fun closeMarks(keep: Boolean) {
            val current = _state.value
            val editing = current.marking ?: return
            marksKeeper.closed(editing)
            val media = current.media?.takeIf { keep && !current.posting }
            if (media == null || (editing.result == current.marks && editing.placement == current.placement)) {
                _state.update { it.copy(marking = null) }
                return
            }
            _state.update { it.copy(marking = null, marks = editing.result, placement = editing.placement) }
            when (media) {
                is MomentMediaFile.Video -> prepare(media)
                is MomentMediaFile.Photo ->
                    marksKeeper.draw(
                        editing.result,
                        editing.placement,
                        media.file,
                        onDrawn = { file -> _state.update { it.copy(media = MomentMediaFile.Photo(file)) } },
                        onFailed = { drawn, placed -> _state.update { it.copy(marks = drawn, placement = placed, notice = MARKS_FAILED) } },
                    )
            }
        }

        /**
         * "Pulse, reinvented"'s Studio tray: a film look over the whole photo, drawn in with its marks from the photo as it
         * came (Original takes it off), as the editor's Done draws them. Never under a Post in flight or an open editor.
         */
        fun setLook(look: MomentLook) {
            val current = _state.value
            val media = current.media as? MomentMediaFile.Photo ?: return
            if (current.posting || current.marking != null || current.marks.look == look) return
            val marks = current.marks.copy(look = look)
            _state.update { it.copy(marks = marks) }
            marksKeeper.draw(
                marks,
                current.placement,
                media.file,
                onDrawn = { file -> _state.update { it.copy(media = MomentMediaFile.Photo(file)) } },
                onFailed = { drawn, placed -> _state.update { it.copy(marks = drawn, placement = placed, notice = MARKS_FAILED) } },
            )
        }

        /**
         * "Pulse, reinvented"'s Studio tray: the photostrip. The photo in the Studio (as Text, Draw and Resize left it) and
         * up to three photos picked with it that still wait, each cropped 4:3, one under the other on white, become one
         * picture and one Moment; the photos in the strip leave the queue (videos waiting stay). Its marks are drawn in.
         */

        /**
         * "Pulse, reinvented"'s Studio tray: before and after (CONTRACT 7g). The photo in the Studio (as Text, Draw and a
         * look left it) and the next photo picked with it that waits become one side-by-side picture and one Moment; the
         * after leaves the queue. Its words and drawings are drawn in; the before as drawn is kept for "Take apart".
         */
        fun beforeAfter() {
            val current = _state.value
            if (current.media !is MomentMediaFile.Photo || current.studioPair != null || current.placement != null) return
            if (current.posting || current.marking != null || current.marks.cutouts.isNotEmpty()) return
            viewModelScope.launch {
                if (marksKeeper.busy && !marksKeeper.awaitDrawn()) return@launch
                val shown = (_state.value.media as? MomentMediaFile.Photo)?.file ?: return@launch
                val next = waiting.firstOrNull { !MomentMedia.isVideo(context, it) } ?: return@launch
                val copy = MomentMedia.copyIn(context, next, "jpg")
                val made = copy?.let { withContext(Dispatchers.Default) { MomentBeforeAfterPicture.make(context, shown, it) } }
                copy?.let { runCatching { it.delete() } }
                if (made == null) {
                    _state.update { it.copy(notice = "Couldn't open the after photo. Try another one.") }
                    return@launch
                }
                waiting = waiting - next
                forgetMarks()
                val pair = StudioPair(made = made, before = shown, after = next)
                _state.update { it.copy(media = MomentMediaFile.Photo(made), pickedTogether = it.pickedTogether - 1, pair = pair) }
            }
        }

        /** "Pulse, reinvented"'s Studio tray: "Take apart". The before back (its words and drawings drawn in), the after next. */
        fun takeApartBeforeAfter() {
            val current = _state.value
            val pair = current.studioPair ?: return
            if (current.posting || current.marking != null) return
            waiting = listOf(pair.after) + waiting
            forgetMarks()
            runCatching { pair.made.delete() }
            _state.update { it.copy(media = MomentMediaFile.Photo(pair.before), pickedTogether = it.pickedTogether + 1, pair = null) }
        }

        /** "Pulse, reinvented"'s Studio: Illuminate's dots as they are now (added, written, moved, removed). */
        fun setDots(dots: List<MomentDotDto>) = _state.update { it.copy(dots = dots.take(MomentDotDto.MOST)) }

        /** "Pulse, reinvented"'s Studio: its playable items as they are now (added, moved, turned, removed). */
        fun setItems(items: List<MomentPlayItemDto>) = _state.update { it.copy(items = items) }

        /** "Pulse, reinvented"'s Studio (PHASE-5 A): only [range] of the video posts (null: all of it); it is exported again. */
        fun setTrim(range: LongRange?) {
            val current = _state.value
            val media = current.media as? MomentMediaFile.Video ?: return
            if (current.posting || current.marking != null || current.trim == range) return
            _state.update { it.copy(trim = range) }
            prepare(media)
        }

        /** "Pulse, reinvented"'s Studio (PHASE-5 A): the photo shows and posts whole, on [backdrop]'s two colours. */
        fun setWhole(backdrop: MomentPlacementPainter.Backdrop) =
            _state.update {
                val shown = it.media is MomentMediaFile.Photo || it.media is MomentMediaFile.Video
                if (shown) it.copy(whole = true, wholeBackdrop = backdrop) else it
            }

        /**
         * "Pulse, reinvented"'s Studio's first screen (PHASE-5 A): the whole photo of [picture] px (as it came) moved, sized,
         * turned or filled on the canvas ([next]), or whole as taken again (null). It is drawn in as Resize's Done draws it.
         */
        fun placeWhole(
            next: MomentPlacement?,
            picture: IntSize,
        ) {
            val current = _state.value
            val media = current.media ?: return
            if (!current.whole || current.posting || current.marking != null) return
            if (current.placement == next) return
            // Between whole as taken and the canvas, what lies on the photo moves with it, so it stays where it was.
            val moved = if ((current.placement == null) == (next == null)) current else current.wholeMoved(picture.shape, next == null)
            _state.update {
                it.copy(marks = moved.marks, stamps = moved.stamps, dots = moved.dots, items = moved.items, placement = next)
            }
            // A video is exported again where it is placed, as Resize's Done exports it (PHASE-5 A on a video).
            if (media is MomentMediaFile.Video) return prepare(media)
            marksKeeper.draw(
                moved.marks,
                next,
                media.file,
                onDrawn = { file -> _state.update { it.copy(media = MomentMediaFile.Photo(file)) } },
                onFailed = { drawn, placed -> _state.update { it.copy(marks = drawn, placement = placed, notice = MARKS_FAILED) } },
            )
        }

        /** "Pulse, reinvented"'s Studio tray: the two words over before and after's halves. */
        fun setPairWords(
            before: String,
            after: String,
        ) = _state.update { it.copy(pair = it.pair?.copy(beforeWords = before, afterWords = after)) }

        fun photostrip() {
            val current = _state.value
            if (current.media !is MomentMediaFile.Photo || waiting.isEmpty()) return
            if (current.posting || current.marking != null) return
            viewModelScope.launch {
                if (marksKeeper.busy && !marksKeeper.awaitDrawn()) return@launch
                val shown = (_state.value.media as? MomentMediaFile.Photo)?.file ?: return@launch
                val used = waiting.filterNot { MomentMedia.isVideo(context, it) }.take(MomentPhotostrip.MOST - 1)
                val copies = used.mapNotNull { MomentMedia.copyIn(context, it, "jpg") }
                val strip = withContext(Dispatchers.Default) { MomentPhotostrip.make(context, listOf(shown) + copies) }
                copies.forEach { runCatching { it.delete() } }
                if (strip == null) {
                    _state.update { it.copy(notice = "Couldn't make the strip.") }
                    return@launch
                }
                waiting = waiting - used.toSet()
                forgetMarks()
                runCatching { shown.delete() }
                _state.update { it.copy(media = MomentMediaFile.Photo(strip), pickedTogether = it.pickedTogether - used.size) }
            }
        }

        /**
         * "Pulse, reinvented"'s Studio: a long press on the photo at ([x], [y]), shares of the picture as shown, lifts the
         * thing there on the phone as a cutout where it was, and keeps it in "Your cutouts". Drawn in like every mark.
         */
        fun liftCutout(
            x: Float,
            y: Float,
        ) {
            val media = _state.value.media as? MomentMediaFile.Photo ?: return
            if (_state.value.posting || _state.value.marking != null) return
            viewModelScope.launch {
                marksKeeper.read(media) {}
                val picture = withTimeoutOrNull(CUTOUT_READ_MS) { marksKeeper.picture.filterNotNull().first() } ?: return@launch
                val now = _state.value
                val id = (now.marks.cutouts.maxOfOrNull { it.id } ?: 0) + 1
                val cutout = MomentCutoutLift.at(context, picture, now.placement, x, y, id)
                if (cutout == null) {
                    _state.update { it.copy(notice = "Nothing to lift there.") }
                    return@launch
                }
                withContext(Dispatchers.IO) { MomentCutoutStore.keep(context, accountId, cutout.image) }
                redrawStudio(now.marks.copy(cutouts = now.marks.cutouts + cutout))
            }
        }

        /** "Pulse, reinvented"'s Studio tray: one of "Your cutouts" in the middle of the photo. */
        fun placeCutout(file: java.io.File) {
            if (_state.value.media !is MomentMediaFile.Photo || _state.value.posting || _state.value.marking != null) return
            viewModelScope.launch {
                val image = withContext(Dispatchers.IO) { MomentCutoutStore.read(file) } ?: return@launch
                val now = _state.value
                val id = (now.marks.cutouts.maxOfOrNull { it.id } ?: 0) + 1
                redrawStudio(now.marks.copy(cutouts = now.marks.cutouts + MomentCutout(id, image, 0.5f, 0.5f, CUTOUT_PLACED_WIDTH)))
            }
        }

        /** The Studio's marks changed outside the editor: drawn into the photo as the editor's Done draws them. */
        private fun redrawStudio(marks: MomentMarks) {
            val media = _state.value.media as? MomentMediaFile.Photo ?: return
            _state.update { it.copy(marks = marks) }
            marksKeeper.draw(
                marks,
                _state.value.placement,
                media.file,
                onDrawn = { file -> _state.update { it.copy(media = MomentMediaFile.Photo(file)) } },
                onFailed = { drawn, placed -> _state.update { it.copy(marks = drawn, placement = placed, notice = MARKS_FAILED) } },
            )
        }

        /** "Pulse, reinvented"'s Studio tray: the photo as it came, read for the film looks' small copies ([marksPicture]). */
        fun readLookPicture() {
            val media = _state.value.media as? MomentMediaFile.Photo ?: return
            marksKeeper.read(media) {}
        }

        /** Another picture takes the sheet: it starts with no marks, as taken, and nothing kept for the last one stays. */
        private fun forgetMarks() {
            marksKeeper.drop()
            _state.update {
                it.copy(marks = MomentMarks(), placement = null, marking = null, whole = false, wholeBackdrop = null, trim = null)
            }
        }

        /** Post right after the editor's Done waits for the marks to be drawn in, so what uploads carries them. */
        private fun waitsForMarks(retried: Boolean): Boolean {
            if (!marksKeeper.busy) return false
            _state.update { it.copy(posting = true, notice = null) }
            viewModelScope.launch {
                val drawn = marksKeeper.awaitDrawn()
                _state.update { it.copy(posting = false) }
                if (drawn) post(retried)
            }
            return true
        }

        fun setHours(hours: Int) = _state.update { it.copy(hours = hours) }

        fun setAudience(audience: String) = _state.update { it.copy(audience = audience) }

        /**
         * The Studio's "Made-up name", or back to the person's own name. Under it: people nearby only, with a place. It
         * floats over its area (the founder, 2026-11-27); "Pin it at a place" stays the author's own choice in the drawer.
         */
        fun setMadeUp(on: Boolean) =
            _state.update {
                when {
                    on == it.madeUp -> it
                    on -> it.copy(madeUp = true, audience = "nearby", noLocation = false, showArea = it.showArea || !it.sky)
                    else -> it.copy(madeUp = false)
                }
            }

        fun setShowArea(on: Boolean) = _state.update { it.copy(showArea = on) }

        /** The Studio's stamps, moved, sized, turned, put on or taken off. */
        fun setStamps(stamps: List<MomentStampPlacement>) = _state.update { it.copy(stamps = stamps) }

        /** The Studio's "Guess the spot", on or off. */
        fun setGuess(on: Boolean) = _state.update { it.copy(guess = on) }

        /**
         * Today's Post screen takes the Moment from the Studio (the switch went off): the picture and the words stay; the
         * stamps, the made-up name and the mentions, which today's screens don't offer, go. Nothing changes when there were none.
         */
        fun leaveStudio() {
            val before = _state.value
            _state.update {
                if (!it.holdsStudioChoices) {
                    it
                } else {
                    it.copy(
                        stamps = emptyList(),
                        madeUp = false,
                        guess = false,
                        mentions = emptyList(),
                        pair = null,
                        dots = emptyList(),
                        items = emptyList(),
                        whole = false,
                        wholeBackdrop = null,
                    )
                }
            }
            heldToTodaysLabelBox(before)
        }

        /**
         * "Pulse, reinvented" (PHASE-6 I): words the Studio put beyond today's label box on its canvas come back into it once
         * when today's Post screen takes the Moment, and are drawn in again as the editor's Done draws them.
         */
        private fun heldToTodaysLabelBox(before: MomentsComposeUiState) {
            val placed = before.placement?.takeIf { before.whole } ?: return
            val canvas = MomentPlacement.CANVAS
            val labels =
                before.marks.labels.map { if (it.text.isBlank()) it else MomentMarksPainter.keptIn(it, canvas.width, canvas.height) }
            val held = before.marks.copy(labels = labels)
            if (held == before.marks) return
            _state.update { it.copy(marks = held) }
            when (val media = before.media) {
                is MomentMediaFile.Video -> prepare(media)
                is MomentMediaFile.Photo ->
                    marksKeeper.draw(
                        held,
                        placed,
                        media.file,
                        onDrawn = { file -> _state.update { it.copy(media = MomentMediaFile.Photo(file)) } },
                        onFailed = { drawn, place -> _state.update { it.copy(marks = drawn, placement = place, notice = MARKS_FAILED) } },
                    )
                null -> Unit
            }
        }

        /** The Sky's rows (`MomentsComposeSky.kt`). */
        fun setPinAtPlace(on: Boolean) = _state.update { it.withPinAtPlace(on) }

        fun setShareLater(on: Boolean) = _state.update { it.withShareLater(on) }

        fun pickShareLater(key: String) = _state.update { it.copy(shareLaterKey = key) }

        fun setShowHeight(on: Boolean) = _state.update { it.copy(showHeight = on) }

        /** "Show the weather" on the Post sheet (API v4.1). */
        fun setShowWeather(on: Boolean) = _state.update { it.copy(showWeather = on) }

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
                it.withVenue(MomentVenue(id, tag.name, tag.latitude, tag.longitude))
            }
        }

        /** "Remove location" in the picker: back to the name the spot gets by itself. */
        fun clearVenue() = _state.update { it.copy(venue = null, findingPlace = false, pinsAtPlace = false) }

        fun setCaption(caption: String) = _state.update { it.copy(caption = caption.take(MAX_CAPTION)) }

        /** "Pulse, reinvented"'s Studio: a person picked after "@" in the caption (sent while their "@Name" stays in it). */
        fun addMention(person: StudioMention) = _state.update { it.copy(mentions = (it.mentions + person).distinctBy { m -> m.id }) }

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
            if (current.posting || waitsForMarks(retried)) return
            if (current.noLocationOn) return postWithoutLocation(current)
            val pin = current.pin ?: return
            _state.update { it.copy(posting = true, notice = null) }
            viewModelScope.launch {
                // A video is ready first (sized, split into parts when long): no Moment for a file that can't be sent.
                val videos = (current.media as? MomentMediaFile.Video)?.let { awaitVideo(it) ?: return@launch }
                // A fix older than about 4 minutes is read again: the server takes one no older than 5.
                val usable =
                    if (!pin.capture && Instant.now().toEpochMilli() - pin.at.toEpochMilli() > FIX_REFRESH_MS) {
                        locations.newFix()?.let { freshPin(it, current.place) } ?: pin
                    } else {
                        pin
                    }
                val now = Instant.now()
                endLapsedLive(current, usable, now)
                val body =
                    CreateMomentBody(
                        kind = current.kind,
                        hours = current.hours,
                        audience = current.audience,
                        // Under the Sky a Moment at home says so too: should the server's switch go off meanwhile, it still
                        // shows only its area.
                        showArea = current.floats,
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
                        venueId = current.pickedVenue?.placeId?.takeIf { !current.sky || current.pinsHere },
                        // The height of the pin that is sent, while "Show elevation" is on the sheet and switched on.
                        altitude = current.copy(pin = usable).shownHeight,
                        // The Sky: pin at the place (the venue picked, else the one naming the spot), and "Share later".
                        pin = "place".takeIf { current.pinsHere },
                        shareLater = current.shareLaterChoice?.key,
                        // The Live mark and the weather stamp (API v4.1): only what the sheet showed, and only while the shot
                        // still holds for this pin (a re-read fix or the LOCATION_TOO_OLD retry included); the server checks again.
                        takenHere = true.takeIf { current.liveFor(usable, now) },
                        showWeather = true.takeIf { current.weatherFor(usable, now) },
                        postAs = "pen_name".takeIf { current.madeUp },
                        // The Studio's stamps that may show on this Moment, and the height for an elevation stamp.
                        stamps = current.sentStamps,
                        elevation = current.stampElevation(usable),
                        guess = current.sentGuess,
                        explore = current.sentExplore,
                        mentions = current.sentMentions,
                        play = current.sentPlay,
                        dots = current.sentDots,
                        // Live beams (CONTRACT 9h): the compass nearest this Moment's own shot, with the Live mark and switch on only.
                        heading = current.livingHeading(pulse.on.value, usable, now),
                        whole = current.sentWhole,
                        backdrop = current.sentBackdrop,
                    )
                if (publish(body, current, videos, usable.latitude to usable.longitude, retried)) {
                    saveChoices(current)
                    postedOne()
                }
            }
        }

        /**
         * Post found the camera's shot no longer holds for the pin it sends (over 10 minutes, or 150 m away): the Moment
         * goes without the mark, and the sheet's Live line and weather row go with it.
         */
        private fun endLapsedLive(
            current: MomentsComposeUiState,
            sent: ComposePin,
            now: Instant,
        ) {
            if (!current.offersLive || current.liveFor(sent, now)) return
            _state.update { if (it.shot == current.shot) it.copy(shot = null) else it }
        }

        /**
         * Makes the Moment and starts its upload: a text card is live at once. A video longer than one Moment is made as
         * its parts, in order, all now (contract v3.11): the same series on each, the caption on the first; they then go up
         * one after another. False when the server said no (the sheet says why; nothing is left half made).
         */
        private suspend fun publish(
            body: CreateMomentBody,
            current: MomentsComposeUiState,
            videos: List<PreparedVideo>?,
            pinned: Pair<Double, Double>?,
            retried: Boolean,
        ): Boolean {
            val media = current.media
            if (videos != null && videos.size > 1 && media is MomentMediaFile.Video) {
                return publishParts(body, media, videos, pinned, retried)
            }
            return when (val result = TogetherCreate.create(body, current) ?: repository.create(body)) {
                is NetworkResult.Success -> {
                    val moment = result.data
                    val video = videos?.firstOrNull()
                    when {
                        media == null -> posting.posted(moment)
                        video != null && media is MomentMediaFile.Video -> {
                            handOff(media, videos)
                            startUpload(moment, video, pinned)
                        }
                        else -> {
                            val latitude = pinned?.let { moment.latitude ?: it.first }
                            posting.start(moment, media, latitude, pinned?.let { moment.longitude ?: it.second })
                            // "Pulse, reinvented"'s Studio: a motion photo's kept clip follows its photo up (PHASE-5 C).
                            StudioMotion.posted(moment.id)
                            // The photo that posts carries its marks: the one as it came isn't needed any more.
                            marksKeeper.drop()
                        }
                    }
                    true
                }
                is NetworkResult.Failure -> {
                    handlePostFailure(result.error, retried)
                    false
                }
            }
        }

        /** The parts of a longer video, made in order; a part the server won't make undoes the ones made before it. */
        private suspend fun publishParts(
            body: CreateMomentBody,
            media: MomentMediaFile.Video,
            videos: List<PreparedVideo>,
            pinned: Pair<Double, Double>?,
            retried: Boolean,
        ): Boolean {
            val series = derivedId("$requestId:series")
            val made = mutableListOf<MomentDto>()
            for ((at, video) in videos.withIndex()) {
                val index = at + 1
                val part =
                    body.copy(
                        series = MomentSeriesDto(id = series, index = index, count = videos.size),
                        // Each part is its own Post: a retry of it gets back the part it made.
                        clientRequestId = if (index == 1) requestId else derivedId("$requestId:$index"),
                        caption = body.caption.takeIf { index == 1 },
                    )
                when (val result = createPart(part)) {
                    is NetworkResult.Success -> made += result.data
                    is NetworkResult.Failure -> {
                        undoParts(made, result.error, retried)
                        return false
                    }
                }
            }
            handOff(media, videos)
            made.zip(videos).forEach { (moment, video) -> startUpload(moment, video, pinned) }
            return true
        }

        /** A prepared video's upload: it goes up as it is (it's sized already), pinned where the server put the Moment. */
        private fun startUpload(
            moment: MomentDto,
            video: PreparedVideo,
            pinned: Pair<Double, Double>?,
        ) {
            val file = MomentMediaFile.Video(video.video, video.durationMs, recordedHere = true)
            posting.start(moment, file, pinned?.let { moment.latitude ?: it.first }, pinned?.let { moment.longitude ?: it.second }, video)
        }

        /** The same id from the same words each time: a part's retry key and the series id follow the Post's own. */
        private fun derivedId(seed: String): String = java.util.UUID.nameUUIDFromBytes(seed.toByteArray()).toString()

        /**
         * The server wouldn't make a part: nobody has seen the parts made before it (they wait for their files), so they
         * go and Post can be tapped again as a new Post. The first part's refusal is handled as any Moment's.
         */
        private suspend fun undoParts(
            made: List<MomentDto>,
            error: NetworkError,
            retried: Boolean,
        ) {
            if (made.isNotEmpty()) {
                made.forEach { repository.delete(it.id) }
                requestId = java.util.UUID.randomUUID().toString()
            }
            handlePostFailure(error, retried || made.isNotEmpty())
        }

        /** One part's `POST /api/moments`, tried again a couple of times while the connection or the server is failing. */
        private suspend fun createPart(body: CreateMomentBody): NetworkResult<MomentDto> {
            var result = repository.create(body)
            var tries = 1
            while (result is NetworkResult.Failure && result.error.isPassing() && tries < PART_TRIES) {
                kotlinx.coroutines.delay(PART_RETRY_MS * tries)
                result = repository.create(body)
                tries++
            }
            return result
        }

        /**
         * The video's prepared files now belong to the upload: the composer stops tracking them, and the picked copy goes
         * (each part is its own export) unless it uploads as it is.
         */
        private fun handOff(
            media: MomentMediaFile.Video,
            videos: List<PreparedVideo>,
        ) {
            preparation = null
            readyVideos = null
            if (videos.none { it.video == media.file }) runCatching { media.file.delete() }
        }

        /**
         * The next sheet opens with this one's "How long", "Who sees it", "Show elevation" and "Show the weather" (on this
         * phone, per account).
         */
        private fun saveChoices(posted: MomentsComposeUiState) {
            val saved = choices.edit().putInt("$accountId.hours", posted.hours).putString("$accountId.audience", posted.audience)
            // Only a sheet that offered the switch says what the person wants.
            if (posted.offersHeight) saved.putBoolean("$accountId.showHeight", posted.showHeight)
            if (posted.weatherLine != null) saved.putBoolean("$accountId.showWeather", posted.showWeather)
            saved.apply()
        }

        /** The pin for a fix taken again at Post, with its height where "Show elevation" may be offered. */
        private suspend fun freshPin(
            fix: PlanGpsFix,
            place: MomentPlacePreviewDto?,
        ) = ComposePin(fix.latitude, fix.longitude, fix.at, capture = false, height = fixHeightFor(place))

        /** A Moment with no location: connections only, no pin, no place (contract v3.4). */
        private fun postWithoutLocation(current: MomentsComposeUiState) {
            _state.update { it.copy(posting = true, notice = null) }
            viewModelScope.launch {
                val videos = (current.media as? MomentMediaFile.Video)?.let { awaitVideo(it) ?: return@launch }
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
                        shareLater = current.shareLaterChoice?.key,
                        mentions = current.sentMentions,
                        play = current.sentPlay,
                        dots = current.sentDots,
                        whole = current.sentWhole,
                        backdrop = current.sentBackdrop,
                    )
                if (publish(body, current, videos, pinned = null, retried = true)) {
                    choices.edit().putInt("$accountId.hours", current.hours).apply()
                    postedOne()
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
                                val pin = freshPin(fix, _state.value.place)
                                _state.update { it.copy(pin = pin) }
                                post(retried = true)
                            } ?: _state.update { it.copy(notice = NO_FIX) }
                        }
                    } else {
                        _state.update { it.copy(notice = NO_FIX) }
                    }
                "PLACE_NOT_NEARBY" -> _state.update { it.copy(venue = null, notice = FAR_PLACE) }
                // The Sky: no public place to pin at here (the switch goes back off), or "Tonight at 8" after 7 pm.
                "NO_PLACE_HERE", "SHARE_TIME_PASSED" -> _state.update { it.skyRefused(error.serverCode) }
                "NO_CONNECTIONS" -> _state.update { it.copy(hasConnections = false, noLocation = false, notice = NEEDS_CONNECTION) }
                "MOMENTS_DAILY_LIMIT" ->
                    _state.update { it.copy(notice = "You've posted ${it.limits.dailyLimit} Moments today. Try again tomorrow.") }
                "MEDIA_TOO_LONG" ->
                    _state.update { it.copy(notice = "A Moment's video can be up to ${it.limits.spoken(it.limits.videoMs)}.") }
                // "Pulse, reinvented": the Studio's post refused, the switch is off for this person now (CONTRACT 1).
                // Today's Post screen takes the Moment as it is, and Post goes again from there.
                "PULSE_REINVENTED_OFF" -> pulse.refusedOff()
                else -> _state.update { it.copy(notice = error.message) }
            }
        }

        override fun onCleared() {
            // A capture that was never posted doesn't stay on the phone, nor does what was made ready to post it.
            val current = _state.value
            if (!current.done) current.media?.file?.delete()
            marksKeeper.drop()
            preparation?.cancel()
            readyVideos?.forEach { deleteFiles(it, keep = null) }
            super.onCleared()
        }

        private companion object {
            const val MAX_TEXT = 200
            const val MAX_CAPTION = 100

            /** "Pulse, reinvented"'s Studio: how long a cutout waits for the photo to be read, and a placed one's width. */
            const val CUTOUT_READ_MS = 10_000L
            const val CUTOUT_PLACED_WIDTH = 0.4f
            const val CHOICES_PREFS = "pantopus.moments.post"
            const val DEFAULT_HOURS = 24
            val ALLOWED_HOURS = setOf(1, 6, 24, 48)
            val ALLOWED_AUDIENCES = setOf("nearby", "connections")
            const val FIX_REFRESH_MS = 4 * 60 * 1000L
            const val NOTICE_MS = 4_000L
            const val LIMITS_WAIT_MS = 5_000L
            const val PART_TRIES = 3
            const val PART_RETRY_MS = 1_500L
            const val TOO_LARGE = "This video is too large to post. Try a shorter one."
            const val NOT_READY = "Couldn't get that video ready to post. Try another one."
            const val NO_FIX = "We couldn't find where you are. Try again in a moment."
            const val FAR_PLACE = "That place is too far from this Moment's pin. Pick one nearby."
            const val NEEDS_CONNECTION = "A Moment with no location goes only to your connections. Add a connection first."
            const val MARKS_UNREADABLE = "Couldn't open this photo to draw on."
            const val MARKS_FAILED = "Couldn't make your changes to the photo. Try again."
        }
    }
