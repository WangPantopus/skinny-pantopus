package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Home Documents endpoints under `backend/routes/home.js`:
 *  - GET  /api/homes/:id/documents (line 4944)
 *  - POST /api/homes/:id/documents (line 4985)
 *
 * Backend `HomeDocument.doc_type` is one of ten constants:
 *   lease · insurance · warranty · manual · permit · floor_plan ·
 *   receipt · photo · paint_color · other
 */
@JsonClass(generateAdapter = true)
data class HomeDocumentDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "file_id") val fileId: String?,
    @Json(name = "doc_type") val docType: String,
    val title: String,
    @Json(name = "storage_bucket") val storageBucket: String?,
    @Json(name = "storage_path") val storagePath: String?,
    @Json(name = "mime_type") val mimeType: String?,
    @Json(name = "size_bytes") val sizeBytes: Long?,
    val visibility: String?,
    val details: Map<String, String>?,
    @Json(name = "created_by") val createdBy: String?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "updated_at") val updatedAt: String?,
)

/** `GET /api/homes/:id/documents` envelope. */
@JsonClass(generateAdapter = true)
data class GetHomeDocumentsResponse(
    val documents: List<HomeDocumentDto>,
)

/** `POST /api/homes/:id/documents` body. */
@JsonClass(generateAdapter = true)
data class CreateDocumentRequest(
    @Json(name = "doc_type") val docType: String,
    val title: String,
    @Json(name = "file_id") val fileId: String? = null,
    @Json(name = "storage_bucket") val storageBucket: String? = null,
    @Json(name = "storage_path") val storagePath: String? = null,
    @Json(name = "mime_type") val mimeType: String? = null,
    @Json(name = "size_bytes") val sizeBytes: Long? = null,
    val visibility: String? = null,
    val details: Map<String, String>? = null,
)

/** `POST /api/homes/:id/documents` envelope. */
@JsonClass(generateAdapter = true)
data class CreateDocumentResponse(
    val document: HomeDocumentDto,
)
