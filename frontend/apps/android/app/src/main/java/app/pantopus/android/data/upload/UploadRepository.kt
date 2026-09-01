package app.pantopus.android.data.upload

import app.pantopus.android.data.api.models.audience.PersonaMediaUploadResponse
import app.pantopus.android.data.api.models.businesses.BusinessMediaUploadResponse
import app.pantopus.android.data.api.models.chats.AIMediaUploadResponse
import app.pantopus.android.data.api.models.chats.ChatMediaUploadResponse
import app.pantopus.android.data.api.models.listings.ListingMediaUploadResponse
import app.pantopus.android.data.api.models.posts.PostMediaUploadResponse
import app.pantopus.android.data.api.models.users.ProfilePictureUploadResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.UploadApi
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps post-media multipart uploads in the [NetworkResult] taxonomy. */
@Singleton
class UploadRepository
    @Inject
    constructor(
        private val uploadApi: UploadApi,
    ) {
        suspend fun uploadPostMedia(
            postId: String,
            photoBytes: List<ByteArray>,
        ): NetworkResult<PostMediaUploadResponse> =
            safeApiCall {
                val parts =
                    photoBytes.mapIndexed { index, bytes ->
                        val (filename, mimeType) = photoMimeInfo(bytes, index)
                        MultipartBody.Part.createFormData(
                            name = "files",
                            filename = filename,
                            body = bytes.toRequestBody(mimeType.toMediaTypeOrNull()),
                        )
                    }
                uploadApi.uploadPostMedia(postId, parts)
            }

        suspend fun uploadChatMedia(
            roomId: String,
            files: List<UploadFile>,
        ): NetworkResult<ChatMediaUploadResponse> =
            safeApiCall {
                val parts =
                    files.map { file ->
                        MultipartBody.Part.createFormData(
                            name = "files",
                            filename = file.filename,
                            body = file.bytes.toRequestBody(file.mimeType.toMediaTypeOrNull()),
                        )
                    }
                uploadApi.uploadChatMedia(roomId, parts)
            }

        suspend fun uploadAIMedia(files: List<UploadFile>): NetworkResult<AIMediaUploadResponse> =
            safeApiCall {
                val parts =
                    files.map { file ->
                        MultipartBody.Part.createFormData(
                            name = "files",
                            filename = file.filename,
                            body = file.bytes.toRequestBody(file.mimeType.toMediaTypeOrNull()),
                        )
                    }
                uploadApi.uploadAIMedia(parts)
            }

        /**
         * T3 — replace the signed-in user's avatar via
         * `POST /api/upload/profile-picture`. Field name is `file`
         * (singular), unlike the `files` multi-part routes above.
         */
        suspend fun uploadProfilePicture(file: UploadFile): NetworkResult<ProfilePictureUploadResponse> =
            safeApiCall {
                uploadApi.uploadProfilePicture(
                    MultipartBody.Part.createFormData(
                        name = "file",
                        filename = file.filename,
                        body = file.bytes.toRequestBody(file.mimeType.toMediaTypeOrNull()),
                    ),
                )
            }

        /** Snap & Sell — attach local photos to a just-created/edited listing. */
        suspend fun uploadListingMedia(
            listingId: String,
            files: List<UploadFile>,
        ): NetworkResult<ListingMediaUploadResponse> =
            safeApiCall {
                val parts =
                    files.map { file ->
                        MultipartBody.Part.createFormData(
                            name = "files",
                            filename = file.filename,
                            body = file.bytes.toRequestBody(file.mimeType.toMediaTypeOrNull()),
                        )
                    }
                uploadApi.uploadListingMedia(listingId, parts)
            }

        /**
         * Beacon avatar / banner. Single part named `file` (singular) and a
         * `type` query param — `avatar` or `banner`. The server writes the URL
         * onto the persona row itself, so no follow-up PATCH is needed.
         * Route `backend/routes/upload.js:312`.
         */
        suspend fun uploadPersonaMedia(
            personaId: String,
            type: String,
            file: UploadFile,
        ): NetworkResult<PersonaMediaUploadResponse> =
            safeApiCall {
                uploadApi.uploadPersonaMedia(
                    personaId = personaId,
                    type = type,
                    file =
                        MultipartBody.Part.createFormData(
                            name = "file",
                            filename = file.filename,
                            body = file.bytes.toRequestBody(file.mimeType.toMediaTypeOrNull()),
                        ),
                )
            }

        /**
         * Business logo / banner. Single part named `file` (singular) and a
         * `type` query param — `logo` or `banner`. The server writes the URL
         * onto the business profile itself, so no follow-up PATCH is needed.
         * Route `backend/routes/upload.js:1679`.
         */
        suspend fun uploadBusinessMedia(
            businessId: String,
            type: String,
            file: UploadFile,
        ): NetworkResult<BusinessMediaUploadResponse> =
            safeApiCall {
                uploadApi.uploadBusinessMedia(
                    businessId = businessId,
                    type = type,
                    file =
                        MultipartBody.Part.createFormData(
                            name = "file",
                            filename = file.filename,
                            body = file.bytes.toRequestBody(file.mimeType.toMediaTypeOrNull()),
                        ),
                )
            }

        /** Attach broadcast/post media given raw [UploadFile]s (image or video). */
        suspend fun uploadPostMediaFiles(
            postId: String,
            files: List<UploadFile>,
        ): NetworkResult<PostMediaUploadResponse> =
            safeApiCall {
                val parts =
                    files.map { file ->
                        MultipartBody.Part.createFormData(
                            name = "files",
                            filename = file.filename,
                            body = file.bytes.toRequestBody(file.mimeType.toMediaTypeOrNull()),
                        )
                    }
                uploadApi.uploadPostMedia(postId, parts)
            }
    }

data class UploadFile(
    val filename: String,
    val mimeType: String,
    val bytes: ByteArray,
) {
    override fun equals(other: Any?): Boolean =
        this === other ||
            (
                other is UploadFile &&
                    filename == other.filename &&
                    mimeType == other.mimeType &&
                    bytes.contentEquals(other.bytes)
            )

    override fun hashCode(): Int {
        var result = filename.hashCode()
        result = 31 * result + mimeType.hashCode()
        result = 31 * result + bytes.contentHashCode()
        return result
    }
}

private fun photoMimeInfo(
    bytes: ByteArray,
    index: Int,
): Pair<String, String> {
    if (bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte()) {
        return "photo-$index.jpg" to "image/jpeg"
    }
    if (bytes.size >= 8 &&
        bytes[0] == 0x89.toByte() &&
        bytes[1] == 0x50.toByte() &&
        bytes[2] == 0x4E.toByte() &&
        bytes[3] == 0x47.toByte()
    ) {
        return "photo-$index.png" to "image/png"
    }
    if (bytes.size >= 12 &&
        bytes[4] == 0x66.toByte() &&
        bytes[5] == 0x74.toByte() &&
        bytes[6] == 0x79.toByte() &&
        bytes[7] == 0x70.toByte()
    ) {
        return "photo-$index.heic" to "image/heic"
    }
    return "photo-$index.jpg" to "image/jpeg"
}
