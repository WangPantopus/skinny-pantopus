package app.pantopus.android.data.api.models.ai

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Envelope from `POST /api/ai/transcribe` (`backend/routes/ai.js:387`) —
 * Whisper transcription of a recorded voice note for the Magic Task
 * describe field.
 */
@JsonClass(generateAdapter = true)
data class TranscriptionResponse(
    val text: String,
    @Json(name = "duration_seconds") val durationSeconds: Double? = null,
)
