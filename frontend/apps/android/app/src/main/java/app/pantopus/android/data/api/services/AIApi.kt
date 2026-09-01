package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.ai.AIConversationsResponse
import app.pantopus.android.data.api.models.ai.AIDraftListingVisionRequest
import app.pantopus.android.data.api.models.ai.AIDraftPostRequest
import app.pantopus.android.data.api.models.ai.AIListingVisionResponse
import app.pantopus.android.data.api.models.ai.AIPostDraftResponse
import app.pantopus.android.data.api.models.ai.TranscriptionResponse
import app.pantopus.android.data.api.models.place.NeighborhoodPulse
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Query

/**
 * AI assistant endpoints under `/api/ai/[*]` from `backend/routes/ai.js`.
 * The streaming chat itself rides raw SSE in [app.pantopus.android.data.ai.AIChatRepository];
 * this interface covers the plain JSON management routes.
 */
interface AIApi {
    /**
     * List the user's AI conversations, newest-updated first.
     * Route `backend/routes/ai.js:358`.
     */
    @GET("api/ai/conversations")
    suspend fun conversations(): AIConversationsResponse

    /**
     * The Neighborhood Pulse for a home — the priority-ranked signal
     * stream behind the Place "Today's Pulse" surface. NOTE: the query
     * param is camelCase `homeId` (Joi `pulseSchema`,
     * `backend/routes/ai.js:102`). Route `backend/routes/ai.js:332`.
     */
    @GET("api/ai/pulse")
    suspend fun pulse(
        @Query("homeId") homeId: String,
    ): NeighborhoodPulse

    /**
     * A12.8 — Whisper transcription of a recorded voice note (m4a/AAC,
     * ≤25 MB, part name `audio`). Route `backend/routes/ai.js:387`.
     */
    @Multipart
    @POST("api/ai/transcribe")
    suspend fun transcribe(
        @Part audio: MultipartBody.Part,
    ): TranscriptionResponse

    /**
     * A12.9 Snap & Sell — draft listing fields from up to five base64
     * data-URL photos. Route `backend/routes/ai.js:199`.
     */
    @POST("api/ai/draft/listing-vision")
    suspend fun draftListingVision(
        @Body body: AIDraftListingVisionRequest,
    ): AIListingVisionResponse

    /**
     * Single-turn post draft from a free-text prompt. Edit Profile's
     * "Generate with AI" bio action feeds it the name / skills / tagline
     * / city the user already entered and writes `draft.content` back
     * into the bio field. Route `backend/routes/ai.js:218`.
     */
    @POST("api/ai/draft/post")
    suspend fun draftPost(
        @Body body: AIDraftPostRequest,
    ): AIPostDraftResponse
}
