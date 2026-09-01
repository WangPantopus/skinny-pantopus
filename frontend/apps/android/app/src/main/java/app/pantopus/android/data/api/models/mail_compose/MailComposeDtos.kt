@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mail_compose

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// GET /api/mailbox/compose/recipients

@JsonClass(generateAdapter = true)
data class MailComposeRecipientsResponse(
    val recipients: List<MailRecipientDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class MailRecipientDto(
    val userId: String,
    val name: String? = null,
    val username: String? = null,
    val homeId: String? = null,
    val homeAddress: String? = null,
    val isVerified: Boolean? = null,
    val homeMediaUrl: String? = null,
    val isOnPantopus: Boolean? = null,
)

// GET /api/mailbox/compose/home-context/:homeId

@JsonClass(generateAdapter = true)
data class MailHomeContextResponse(
    val homeId: String? = null,
    val addressDisplay: String? = null,
    val memberCount: Int? = null,
    val homeMediaUrl: String? = null,
    val privateDeliveryAvailable: Boolean? = null,
    val members: List<MailHomeMemberDto>? = null,
)

@JsonClass(generateAdapter = true)
data class MailHomeMemberDto(
    val userId: String,
    val name: String? = null,
    val role: String? = null,
)

// POST /api/mailbox/send

@JsonClass(generateAdapter = true)
data class SendMailBody(
    val recipientUserId: String? = null,
    val recipientHomeId: String? = null,
    val type: String = "letter",
    val subject: String,
    val content: String,
    val `object`: SendMailObject,
    val expiresAt: String? = null,
)

@JsonClass(generateAdapter = true)
data class SendMailObject(
    val format: String = "mailjson_v1",
    val title: String? = null,
    val content: String? = null,
    val payload: SendMailPayload,
)

@JsonClass(generateAdapter = true)
data class SendMailPayload(
    val stationeryTheme: String,
    val inkSelection: String,
    val sealChoice: String,
    val intent: String,
    val returnAddressShared: Boolean,
    val voicePostscriptUri: String? = null,
)

@JsonClass(generateAdapter = true)
data class SendMailResponse(
    val message: String? = null,
    val mail: SentMailDto? = null,
)

@JsonClass(generateAdapter = true)
data class SentMailDto(
    val id: String? = null,
    val subject: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)
