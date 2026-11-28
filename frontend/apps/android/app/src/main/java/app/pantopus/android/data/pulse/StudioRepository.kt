package app.pantopus.android.data.pulse

import app.pantopus.android.data.api.models.moments.MomentDailySpotDto
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentEditBody
import app.pantopus.android.data.api.models.moments.MomentGuessBody
import app.pantopus.android.data.api.models.moments.MomentGuessResponse
import app.pantopus.android.data.api.models.moments.MomentPlayAnswerBody
import app.pantopus.android.data.api.models.moments.MomentPlayAnswersPageDto
import app.pantopus.android.data.api.models.moments.MomentPlayItemDto
import app.pantopus.android.data.api.models.moments.MomentStampsPreviewBody
import app.pantopus.android.data.api.models.moments.MomentStampsPreviewDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.StudioApi
import app.pantopus.android.data.moments.MomentMotionClip
import app.pantopus.android.data.moments.serverCode
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The Studio's own requests ([StudioApi]). A refusal that says the switch is off for this person
 * (`403 PULSE_REINVENTED_OFF`, CONTRACT 1) turns it off at once and reads it again, so the app goes back to today's
 * screens.
 */
@Singleton
class StudioRepository
    @Inject
    constructor(
        private val api: StudioApi,
        private val feature: PulseReinventedFeature,
    ) {
        /** The tray's stamps for a Moment posted at this point now (CONTRACT 2a). */
        suspend fun stampsPreview(
            latitude: Double,
            longitude: Double,
        ): NetworkResult<MomentStampsPreviewDto> =
            when (val answer = safeApiCall { api.stampsPreview(MomentStampsPreviewBody(latitude, longitude)) }) {
                is NetworkResult.Success -> NetworkResult.Success(answer.data.stamps ?: MomentStampsPreviewDto())
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    answer
                }
            }

        /** One of the five signals on a Moment, or none (CONTRACT 4); the answer is the signal the server kept. */
        suspend fun signal(
            momentId: String,
            signal: String?,
        ): NetworkResult<String?> {
            val body = JSONObject().put("signal", signal ?: JSONObject.NULL).toString().toRequestBody(JSON)
            return when (val answer = safeApiCall { api.signal(momentId, body) }) {
                is NetworkResult.Success -> NetworkResult.Success(answer.data.mySignal)
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    answer
                }
            }
        }

        /** The author's 15-minute edit (CONTRACT 3): the Moment as it is now. */
        suspend fun edit(
            momentId: String,
            body: MomentEditBody,
        ): NetworkResult<MomentDto> =
            when (val answer = safeApiCall { api.edit(momentId, body) }) {
                is NetworkResult.Success -> NetworkResult.Success(answer.data.moment)
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    answer
                }
            }

        /** The reader's one guess at a guess-the-spot Moment (CONTRACT 5c): how far off, and the Moment in full. */
        suspend fun guess(
            momentId: String,
            latitude: Double,
            longitude: Double,
        ): NetworkResult<MomentGuessResponse> =
            safeApiCall { api.guess(momentId, MomentGuessBody(latitude, longitude)) }.also { answer ->
                if ((answer as? NetworkResult.Failure)?.error?.serverCode == SWITCH_OFF) feature.refusedOff()
            }

        /**
         * A motion photo's clip beside its Moment's photo (CONTRACT 10b): true once the server keeps it. A clip the picture
         * check refuses (`422 MOTION_REFUSED`) or one past the limits is not kept; the photo stays a still.
         */
        suspend fun uploadMotion(
            momentId: String,
            clip: MomentMotionClip,
        ): Boolean {
            val file = MultipartBody.Part.createFormData("file", clip.file.name, clip.file.asRequestBody(MP4))
            val frames = clip.frames.map { MultipartBody.Part.createFormData("frames", it.name, it.asRequestBody(JPEG)) }
            return when (val answer = safeApiCall { api.uploadMotion(momentId, file, frames) }) {
                is NetworkResult.Success -> true
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    false
                }
            }
        }

        /** The author takes one dot off their Moment (CONTRACT 7c): true once the server has it gone. */
        suspend fun removeDot(
            momentId: String,
            dotId: String,
        ): Boolean =
            when (val answer = safeApiCall { api.removeDot(momentId, dotId) }) {
                is NetworkResult.Success -> true
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    false
                }
            }

        /** A reader's answer to one playable item (CONTRACT 7b): the item as the reader may now see it. */
        suspend fun answerPlay(
            momentId: String,
            itemId: String,
            body: MomentPlayAnswerBody,
        ): NetworkResult<MomentPlayItemDto?> =
            when (val answer = safeApiCall { api.answerPlay(momentId, itemId, body) }) {
                is NetworkResult.Success -> NetworkResult.Success(answer.data.item)
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    answer
                }
            }

        /** The reader takes their answer back (CONTRACT 7b): true once the server has it gone. */
        suspend fun takeBackPlay(
            momentId: String,
            itemId: String,
        ): Boolean =
            when (val answer = safeApiCall { api.takeBackPlay(momentId, itemId) }) {
                is NetworkResult.Success -> true
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    false
                }
            }

        /** A question box's answers, to its author (CONTRACT 7b); null when they can't be read. */
        suspend fun playAnswers(
            momentId: String,
            itemId: String,
            cursor: String?,
        ): MomentPlayAnswersPageDto? =
            when (val answer = safeApiCall { api.playAnswers(momentId, itemId, cursor) }) {
                is NetworkResult.Success -> answer.data
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    null
                }
            }

        /** The author removes one answer from their post (CONTRACT 7b): true once it is gone. */
        suspend fun removePlayAnswer(
            momentId: String,
            itemId: String,
            answerId: String,
        ): Boolean =
            when (val answer = safeApiCall { api.removePlayAnswer(momentId, itemId, answerId) }) {
                is NetworkResult.Success -> true
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    false
                }
            }

        /** Today's guess-the-spot Moment for the town at this point (CONTRACT 5d), or null. */
        suspend fun dailySpot(
            latitude: Double,
            longitude: Double,
        ): NetworkResult<MomentDailySpotDto?> =
            when (val answer = safeApiCall { api.dailySpot(latitude, longitude) }) {
                is NetworkResult.Success -> NetworkResult.Success(answer.data.dailySpot?.takeIf { it.momentId != null })
                is NetworkResult.Failure -> {
                    if (answer.error.serverCode == SWITCH_OFF) feature.refusedOff()
                    answer
                }
            }

        companion object {
            private val JSON = "application/json; charset=utf-8".toMediaType()
            private val MP4 = "video/mp4".toMediaType()
            private val JPEG = "image/jpeg".toMediaType()

            /** The server's answer to a Studio-only request from a person whose switch is off (CONTRACT 1). */
            const val SWITCH_OFF = "PULSE_REINVENTED_OFF"
        }
    }
