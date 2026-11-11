@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.data.moments

import app.pantopus.android.data.api.models.moments.CreateMomentBody
import app.pantopus.android.data.api.models.moments.MomentAdultConfirmResponse
import app.pantopus.android.data.api.models.moments.MomentBriefDto
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentPlacePreviewDto
import app.pantopus.android.data.api.models.moments.MomentPointBody
import app.pantopus.android.data.api.models.moments.MomentReplyBody
import app.pantopus.android.data.api.models.moments.MomentReplyResponse
import app.pantopus.android.data.api.models.moments.MomentReportBody
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.api.models.moments.MomentViewersResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MomentsApi
import app.pantopus.android.data.blocks.BlocksRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The Moments routes for the screens, plus what the map and the viewer share while the app runs: the rings last read
 * for the map (the viewer's "next ring nearby" and Play all walk them), and the Moments watched since (their rings turn
 * gray at once, before the next read).
 */
@Singleton
class MomentsRepository
    @Inject
    constructor(
        private val api: MomentsApi,
        private val blocks: BlocksRepository,
    ) {
        private val _rings = MutableStateFlow<List<MomentRingDto>>(emptyList())

        /** The rings of the last map read, newest first as the server sent them. */
        val rings: StateFlow<List<MomentRingDto>> = _rings.asStateFlow()

        private val _watched = MutableStateFlow<Set<String>>(emptySet())

        /** Moments watched in this run of the app, recorded or not yet. */
        val watched: StateFlow<Set<String>> = _watched.asStateFlow()

        private val _reported = MutableStateFlow<Set<String>>(emptySet())

        /**
         * Moments you reported in this run of the app: they leave your map at once, before the next read (the server
         * leaves them out of every read after the report too).
         */
        val reported: StateFlow<Set<String>> = _reported.asStateFlow()

        /**
         * What the viewer plays next, set by the map just before it opens the viewer: the rings in order and where to
         * start. Kept here rather than in the route because a map can hold 300 rings.
         */
        @Volatile
        var playback: MomentsPlayback? = null

        private val _changes = MutableSharedFlow<Unit>(extraBufferCapacity = 4)

        /** Something on the map changed (a Moment posted, deleted, a person muted or blocked): read it again. */
        val changes: SharedFlow<Unit> = _changes.asSharedFlow()

        fun announceChange() {
            _changes.tryEmit(Unit)
        }

        private val _mapNote = MutableStateFlow<String?>(null)

        /**
         * A note for the map's toast from outside the map ("This Moment has ended." after a push for one), kept until the
         * map shows it: the map may not be on screen yet when it is set.
         */
        val mapNote: StateFlow<String?> = _mapNote.asStateFlow()

        fun noteOnMap(text: String) {
            _mapNote.value = text
        }

        fun mapNoteShown() {
            _mapNote.value = null
        }

        /** Sign-out: the next person on this phone starts with no rings, nothing watched and nothing queued. */
        fun clearAccount() {
            _rings.value = emptyList()
            _watched.value = emptySet()
            _reported.value = emptySet()
            _mapNote.value = null
            playback = null
        }

        /**
         * Queues one Moment for the viewer (the quote above a chat reply, a link): true when it can be watched. A Moment
         * that ended, was deleted or isn't visible any more answers false.
         */
        suspend fun queueSingle(
            id: String,
            viewerId: String?,
        ): Boolean {
            val moment = (moment(id) as? NetworkResult.Success)?.data ?: return false
            val ring =
                MomentRingDto(
                    id = "single_${moment.id}",
                    author = moment.author,
                    latitude = moment.latitude ?: 0.0,
                    longitude = moment.longitude ?: 0.0,
                    placeLabel = moment.placeLabel,
                    moments = listOf(MomentBriefDto(moment.id, moment.kind, moment.createdAt, moment.expiresAt, moment.seen)),
                    unseenCount = if (moment.seen) 0 else 1,
                    newestAt = moment.createdAt,
                    mine = viewerId != null && moment.author.id == viewerId,
                )
            playback = MomentsPlayback(rings = listOf(ring), startIndex = 0, newOnly = false)
            return true
        }

        suspend fun map(
            south: Double,
            west: Double,
            north: Double,
            east: Double,
            zoom: Int,
        ): NetworkResult<List<MomentRingDto>> =
            when (val result = safeApiCall { api.map(south, west, north, east, zoom) }) {
                is NetworkResult.Success -> {
                    // Moments with no location ride along (flagged `noLocation`): the strip shows them, the map doesn't.
                    val all = result.data.rings + result.data.unplaced.map { it.copy(noLocation = true) }
                    _rings.value = all
                    NetworkResult.Success(all)
                }
                is NetworkResult.Failure -> result
            }

        suspend fun mine(): NetworkResult<List<MomentDto>> =
            when (val result = safeApiCall { api.mine() }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.moments)
                is NetworkResult.Failure -> result
            }

        suspend fun moment(id: String): NetworkResult<MomentDto> =
            when (val result = safeApiCall { api.moment(id) }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.moment)
                is NetworkResult.Failure -> result
            }

        /** Records one view (the server counts each person once) and marks the Moment watched here at once. */
        suspend fun recordView(id: String): NetworkResult<Unit> {
            _watched.update { it + id }
            return safeApiCall { api.view(id) }.toUnit()
        }

        suspend fun viewers(id: String): NetworkResult<MomentViewersResponse> = safeApiCall { api.viewers(id) }

        /** Sets the reaction, or takes it back with null. */
        suspend fun react(
            id: String,
            emoji: String?,
        ): NetworkResult<String?> {
            val json = JSONObject().put("emoji", emoji ?: JSONObject.NULL).toString()
            return when (val result = safeApiCall { api.react(id, json.toRequestBody(JSON)) }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.myReaction)
                is NetworkResult.Failure -> result
            }
        }

        suspend fun reply(
            id: String,
            text: String,
        ): NetworkResult<MomentReplyResponse> = safeApiCall { api.reply(id, MomentReplyBody(text)) }

        suspend fun delete(id: String): NetworkResult<Unit> = safeApiCall { api.delete(id) }.toUnit().alsoChanged()

        suspend fun report(
            id: String,
            reason: String,
        ): NetworkResult<Unit> =
            safeApiCall { api.report(id, MomentReportBody(reason)) }.toUnit().also { result ->
                if (result is NetworkResult.Success) _reported.update { it + id }
            }.alsoChanged()

        suspend fun mute(userId: String): NetworkResult<Unit> = safeApiCall { api.mute(userId) }.toUnit().alsoChanged()

        suspend fun unmute(userId: String): NetworkResult<Unit> = safeApiCall { api.unmute(userId) }.toUnit().alsoChanged()

        suspend fun block(userId: String): NetworkResult<Unit> = blocks.block(userId).alsoChanged()

        suspend fun placePreview(
            latitude: Double,
            longitude: Double,
        ): NetworkResult<MomentPlacePreviewDto> = safeApiCall { api.placePreview(MomentPointBody(latitude, longitude)) }

        /** With location off: only the 18+ state and whether you have a connection (contract v3.4). */
        suspend fun postingPreview(): NetworkResult<MomentPlacePreviewDto> = safeApiCall { api.placePreview(MomentPointBody()) }

        suspend fun adultConfirm(): NetworkResult<MomentAdultConfirmResponse> = safeApiCall { api.adultConfirm() }

        suspend fun create(body: CreateMomentBody): NetworkResult<MomentDto> =
            when (val result = safeApiCall { api.create(body) }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.moment)
                is NetworkResult.Failure -> result
            }

        suspend fun uploadMedia(
            id: String,
            file: MultipartBody.Part,
            poster: MultipartBody.Part?,
            frames: List<MultipartBody.Part>,
        ): NetworkResult<MomentDto> =
            when (val result = safeApiCall { api.uploadMedia(id, file, poster, frames) }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.moment)
                is NetworkResult.Failure -> result
            }

        private fun NetworkResult<retrofit2.Response<Unit>>.toUnit(): NetworkResult<Unit> =
            when (this) {
                is NetworkResult.Success ->
                    if (data.isSuccessful) {
                        NetworkResult.Success(Unit)
                    } else {
                        NetworkResult.Failure(httpError(data.code(), data.errorBody()?.string()))
                    }
                is NetworkResult.Failure -> this
            }

        private fun NetworkResult<Unit>.alsoChanged(): NetworkResult<Unit> {
            if (this is NetworkResult.Success) announceChange()
            return this
        }

        private companion object {
            val JSON = "application/json; charset=utf-8".toMediaType()

            /** A non-2xx `Response<Unit>` mapped as `safeApiCall` maps a thrown one. */
            fun httpError(
                code: Int,
                body: String?,
            ): NetworkError =
                when (code) {
                    401 -> NetworkError.Unauthorized
                    403 -> NetworkError.Forbidden(body)
                    404 -> NetworkError.NotFound
                    in 500..599 -> NetworkError.Server(code, body)
                    else -> NetworkError.ClientError(code, body)
                }
        }
    }

/**
 * The viewer's queue: [rings] in the order they play, starting at [startIndex]. With [newOnly] (Play all) only the
 * Moments not watched yet play; otherwise a ring opens at its first new Moment, or its first one when all are watched.
 */
data class MomentsPlayback(
    val rings: List<MomentRingDto>,
    val startIndex: Int,
    val newOnly: Boolean,
)

/** The `code` the server put in an error body (`{error, code}`), e.g. `ADULT_CONFIRM_REQUIRED`; null when none. */
val NetworkError.serverCode: String?
    get() {
        val body =
            when (this) {
                is NetworkError.Forbidden -> body
                is NetworkError.ClientError -> body
                is NetworkError.Server -> body
                else -> null
            } ?: return null
        return runCatching { JSONObject(body).optString("code") }.getOrNull()?.takeIf { it.isNotBlank() }
    }
