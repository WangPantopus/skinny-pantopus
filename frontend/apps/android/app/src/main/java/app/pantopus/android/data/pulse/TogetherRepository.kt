package app.pantopus.android.data.pulse

import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.ConvergenceDto
import app.pantopus.android.data.api.models.reinvented.CrowdDto
import app.pantopus.android.data.api.models.reinvented.EyesOnAskDto
import app.pantopus.android.data.api.models.reinvented.EyesOnNearBody
import app.pantopus.android.data.api.models.reinvented.MomentPinDto
import app.pantopus.android.data.api.models.reinvented.MomentPinReactionBody
import app.pantopus.android.data.api.models.reinvented.MomentRepliesResponse
import app.pantopus.android.data.api.models.reinvented.MomentRepliesShownBody
import app.pantopus.android.data.api.models.reinvented.MomentReplyBody
import app.pantopus.android.data.api.models.reinvented.MomentReplyDto
import app.pantopus.android.data.api.models.reinvented.MomentReplyReportBody
import app.pantopus.android.data.api.models.reinvented.PinboardDto
import app.pantopus.android.data.api.models.reinvented.RelicDto
import app.pantopus.android.data.api.models.reinvented.RetakeDto
import app.pantopus.android.data.api.models.reinvented.SealPlaceBody
import app.pantopus.android.data.api.models.reinvented.SkyStripDayDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.TogetherApi
import app.pantopus.android.data.moments.serverCode
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Phase 3 on a Moment (CONTRACT 8): replies, pins, Retakes, and the Studio's create. A 403 `PULSE_REINVENTED_OFF` turns
 * the switch off at once.
 */
@Singleton
@Suppress("TooManyFunctions") // One call per route of phase 3, piece by piece (CONTRACT 8), as TogetherApi.
class TogetherRepository
    @Inject
    constructor(
        private val api: TogetherApi,
        private val feature: PulseReinventedFeature,
    ) {
        suspend fun replies(
            momentId: String,
            cursor: String?,
        ): NetworkResult<MomentRepliesResponse> = guarded { api.replies(momentId, cursor) }

        suspend fun reply(
            momentId: String,
            text: String,
        ): NetworkResult<MomentReplyDto> = guarded { api.reply(momentId, MomentReplyBody(text)).reply }

        suspend fun remove(
            momentId: String,
            replyId: String,
        ): NetworkResult<Unit> = guarded { api.remove(momentId, replyId) }

        suspend fun report(
            momentId: String,
            replyId: String,
            reason: String,
        ): NetworkResult<Unit> = guarded { api.report(momentId, replyId, MomentReplyReportBody(reason)) }

        suspend fun setShown(
            momentId: String,
            shown: Boolean,
        ): NetworkResult<MomentDto> = guarded { api.setShown(momentId, MomentRepliesShownBody(shown)).moment }

        /** CONTRACT 8b: the pins on a Moment's picture. */
        suspend fun pins(momentId: String): NetworkResult<List<MomentPinDto>> = guarded { api.pins(momentId).pins }

        /** CONTRACT 8b: one of the five signals dropped on a spot of the picture. */
        suspend fun dropReaction(
            momentId: String,
            x: Double,
            y: Double,
            signal: String,
        ): NetworkResult<MomentPinDto> = guarded { api.dropReaction(momentId, MomentPinReactionBody(x = x, y = y, signal = signal)).pin }

        /** CONTRACT 8e: a Retake, by its start's id or any frame's. */
        suspend fun retake(id: String): NetworkResult<RetakeDto> = guarded { api.retake(id).retake }

        /** CONTRACT 8f: open Eyes-on Asks near where the phone is (in the body only). */
        suspend fun eyesOnNear(
            latitude: Double,
            longitude: Double,
        ): NetworkResult<List<EyesOnAskDto>> = guarded { api.eyesOnNear(EyesOnNearBody(latitude, longitude)).asks }

        /** CONTRACT 8h: a convergence, its photos and its colours. */
        suspend fun convergence(id: String): NetworkResult<ConvergenceDto> = guarded { api.convergence(id).convergence }

        /** CONTRACT 8h: a place's sunsets over [days] days. */
        suspend fun skyStrip(
            cell: String,
            days: Int,
        ): NetworkResult<List<SkyStripDayDto>> = guarded { api.skyStrip(cell, days).days }

        /** CONTRACT 8i: a pinboard and the pieces this reader may see. */
        suspend fun pinboard(id: String): NetworkResult<PinboardDto> = guarded { api.pinboard(id).pinboard }

        /** CONTRACT 8i: the scene around a Moment from every phone, or null where fewer than three caught it. */
        suspend fun crowd(id: String): NetworkResult<CrowdDto?> = guarded { api.crowd(id).crowd }

        /** CONTRACT 8g: place relics near the reader. */
        suspend fun relicsNear(
            latitude: Double,
            longitude: Double,
        ): NetworkResult<List<RelicDto>> = guarded { api.sealsNear(SealPlaceBody(latitude, longitude)).relics }

        /** CONTRACT 8g: a place relic, whole for a reader standing where it was left. */
        suspend fun openRelic(
            id: String,
            latitude: Double,
            longitude: Double,
        ): NetworkResult<MomentDto> = guarded { api.openSeal(id, SealPlaceBody(latitude, longitude)).moment }

        /** CONTRACT 8: a Moment made in the Studio with phase 3's keys ([TogetherCreate]). */
        suspend fun createMoment(body: Map<String, Any?>): NetworkResult<MomentDto> = guarded { api.createMoment(body).moment }

        private suspend fun <T> guarded(call: suspend () -> T): NetworkResult<T> {
            val answer = safeApiCall { call() }
            if (answer is NetworkResult.Failure && answer.error.serverCode == StudioRepository.SWITCH_OFF) feature.refusedOff()
            return answer
        }
    }
