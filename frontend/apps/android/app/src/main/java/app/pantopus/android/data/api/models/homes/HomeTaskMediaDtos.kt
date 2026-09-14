package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Private metadata only. Legacy provider URLs are deliberately not decoded. */
@JsonClass(generateAdapter = true)
data class HomeTaskMediaDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "task_id") val taskId: String,
    @Json(name = "uploaded_by") val uploadedBy: String?,
    @Json(name = "file_name") val fileName: String,
    @Json(name = "mime_type") val mimeType: String?,
    @Json(name = "file_size") val fileSize: Long,
    val state: String,
    val available: Boolean,
    @Json(name = "cleanup_pending") val cleanupPending: Boolean? = null,
) {
    fun sameFile(other: HomeTaskMediaDto): Boolean {
        val sameIdentity = id == other.id && homeId == other.homeId && taskId == other.taskId
        val sameMetadata = fileName == other.fileName && mimeType == other.mimeType && fileSize == other.fileSize
        return sameIdentity && sameMetadata && uploadedBy == other.uploadedBy
    }

    val removable get() = state != "legacy" && (state != "retired" || cleanupPending == true)
}

@JsonClass(generateAdapter = true)
data class HomeTaskMediaList(
    val media: List<HomeTaskMediaDto>,
    @Json(name = "can_upload") val canUpload: Boolean,
)

@JsonClass(generateAdapter = true)
data class HomeTaskMediaUpload(val media: List<HomeTaskMediaDto>)

@JsonClass(generateAdapter = true)
data class HomeTaskMediaRemoval(val media: HomeTaskMediaDto)
