package app.pantopus.android.data.ai

import app.pantopus.android.data.api.models.ai.TranscriptionResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AIApi
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A12.8 — wraps the multipart `POST /api/ai/transcribe` route
 * (`backend/routes/ai.js:387`, part name `audio`, ≤25 MB) in the
 * [NetworkResult] taxonomy. Used by the Magic Task describe card's mic
 * button to turn a recorded m4a voice note into text.
 */
@Singleton
class AiTranscriptionRepository
    @Inject
    constructor(
        private val aiApi: AIApi,
    ) {
        suspend fun transcribe(
            filename: String,
            mimeType: String,
            bytes: ByteArray,
        ): NetworkResult<TranscriptionResponse> =
            safeApiCall {
                aiApi.transcribe(
                    MultipartBody.Part.createFormData(
                        name = "audio",
                        filename = filename,
                        body = bytes.toRequestBody(mimeType.toMediaTypeOrNull()),
                    ),
                )
            }
    }
