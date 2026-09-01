package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.audience.PersonaMediaUploadResponse
import app.pantopus.android.data.api.models.businesses.BusinessMediaUploadResponse
import app.pantopus.android.data.api.models.chats.AIMediaUploadResponse
import app.pantopus.android.data.api.models.chats.ChatMediaUploadResponse
import app.pantopus.android.data.api.models.listings.ListingMediaUploadResponse
import app.pantopus.android.data.api.models.posts.PostMediaUploadResponse
import app.pantopus.android.data.api.models.users.ProfilePictureUploadResponse
import okhttp3.MultipartBody
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Multipart upload endpoints under `api/upload`.
 * Post media uses `POST /api/upload/post-media/:postId` —
 * `backend/routes/upload.js:934`.
 */
interface UploadApi {
    /** Attach up to nine images/videos to an existing post. */
    @Multipart
    @POST("api/upload/post-media/{postId}")
    suspend fun uploadPostMedia(
        @Path("postId") postId: String,
        @Part files: @JvmSuppressWildcards List<MultipartBody.Part>,
    ): PostMediaUploadResponse

    /** Upload up to five chat attachments for a room. */
    @Multipart
    @POST("api/upload/chat-media/{roomId}")
    suspend fun uploadChatMedia(
        @Path("roomId") roomId: String,
        @Part files: @JvmSuppressWildcards List<MultipartBody.Part>,
    ): ChatMediaUploadResponse

    /** Upload images for AI assistant chat. */
    @Multipart
    @POST("api/upload/ai-media")
    suspend fun uploadAIMedia(
        @Part files: @JvmSuppressWildcards List<MultipartBody.Part>,
    ): AIMediaUploadResponse

    /**
     * Replace the signed-in user's avatar. Single part named `file`; the
     * server resizes to 800x800 webp, writes `User.profile_picture_url`,
     * and echoes the new URL back.
     * Route `backend/routes/upload.js:236`.
     */
    @Multipart
    @POST("api/upload/profile-picture")
    suspend fun uploadProfilePicture(
        @Part file: MultipartBody.Part,
    ): ProfilePictureUploadResponse

    /**
     * Attach photos to an existing listing (Snap & Sell post-create
     * upload). Route `backend/routes/upload.js:1049`.
     */
    @Multipart
    @POST("api/upload/listing-media/{listingId}")
    suspend fun uploadListingMedia(
        @Path("listingId") listingId: String,
        @Part files: @JvmSuppressWildcards List<MultipartBody.Part>,
    ): ListingMediaUploadResponse

    /**
     * Upload a Beacon avatar or banner. Single part named `file`, images
     * only; `type` is `avatar` or `banner`. The server resizes (800x800 for
     * avatars, 1600x600 for banners), writes `avatar_url` / `banner_url` on
     * the persona row and echoes the new URL. Owner-only.
     * Route `backend/routes/upload.js:312`.
     */
    @Multipart
    @POST("api/upload/persona-media/{personaId}")
    suspend fun uploadPersonaMedia(
        @Path("personaId") personaId: String,
        @Query("type") type: String,
        @Part file: MultipartBody.Part,
    ): PersonaMediaUploadResponse

    /**
     * Upload a business logo or banner. Single part named `file`, images
     * only; `type` is `logo` or `banner`. The server resizes (800x800 for
     * logos, 1600x900 for banners), writes `logo_file_id` /
     * `banner_file_id` on the business profile plus the mirrored
     * `User.profile_picture_url` / `cover_photo_url`, and echoes the new
     * URL. Requires the `profile.edit` permission on the business.
     * Route `backend/routes/upload.js:1679`.
     */
    @Multipart
    @POST("api/upload/business-media/{businessId}")
    suspend fun uploadBusinessMedia(
        @Path("businessId") businessId: String,
        @Query("type") type: String,
        @Part file: MultipartBody.Part,
    ): BusinessMediaUploadResponse
}
