package app.pantopus.android.data.moments.fieldcard

import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.moments.serverCode
import app.pantopus.android.data.pulse.PulseReinventedFeature
import app.pantopus.android.data.pulse.StudioRepository
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import javax.inject.Inject
import javax.inject.Singleton

/*
 * "Pulse, reinvented" phase 2, field cards and Collect (PHASE-2 piece 2, board B3; CONTRACT 7d, 7f). A reader taps a
 * `thing` dot: the first tap anywhere makes its card (one Pantopus AI call on the server, kept with the post), every
 * later tap reads the kept card. It always says "likely", gives one line of why and a source that opens, never says a
 * plant or mushroom is safe to eat, and people can say it is not right. "Collect" keeps it in the reader's own field
 * guide. Switch on only; with the switch off no `thing` dot is drawn and none of these is asked.
 */

@JsonClass(generateAdapter = true)
data class MomentFieldCardSourceDto(
    val title: String? = null,
    val url: String? = null,
)

@JsonClass(generateAdapter = true)
data class MomentFieldCardCorrectionDto(
    val name: String = "",
    val note: String? = null,
)

/** A kept field card, as the server answers it (CONTRACT 7d), with whether this reader collected it (7f). */
@JsonClass(generateAdapter = true)
data class MomentFieldCardDto(
    /** Null when the picture shows nothing it can name (`why` then says so). */
    val name: String? = null,
    val likely: Boolean = true,
    val scientific: String? = null,
    val why: String? = null,
    val source: MomentFieldCardSourceDto? = null,
    /** For a plant, berry, seed or mushroom: "Never eat a wild plant or mushroom on a guess." */
    val caution: String? = null,
    @Json(name = "named_by") val namedBy: String? = null,
    @Json(name = "made_at") val madeAt: String? = null,
    val corrections: Int = 0,
    @Json(name = "my_correction") val myCorrection: MomentFieldCardCorrectionDto? = null,
    val collected: Boolean? = null,
)

@JsonClass(generateAdapter = true)
data class MomentFieldCardAnswer(
    val card: MomentFieldCardDto,
)

@JsonClass(generateAdapter = true)
data class MomentFieldCardCorrectionBody(
    val name: String,
    val note: String? = null,
)

/** One collected card in the reader's field guide; its words stay after the post ends. */
@JsonClass(generateAdapter = true)
data class MomentFieldGuideEntryDto(
    @Json(name = "post_id") val postId: String = "",
    @Json(name = "dot_id") val dotId: String = "",
    @Json(name = "collected_at") val collectedAt: String? = null,
    val card: MomentFieldCardDto = MomentFieldCardDto(),
    /** Whether the reader can still open the post now. */
    val open: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class MomentFieldGuidePage(
    val cards: List<MomentFieldGuideEntryDto> = emptyList(),
    @Json(name = "next_cursor") val nextCursor: String? = null,
)

/** The person's own "Pantopus AI" choice (on by default). */
@JsonClass(generateAdapter = true)
data class MomentPantopusAiChoice(
    @Json(name = "pantopus_ai") val pantopusAi: Boolean = true,
)

interface MomentFieldCardApi {
    /** CONTRACT 7d: the thing's card, made on the first tap anywhere and kept; later taps read it. */
    @POST("api/reinvented/dots/{id}/{dot}/card")
    suspend fun card(
        @Path("id") id: String,
        @Path("dot") dot: String,
    ): MomentFieldCardAnswer

    /** "Not right?": what the reader thinks it is; the card stays as it is. */
    @POST("api/reinvented/dots/{id}/{dot}/card/correction")
    suspend fun correct(
        @Path("id") id: String,
        @Path("dot") dot: String,
        @Body body: MomentFieldCardCorrectionBody,
    ): MomentFieldCardAnswer

    /** CONTRACT 7f: keep the card in the reader's field guide. */
    @POST("api/reinvented/dots/{id}/{dot}/collect")
    suspend fun collect(
        @Path("id") id: String,
        @Path("dot") dot: String,
    ): MomentFieldCardAnswer

    @DELETE("api/reinvented/dots/{id}/{dot}/collect")
    suspend fun letGo(
        @Path("id") id: String,
        @Path("dot") dot: String,
    )

    @GET("api/reinvented/field-guide")
    suspend fun fieldGuide(
        @Query("cursor") cursor: String? = null,
    ): MomentFieldGuidePage

    @GET("api/reinvented/settings")
    suspend fun settings(): MomentPantopusAiChoice

    @PATCH("api/reinvented/settings")
    suspend fun setPantopusAi(
        @Body body: MomentPantopusAiChoice,
    ): MomentPantopusAiChoice
}

@Module
@InstallIn(SingletonComponent::class)
object MomentFieldCardModule {
    @Provides
    @Singleton
    fun provideMomentFieldCardApi(retrofit: Retrofit): MomentFieldCardApi = retrofit.create(MomentFieldCardApi::class.java)
}

/** The field cards' reads and writes; "the switch is off" from the server turns the new screens back at once. */
@Singleton
class MomentFieldCardRepository
    @Inject
    constructor(
        private val api: MomentFieldCardApi,
        private val feature: PulseReinventedFeature,
    ) {
        suspend fun card(
            id: String,
            dot: String,
        ): NetworkResult<MomentFieldCardDto> = guarded { api.card(id, dot).card }

        suspend fun correct(
            id: String,
            dot: String,
            name: String,
            note: String?,
        ): NetworkResult<MomentFieldCardDto> = guarded { api.correct(id, dot, MomentFieldCardCorrectionBody(name, note)).card }

        suspend fun collect(
            id: String,
            dot: String,
            keep: Boolean,
        ): NetworkResult<MomentFieldCardDto?> =
            guarded {
                if (keep) {
                    api.collect(id, dot).card
                } else {
                    api.letGo(id, dot)
                    null
                }
            }

        suspend fun fieldGuide(cursor: String?): NetworkResult<MomentFieldGuidePage> = guarded { api.fieldGuide(cursor) }

        /** The person's own Pantopus AI choice; on when it can't be read (the server decides again on each call). */
        suspend fun pantopusAi(): NetworkResult<Boolean> = guarded { api.settings().pantopusAi }

        suspend fun setPantopusAi(on: Boolean): NetworkResult<Boolean> =
            guarded { api.setPantopusAi(MomentPantopusAiChoice(on)).pantopusAi }

        private suspend fun <T> guarded(call: suspend () -> T): NetworkResult<T> {
            val answer = safeApiCall { call() }
            if (answer is NetworkResult.Failure && answer.error.serverCode == StudioRepository.SWITCH_OFF) feature.refusedOff()
            return answer
        }
    }

/** What a refused card says (CONTRACT 7d), in the iPhone's words; null for anything else. */
fun fieldCardRefusal(error: NetworkError): String? =
    when (error.serverCode) {
        "PANTOPUS_AI_OFF" -> "Pantopus AI is off for you. Turn it on in Settings."
        "FIELD_CARD_OFF" -> "The author keeps Pantopus AI off for their photos."
        "AI_DISABLED" -> "Naming things isn't available right now."
        "AI_BUDGET" -> "That's all the new cards for today. Try again tomorrow."
        "FIELD_CARD_FAILED", "PANTOPUS_AI_UNAVAILABLE" -> "Couldn't name it this time. Try again."
        else -> null
    }
