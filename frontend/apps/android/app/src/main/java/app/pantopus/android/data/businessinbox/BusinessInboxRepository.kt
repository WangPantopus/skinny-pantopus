package app.pantopus.android.data.businessinbox

import app.pantopus.android.data.api.models.businessinbox.BusinessInboxRoomsResponse
import app.pantopus.android.data.api.models.businessinbox.BusinessMatchedPostsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessInboxApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [BusinessInboxApi] in the `NetworkResult` taxonomy. */
@Singleton
class BusinessInboxRepository
    @Inject
    constructor(
        private val api: BusinessInboxApi,
    ) {
        /** Messages section — rooms addressed to the business identity. */
        suspend fun rooms(businessId: String): NetworkResult<BusinessInboxRoomsResponse> = safeApiCall { api.rooms(businessId) }

        /** Mentions section — neighborhood posts matched to the business. */
        suspend fun matchedPosts(
            businessId: String,
            page: Int = 1,
            pageSize: Int = 30,
        ): NetworkResult<BusinessMatchedPostsResponse> = safeApiCall { api.matchedPosts(businessId, page, pageSize) }
    }
