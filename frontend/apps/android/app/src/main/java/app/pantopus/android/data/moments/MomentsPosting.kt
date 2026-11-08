@file:Suppress("MagicNumber")

package app.pantopus.android.data.moments

import android.content.Context
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.network.NetworkMonitor
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okio.BufferedSink
import okio.source
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/** One Moment on its way up, as the map draws it (board P5: "Posting · 65%", then the ring appears). */
data class MomentPosting(
    /** The Moment's id: the server made it when Post was tapped. */
    val momentId: String,
    val kind: String,
    val latitude: Double,
    val longitude: Double,
    /** 0 to 1: exporting a video is the first fifth, the upload the rest. */
    val progress: Float = 0f,
    val stage: Stage = Stage.PREPARING,
    /** What went wrong when [stage] is [Stage.FAILED]. */
    val message: String? = null,
) {
    enum class Stage { PREPARING, UPLOADING, CHECKING, FAILED }
}

/** What the person hears about a Moment that finished posting. */
sealed interface MomentPostingOutcome {
    data class Live(
        val moment: MomentDto,
    ) : MomentPostingOutcome

    /** The picture check or a review holds it before anyone sees it. */
    data class Held(
        val moment: MomentDto,
    ) : MomentPostingOutcome
}

/**
 * Uploads Moments' photos and videos in the background: it keeps going when the person leaves the camera or the
 * Moments tab, waits out a lost connection, and retries a failed upload a few times before it asks the person to try
 * again (brief: "Upload continues in the background with retries"). The Moment itself was made when Post was tapped,
 * so its location was checked while it was fresh; its time starts when the upload finishes.
 */
@Singleton
class MomentsPosting
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val repository: MomentsRepository,
        private val network: NetworkMonitor,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        private val jobs = ConcurrentHashMap<String, Job>()
        private val media = ConcurrentHashMap<String, MomentMediaFile>()
        private val prepared = ConcurrentHashMap<String, Prepared>()

        private val _posts = MutableStateFlow<List<MomentPosting>>(emptyList())

        /** Moments still posting, oldest first. */
        val posts: StateFlow<List<MomentPosting>> = _posts.asStateFlow()

        private val _outcomes = MutableSharedFlow<MomentPostingOutcome>(extraBufferCapacity = 4)

        /** Moments that finished posting: the map reads the area again and says so. */
        val outcomes: SharedFlow<MomentPostingOutcome> = _outcomes.asSharedFlow()

        /** Starts uploading [file] for the Moment [moment], made a moment ago with `POST /api/moments`. */
        fun start(
            moment: MomentDto,
            file: MomentMediaFile,
            latitude: Double,
            longitude: Double,
        ) {
            media[moment.id] = file
            _posts.update { list ->
                list.filterNot { it.momentId == moment.id } + MomentPosting(moment.id, moment.kind, latitude, longitude)
            }
            run(moment.id)
        }

        /** "Try again" on a Moment that couldn't post. */
        fun retry(momentId: String) {
            if (media[momentId] == null) return
            update(momentId) { it.copy(stage = MomentPosting.Stage.PREPARING, progress = 0f, message = null) }
            run(momentId)
        }

        /** Gives up on a Moment that couldn't post: the server's copy (still uploading, so nobody saw it) goes too. */
        fun discard(momentId: String) {
            jobs.remove(momentId)?.cancel()
            media.remove(momentId)?.let { cleanUp(it) }
            prepared.remove(momentId)?.let { cleanUp(it) }
            _posts.update { list -> list.filterNot { it.momentId == momentId } }
            scope.launch { repository.delete(momentId) }
        }

        private fun run(momentId: String) {
            jobs[momentId]?.cancel()
            jobs[momentId] =
                scope.launch {
                    val file = media[momentId] ?: return@launch
                    try {
                        upload(momentId, file)
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (failure: Exception) {
                        timber.log.Timber.tag("Moments").w(failure, "posting failed")
                        fail(momentId, "Couldn't post your Moment.")
                    }
                }
        }

        private suspend fun upload(
            momentId: String,
            file: MomentMediaFile,
        ) {
            // Prepared once: a retry after the upload failed starts from the prepared files.
            val parts =
                prepared[momentId] ?: when (file) {
                    is MomentMediaFile.Photo -> {
                        val photo = MomentMedia.preparePhoto(context, file.file)
                        Prepared(photo, JPEG, null, emptyList())
                    }
                    is MomentMediaFile.Video -> {
                        val video =
                            MomentMedia.prepareVideo(context, file) { exported ->
                                update(momentId) { it.copy(progress = exported * EXPORT_SHARE) }
                            }
                        Prepared(video.video, MP4, video.poster, video.frames)
                    }
                }.also { prepared[momentId] = it }
            var attempt = 0
            while (true) {
                if (!network.isOnline.value) network.isOnline.first { it }
                update(momentId) { it.copy(stage = MomentPosting.Stage.UPLOADING, progress = EXPORT_SHARE) }
                val body =
                    ProgressBody(parts.file, parts.type) { sent ->
                        update(momentId) { it.copy(progress = EXPORT_SHARE + (1f - EXPORT_SHARE) * sent) }
                    }
                val filePart = MultipartBody.Part.createFormData("file", parts.file.name, body)
                val posterPart = parts.poster?.let { MultipartBody.Part.createFormData("poster", it.name, it.asRequestBody(JPEG)) }
                val frameParts = parts.frames.map { MultipartBody.Part.createFormData(FRAMES_FIELD, it.name, it.asRequestBody(JPEG)) }
                when (val result = repository.uploadMedia(momentId, filePart, posterPart, frameParts)) {
                    is NetworkResult.Success -> {
                        finish(momentId, result.data)
                        return
                    }
                    is NetworkResult.Failure -> {
                        val error = result.error
                        attempt++
                        if (!error.isRetryable() || attempt >= MAX_ATTEMPTS) {
                            fail(momentId, error.postingMessage())
                            return
                        }
                        delay(BACKOFF_MS * (1L shl (attempt - 1)))
                    }
                }
            }
        }

        /** The file is in: live now, or the picture check runs first (a few seconds), or a review holds it. */
        private suspend fun finish(
            momentId: String,
            uploaded: MomentDto,
        ) {
            var moment = uploaded
            update(momentId) { it.copy(stage = MomentPosting.Stage.CHECKING, progress = 1f) }
            var waited = 0L
            while (moment.state == "checking" && waited < CHECK_WAIT_MS) {
                delay(CHECK_POLL_MS)
                waited += CHECK_POLL_MS
                (repository.moment(momentId) as? NetworkResult.Success)?.data?.let { moment = it }
            }
            media.remove(momentId)?.let { cleanUp(it) }
            prepared.remove(momentId)?.let { cleanUp(it) }
            jobs.remove(momentId)
            _posts.update { list -> list.filterNot { it.momentId == momentId } }
            repository.announceChange()
            _outcomes.tryEmit(if (moment.state == "held") MomentPostingOutcome.Held(moment) else MomentPostingOutcome.Live(moment))
        }

        private fun fail(
            momentId: String,
            message: String,
        ) {
            update(momentId) { it.copy(stage = MomentPosting.Stage.FAILED, message = message) }
        }

        private fun update(
            momentId: String,
            change: (MomentPosting) -> MomentPosting,
        ) {
            _posts.update { list -> list.map { if (it.momentId == momentId) change(it) else it } }
        }

        private fun cleanUp(file: MomentMediaFile) {
            runCatching { file.file.delete() }
        }

        private fun cleanUp(parts: Prepared) {
            runCatching { (listOfNotNull(parts.file, parts.poster) + parts.frames).forEach { it.delete() } }
        }

        private data class Prepared(
            val file: File,
            val type: MediaType,
            val poster: File?,
            val frames: List<File>,
        )

        private companion object {
            val JPEG = "image/jpeg".toMediaType()
            val MP4 = "video/mp4".toMediaType()

            /** The multipart name of the video's extra frames (contract: `frames[]`, up to two). */
            const val FRAMES_FIELD = "frames"
            const val EXPORT_SHARE = 0.2f
            const val MAX_ATTEMPTS = 5
            const val BACKOFF_MS = 2_000L
            const val CHECK_POLL_MS = 2_000L
            const val CHECK_WAIT_MS = 30_000L
        }
    }

/** Worth another try: no connection, a timeout, the server busy or briefly failing. */
private fun NetworkError.isRetryable(): Boolean =
    this is NetworkError.Transport || this is NetworkError.Server || this == NetworkError.RetriesExhausted || code == 408 || code == 429

/** What the posting ring says when the upload gave up. */
private fun NetworkError.postingMessage(): String =
    when (serverCode) {
        "MEDIA_TOO_LONG" -> "Videos can be up to 30 seconds."
        "MEDIA_TOO_LARGE" -> "That file is too large."
        "PHOTO_UNREADABLE", "VIDEO_UNREADABLE" -> "That file couldn't be read."
        "MOMENT_ENDED" -> "That Moment has ended."
        else -> "Couldn't post your Moment."
    }

/** A file body that reports how much of it has been sent, 0 to 1. */
private class ProgressBody(
    private val file: File,
    private val type: MediaType,
    private val onProgress: (Float) -> Unit,
) : RequestBody() {
    override fun contentType(): MediaType = type

    override fun contentLength(): Long = file.length()

    override fun writeTo(sink: BufferedSink) {
        val total = contentLength().coerceAtLeast(1L)
        var sent = 0L
        var reported = 0f
        file.source().use { source ->
            while (true) {
                val read = source.read(sink.buffer, CHUNK)
                if (read == -1L) break
                sink.flush()
                sent += read
                val now = sent.toFloat() / total
                if (now - reported >= 0.01f || sent == total) {
                    reported = now
                    onProgress(now)
                }
            }
        }
    }

    private companion object {
        const val CHUNK = 64L * 1024L
    }
}
