@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonValue

/**
 * Coupon-shaped sub-payload decoded from `mail.object_payload` when
 * `mail_type == "coupon"`. Backend stores this as untyped JSON in S3
 * (route handler at `backend/routes/mailboxV2.js:412`); the DTO is
 * defensive and [decodeFromObjectPayload] returns null when the
 * payload is missing the bare-minimum [headline] field.
 */
data class CouponDetailDto(
    val brandLogoUrl: String?,
    val brandName: String?,
    val headline: String,
    val subcopy: String?,
    val code: String?,
    val expiresAt: String?,
    val merchant: String?,
    val terms: String?,
    val minimumSpend: String?,
    val finePrint: String?,
) {
    companion object {
        fun decodeFromObjectPayload(payload: JsonValue?): CouponDetailDto? {
            if (payload == null) return null
            val headline =
                (payload["headline"] as? String)
                    ?: (payload["title"] as? String)
                    ?: return null
            if (headline.isEmpty()) return null
            return CouponDetailDto(
                brandLogoUrl = payload["brand_logo_url"] as? String,
                brandName = payload["brand_name"] as? String,
                headline = headline,
                subcopy = payload["subcopy"] as? String,
                code = payload["code"] as? String,
                expiresAt = payload["expires_at"] as? String,
                merchant =
                    (payload["merchant"] as? String)
                        ?: (payload["brand_name"] as? String),
                terms = payload["terms"] as? String,
                minimumSpend =
                    (payload["minimum_spend"] as? String)
                        ?: (payload["min_spend"] as? String),
                finePrint = payload["fine_print"] as? String,
            )
        }
    }
}
