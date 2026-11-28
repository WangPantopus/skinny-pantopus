package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.CreateMomentBody
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.pulse.PulseReinventedFeature
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.screens.moments.compose.floats
import app.pantopus.android.ui.screens.moments.studio.studioPair
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * What the open Studio adds to the Moment it makes for "Pulse, reinvented" phase 3 ("together and back outside",
 * CONTRACT 8; iPhone's `TogetherStudio.swift`): what the Studio was opened for (a frame for someone's Retake, 8e) and the
 * person's own choices in the drawer (start a Retake, join tonight's sky, start a pinboard). Each rides the create
 * request as one more key ([TogetherCreate]). Only while the switch is on, and only for the Studio on screen: today's
 * Post screen never shows the rows, so it never sends any of this, and with nothing chosen the request is exactly
 * today's.
 */
internal object TogetherStudio {
    /** What the Studio was opened for, from a screen of this build's own. */
    sealed interface Context {
        /** Add a frame to a Retake (8e): its first picture is a ghost to line up with. */
        data class RetakeFrame(
            val startId: String,
            val title: String,
            val ghost: String?,
        ) : Context

        /** Answer an Eyes-on Ask with a Live photo (8f). */
        data class EyesOnAnswer(
            val askId: String,
            val question: String,
        ) : Context

        /** Add a piece to a pinboard (8i): a photo, one per person. */
        data class PinboardPiece(
            val startId: String,
            val prompt: String,
        ) : Context
    }

    /** Set just before the Studio opens ([openFor]); dropped with the Studio's screen. */
    val context = mutableStateOf<Context?>(null)

    /** The Retake's first picture over the Studio's own while adding a frame (on by default; one tap hides it). */
    val ghostOn = mutableStateOf(true)

    /** "Join tonight's sky" (8h): on by default where it is offered, one tap to leave out. */
    val joinsSky = mutableStateOf(true)

    /** "Start a Retake" and its name (1 to 60 characters). */
    val startsRetake = mutableStateOf(false)
    val retakeTitle = mutableStateOf("")

    /** "Start a pinboard" and its prompt (1 to 80 characters, 8i). */
    val startsPinboard = mutableStateOf(false)
    val pinboardPrompt = mutableStateOf("")

    /** The Studio's screen holding the choices: set by its stage ([TogetherStudioGhost]); null while none shows. */
    @Volatile internal var owner: TogetherStudioViewModel? = null

    /** The Studio's stage is on screen (today's Post screen never draws it). */
    val staged = mutableStateOf(false)

    /** A Studio asked for by [openFor] that Pulse hasn't opened yet, with when it was asked. */
    val opening = mutableStateOf<Long?>(null)

    /** Pulse has opened the Studio for [context]: the next Studio screen claims it ([TogetherStudioViewModel]). */
    @Volatile internal var pending = false

    /** Opens the Studio for [context]: Pulse opens it once whatever was in front of it has closed ([TogetherStudioOpener]). */
    fun openFor(context: Context) {
        reset()
        this.context.value = context
        opening.value = System.currentTimeMillis()
    }

    fun reset() {
        context.value = null
        ghostOn.value = true
        joinsSky.value = true
        startsRetake.value = false
        retakeTitle.value = ""
        startsPinboard.value = false
        pinboardPrompt.value = ""
        opening.value = null
        pending = false
    }

    /** The keys this Studio adds to the Moment it makes, or empty for today's request. */
    fun fields(state: MomentsComposeUiState): Map<String, Any> {
        if (owner?.switchOn != true || !staged.value) return emptyMap()
        val opened = context.value ?: return ownChoices(state)
        return openedFor(opened, state)
    }

    /** What the Studio was opened for, from another screen of this build's own. */
    private fun openedFor(
        opened: Context,
        state: MomentsComposeUiState,
    ): Map<String, Any> {
        // One photo as taken: a before and after (7g) is two pictures side by side, never a frame or a start.
        val photo = state.media is MomentMediaFile.Photo && state.studioPair == null
        return when (opened) {
            // Only a photo joins a Retake; a text card or a video posts as an ordinary Moment.
            is Context.RetakeFrame -> if (photo) mapOf("retake_of" to opened.startId) else emptyMap()
            // An Eyes-on answer is a Live photo (8f); anything else posts as an ordinary Moment.
            is Context.EyesOnAnswer -> if (photo) mapOf("eyes_on_for" to opened.askId) else emptyMap()
            // A pinboard's piece is a photo (8i); it may also join tonight's sky. Anything else posts as an ordinary Moment.
            is Context.PinboardPiece ->
                buildMap {
                    if (photo) put("pinboard_of", opened.startId)
                    if (joinsSky.value && state.offersSky) put("join_convergence", true)
                }
        }
    }

    /** The person's own choices in the drawer of a Studio opened from Pulse's + or the camera. */
    private fun ownChoices(state: MomentsComposeUiState): Map<String, Any> {
        val title = retakeTitle.value.trim().take(TITLE_MAX)
        val starts = startsRetake.value && title.isNotEmpty() && state.offersRetake
        val prompt = pinboardPrompt.value.trim().take(PROMPT_MAX)
        val board = startsPinboard.value && prompt.isNotEmpty() && state.offersPinboard
        return buildMap {
            if (starts) put("retake", mapOf("title" to title))
            // The server decides whether a window is open; only a photo the author let join may join one.
            if (joinsSky.value && state.offersSky) put("join_convergence", true)
            if (board) put("pinboard", mapOf("prompt" to prompt))
        }
    }

    const val TITLE_MAX = 60
    const val PROMPT_MAX = 80

    /** A Studio asked for longer ago than this is not opened any more (Pulse wasn't there to open it). */
    const val OPENING_MS = 15_000L
}

/**
 * "Start a Retake" may be chosen (8e): one photo with an exact place, taken now, away from home, under the person's own
 * name, not a guess spot, not a Pulse post. The server checks again (`400 RETAKE_INVALID`).
 */
internal val MomentsComposeUiState.offersRetake: Boolean
    get() =
        media is MomentMediaFile.Photo && studioPair == null && pickedTogether <= 1 && !noLocationOn && pin != null &&
            !floats && shareLaterKey == null && !madeUp && !guess && studioPostKind(StudioPostState.draft.value) == null &&
            place?.atHome != true

/**
 * "Join tonight's sky" may be offered (8h): a photo with an exact place shared with people nearby (a piece counts only
 * those), away from home, under the person's own name, not shared later, not a guess spot or a Pulse post.
 */
internal val MomentsComposeUiState.offersSky: Boolean
    get() =
        media is MomentMediaFile.Photo && studioPair == null && audience == "nearby" && !noLocationOn && pin != null &&
            !floats && shareLaterKey == null && !madeUp && !guess && studioPostKind(StudioPostState.draft.value) == null &&
            place?.atHome != true

/**
 * "Start a pinboard" may be chosen (8i): one photo under the person's own name, not a guess spot, not a Pulse post. The
 * server checks again (`400 PINBOARD_INVALID`).
 */
internal val MomentsComposeUiState.offersPinboard: Boolean
    get() =
        media is MomentMediaFile.Photo && studioPair == null && pickedTogether <= 1 && !madeUp && !guess &&
            studioPostKind(StudioPostState.draft.value) == null

/**
 * Holds the Studio's phase 3 choices for the screen it belongs to ([TogetherStudio.owner]), with what sends them. When the
 * switch goes off the choices go at once (the Studio then gives way to today's Post screen on the same composer); when the
 * Studio's screen closes, they go with it.
 */
@HiltViewModel
class TogetherStudioViewModel
    @Inject
    constructor(
        private val feature: PulseReinventedFeature,
        internal val repository: TogetherRepository,
        internal val moshi: Moshi,
    ) : ViewModel() {
        internal val switchOn: Boolean get() = feature.on.value
        val on: StateFlow<Boolean> = feature.on

        init {
            TogetherStudio.owner = this
            // Only the Studio Pulse opened for a Retake's frame adds one; any other Studio starts with nothing chosen.
            if (!TogetherStudio.pending) TogetherStudio.context.value = null
            TogetherStudio.pending = false
            TogetherStudio.opening.value = null
            viewModelScope.launch {
                feature.on.collect { on -> if (!on) TogetherStudio.reset() }
            }
        }

        override fun onCleared() {
            if (TogetherStudio.owner === this) {
                TogetherStudio.owner = null
                TogetherStudio.reset()
            }
        }
    }

/**
 * `POST /api/moments` for a Moment made in the Studio ([TogetherStudio]): null, so the caller sends exactly today's
 * request, unless the switch is on, the Studio's stage is on screen and it chose something of phase 3; then the same body
 * (Moshi's own adapter for [CreateMomentBody]) with those keys beside its own. A retry of the same Post builds the same keys;
 * a Moment made with them drops the choices. Route `backend/routes/moments.js` (create).
 */
object TogetherCreate {
    suspend fun create(
        body: CreateMomentBody,
        state: MomentsComposeUiState,
    ): NetworkResult<MomentDto>? {
        val owner = TogetherStudio.owner ?: return null
        val fields = TogetherStudio.fields(state)
        if (fields.isEmpty()) return null
        @Suppress("UNCHECKED_CAST")
        val base = owner.moshi.adapter(CreateMomentBody::class.java).toJsonValue(body) as? Map<String, Any?> ?: return null
        // Left out where today's request leaves a key out (a null is never written).
        val result = owner.repository.createMoment(base.filterValues { it != null } + fields)
        if (result is NetworkResult.Success) TogetherStudio.reset()
        return result
    }
}
