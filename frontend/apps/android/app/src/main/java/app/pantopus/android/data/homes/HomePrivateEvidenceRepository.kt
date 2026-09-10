package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomeEvidenceSessionDto
import app.pantopus.android.data.api.models.homes.HomeEvidenceVerifyRequest
import app.pantopus.android.data.api.models.homes.HomePrivateEvidenceResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomePrivateEvidenceApi
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection.HTTP_BAD_REQUEST
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

const val HOME_EVIDENCE_MAX_BYTES = 25 * 1024 * 1024
val HOME_EVIDENCE_TYPES = setOf("deed", "closing_disclosure", "tax_bill", "utility_bill", "lease")
val HOME_EVIDENCE_MIMES = setOf("application/pdf", "text/plain", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif")

data class HomeEvidenceBytes(val bytes: ByteArray, val mimeType: String, val inspection: String?)

@Singleton
open class HomePrivateEvidenceRepository
    @Inject
    constructor(private val api: HomePrivateEvidenceApi) {
        open suspend fun list(
            homeId: String,
            claimId: String,
            expected: String?,
            platform: Boolean,
        ) = safeApiCall { api.list(homeId, claimId, expected, mode(platform)) }

        open suspend fun upload(
            scope: HomeEvidenceSessionDto,
            uploadId: String,
            type: String,
            name: String,
            mime: String,
            bytes: ByteArray,
        ): NetworkResult<HomePrivateEvidenceResponse> {
            val supported = type in HOME_EVIDENCE_TYPES && mime in HOME_EVIDENCE_MIMES
            val validFile = name.isNotBlank() && bytes.isNotEmpty() && bytes.size <= HOME_EVIDENCE_MAX_BYTES
            if (!supported || !validFile) {
                return NetworkResult.Failure(NetworkError.ClientError(HTTP_BAD_REQUEST, "Choose a supported document of 25 MB or less."))
            }
            return safeApiCall {
                api.upload(
                    scope.homeId,
                    scope.claimId,
                    scope.sessionScope,
                    uploadId.toRequestBody("text/plain".toMediaType()),
                    type.toRequestBody("text/plain".toMediaType()),
                    privateEvidencePart(name, mime, bytes),
                )
            }
        }

        open suspend fun download(
            scope: HomeEvidenceSessionDto,
            evidenceId: String,
            platform: Boolean,
            token: String?,
        ) = safeApiCall {
            val response = api.download(scope.homeId, scope.claimId, evidenceId, scope.sessionScope, mode(platform), token)
            if (!response.isSuccessful) {
                response.errorBody()?.close()
                throw HttpException(response)
            }
            val body = requireNotNull(response.body())
            body.use {
                readPrivateHomeMedia(erase = { content: HomeEvidenceBytes -> content.bytes.fill(0) }) {
                    require(it.contentLength() <= HOME_EVIDENCE_MAX_BYTES)
                    val bytes = readHomeEvidenceBytes(it.byteStream())
                    require(bytes.isNotEmpty() && bytes.size <= HOME_EVIDENCE_MAX_BYTES)
                    HomeEvidenceBytes(
                        bytes,
                        it.contentType()?.toString()?.substringBefore(';').orEmpty(),
                        response.headers()["x-claim-evidence-inspection"],
                    )
                }
            }
        }

        open suspend fun verify(
            scope: HomeEvidenceSessionDto,
            evidenceId: String,
            platform: Boolean,
            token: String,
            inspection: String,
        ) = safeApiCall {
            api.verify(
                scope.homeId,
                scope.claimId,
                evidenceId,
                scope.sessionScope,
                mode(platform),
                HomeEvidenceVerifyRequest(token, inspection),
            )
        }

        open suspend fun remove(
            scope: HomeEvidenceSessionDto,
            evidenceId: String,
        ) = safeApiCall { api.remove(scope.homeId, scope.claimId, evidenceId, scope.sessionScope) }

        private fun mode(platform: Boolean) = if (platform) "platform" else "home"
    }

/** Never buffers more than the supported document bound, including unknown-length providers. */
fun readHomeEvidenceBytes(input: InputStream): ByteArray {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        require(output.size() + count <= HOME_EVIDENCE_MAX_BYTES) { "Choose a document of 25 MB or less." }
        output.write(buffer, 0, count)
    }
    return output.toByteArray()
}

/** Busboy decodes plain filename as Latin-1; filename* preserves the exact UTF-8 name. */
private fun privateEvidencePart(
    name: String,
    mime: String,
    bytes: ByteArray,
): MultipartBody.Part {
    val fallback = name.map { if (it.code in 32..126 && it != '"' && it != '\\') it else '_' }.joinToString("")
    val encoded = URLEncoder.encode(name, "UTF-8").replace("+", "%20").replace("*", "%2A")
    val disposition = "form-data; name=\"file\"; filename=\"$fallback\"; filename*=UTF-8''$encoded"
    return MultipartBody.Part.create(Headers.headersOf("Content-Disposition", disposition), bytes.toRequestBody(mime.toMediaType()))
}
