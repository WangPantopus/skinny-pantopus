@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class HomeTaskCreationReceiptDto(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "request_id") val requestId: String,
    @Json(name = "task_id") val taskId: String,
    @Json(name = "payload_hash") val payloadHash: String,
    @Json(name = "created_at") val createdAt: String,
)

@JsonClass(generateAdapter = true)
data class HomeTaskCreationResponse(
    val task: HomeTaskDto,
    @Json(name = "creation_receipt") val creationReceipt: HomeTaskCreationReceiptDto,
    @Json(name = "task_session") val taskSession: HomeTaskSessionDto,
    val replayed: Boolean,
)
