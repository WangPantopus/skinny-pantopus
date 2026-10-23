package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.links.LinkPreviewResponse
import retrofit2.http.GET
import retrofit2.http.Query

/** Link preview — route `backend/routes/linkPreview.js`, mounted at `/api/link-preview`. */
interface LinkPreviewApi {
    /**
     * A page's title, description and site name. The server reads the page,
     * so the link's host never sees this device. Text only: no image is
     * offered. Route `backend/routes/linkPreview.js:346`.
     */
    @GET("api/link-preview")
    suspend fun preview(
        @Query("url") url: String,
    ): LinkPreviewResponse
}
