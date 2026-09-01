package app.pantopus.android.data.files

import app.pantopus.android.data.api.models.homes.FileUploadResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.FilesApi
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps the generic multipart `POST /api/files/upload` endpoint
 * (`backend/routes/files.js:781`) in the [NetworkResult] taxonomy.
 * Reusable across features that push a single binary blob and register
 * the resulting URL — e.g. gig delivery-proof photos before the
 * `mark-completed` call. The server's 413/415 errors flow back as a
 * mapped [NetworkResult.Failure].
 */
@Singleton
class FilesRepository
    @Inject
    constructor(
        private val filesApi: FilesApi,
    ) {
        suspend fun uploadFile(
            filename: String,
            mimeType: String,
            bytes: ByteArray,
            fileType: String,
            visibility: String = "private",
        ): NetworkResult<FileUploadResponse> =
            safeApiCall {
                val filePart =
                    MultipartBody.Part.createFormData(
                        name = "file",
                        filename = filename,
                        body = bytes.toRequestBody(mimeType.toMediaTypeOrNull()),
                    )
                val plain = "text/plain".toMediaTypeOrNull()
                filesApi.upload(
                    file = filePart,
                    fileType = fileType.toRequestBody(plain),
                    visibility = visibility.toRequestBody(plain),
                )
            }
    }
