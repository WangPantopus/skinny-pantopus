package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class GigStopTerms(
    val gigId: String,
    val ownerId: String,
    val workerId: String?,
    val paymentId: String?,
    val amountCents: Int,
    val currency: String,
    val gigStatus: String,
    val acceptedAt: String?,
    val acceptedBidId: String?,
    val policy: String,
    val policyFeeCents: Int,
)

/** Only these nonsecret original command fields are persisted. */
@JsonClass(generateAdapter = true)
data class GigStopRequest(
    val requestId: String,
    val gigId: String,
    val actorId: String,
    val action: String,
    val terms: GigStopTerms,
    val reason: String?,
    val rollbackMode: String?,
    val financialAction: String,
)

@JsonClass(generateAdapter = true)
data class GigStopCommand(
    val requestId: String,
    val action: String,
    val expectedActorId: String,
    val expectedSessionScope: String,
    val expectedTerms: GigStopTerms,
    val reason: String?,
    val rollbackMode: String?,
)

@JsonClass(generateAdapter = true)
data class GigStopPreview(
    val actorId: String,
    val sessionScope: String,
    val action: String,
    val terms: GigStopTerms,
    val eligible: Boolean,
    val unavailableReason: String?,
    val financialAction: String,
    val activeRequestId: String?,
)

@JsonClass(generateAdapter = true)
data class GigStopReceipt(
    val requestId: String,
    val gigId: String,
    val paymentId: String?,
    val ownerId: String,
    val workerId: String?,
    val amountCents: Int,
    val currency: String,
    val action: String,
    val gigStatus: String,
    val financialStatus: String,
)

@JsonClass(generateAdapter = true)
data class GigStopProgress(
    val actorId: String,
    val sessionScope: String,
    val requestId: String,
    val action: String,
    val status: String,
    val financialStatus: String,
    val canRetry: Boolean,
    val request: GigStopRequest,
    val receipt: GigStopReceipt?,
)

@JsonClass(generateAdapter = true)
data class GigStopConflict(val code: String? = null, val activeRequestId: String? = null)
