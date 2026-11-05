@file:Suppress("TooManyFunctions")

package app.pantopus.android.data.crewday

import app.pantopus.android.data.api.models.crewday.CrewDayBookingBody
import app.pantopus.android.data.api.models.crewday.CrewDayBookingDto
import app.pantopus.android.data.api.models.crewday.CrewDayBookingPatch
import app.pantopus.android.data.api.models.crewday.CrewDayBusinessResponse
import app.pantopus.android.data.api.models.crewday.CrewDayCardDto
import app.pantopus.android.data.api.models.crewday.CrewDayCreateBody
import app.pantopus.android.data.api.models.crewday.CrewDayCrewViewDto
import app.pantopus.android.data.api.models.crewday.CrewDayDoneBody
import app.pantopus.android.data.api.models.crewday.CrewDayDto
import app.pantopus.android.data.api.models.crewday.CrewDayEditBody
import app.pantopus.android.data.api.models.crewday.CrewDayHomeDto
import app.pantopus.android.data.api.models.crewday.CrewDayNewDateBody
import app.pantopus.android.data.api.models.crewday.CrewDayNoteBody
import app.pantopus.android.data.api.models.crewday.CrewDayOnTheWayBody
import app.pantopus.android.data.api.models.crewday.CrewDayPriceAnswerBody
import app.pantopus.android.data.api.models.crewday.CrewDayPriceBody
import app.pantopus.android.data.api.models.crewday.CrewDayProblemBody
import app.pantopus.android.data.api.models.crewday.CrewDayProposeDatesBody
import app.pantopus.android.data.api.models.crewday.CrewDayProposedDateDto
import app.pantopus.android.data.api.models.crewday.CrewDayPublicDto
import app.pantopus.android.data.api.models.crewday.CrewDayQuoteBody
import app.pantopus.android.data.api.models.crewday.CrewDayQuoteDto
import app.pantopus.android.data.api.models.crewday.CrewDayReasonBody
import app.pantopus.android.data.api.models.crewday.CrewDayRequestBody
import app.pantopus.android.data.api.models.crewday.CrewDayRouteDto
import app.pantopus.android.data.api.models.crewday.CrewDayRouteOrderBody
import app.pantopus.android.data.api.models.crewday.CrewDayRunningLateBody
import app.pantopus.android.data.api.models.crewday.CrewDayRunningLateResponse
import app.pantopus.android.data.api.models.crewday.CrewDayTodayResponse
import app.pantopus.android.data.api.models.crewday.CrewDayUploadResponse
import app.pantopus.android.data.api.models.crewday.MyCrewDaysResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.CrewDaysApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Crew Day's data (docs/product/crew-day-build/02-contract.md). Every write bumps [changes], so Today's cards, Your
 * Crew Days and the crew's lists read again when they come back on screen.
 */
@Singleton
open class CrewDaysRepository
    @Inject
    constructor(
        private val api: CrewDaysApi,
    ) {
        private val _changes = MutableStateFlow(0L)

        /** Goes up after every Crew Day write this app makes. */
        val changes: StateFlow<Long> = _changes.asStateFlow()

        /** A read: a 403 keeps its body, so `CREW_DAY_UNAVAILABLE` and the other codes stay readable. */
        private suspend inline fun <T> call(crossinline block: suspend () -> T): NetworkResult<T> =
            safeApiCall(surfaceForbiddenBody = true, block = block)

        /** A write: as [call], and a success bumps [changes]. */
        private suspend inline fun <T> write(crossinline block: suspend () -> T): NetworkResult<T> =
            call(block).also { if (it is NetworkResult.Success) _changes.value += 1 }

        // MARK: - Public

        open suspend fun invitation(code: String): NetworkResult<CrewDayPublicDto> = call { api.invitation(code) }

        open suspend fun quote(
            code: String,
            body: CrewDayQuoteBody,
        ): NetworkResult<CrewDayQuoteDto> = call { api.quote(code, body) }

        // MARK: - Household

        open suspend fun book(
            crewDayId: String,
            body: CrewDayBookingBody,
        ): NetworkResult<CrewDayBookingDto> = write { api.book(crewDayId, body).booking }

        open suspend fun mine(): NetworkResult<MyCrewDaysResponse> = call { api.mine() }

        open suspend fun today(): NetworkResult<CrewDayTodayResponse> = call { api.today() }

        open suspend fun dismiss(crewDayId: String): NetworkResult<Unit> = write { api.dismiss(crewDayId) }

        open suspend fun booking(bookingId: String): NetworkResult<CrewDayBookingDto> = call { api.booking(bookingId) }

        open suspend fun updateBooking(
            bookingId: String,
            patch: CrewDayBookingPatch,
        ): NetworkResult<CrewDayBookingDto> =
            write { api.updateBooking(bookingId, patch).booking }

        open suspend fun cancelBooking(bookingId: String): NetworkResult<CrewDayBookingDto> =
            write { api.cancelBooking(bookingId).booking }

        open suspend fun askRelease(bookingId: String): NetworkResult<CrewDayBookingDto> =
            write { api.askRelease(bookingId).booking }

        open suspend fun answerPrice(
            bookingId: String,
            approve: Boolean,
        ): NetworkResult<CrewDayBookingDto> =
            write { api.answerPrice(bookingId, CrewDayPriceAnswerBody(approve)).booking }

        open suspend fun gateReady(bookingId: String): NetworkResult<CrewDayBookingDto> =
            write { api.gateReady(bookingId).booking }

        open suspend fun confirm(bookingId: String): NetworkResult<CrewDayBookingDto> =
            write { api.confirm(bookingId).booking }

        open suspend fun reportProblem(
            bookingId: String,
            body: CrewDayProblemBody,
        ): NetworkResult<CrewDayBookingDto> = write { api.reportProblem(bookingId, body).booking }

        open suspend fun answerNewDate(
            bookingId: String,
            proposalId: String,
            choice: String,
        ): NetworkResult<CrewDayBookingDto> =
            write { api.answerNewDate(bookingId, CrewDayNewDateBody(proposalId, choice)).booking }

        /**
         * Uploads one photo ([bytes] of [mimeType]) for [bookingId]; [purpose] is `done` (the crew) or `problem` (the
         * household). The answer's `path` goes into done or problem.
         */
        open suspend fun upload(
            bookingId: String,
            purpose: String,
            bytes: ByteArray,
            mimeType: String,
            fileName: String,
        ): NetworkResult<CrewDayUploadResponse> =
            call {
                val part = MultipartBody.Part.createFormData("photo", fileName, bytes.toRequestBody(mimeType.toMediaType()))
                api.upload(bookingId.toRequestBody(TEXT), purpose.toRequestBody(TEXT), part)
            }

        open suspend fun askForCrewDay(body: CrewDayRequestBody): NetworkResult<CrewDayCardDto> =
            write { api.askForCrewDay(body).request }

        // MARK: - Crew

        open suspend fun business(businessId: String): NetworkResult<CrewDayBusinessResponse> =
            call { api.business(businessId) }

        open suspend fun create(body: CrewDayCreateBody): NetworkResult<CrewDayDto> = write { api.create(body).crewDay }

        open suspend fun edit(
            crewDayId: String,
            body: CrewDayEditBody,
        ): NetworkResult<CrewDayDto> = write { api.edit(crewDayId, body).crewDay }

        open suspend fun submit(crewDayId: String): NetworkResult<CrewDayDto> = write { api.submit(crewDayId).crewDay }

        open suspend fun crewDay(crewDayId: String): NetworkResult<CrewDayCrewViewDto> = call { api.crewDay(crewDayId) }

        open suspend fun setPrice(
            crewDayId: String,
            bookingId: String,
            priceCents: Int,
        ): NetworkResult<CrewDayHomeDto> =
            write { api.setPrice(crewDayId, bookingId, CrewDayPriceBody(priceCents = priceCents)).booking }

        open suspend fun declineHome(
            crewDayId: String,
            bookingId: String,
            note: String?,
        ): NetworkResult<CrewDayHomeDto> =
            write {
                api.setPrice(crewDayId, bookingId, CrewDayPriceBody(decline = true, note = note)).booking
            }

        open suspend fun release(
            crewDayId: String,
            bookingId: String,
        ): NetworkResult<CrewDayHomeDto> = write { api.release(crewDayId, bookingId).booking }

        open suspend fun invitePast(crewDayId: String): NetworkResult<Int> = write { api.invitePast(crewDayId).invited }

        open suspend fun proposeDates(
            crewDayId: String,
            dates: List<CrewDayProposedDateDto>,
            note: String?,
        ): NetworkResult<CrewDayDto> =
            write { api.proposeDates(crewDayId, CrewDayProposeDatesBody(dates, note)).crewDay }

        open suspend fun cancelDay(
            crewDayId: String,
            reason: String?,
        ): NetworkResult<CrewDayDto> = write { api.cancelDay(crewDayId, CrewDayReasonBody(reason)).crewDay }

        open suspend fun route(
            crewDayId: String,
            date: String?,
        ): NetworkResult<CrewDayRouteDto> = call { api.route(crewDayId, date) }

        open suspend fun reorder(
            crewDayId: String,
            bookingIds: List<String>,
        ): NetworkResult<CrewDayRouteDto> = write { api.reorder(crewDayId, CrewDayRouteOrderBody(bookingIds)) }

        open suspend fun onTheWay(
            bookingId: String,
            etaStart: String,
            etaEnd: String,
        ): NetworkResult<CrewDayHomeDto> =
            write { api.onTheWay(bookingId, CrewDayOnTheWayBody(etaStart, etaEnd)).booking }

        open suspend fun runningLate(
            crewDayId: String,
            minutes: Int,
            date: String?,
        ): NetworkResult<CrewDayRunningLateResponse> =
            write { api.runningLate(crewDayId, CrewDayRunningLateBody(minutes, date)) }

        open suspend fun cantGetIn(
            bookingId: String,
            note: String?,
        ): NetworkResult<CrewDayHomeDto> = write { api.cantGetIn(bookingId, CrewDayNoteBody(note)).booking }

        open suspend fun markDone(
            bookingId: String,
            photoPaths: List<String>,
            note: String?,
        ): NetworkResult<CrewDayHomeDto> =
            write { api.markDone(bookingId, CrewDayDoneBody(photoPaths, note)).booking }

        private companion object {
            val TEXT = "text/plain".toMediaType()
        }
    }

/** The contract's error body: `{ "error": "<sentence for people>", "code": "<CODE>" }`. */
private fun NetworkError.errorJson(): JSONObject? {
    val body =
        when (this) {
            is NetworkError.ClientError -> body
            is NetworkError.Forbidden -> body
            is NetworkError.Server -> body
            else -> null
        }
    return body?.let { runCatching { JSONObject(it) }.getOrNull() }
}

/** The refusal's machine code (`DAY_FULL`, `BOOKING_CLOSED`, `ASK_THE_CREW`, `CREW_DAY_UNAVAILABLE` …), when it has one. */
val NetworkError.crewDayCode: String?
    get() = errorJson()?.optString("code")?.takeIf { it.isNotBlank() } ?: if (this == NetworkError.NotFound) "NOT_FOUND" else null

/** The server's sentence for people, else this error's own copy. */
val NetworkError.crewDayMessage: String
    get() =
        errorJson()?.let { json ->
            json.optString("error").takeIf { it.isNotBlank() && !NetworkError.ClientError.isMachineCode(it) }
                ?: json.optString("message").takeIf { it.isNotBlank() }
        } ?: message
