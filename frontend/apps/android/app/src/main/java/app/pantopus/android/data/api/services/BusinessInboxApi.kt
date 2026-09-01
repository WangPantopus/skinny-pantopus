package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.businessinbox.BusinessInboxRoomsResponse
import app.pantopus.android.data.api.models.businessinbox.BusinessMatchedPostsResponse
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The business-side inbox (RN `components/business/tabs/InboxTab.tsx`).
 * Two sections, two routes — Messages (rooms addressed to the business
 * identity) and Mentions (neighborhood posts matched to the business).
 *
 * Both are seat-scoped: the chat route runs `canActAsBusiness`, the
 * matched-posts route runs `checkBusinessPermission`, so a viewer without a
 * seat gets a 403 rather than an empty list. Mirrors iOS
 * `BusinessInboxEndpoints.swift`.
 */
interface BusinessInboxApi {
    /** `GET /api/chat/business/:businessUserId/rooms` — shared business
     *  inbox, newest last-message first.
     *  Route `backend/routes/chats.js:662`. */
    @GET("api/chat/business/{businessId}/rooms")
    suspend fun rooms(
        @Path("businessId") businessId: String,
        @Query("limit") limit: Int = 200,
        @Query("type") type: String? = null,
    ): BusinessInboxRoomsResponse

    /** `GET /api/businesses/:businessId/matched-posts` — neighborhood posts
     *  whose `matched_business_ids` contains this business. The server caps
     *  `page_size` at 50. Route `backend/routes/businesses.js:4367`. */
    @GET("api/businesses/{businessId}/matched-posts")
    suspend fun matchedPosts(
        @Path("businessId") businessId: String,
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 30,
    ): BusinessMatchedPostsResponse
}
