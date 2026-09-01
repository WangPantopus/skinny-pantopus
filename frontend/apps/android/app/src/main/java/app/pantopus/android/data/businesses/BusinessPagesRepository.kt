package app.pantopus.android.data.businesses

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
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessPagesApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * C4 — wraps the business Pages CMS endpoints in the [NetworkResult]
 * taxonomy. Mirrors iOS `BusinessPagesEndpoints`.
 */
@Singleton
open class BusinessPagesRepository
    @Inject
    constructor(
        private val api: BusinessPagesApi,
    ) {
        /** `GET /:id/pages`. */
        open suspend fun pages(businessId: String): NetworkResult<BusinessPagesResponse> = safeApiCall { api.pages(businessId) }

        /** `POST /:id/pages`. */
        open suspend fun createPage(
            businessId: String,
            slug: String,
            title: String,
        ): NetworkResult<BusinessPageEnvelope> =
            safeApiCall {
                api.createPage(
                    businessId,
                    CreateBusinessPageRequest(slug = slug, title = title, showInNav = true),
                )
            }

        /** `DELETE /:id/pages/:pageId`. */
        open suspend fun deletePage(
            businessId: String,
            pageId: String,
        ): NetworkResult<Unit> = safeApiCall { api.deletePage(businessId, pageId) }

        /** `GET /:id/pages/:pageId/blocks`. */
        open suspend fun blocks(
            businessId: String,
            pageId: String,
            revision: String = "draft",
        ): NetworkResult<BusinessPageBlocksResponse> = safeApiCall { api.blocks(businessId, pageId, revision) }

        /** `PUT /:id/pages/:pageId/blocks`. */
        open suspend fun saveDraftBlocks(
            businessId: String,
            pageId: String,
            body: SaveBusinessPageBlocksRequest,
        ): NetworkResult<SaveBusinessPageBlocksResponse> = safeApiCall { api.saveDraftBlocks(businessId, pageId, body) }

        /** `POST /:id/pages/:pageId/publish`. */
        open suspend fun publishPage(
            businessId: String,
            pageId: String,
        ): NetworkResult<PublishBusinessPageResponse> = safeApiCall { api.publishPage(businessId, pageId) }

        /** `GET /:id/pages/:pageId/revisions`. */
        open suspend fun revisions(
            businessId: String,
            pageId: String,
        ): NetworkResult<BusinessPageRevisionsResponse> = safeApiCall { api.revisions(businessId, pageId) }

        /** `POST /:id/pages/:pageId/revisions/:rev/restore`. */
        open suspend fun restoreRevision(
            businessId: String,
            pageId: String,
            revision: Int,
        ): NetworkResult<RestoreBusinessPageRevisionResponse> = safeApiCall { api.restoreRevision(businessId, pageId, revision) }

        /** `GET /api/b/:username/:slug` — public named page + published blocks. */
        open suspend fun publicPage(
            username: String,
            slug: String,
        ): NetworkResult<PublicBusinessPageResponse> = safeApiCall { api.publicPage(username, slug) }
    }
