package app.pantopus.android.data.moments.sound

import app.pantopus.android.data.api.models.moments.MomentEnvelope
import app.pantopus.android.data.pulse.PulseReinventedFeature
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import dagger.Module
import dagger.Provides
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Retrofit
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import javax.inject.Singleton

/*
 * "Pulse, reinvented" phase 2, sound (PHASE-2 piece 10; CONTRACT 7e): place sound and a dot's voice whisper are media
 * like a Moment's video. They go up after the Moment is made (`POST /api/reinvented/moments/:id/sound`), only while the
 * switch is on for the author and never under a made-up name. Every Moment answer to a reader whose switch is on adds
 * `sound`; with the switch off the server sends no such key and today's screens show the plain picture.
 */

/** The sound a Moment carries, as a switch-on reader reads it. `url` is a short signed link, given with the picture's. */
@JsonClass(generateAdapter = true)
data class MomentSoundDto(
    // Defaults, so a sound this app can't read never stops a Moment from opening: it is simply not played.
    val kind: String = "",
    val url: String? = null,
    @Json(name = "duration_ms") val durationMs: Long? = null,
    /** A voice's words with their times (Voice Spark); null for place sound. */
    val words: List<MomentSoundWordDto>? = null,
    /** The app cleaned wind from it on the phone: said wherever it plays. */
    val cleaned: Boolean = false,
) {
    companion object {
        const val PLACE = "place"
        const val VOICE = "voice"
        const val WHISPER = "whisper"

        /** Place sound and a whisper: up to 3.5 seconds (the server's limit); the Studio records three. */
        const val SHORT_MS = 3_000L
    }
}

/** One spoken word and when it is said, from the start of the sound. */
@JsonClass(generateAdapter = true)
data class MomentSoundWordDto(
    val w: String = "",
    @Json(name = "start_ms") val startMs: Long = 0,
    @Json(name = "end_ms") val endMs: Long = 0,
)

interface MomentSoundApi {
    /** CONTRACT 7e: one sound for the author's own Moment, before it ends; the same kind again replaces it. */
    @Multipart
    @POST("api/reinvented/moments/{id}/sound")
    suspend fun upload(
        @Path("id") id: String,
        @Part file: MultipartBody.Part,
        @Part("kind") kind: RequestBody,
        @Part("duration_ms") durationMs: RequestBody,
        @Part("cleaned") cleaned: RequestBody? = null,
        @Part("dot") dot: RequestBody? = null,
    ): MomentEnvelope
}

/** This piece's own module from the app's one Retrofit (the app's network module is untouched). */
@Module
@InstallIn(SingletonComponent::class)
object MomentSoundModule {
    @Provides
    @Singleton
    fun provideMomentSoundApi(retrofit: Retrofit): MomentSoundApi = retrofit.create(MomentSoundApi::class.java)
}

/** What the Studio's sounds need once the Moment is made, reached from the application (no screen holds them then). */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface MomentSoundEntryPoint {
    fun soundApi(): MomentSoundApi

    fun pulseReinvented(): PulseReinventedFeature
}
