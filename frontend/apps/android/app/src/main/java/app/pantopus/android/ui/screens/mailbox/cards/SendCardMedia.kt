@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import android.net.Uri
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.CardMediaUploads
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File

/**
 * The card's own photo and voice greeting while it's written (memories plan steps 4 and 7), for [SendCardViewModel]:
 * each uploads as soon as it's added, with its own progress, into the [form]; a failure keeps the note and says why
 * ([message]), and nothing goes without it unless it's removed on purpose.
 */
class SendCardMedia(
    private val scope: CoroutineScope,
    private val media: CardMediaUploads,
    private val form: MutableStateFlow<SendCardForm>,
    private val message: (NetworkError, String) -> String,
) {
    private var photoJob: Job? = null

    /**
     * "Add a photo" or "Replace" (memories plan step 4): the picked photo, prepared on the phone (upright, at most
     * 1600 px, no EXIF), uploads at once with its progress. A failure keeps the note and says why.
     */
    fun addPhoto(uri: Uri) {
        photoJob?.cancel()
        val before = form.value.photo
        media.forget(before?.local)
        form.update { it.copy(photo = CardPhotoDraft(alt = before?.alt.orEmpty())) }
        photoJob =
            scope.launch {
                val prepared = media.preparePhoto(uri)
                if (prepared == null) {
                    form.update {
                        it.copy(photo = it.photo?.copy(failed = "We couldn’t read this photo. Try another one."))
                    }
                    return@launch
                }
                form.update {
                    it.copy(photo = it.photo?.copy(local = prepared.file, width = prepared.width, height = prepared.height))
                }
                uploadPhoto(prepared.file)
            }
    }

    /** "Try again" after a failed upload: the same prepared photo. */
    fun retryPhoto() {
        val local = form.value.photo?.local ?: return
        photoJob?.cancel()
        form.update { it.copy(photo = it.photo?.copy(failed = null, progress = 0f)) }
        photoJob = scope.launch { uploadPhoto(local) }
    }

    private suspend fun uploadPhoto(file: File) {
        val result =
            media.upload("photo", file, "image/jpeg") { done ->
                form.update { form -> if (form.photo?.local == file) form.copy(photo = form.photo.copy(progress = done)) else form }
            }
        form.update { form ->
            val photo = form.photo?.takeIf { it.local == file } ?: return@update form
            when (result) {
                is NetworkResult.Success ->
                    form.copy(
                        photo = photo.copy(stored = result.data, progress = 1f, width = result.data.width, height = result.data.height),
                    )
                is NetworkResult.Failure ->
                    form.copy(photo = photo.copy(failed = message(result.error, "upload your photo")))
            }
        }
    }

    /** "Remove": the card goes without a photo, on purpose. */
    fun removePhoto() {
        photoJob?.cancel()
        media.forget(form.value.photo?.local)
        form.update { it.copy(photo = null) }
    }

    private var voiceJob: Job? = null

    /** A greeting just recorded (memories plan step 7): it uploads at once with its progress. */
    fun addVoice(
        file: File,
        ranMs: Long,
    ) {
        voiceJob?.cancel()
        media.forget(form.value.voice?.local)
        form.update { it.copy(voice = CardVoiceDraft(local = file, durationMs = ranMs)) }
        voiceJob = scope.launch { uploadVoice(file) }
    }

    /** "Try again" after a failed upload: the same recording. */
    fun retryVoice() {
        val local = form.value.voice?.local ?: return
        voiceJob?.cancel()
        form.update { it.copy(voice = it.voice?.copy(failed = null, progress = 0f)) }
        voiceJob = scope.launch { uploadVoice(local) }
    }

    private suspend fun uploadVoice(file: File) {
        val result =
            media.upload("voice", file, "audio/mp4") { done ->
                form.update { form -> if (form.voice?.local == file) form.copy(voice = form.voice.copy(progress = done)) else form }
            }
        form.update { form ->
            val voice = form.voice?.takeIf { it.local == file } ?: return@update form
            when (result) {
                is NetworkResult.Success -> form.copy(voice = voice.copy(stored = result.data, progress = 1f))
                is NetworkResult.Failure ->
                    form.copy(voice = voice.copy(failed = message(result.error, "upload your greeting")))
            }
        }
    }

    /** "Remove": the card goes without a greeting, on purpose. */
    fun removeVoice() {
        voiceJob?.cancel()
        media.forget(form.value.voice?.local)
        form.update { it.copy(voice = null) }
    }

    /** The photo's description for screen readers, cut at [PHOTO_ALT_LIMIT] letters. */
    fun onPhotoAlt(text: String) {
        // One line, as the server keeps it (it folds spaces): a return in the keyboard doesn't break it.
        val line = text.replace(Regex("\\s*[\\r\\n]+\\s*"), " ")
        form.update { it.copy(photo = it.photo?.copy(alt = line.takeLetters(PHOTO_ALT_LIMIT))) }
    }
}
