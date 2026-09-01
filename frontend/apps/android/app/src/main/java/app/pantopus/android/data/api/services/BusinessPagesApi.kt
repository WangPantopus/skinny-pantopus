package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.business_pages.BusinessPageBlocksResponse
import app.pantopus.android.data.api.models.business_pages.BusinessPageEnvelope
import app.pantopus.android.data.api.models.business_pages.BusinessPageRevisionsResponse
import app.pantopus.android.data.api.models.business_pages.BusinessPagesResponse
import app.pantopus.android.data.api.models.business_pages.CreateBusinessPageRequest
import app.pantopus.android.data.api.models.business_pages.PublicBusinessPageResponse
import app.pantopus.android.data.api.models.business_pages.PublishBusinessPageResponse
import app.pantopus.android.data.api.models.business_pages.RestoreBusinessPageRevisionResponse
import app.pantopus.android.data.api.models.business_pages.SaveBusinessPageBlocksRequest
import app.pantopus.android.data.api.models.business_pages.SaveBusinessPageBlocksResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * C4 — the business Pages CMS. Every custom-page, block and revision route
 * lives under the `/api/businesses` mount (`backend/app.js:348`), NOT under
 * `/api/b` (`backend/app.js:350`) — that prefix only serves the two public
 * reads, one of which is [publicPage] below.
 */
interface BusinessPagesApi {
    /** `GET /api/businesses/:id/pages` — route `backend/routes/businesses.js:2865`. */
    @GET("api/businesses/{businessId}/pages")
    suspend fun pages(
        @Path("businessId") businessId: String,
    ): BusinessPagesResponse

    /** `POST /api/businesses/:id/pages` — route `backend/routes/businesses.js:2809`. */
    @POST("api/businesses/{businessId}/pages")
    suspend fun createPage(
        @Path("businessId") businessId: String,
        @Body body: CreateBusinessPageRequest,
    ): BusinessPageEnvelope

    /** `DELETE /api/businesses/:id/pages/:pageId` — route `backend/routes/businesses.js:2949`. */
    @DELETE("api/businesses/{businessId}/pages/{pageId}")
    suspend fun deletePage(
        @Path("businessId") businessId: String,
        @Path("pageId") pageId: String,
    )

    /** `GET …/pages/:pageId/blocks` — route `backend/routes/businesses.js:3006`. */
    @GET("api/businesses/{businessId}/pages/{pageId}/blocks")
    suspend fun blocks(
        @Path("businessId") businessId: String,
        @Path("pageId") pageId: String,
        @Query("revision") revision: String = "draft",
    ): BusinessPageBlocksResponse

    /** `PUT …/pages/:pageId/blocks` — route `backend/routes/businesses.js:3066`. */
    @PUT("api/businesses/{businessId}/pages/{pageId}/blocks")
    suspend fun saveDraftBlocks(
        @Path("businessId") businessId: String,
        @Path("pageId") pageId: String,
        @Body body: SaveBusinessPageBlocksRequest,
    ): SaveBusinessPageBlocksResponse

    /** `POST …/pages/:pageId/publish` — route `backend/routes/businesses.js:3153`. */
    @POST("api/businesses/{businessId}/pages/{pageId}/publish")
    suspend fun publishPage(
        @Path("businessId") businessId: String,
        @Path("pageId") pageId: String,
    ): PublishBusinessPageResponse

    /** `GET …/pages/:pageId/revisions` — route `backend/routes/businesses.js:3241`. */
    @GET("api/businesses/{businessId}/pages/{pageId}/revisions")
    suspend fun revisions(
        @Path("businessId") businessId: String,
        @Path("pageId") pageId: String,
    ): BusinessPageRevisionsResponse

    /** `POST …/revisions/:rev/restore` — route `backend/routes/businesses.js:3277`. */
    @POST("api/businesses/{businessId}/pages/{pageId}/revisions/{revision}/restore")
    suspend fun restoreRevision(
        @Path("businessId") businessId: String,
        @Path("pageId") pageId: String,
        @Path("revision") revision: Int,
    ): RestoreBusinessPageRevisionResponse

    /**
     * `GET /api/b/:username/:slug` — the public read for one named page plus
     * its published blocks. No auth. Route
     * `backend/routes/businessPublicPage.js:62`.
     */
    @GET("api/b/{username}/{slug}")
    suspend fun publicPage(
        @Path("username") username: String,
        @Path("slug") slug: String,
    ): PublicBusinessPageResponse
}
