@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * `GET /payments/status` (owner view). Stripe Connect account status for the
 * owner. Homes are not applicable (`applicable:false`). Payout settlement is
 * deferred — surface processing/pending where relevant.
 */
@JsonClass(generateAdapter = true)
data class PaymentStatusResponse(
    val applicable: Boolean = false,
    val connected: Boolean = false,
    @Json(name = "charges_enabled") val chargesEnabled: Boolean? = null,
    @Json(name = "payouts_enabled") val payoutsEnabled: Boolean? = null,
)
