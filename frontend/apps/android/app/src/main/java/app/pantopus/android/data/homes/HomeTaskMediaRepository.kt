package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomeTaskMediaUpload
import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeTaskMediaApi
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.net.HttpURLConnection.HTTP_BAD_REQUEST
import javax.inject.Inject
import javax.inject.Singleton

data class HomeTaskMediaBytes(val bytes: ByteArray, val mimeType: String)

@Singleton
open class HomeTaskMediaRepository
    @Inject
    constructor(private val api: HomeTaskMediaApi) {
        open suspend fun list(
            session: HomeTaskSessionDto,
            taskId: String,
        ) = safeApiCall { api.list(session.homeId, taskId, session.sessionScope) }

        open suspend fun upload(
            session: HomeTaskSessionDto,
            taskId: String,
            uploadId: String,
            filename: String,
            mimeType: String,
            bytes: ByteArray,
        ): NetworkResult<HomeTaskMediaUpload> {
            if (mimeType !in HOME_EVIDENCE_MIMES || bytes.isEmpty() || bytes.size > HOME_EVIDENCE_MAX_BYTES) {
                return NetworkResult.Failure(NetworkError.ClientError(HTTP_BAD_REQUEST, "Choose a supported file of 25 MB or less."))
            }
            return safeApiCall {
                api.upload(
                    session.homeId,
                    taskId,
                    session.sessionScope,
                    uploadId.toRequestBody("text/plain".toMediaType()),
                    MultipartBody.Part.createFormData("file", filename, bytes.toRequestBody(mimeType.toMediaType())),
                )
            }
        }

        open suspend fun download(
            session: HomeTaskSessionDto,
            taskId: String,
            mediaId: String,
        ) = safeApiCall {
            val response = api.download(session.homeId, taskId, mediaId, session.sessionScope)
            if (!response.isSuccessful) {
                response.errorBody()?.close()
                throw HttpException(response)
            }
            val body = requireNotNull(response.body())
            body.use { current ->
                readPrivateHomeMedia(erase = { content: HomeTaskMediaBytes -> content.bytes.fill(0) }) {
                    require(current.contentLength() <= HOME_EVIDENCE_MAX_BYTES)
                    HomeTaskMediaBytes(
                        readHomeEvidenceBytes(current.byteStream()),
                        current.contentType()?.toString()?.substringBefore(';').orEmpty(),
                    )
                }
            }
        }

        open suspend fun remove(
            session: HomeTaskSessionDto,
            taskId: String,
            mediaId: String,
        ) = safeApiCall { api.remove(session.homeId, taskId, mediaId, session.sessionScope) }
    }
