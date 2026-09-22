@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.JsonClass

/** Verified receipt for the current historical assigned payment; never infer readiness from HTTP/SDK success. */
@JsonClass(generateAdapter = true)
data class GigAssignedAuthorizationDto(
    val gigId: String? = null,
    val paymentId: String? = null,
    val actorId: String? = null,
    val payerId: String? = null,
    val payeeId: String? = null,
    val sessionScope: String? = null,
    val authorizationAttemptId: String? = null,
    val paymentIntentId: String? = null,
    val amountCents: Int? = null,
    val currency: String? = null,
    val paymentStatus: String? = null,
    val providerStatus: String? = null,
    val authorizationReady: Boolean? = null,
    val alreadyAuthorized: Boolean? = null,
    val recoveryState: String? = null,
    val canRetry: Boolean? = null,
    val cancellationPending: Boolean? = null,
    val authorizationAvailableAt: String? = null,
    val clientSecret: String? = null,
)

@JsonClass(generateAdapter = true)
data class GigAssignedAuthorizationBody(
    val expectedActorId: String,
    val expectedSessionScope: String,
    val expectedPaymentId: String,
    val expectedPayerId: String,
    val expectedPayeeId: String,
    val expectedAmountCents: Int,
    val currency: String = "usd",
)
