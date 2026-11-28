package app.pantopus.android.data.moments.sound

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.data.pulse.StudioRepository
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

/** One sound made in the Studio: its .m4a, how long it is, and whether it is the wind-cleaned copy. */
data class MomentsStudioRecording(
    val file: File,
    val durationMs: Long,
    val cleaned: Boolean,
    /** The samples as heard, kept on the phone until posting so "Clean the wind" can be undone. */
    val heard: MomentSoundSamples,
)

/**
 * The Studio's sounds waiting for their Moment (CONTRACT 7e), place sound and whisper dots' whispers: they can only go
 * up once `POST /api/moments` has made it.
 * The Studio puts them here; the compose screen hands over the Moment it made ([send]); leaving the compose screen
 * without posting drops them ([clear]). They are sent only while the switch is on for the author and never under a
 * made-up name ("A made-up name can't carry sound: a voice tells who you are."). Nothing here is sent anywhere else.
 */
object MomentsStudioSounds {
    private val _place = MutableStateFlow<MomentsStudioRecording?>(null)

    /** Three seconds of place sound, while one is kept. */
    val place: StateFlow<MomentsStudioRecording?> = _place.asStateFlow()

    private val _whispers = MutableStateFlow<Map<String, MomentsStudioRecording>>(emptyMap())

    /** A whisper dot's three seconds, by the dot's id (CONTRACT 7c, 7e): a whisper dot goes out only with one. */
    val whispers: StateFlow<Map<String, MomentsStudioRecording>> = _whispers.asStateFlow()

    @Volatile private var app: Context? = null

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun setPlace(
        context: Context,
        recording: MomentsStudioRecording?,
    ) {
        app = context.applicationContext
        val old = _place.value
        _place.value = recording
        if (old != null && old.file != recording?.file) old.file.delete()
    }

    fun setWhisper(
        context: Context,
        dot: String,
        recording: MomentsStudioRecording?,
    ) {
        app = context.applicationContext
        val old = _whispers.value[dot]
        _whispers.value = if (recording == null) _whispers.value - dot else _whispers.value + (dot to recording)
        if (old != null && old.file != recording?.file) old.file.delete()
    }

    /** Leaving the compose screen without posting: nothing waits any more. */
    fun clear() {
        _place.value?.file?.delete()
        _place.value = null
        _whispers.value.values.forEach { it.file.delete() }
        _whispers.value = emptyMap()
    }

    /**
     * The Moment was made: its sounds go up now, in the background (the person is already on their way). Called by
     * the compose screen with the Moment it made, whether the author posts under a made-up name ([madeUp]) and whether
     * the switch reads on for them ([on]); either one stops every sound (and drops it).
     */
    fun send(
        moment: MomentDto,
        madeUp: Boolean,
        on: Boolean,
    ) {
        val place = _place.value
        // Only whispers whose dot went out with the Moment (the server keeps the app's dot ids).
        val sent = moment.dots.orEmpty().map { it.id }.toSet()
        val whispers = _whispers.value
        _place.value = null
        _whispers.value = emptyMap()
        if (place == null && whispers.isEmpty()) return
        val context = app
        val going = whispers.filterKeys { it in sent }
        whispers.filterKeys { it !in sent }.values.forEach { it.file.delete() }
        if (!on || madeUp || context == null) {
            place?.file?.delete()
            going.values.forEach { it.file.delete() }
            return
        }
        val entry = EntryPointAccessors.fromApplication(context, MomentSoundEntryPoint::class.java)
        scope.launch {
            val refused = mutableListOf<Pair<String, String>>()
            place?.let { sound ->
                upload(entry, moment.id, sound, MomentSoundDto.PLACE, null)?.let { refused += "Your place sound" to it }
                sound.file.delete()
            }
            going.forEach { (dot, sound) ->
                upload(entry, moment.id, sound, MomentSoundDto.WHISPER, dot)?.let { refused += "Your whisper" to it }
                sound.file.delete()
            }
            val first = refused.firstOrNull() ?: return@launch
            val what = if (refused.size == 1) "${first.first} wasn't added." else "Some of your sound wasn't added."
            tell(context, "$what ${first.second}")
        }
    }

    /** One sound's upload, tried once more on a lost connection or a busy server; the server's words when it says no. */
    private suspend fun upload(
        entry: MomentSoundEntryPoint,
        momentId: String,
        recording: MomentsStudioRecording,
        kind: String,
        dot: String?,
    ): String? {
        var answer = once(entry, momentId, recording, kind, dot)
        if (answer is NetworkResult.Failure && answer.error.passing()) {
            delay(RETRY_MS)
            answer = once(entry, momentId, recording, kind, dot)
        }
        val error = (answer as? NetworkResult.Failure)?.error ?: return null
        if (error.serverCode == StudioRepository.SWITCH_OFF) entry.pulseReinvented().refusedOff()
        return when (error.serverCode) {
            "PEN_NAME_NO_SOUND" -> "A made-up name can't carry sound: a voice tells who you are."
            "MOMENT_ENDED" -> "The Moment had already ended."
            StudioRepository.SWITCH_OFF -> "Sound isn't available on your account right now."
            else -> error.message
        }
    }

    private suspend fun once(
        entry: MomentSoundEntryPoint,
        momentId: String,
        recording: MomentsStudioRecording,
        kind: String,
        dot: String?,
    ): NetworkResult<*> =
        safeApiCall {
            val text = "text/plain".toMediaType()
            entry.soundApi().upload(
                id = momentId,
                file = MultipartBody.Part.createFormData("file", "sound.m4a", recording.file.asRequestBody("audio/mp4".toMediaType())),
                kind = kind.toRequestBody(text),
                durationMs = recording.durationMs.toString().toRequestBody(text),
                cleaned = if (recording.cleaned) "true".toRequestBody(text) else null,
                dot = dot?.toRequestBody(text),
            )
        }

    private fun NetworkError.passing(): Boolean =
        this is NetworkError.Transport || this is NetworkError.Server || this == NetworkError.RetriesExhausted || code == HTTP_TIMEOUT

    private fun tell(
        context: Context,
        words: String,
    ) {
        Handler(Looper.getMainLooper()).post { Toast.makeText(context, words, Toast.LENGTH_LONG).show() }
    }

    private const val RETRY_MS = 1_500L
    private const val HTTP_TIMEOUT = 408
}
