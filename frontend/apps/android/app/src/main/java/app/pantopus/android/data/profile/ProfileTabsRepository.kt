package app.pantopus.android.data.profile

import app.pantopus.android.data.api.models.profile.FileDeleteResponse
import app.pantopus.android.data.api.models.profile.GigReviewsResponse
import app.pantopus.android.data.api.models.profile.PortfolioListResponse
import app.pantopus.android.data.api.models.profile.PortfolioUploadResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.FilesApi
import app.pantopus.android.data.api.services.ReviewsApi
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Reads behind the public-profile Portfolio and Reviews tabs. The Gigs
 * tab is served by `GigsRepository.userGigs`, which already owns
 * `/api/gigs`.
 *
 *   `GET  /api/files/portfolio`          — `backend/routes/files.js:489`
 *   `GET  /api/files/portfolio/{userId}` — `backend/routes/files.js:526`
 *   `POST /api/files/portfolio`          — `backend/routes/files.js:362`
 *   `DELETE /api/files/{id}`             — `backend/routes/files.js:853`
 *   `GET  /api/reviews/user/{userId}`    — `backend/routes/reviews.js:149`
 */
@Singleton
class ProfileTabsRepository
    @Inject
    constructor(
        private val filesApi: FilesApi,
        private val reviewsApi: ReviewsApi,
    ) {
        /**
         * Your own portfolio reads the authenticated route so private
         * documents come back too; someone else's reads the public one,
         * which filters `visibility = 'public'`.
         */
        suspend fun portfolio(
            userId: String,
            isOwnProfile: Boolean,
        ): NetworkResult<PortfolioListResponse> =
            safeApiCall {
                if (isOwnProfile) filesApi.myPortfolio() else filesApi.userPortfolio(userId)
            }

        /** `POST /api/files/portfolio` — single `file` part plus form fields. */
        suspend fun uploadPortfolioItem(
            filename: String,
            mimeType: String,
            bytes: ByteArray,
            title: String,
            description: String?,
            category: String?,
        ): NetworkResult<PortfolioUploadResponse> =
            safeApiCall {
                val filePart =
                    MultipartBody.Part.createFormData(
                        name = "file",
                        filename = filename,
                        body = bytes.toRequestBody(mimeType.toMediaTypeOrNull()),
                    )
                filesApi.uploadPortfolio(
                    file = filePart,
                    title = title.asFormField(),
                    description = description?.takeIf { it.isNotBlank() }?.asFormField(),
                    category = category?.takeIf { it.isNotBlank() }?.asFormField(),
                )
            }

        /** `DELETE /api/files/{id}` — soft-delete one owned file. */
        suspend fun deleteFile(id: String): NetworkResult<FileDeleteResponse> = safeApiCall { filesApi.deleteFile(id) }

        /** `GET /api/reviews/user/{userId}` — gig reviews received. */
        suspend fun userGigReviews(
            userId: String,
            limit: Int = REVIEW_PAGE_LIMIT,
        ): NetworkResult<GigReviewsResponse> = safeApiCall { reviewsApi.userReviews(userId, limit) }

        private fun String.asFormField(): RequestBody = toRequestBody("text/plain".toMediaTypeOrNull())

        companion object {
            /** The route clamps `limit` to 50 (`backend/routes/reviews.js:152`). */
            const val REVIEW_PAGE_LIMIT = 50
        }
    }
