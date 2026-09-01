@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Reusable message templates for workflows and manual sends.
 * `GET/POST /message-templates`, `PUT/DELETE /message-templates/:id`,
 * `POST /message-templates/preview`. `channel` ∈ `email|push|in_app|sms`
 * (subject required for email). Body may contain `{{variable}}` placeholders.
 */
@JsonClass(generateAdapter = true)
data class MessageTemplateDto(
    val id: String,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
    val name: String,
    val channel: String? = null,
    val subject: String? = null,
    val body: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** `GET /message-templates` — `{ templates: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetMessageTemplatesResponse(
    val templates: List<MessageTemplateDto> = emptyList(),
)

/** `POST/PUT /message-templates` — `{ template: … }`. */
@JsonClass(generateAdapter = true)
data class MessageTemplateResponse(
    val template: MessageTemplateDto,
)

/** Body for `POST /message-templates`. */
@JsonClass(generateAdapter = true)
data class CreateMessageTemplateRequest(
    val name: String,
    val body: String,
    val channel: String? = null,
    val subject: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** Body for `PUT /message-templates/:id` (partial). */
@JsonClass(generateAdapter = true)
data class UpdateMessageTemplateRequest(
    val name: String? = null,
    val body: String? = null,
    val channel: String? = null,
    val subject: String? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
)

/** Body for `POST /message-templates/preview` — interpolate `{{variables}}`. */
@JsonClass(generateAdapter = true)
data class PreviewTemplateRequest(
    val body: String,
    val subject: String? = null,
    val variables: Map<String, Any?>? = null,
)

/** `POST /message-templates/preview` — the filled subject/body. */
@JsonClass(generateAdapter = true)
data class PreviewTemplateResponse(
    val subject: String? = null,
    val body: String? = null,
)
