package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.FileUploadResponse
import app.pantopus.android.data.api.models.profile.FileDeleteResponse
import app.pantopus.android.data.api.models.profile.PortfolioListResponse
import app.pantopus.android.data.api.models.profile.PortfolioUploadResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * File endpoints from `backend/routes/files.js`, mounted at `/api/files`
 * (`backend/app.js:329`). Covers the generic upload plus the portfolio
 * surface behind the public-profile Portfolio tab.
 */
interface FilesApi {
    /**
     * Upload one binary file plus optional form fields. Route
     * `backend/routes/files.js:781`. The server's 413/415 errors flow
     * back as Retrofit HttpException and are mapped by `NetworkResult`
     * callers.
     */
    @Multipart
    @POST("api/files/upload")
    suspend fun upload(
        @Part file: MultipartBody.Part,
        @Part("file_type") fileType: RequestBody,
        @Part("visibility") visibility: RequestBody,
    ): FileUploadResponse

    /**
     * `GET /api/files/portfolio` — the signed-in user's own portfolio
     * files, private documents included. Route
     * `backend/routes/files.js:489`. `category` filters on the row's
     * `file_context` column.
     */
    @GET("api/files/portfolio")
    suspend fun myPortfolio(
        @Query("category") category: String? = null,
    ): PortfolioListResponse

    /**
     * `GET /api/files/portfolio/{userId}` — another user's *public*
     * portfolio files. Route `backend/routes/files.js:526`; no
     * `verifyToken`, and it filters `visibility = 'public'`.
     */
    @GET("api/files/portfolio/{userId}")
    suspend fun userPortfolio(
        @Path("userId") userId: String,
    ): PortfolioListResponse

    /**
     * `POST /api/files/portfolio` — add one portfolio item. Route
     * `backend/routes/files.js:362`. Single `file` part; `category`
     * lands in `File.file_context` and `title` / `description` in
     * `File.metadata`.
     */
    @Multipart
    @POST("api/files/portfolio")
    suspend fun uploadPortfolio(
        @Part file: MultipartBody.Part,
        @Part("title") title: RequestBody,
        @Part("description") description: RequestBody? = null,
        @Part("category") category: RequestBody? = null,
    ): PortfolioUploadResponse

    /**
     * `DELETE /api/files/{id}` — soft-delete one owned file. Route
     * `backend/routes/files.js:853`; returns 403 when the caller doesn't
     * own the row, so callers must not drop the card optimistically.
     */
    @DELETE("api/files/{id}")
    suspend fun deleteFile(
        @Path("id") id: String,
    ): FileDeleteResponse
}
