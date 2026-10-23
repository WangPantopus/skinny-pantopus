package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.identity.LocalProfileUpdateRequest
import app.pantopus.android.data.api.models.identity.OwnLocalProfileResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH

/**
 * How neighbors see you: the signed-in person's Local Profile, the name and photo other people see on their posts,
 * comments, chats, tasks and notices. A new photo goes through [UploadApi.uploadLocalProfilePicture].
 */
interface LocalProfilesApi {
    /** `GET /api/local-profiles/me` — route `backend/routes/localProfiles.js:372`. */
    @GET("api/local-profiles/me")
    suspend fun me(): OwnLocalProfileResponse

    /** `PATCH /api/local-profiles/me` — set the name or photo neighbors see. Route `backend/routes/localProfiles.js:383`. */
    @PATCH("api/local-profiles/me")
    suspend fun updateMe(
        @Body body: LocalProfileUpdateRequest,
    ): OwnLocalProfileResponse
}
