package app.pantopus.android.data.api.models.homes

import app.pantopus.android.data.homes.homeTaskUUID
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.math.BigDecimal

internal const val MAX_HOME_GIG_PRICE = 99_999_999.99
private const val MAX_GIG_LATITUDE = 90.0
private const val MAX_GIG_LONGITUDE = 180.0
private const val MAX_GIG_TITLE = 255
private const val MIN_GIG_DESCRIPTION = 10

@JsonClass(generateAdapter = true)
data class HomeTaskGigState(
    val ok: Boolean,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "task_id") val taskId: String,
    @Json(name = "task_updated_at") val taskUpdatedAt: String,
    @Json(name = "can_publish") val canPublish: Boolean,
    @Json(name = "task_session") val taskSession: HomeTaskSessionDto,
    @Json(name = "gig_id") val gigId: String? = null,
) {
    fun matches(
        home: String,
        task: String,
    ): Boolean =
        ok && homeId == home && taskId == task && recurrenceDate(taskUpdatedAt) != null &&
            (gigId == null || homeTaskUUID(gigId))
}

@JsonClass(generateAdapter = true)
data class HomeTaskGigLocation(
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val city: String? = null,
    val state: String? = null,
    val zip: String? = null,
    val mode: String = "address",
) {
    fun valid(): Boolean =
        mode == "address" && address.trim().length in 3..500 && latitude.isFinite() && longitude.isFinite() &&
            latitude in -MAX_GIG_LATITUDE..MAX_GIG_LATITUDE && longitude in -MAX_GIG_LONGITUDE..MAX_GIG_LONGITUDE
}

@JsonClass(generateAdapter = true)
data class HomeTaskGigSource(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "task_id") val taskId: String,
    @Json(name = "request_id") val requestId: String,
    @Json(name = "expected_updated_at") val expectedUpdatedAt: String,
    val reviewed: Boolean = true,
) {
    fun valid(): Boolean = reviewed && listOf(homeId, taskId, requestId).all(::homeTaskUUID) && recurrenceDate(expectedUpdatedAt) != null
}

/** Exact reviewed wire fields; no private mail, files, Home location or credentials. */
@JsonClass(generateAdapter = true)
data class HomeTaskGigRequest(
    @Json(name = "home_task_source") val source: HomeTaskGigSource,
    val title: String,
    val description: String,
    val price: Double,
    val category: String,
    @Json(name = "cancellation_policy") val cancellationPolicy: String,
    val location: HomeTaskGigLocation,
    @Json(name = "location_precision") val locationPrecision: String = "approx_area",
    @Json(name = "reveal_policy") val revealPolicy: String = "after_assignment",
    @Json(name = "visibility_scope") val visibilityScope: String = "city",
    val attachments: List<String> = emptyList(),
) {
    fun valid(): Boolean =
        source.valid() && title.trim().length in 5..MAX_GIG_TITLE && title.length <= MAX_GIG_TITLE &&
            description.trim().length >= MIN_GIG_DESCRIPTION &&
            price.isFinite() && price > 0 && price <= MAX_HOME_GIG_PRICE && BigDecimal.valueOf(price).stripTrailingZeros().scale() <= 2 &&
            category.length in 1..100 && cancellationPolicy in setOf("flexible", "standard", "strict") && location.valid() &&
            locationPrecision == "approx_area" && revealPolicy == "after_assignment" && visibilityScope == "city" && attachments.isEmpty()
}

@JsonClass(generateAdapter = true)
data class HomeTaskGigReceipt(
    @Json(name = "home_id") val homeId: String,
    @Json(name = "task_id") val taskId: String,
    @Json(name = "actor_id") val actorId: String,
    @Json(name = "request_id") val requestId: String,
    @Json(name = "gig_id") val gigId: String,
    @Json(name = "request_hash") val requestHash: String,
    @Json(name = "created_at") val createdAt: String,
) {
    fun matches(
        request: HomeTaskGigRequest,
        actor: String,
    ): Boolean =
        homeId == request.source.homeId && taskId == request.source.taskId && actorId == actor && requestId == request.source.requestId &&
            homeTaskUUID(gigId) && requestHash.matches(Regex("^[a-f0-9]{64}$")) && recurrenceDate(createdAt) != null
}

@JsonClass(generateAdapter = true)
data class HomeTaskPublishedGig(
    val id: String,
    @Json(name = "user_id") val userId: String,
    @Json(name = "created_by") val createdBy: String,
    val title: String,
    val description: String,
    val price: Double,
    val status: String,
)

@JsonClass(generateAdapter = true)
data class HomeTaskGigResponse(
    val gig: HomeTaskPublishedGig,
    @Json(name = "publication_receipt") val receipt: HomeTaskGigReceipt,
    @Json(name = "task_session") val taskSession: HomeTaskSessionDto,
    val replayed: Boolean,
) {
    fun matches(
        request: HomeTaskGigRequest,
        actor: String,
    ): Boolean =
        receipt.matches(request, actor) && gig.id == receipt.gigId && gig.userId == actor && gig.createdBy == actor &&
            gig.status in setOf("open", "assigned", "in_progress", "completed", "cancelled") &&
            (replayed || (gig.title == request.title && gig.description == request.description && gig.price == request.price))
}
