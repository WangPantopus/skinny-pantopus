@file:Suppress("TooManyFunctions")

package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.ai.AICardStateReportBody
import app.pantopus.android.data.api.models.ai.AIConversationMessagesResponse
import app.pantopus.android.data.api.models.ai.AIConversationsResponse
import app.pantopus.android.data.api.models.ai.AIDraftListingVisionRequest
import app.pantopus.android.data.api.models.ai.AIDraftPickupScheduleRequest
import app.pantopus.android.data.api.models.ai.AIDraftPickupScheduleResponse
import app.pantopus.android.data.api.models.ai.AIDraftPostRequest
import app.pantopus.android.data.api.models.ai.AIListingVisionResponse
import app.pantopus.android.data.api.models.ai.AIMemoryEditBody
import app.pantopus.android.data.api.models.ai.AIMemoryForgetAllResponse
import app.pantopus.android.data.api.models.ai.AIMemoryItemResponse
import app.pantopus.android.data.api.models.ai.AIMemoryListResponse
import app.pantopus.android.data.api.models.ai.AIMemoryReviewedResponse
import app.pantopus.android.data.api.models.ai.AINeedsYouResponse
import app.pantopus.android.data.api.models.ai.AIPostDraftResponse
import app.pantopus.android.data.api.models.ai.AIRuleChangeBody
import app.pantopus.android.data.api.models.ai.AIRuleResponse
import app.pantopus.android.data.api.models.ai.AIRulesResponse
import app.pantopus.android.data.api.models.place.NeighborhoodPulse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
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
    suspend fun conversations(
        @Query("order") order: String? = null,
    ): AIConversationsResponse

    /**
     * One conversation's earlier turns, for a restored thread. [cards] is the
     * chat request's card list, comma-separated: the server leaves out the
     * cards an app doesn't list (AI assistant phase 1 contract, section 4.1).
     * Route `backend/routes/ai.js:459`.
     */
    @GET("api/ai/conversations/{id}/messages")
    suspend fun conversationMessages(
        @Path("id") id: String,
        @Query("cards") cards: String,
    ): AIConversationMessagesResponse

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

    /**
     * The pickup days on a photo of a household's hauler's flyer, for the Today
     * pickup editor to fill in. Nothing is saved: the editor's own Save writes
     * the days. Route `backend/routes/ai.js:249`.
     */
    @POST("api/ai/draft/pickup-schedule")
    suspend fun draftPickupSchedule(
        @Body body: AIDraftPickupScheduleRequest,
    ): AIDraftPickupScheduleResponse

    /**
     * Delete one of the user's AI conversations (the assistant thread's "Delete conversation").
     * Route `backend/routes/ai.js:451`.
     */
    @DELETE("api/ai/conversations/{id}")
    suspend fun deleteConversation(
        @Path("id") id: String,
    ): Unit

    /**
     * What ran on one of the assistant's action cards, so the person's other phones show it too (AI assistant phase 3
     * contract §4.2). `404 CARD_UNKNOWN` for a card the server has no record of. Route `backend/routes/ai.js:577`.
     */
    @POST("api/ai/cards/{cardId}/state")
    suspend fun reportCardState(
        @Path("cardId") cardId: String,
        @Body body: AICardStateReportBody,
    ): Unit

    /**
     * What the person asked Pantopus to remember, newest first, with the yearly review's date (AI assistant phase 3
     * contract §5.4). Only their own items. Route `backend/routes/ai.js:598`.
     */
    @GET("api/ai/memory")
    suspend fun memory(): AIMemoryListResponse

    /**
     * New words for a remembered fact, checked as a new one; it counts as reviewing it. `400 MEMORY_FACT_INVALID`
     * carries the reason. Route `backend/routes/ai.js:611`.
     */
    @PATCH("api/ai/memory/{id}")
    suspend fun editMemory(
        @Path("id") id: String,
        @Body body: AIMemoryEditBody,
    ): AIMemoryItemResponse

    /** Forget one item (204). Route `backend/routes/ai.js:615`. */
    @DELETE("api/ai/memory/{id}")
    suspend fun forgetMemory(
        @Path("id") id: String,
    ): Unit

    /** Forget everything. Route `backend/routes/ai.js:620`. */
    @DELETE("api/ai/memory")
    suspend fun forgetAllMemory(): AIMemoryForgetAllResponse

    /** "Looks right": every item counts as reviewed for another year. Route `backend/routes/ai.js:607`. */
    @POST("api/ai/memory/reviewed")
    suspend fun memoryReviewed(): AIMemoryReviewedResponse

    /**
     * What waits on the person, most urgent first, for Today's Needs you card (AI assistant phase 3 contract §6.2).
     * Read through the screens' store: sends the stored ETag; a 304 means the copy is current.
     * Route `backend/routes/ai.js:628`.
     */
    @GET("api/ai/needs-you")
    suspend fun needsYou(
        @Header("If-None-Match") etag: String?,
    ): Response<AINeedsYouResponse>

    /** The person's standing rules with their last runs (AI assistant phase 3 contract §18.5). Route `backend/routes/ai.js:688`. */
    @GET("api/ai/rules")
    suspend fun rules(): AIRulesResponse

    /**
     * Switch a rule off or on (turning it on checks again that it can run: `409 RULE_CANNOT_RUN` says why not), or give
     * a weekly plan 12 more weeks. Route `backend/routes/ai.js:699`.
     */
    @PATCH("api/ai/rules/{id}")
    suspend fun changeRule(
        @Path("id") id: String,
        @Body body: AIRuleChangeBody,
    ): AIRuleResponse

    /** Delete a rule and its runs (204); the plans it posted stay. Route `backend/routes/ai.js:703`. */
    @DELETE("api/ai/rules/{id}")
    suspend fun deleteRule(
        @Path("id") id: String,
    ): Unit
}
