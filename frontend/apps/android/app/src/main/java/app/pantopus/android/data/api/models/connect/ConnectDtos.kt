package app.pantopus.android.data.api.models.connect

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for the Stripe Connect (Express) payout endpoints in
 * `backend/routes/pays.js` (`/connect/...`). Block 3C reads onboarding /
 * payouts-enabled state to gate withdraw and opens Stripe-hosted Account Link
 * + Express dashboard URLs. Bank / identity / KYC fields are intentionally not
 * modelled — Stripe hosts that UI.
 */

// POST /api/payments/connect/account — backend/routes/pays.js:161
@JsonClass(generateAdapter = true)
data class ConnectCreateAccountRequest(
    val country: String? = null,
    val businessType: String? = null,
)

@JsonClass(generateAdapter = true)
data class ConnectCreateAccountResponse(
    val stripeAccountId: String? = null,
    val account: ConnectAccountDto? = null,
)

/** The slim Connect-account projection the client needs to gate payouts. */
@JsonClass(generateAdapter = true)
data class ConnectAccountDto(
    @Json(name = "stripe_account_id") val stripeAccountId: String? = null,
    @Json(name = "charges_enabled") val chargesEnabled: Boolean = false,
    @Json(name = "payouts_enabled") val payoutsEnabled: Boolean = false,
    @Json(name = "details_submitted") val detailsSubmitted: Boolean = false,
    /**
     * `StripeAccount.created_at` — when the seller first connected. The handler
     * returns the whole row (`stripe/stripeService.js:449`), so this is real
     * data; it dates the "Connected …" row on A14.6 Payments.
     */
    @Json(name = "created_at") val createdAt: String? = null,
)

// GET /api/payments/connect/account — backend/routes/pays.js:243
@JsonClass(generateAdapter = true)
data class ConnectAccountStatusResponse(
    val account: ConnectAccountDto,
)

// POST /api/payments/connect/onboarding — backend/routes/pays.js:213
@JsonClass(generateAdapter = true)
data class ConnectOnboardingRequest(
    val returnUrl: String? = null,
    val refreshUrl: String? = null,
)

@JsonClass(generateAdapter = true)
data class ConnectOnboardingResponse(
    val onboardingUrl: String,
    val expiresAt: Long? = null,
)

// POST /api/payments/connect/dashboard — backend/routes/pays.js:265
@JsonClass(generateAdapter = true)
data class ConnectDashboardResponse(
    val dashboardUrl: String,
)
