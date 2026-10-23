package app.pantopus.android.data.identity

import app.pantopus.android.data.api.models.identity.LocalProfileUpdateRequest
import app.pantopus.android.data.api.models.identity.OwnLocalProfileResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.LocalProfilesApi
import app.pantopus.android.data.api.services.UploadApi
import app.pantopus.android.data.upload.UploadFile
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

/** How neighbors see you: `/api/local-profiles/me` and its photo upload, in the [NetworkResult] taxonomy. */
@Singleton
class LocalProfileRepository
    @Inject
    constructor(
        private val api: LocalProfilesApi,
        private val uploadApi: UploadApi,
    ) {
        suspend fun me(): NetworkResult<OwnLocalProfileResponse> = safeApiCall { api.me() }

        suspend fun update(body: LocalProfileUpdateRequest): NetworkResult<OwnLocalProfileResponse> = safeApiCall { api.updateMe(body) }

        /** A photo for neighbors only (`POST /api/upload/local-profile-picture`, field `file`). */
        suspend fun uploadPhoto(file: UploadFile): NetworkResult<OwnLocalProfileResponse> =
            safeApiCall {
                uploadApi.uploadLocalProfilePicture(
                    MultipartBody.Part.createFormData(
                        name = "file",
                        filename = file.filename,
                        body = file.bytes.toRequestBody(file.mimeType.toMediaTypeOrNull()),
                    ),
                )
            }
    }
