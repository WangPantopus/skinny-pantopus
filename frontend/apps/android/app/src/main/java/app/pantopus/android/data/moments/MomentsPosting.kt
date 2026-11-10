@file:Suppress("MagicNumber", "TooGenericExceptionCaught", "TooManyFunctions")

package app.pantopus.android.data.moments

import android.content.Context
import app.pantopus.android.data.api.models.moments.MomentAuthorDto
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
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okio.BufferedSink
import okio.source
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

/** One Moment on its way up, as the map draws it (board P5: "Posting · 65%", then the ring appears). */
data class MomentPosting(
    /** The Moment's id: the server made it when Post was tapped. */
    val momentId: String,
    val kind: String,
    val latitude: Double,
    val longitude: Double,
    /** You, as your ring will show you, so the posting ring and the ring that follows it wear the same face. */
    val author: MomentAuthorDto? = null,
    /** 0 to 1: exporting a video is the first fifth, the upload the rest. */
    val progress: Float = 0f,
    val stage: Stage = Stage.PREPARING,
    /** What went wrong when [stage] is [Stage.FAILED]. */
    val message: String? = null,
) {
    /** [DONE]: it's live, and this stays on the map just until the map's own read has its ring, so nothing blinks. */
    enum class Stage { PREPARING, UPLOADING, CHECKING, DONE, FAILED }
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
 *
 * Each upload leaves a small note beside its file until it is in, so one the app was closed on is picked up at the
 * next launch for the same account ([resume]). Each also has a job with Android's WorkManager ([MomentUploadWorker]),
 * so it finishes after the app is swiped away too ([finishInBackground], REVIEW B7). Sign-out drops every upload, file,
 * note and job ([clearAccount]).
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
        private val resuming = AtomicBoolean(false)

        /** Uploads the server refused for good (too long, unreadable, ended): a background job doesn't try them again. */
        private val refused = ConcurrentHashMap.newKeySet<String>()

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
            writeNote(Note.of(moment, file, latitude, longitude))
            _posts.update { list ->
                list.filterNot { it.momentId == moment.id } +
                    MomentPosting(moment.id, moment.kind, latitude, longitude, author = moment.author)
            }
            run(moment.id)
            MomentUploadWorker.schedule(context, moment.id)
        }

        /** A text card has nothing to upload: it's live the moment it's posted. */
        fun posted(moment: MomentDto) {
            repository.announceChange()
            _outcomes.tryEmit(MomentPostingOutcome.Live(moment))
        }

        /** "Try again" on a Moment that couldn't post. */
        fun retry(momentId: String) {
            if (media[momentId] == null) return
            refused.remove(momentId)
            update(momentId) { it.copy(stage = MomentPosting.Stage.PREPARING, progress = 0f, message = null) }
            run(momentId)
            MomentUploadWorker.schedule(context, momentId)
        }

        /** Gives up on a Moment that couldn't post: the server's copy (still uploading, so nobody saw it) goes too. */
        fun discard(momentId: String) {
            jobs.remove(momentId)?.cancel()
            MomentUploadWorker.cancel(context, momentId)
            forget(momentId)
            _posts.update { list -> list.filterNot { it.momentId == momentId } }
            scope.launch { repository.delete(momentId) }
        }

        /**
         * Picks up the uploads the app was closed on, for the account [userId] that made them: a Moment the server still
         * has as "uploading" goes back on the map as a posting ring and its file goes up; one that got in, ended or was
         * deleted meanwhile just has its file and note removed. Safe to call on every launch and foreground.
         */
        fun resume(userId: String) {
            if (!resuming.compareAndSet(false, true)) return
            scope.launch {
                try {
                    val notes = readNotes()
                    // Another account's leftovers never go up as this one (sign-out clears them; this is the belt).
                    notes.filter { it.userId != userId }.forEach { dropNote(it, deleteFile = true) }
                    val pending = notes.filter { it.userId == userId && !media.containsKey(it.momentId) }
                    if (pending.isEmpty()) return@launch
                    val mine = (repository.mine() as? NetworkResult.Success)?.data
                    pending.forEach { note ->
                        val server = mine?.firstOrNull { it.id == note.momentId }
                        val file = File(note.path)
                        when {
                            !file.exists() -> {
                                dropNote(note, deleteFile = false)
                                if (server?.state == UPLOADING) repository.delete(note.momentId)
                            }
                            mine != null && server?.state != UPLOADING -> dropNote(note, deleteFile = true)
                            else -> restore(note, file, server?.author)
                        }
                    }
                } finally {
                    resuming.set(false)
                }
            }
        }

        /** Sign-out: stops every upload and removes the account's photos, videos and upload notes from the phone. */
        fun clearAccount() {
            jobs.values.forEach { it.cancel() }
            jobs.clear()
            MomentUploadWorker.cancelAll(context)
            media.clear()
            prepared.clear()
            refused.clear()
            _posts.value = emptyList()
            MomentMedia.clear(context)
        }

        private fun restore(
            note: Note,
            file: File,
            author: MomentAuthorDto?,
        ) {
            if (media.putIfAbsent(note.momentId, note.mediaFile(file)) != null) return
            _posts.update { list ->
                list.filterNot { it.momentId == note.momentId } +
                    MomentPosting(note.momentId, note.kind, note.latitude, note.longitude, author = author)
            }
            run(note.momentId)
            MomentUploadWorker.schedule(context, note.momentId)
        }

        /** What a background job found when it saw an upload through (REVIEW B7). */
        enum class BackgroundUpload { DONE, TRY_LATER, GAVE_UP }

        /**
         * The background job's side of an upload (REVIEW B7): it waits for the upload this process is doing, or, when
         * Android started the app for the job after it was closed, picks the upload up from its note as [resume] does, and
         * waits for it to end. An upload that failed earlier in this run of the app goes once more.
         */
        suspend fun finishInBackground(
            momentId: String,
            userId: String,
        ): BackgroundUpload {
            if (jobs[momentId]?.isActive != true) {
                if (media.containsKey(momentId)) {
                    if (momentId in refused) return BackgroundUpload.GAVE_UP
                    retry(momentId)
                } else {
                    pickUp(momentId, userId)?.let { return it }
                }
            }
            // "Try again" replaces the job: follow the newest one until the upload is over.
            var waits = 0
            while (true) {
                val job = jobs[momentId]
                if (job != null) {
                    job.join()
                    if (jobs[momentId] === job || jobs[momentId] == null) break
                } else if (media.containsKey(momentId) && stageOf(momentId) == MomentPosting.Stage.PREPARING && waits++ < PICKUP_WAITS) {
                    // Between the note being read and the upload starting.
                    delay(PICKUP_POLL_MS)
                } else {
                    break
                }
            }
            return when {
                stageOf(momentId) != MomentPosting.Stage.FAILED -> BackgroundUpload.DONE
                momentId in refused -> BackgroundUpload.GAVE_UP
                else -> BackgroundUpload.TRY_LATER
            }
        }

        /**
         * A job with no upload in this process: [momentId]'s note, if it is still [userId]'s and its Moment still waits
         * for the file, goes back up (null: wait for it); otherwise the answer is final.
         */
        private suspend fun pickUp(
            momentId: String,
            userId: String,
        ): BackgroundUpload? {
            val note = readNotes().firstOrNull { it.momentId == momentId } ?: return BackgroundUpload.DONE
            if (note.userId != userId) return BackgroundUpload.GAVE_UP
            val file = File(note.path)
            val server =
                when (val mine = repository.mine()) {
                    is NetworkResult.Success -> mine.data.firstOrNull { it.id == momentId }
                    // No answer about it: try again once the job runs again.
                    is NetworkResult.Failure -> return BackgroundUpload.TRY_LATER
                }
            return when {
                !file.exists() -> {
                    dropNote(note, deleteFile = false)
                    if (server?.state == UPLOADING) repository.delete(momentId)
                    BackgroundUpload.GAVE_UP
                }
                // It got in, ended or was deleted meanwhile.
                server?.state != UPLOADING -> {
                    dropNote(note, deleteFile = true)
                    BackgroundUpload.DONE
                }
                else -> {
                    restore(note, file, server?.author)
                    null
                }
            }
        }

        private fun stageOf(momentId: String): MomentPosting.Stage? = _posts.value.firstOrNull { it.momentId == momentId }?.stage

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
                        // Bytes handed to the network aren't yet bytes the server has: the ring stops just short of full
                        // until the server answers.
                        update(momentId) { it.copy(progress = EXPORT_SHARE + (UPLOAD_CAP - EXPORT_SHARE) * sent) }
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
                            if (!error.isRetryable()) refused += momentId
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
            forget(momentId)
            jobs.remove(momentId)
            val held = moment.state == "held"
            if (!held) update(momentId) { it.copy(stage = MomentPosting.Stage.DONE, progress = 1f) }
            repository.announceChange()
            _outcomes.tryEmit(if (held) MomentPostingOutcome.Held(moment) else MomentPostingOutcome.Live(moment))
            if (!held) {
                // The posting ring stands in until the map's own read brings the Moment's ring, so nothing blinks.
                withTimeoutOrNull(RING_WAIT_MS) {
                    repository.rings.first { rings -> rings.any { ring -> ring.mine && ring.moments.any { it.id == momentId } } }
                }
            }
            _posts.update { list -> list.filterNot { it.momentId == momentId } }
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

        /** The upload is over, one way or another: its files and its note leave the phone. */
        private fun forget(momentId: String) {
            refused.remove(momentId)
            media.remove(momentId)?.let { runCatching { it.file.delete() } }
            prepared.remove(momentId)?.let { parts ->
                runCatching { (listOfNotNull(parts.file, parts.poster) + parts.frames).forEach { it.delete() } }
            }
            runCatching { noteFile(momentId).delete() }
        }

        private fun noteFile(momentId: String): File = File(MomentMedia.outbox(context), "$momentId.json")

        private fun writeNote(note: Note) {
            runCatching { noteFile(note.momentId).writeText(note.toJson()) }
                .onFailure { timber.log.Timber.tag("Moments").w(it, "couldn't note the upload") }
        }

        private fun readNotes(): List<Note> =
            MomentMedia.outbox(context).listFiles().orEmpty().mapNotNull { file ->
                runCatching { Note.fromJson(file.readText()) }.getOrNull() ?: run {
                    file.delete()
                    null
                }
            }

        private fun dropNote(
            note: Note,
            deleteFile: Boolean,
        ) {
            runCatching { noteFile(note.momentId).delete() }
            if (deleteFile) runCatching { File(note.path).delete() }
        }

        private data class Prepared(
            val file: File,
            val type: MediaType,
            val poster: File?,
            val frames: List<File>,
        )

        /** What an upload needs to start again after the app was closed: whose it is, the file, and where it pins. */
        private data class Note(
            val momentId: String,
            val userId: String,
            val kind: String,
            val path: String,
            val durationMs: Long,
            val recordedHere: Boolean,
            val latitude: Double,
            val longitude: Double,
        ) {
            fun mediaFile(file: File): MomentMediaFile =
                if (kind == "video") MomentMediaFile.Video(file, durationMs, recordedHere) else MomentMediaFile.Photo(file)

            fun toJson(): String =
                JSONObject()
                    .put("momentId", momentId)
                    .put("userId", userId)
                    .put("kind", kind)
                    .put("path", path)
                    .put("durationMs", durationMs)
                    .put("recordedHere", recordedHere)
                    .put("latitude", latitude)
                    .put("longitude", longitude)
                    .toString()

            companion object {
                fun of(
                    moment: MomentDto,
                    file: MomentMediaFile,
                    latitude: Double,
                    longitude: Double,
                ): Note {
                    val video = file as? MomentMediaFile.Video
                    return Note(
                        momentId = moment.id,
                        userId = moment.author.id,
                        kind = if (video != null) "video" else "photo",
                        path = file.file.path,
                        durationMs = video?.durationMs ?: 0L,
                        recordedHere = video?.recordedHere ?: false,
                        latitude = latitude,
                        longitude = longitude,
                    )
                }

                fun fromJson(text: String): Note {
                    val json = JSONObject(text)
                    return Note(
                        momentId = json.getString("momentId"),
                        userId = json.getString("userId"),
                        kind = json.getString("kind"),
                        path = json.getString("path"),
                        durationMs = json.optLong("durationMs"),
                        recordedHere = json.optBoolean("recordedHere"),
                        latitude = json.getDouble("latitude"),
                        longitude = json.getDouble("longitude"),
                    )
                }
            }
        }

        private companion object {
            val JPEG = "image/jpeg".toMediaType()
            val MP4 = "video/mp4".toMediaType()

            /** The multipart name of the video's extra frames (QUESTIONS 11-08 21:05Z: `frames`, sent up to twice). */
            const val FRAMES_FIELD = "frames"
            const val UPLOADING = "uploading"
            const val EXPORT_SHARE = 0.2f
            const val UPLOAD_CAP = 0.97f
            const val MAX_ATTEMPTS = 5
            const val BACKOFF_MS = 2_000L
            const val CHECK_POLL_MS = 2_000L
            const val CHECK_WAIT_MS = 30_000L
            const val RING_WAIT_MS = 4_000L
            const val PICKUP_POLL_MS = 500L
            const val PICKUP_WAITS = 20
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
