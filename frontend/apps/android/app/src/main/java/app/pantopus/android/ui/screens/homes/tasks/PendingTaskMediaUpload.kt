package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.homes.HOME_EVIDENCE_MAX_BYTES
import app.pantopus.android.data.homes.HOME_EVIDENCE_MIMES
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import java.net.HttpURLConnection.HTTP_CONFLICT

/** Memory belongs to this exact selection; UI state exposes metadata, never mutable file bytes. */
internal class PendingTaskMediaUpload(
    val id: String,
    val localName: String,
    val mimeType: String,
    bytes: ByteArray,
) {
    private val original = bytes.copyOf()
    val size get() = original.size
    init {
        require(TASK_MEDIA_UUID.matches(id) && localName.isNotBlank())
        require(mimeType in HOME_EVIDENCE_MIMES && original.isNotEmpty() && original.size <= HOME_EVIDENCE_MAX_BYTES)
    }
    val serverFilename: String get() = "task-attachment-$id.${extension(mimeType)}"
    fun copyBytes() = original.copyOf()
    fun erase() = original.fill(0)

    private fun extension(mime: String): String = when (mime) {
        "application/pdf" -> "pdf"
        "text/plain" -> "txt"
        "image/jpeg" -> "jpg"
        "image/png" -> "png"
        "image/webp" -> "webp"
        "image/heic" -> "heic"
        "image/heif" -> "heif"
        else -> error("Unsupported file type")
    }
}

/** Only a failed upload POST can acknowledge retirement of its immutable upload ID. */
internal class HomeTaskMediaUploadFailure(val error: NetworkError) : IllegalStateException(error.message, error) {
    val retired: Boolean get() {
        if (error !is NetworkError.ClientError || error.code != HTTP_CONFLICT) return false
        val type = Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
        val adapter = Moshi.Builder().build().adapter<Map<String, Any?>>(type)
        return runCatching { error.body?.let(adapter::fromJson)?.get("code") == "HOME_TASK_UPLOAD_RETIRED" }.getOrDefault(false)
    }
}
