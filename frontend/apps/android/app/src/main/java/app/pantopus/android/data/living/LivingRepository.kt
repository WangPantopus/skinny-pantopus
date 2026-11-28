package app.pantopus.android.data.living

import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.data.pulse.PulseReinventedFeature
import app.pantopus.android.data.pulse.ReinventedBox
import app.pantopus.android.data.pulse.StudioRepository
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/** The living world's reads (CONTRACT 9). A 403 `PULSE_REINVENTED_OFF` turns the switch off at once. */
@Singleton
class LivingRepository
    @Inject
    constructor(
        private val api: LivingApi,
        private val choices: LivingChoicesApi,
        private val feature: PulseReinventedFeature,
    ) {
        /** CONTRACT 9h: the live beams in the map's box. */
        suspend fun beams(box: ReinventedBox): NetworkResult<List<LivingBeamDto>> =
            guarded { api.beams(box.south.fixed(), box.west.fixed(), box.north.fixed(), box.east.fixed()).beams }

        /** CONTRACT 9b: Ask the map, for the map's box and time. */
        suspend fun askMap(
            q: String,
            box: ReinventedBox,
            time: String,
        ): NetworkResult<LivingAskAnswer> = guarded { api.askMap(LivingAskBody(q, box.south, box.west, box.north, box.east, time)) }

        /** CONTRACT 9b: Atlas search, a page after [cursor]. */
        suspend fun atlasSearch(
            q: String,
            cursor: String?,
        ): NetworkResult<LivingAtlasSearchPage> = guarded { api.atlasSearch(LivingAtlasSearchBody(q, cursor)) }

        /** CONTRACT 9c: the person's followed places. */
        suspend fun places(): NetworkResult<List<LivingFollowedPlaceDto>> = guarded { choices.places().places }

        /** CONTRACT 9c: follow a place, by the name and point the place picker answered. */
        suspend fun follow(
            label: String,
            latitude: Double,
            longitude: Double,
        ): NetworkResult<LivingFollowAnswer> = guarded { choices.follow(LivingFollowBody(label.take(MAX_LABEL), latitude, longitude)) }

        suspend fun unfollow(id: String): NetworkResult<Unit> = guarded { choices.unfollow(id) }

        /** CONTRACT 9c: constellations near the phone's place (in the body, never kept). */
        suspend fun constellations(
            latitude: Double,
            longitude: Double,
        ): NetworkResult<LivingConstellationsDto> = guarded { api.constellations(LivingPointDto(latitude, longitude)) }

        /** CONTRACT 9d: a person's cabinet. */
        suspend fun cabinet(userId: String): NetworkResult<LivingCabinetDto> = guarded { api.cabinet(userId).cabinet }

        /** CONTRACT 9d: the reader's own poster for [year]. */
        suspend fun poster(year: Int): NetworkResult<LivingPosterDto> = guarded { api.poster(year).poster }

        /** CONTRACT 9d: "Show my cabinet to people I know". */
        suspend fun showCabinet(on: Boolean): NetworkResult<Unit> = guarded { choices.showCabinet(LivingCabinetChoice(on)) }

        /** CONTRACT 9e: the person's Echoes choice (`off` when not set). */
        suspend fun echoesChoice(): NetworkResult<String> = guarded { choices.settings().echoes ?: ECHOES_OFF }

        suspend fun setEchoes(choice: String): NetworkResult<Unit> = guarded { choices.setEchoes(LivingEchoesChoice(choice)) }

        /** CONTRACT 9e: today's echoes and twins (only read while the person takes part). */
        suspend fun echoes(): NetworkResult<LivingEchoesDto> = guarded { choices.echoes() }

        /** CONTRACT 9f: the windows of the reader's circles. */
        suspend fun windows(): NetworkResult<List<LivingWindowDto>> = guarded { choices.windows().windows }

        /** CONTRACT 9f: the reader's own window on [circleId], or null when they show none. */
        suspend fun myWindow(circleId: String): NetworkResult<String?> =
            guarded { choices.circlesWindows().circles.firstOrNull { it.id == circleId }?.myWindow?.label }

        /** CONTRACT 9f: show a window named [label] to the circle, or stop with null. */
        suspend fun setWindow(
            circleId: String,
            label: String?,
        ): NetworkResult<Unit> = guarded { choices.setWindow(circleId, windowBody(label)) }

        /** CONTRACT 9g: the place sounds in the map's box, for its time. */
        suspend fun sounds(
            box: ReinventedBox,
            time: String,
        ): NetworkResult<List<LivingSoundDto>> =
            guarded { api.sounds(box.south.fixed(), box.west.fixed(), box.north.fixed(), box.east.fixed(), time).sounds }

        private suspend fun <T> guarded(call: suspend () -> T): NetworkResult<T> {
            val answer = safeApiCall { call() }
            if (answer is NetworkResult.Failure && answer.error.serverCode == StudioRepository.SWITCH_OFF) feature.refusedOff()
            return answer
        }
    }

/** What a refused search says (CONTRACT 9b): too many, or not words it can search. */
internal fun searchRefusal(error: NetworkError): String =
    when {
        error.code == HTTP_TOO_MANY -> "That's a lot of searching. Wait a minute, then try again."
        error.serverCode == "SEARCH_INVALID" || error.code == HTTP_BAD_REQUEST ->
            "Try a word or two, like \u201Cmushroom\u201D or \u201Csunset\u201D."
        else -> "Search couldn't finish. Try again."
    }

internal const val ECHOES_OFF = "off"
internal const val ECHOES_ON = "on"
internal const val ECHOES_NAMES = "names"
private const val HTTP_BAD_REQUEST = 400
private const val MAX_LABEL = 60
private const val MAX_WINDOW = 30
private const val HTTP_TOO_MANY = 429

/** `{ "window": { "label" } }`, or `{ "window": null }` to stop: the key is always sent (the app's JSON leaves nulls out). */
private fun windowBody(label: String?): RequestBody {
    val window = label?.let { JSONObject().put("label", it.take(MAX_WINDOW)) } ?: JSONObject.NULL
    return JSONObject().put("window", window).toString().toRequestBody("application/json".toMediaType())
}

/** A box's side as the map sends it: five decimals, a dot whatever the phone's language. */
internal fun Double.fixed(): String = String.format(Locale.US, "%.5f", this)
