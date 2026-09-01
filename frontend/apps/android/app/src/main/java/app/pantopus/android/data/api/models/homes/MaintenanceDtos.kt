@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.math.BigDecimal

/**
 * One row from `GET /api/homes/:id/maintenance` —
 * `backend/routes/home.js` (added in T6.3b / P10).
 *
 * `cost` is a NUMERIC column (mirrors `HomeBill.amount`); on the wire
 * it can be a number or a string. [BillDecimalAdapter] (registered in
 * `NetworkModule`) normalises both shapes to [BigDecimal]. The
 * existing adapter handles both Bill + Maintenance amounts since they
 * share `BigDecimal` semantics.
 */
@JsonClass(generateAdapter = true)
data class MaintenanceTaskDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val task: String = "",
    val vendor: String? = null,
    val cost: BigDecimal? = null,
    val recurrence: String = "one_time",
    @Json(name = "due_date") val dueDate: String? = null,
    val status: String = "scheduled",
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
)

/** Envelope for `GET /api/homes/:id/maintenance`. */
@JsonClass(generateAdapter = true)
data class GetHomeMaintenanceResponse(
    val tasks: List<MaintenanceTaskDto> = emptyList(),
)

/** Envelope for `POST /api/homes/:id/maintenance` and
 *  `PUT …/:taskId`. */
@JsonClass(generateAdapter = true)
data class HomeMaintenanceResponse(
    val task: MaintenanceTaskDto,
)

/** Body for `POST /api/homes/:id/maintenance`. */
@JsonClass(generateAdapter = true)
data class CreateMaintenanceRequest(
    val task: String,
    val vendor: String? = null,
    val cost: BigDecimal? = null,
    val recurrence: String? = null,
    @Json(name = "due_date") val dueDate: String? = null,
    val status: String? = null,
)

/** Body for `PUT /api/homes/:id/maintenance/:taskId`. All fields optional. */
@JsonClass(generateAdapter = true)
data class UpdateMaintenanceRequest(
    val task: String? = null,
    val vendor: String? = null,
    val cost: BigDecimal? = null,
    val recurrence: String? = null,
    @Json(name = "due_date") val dueDate: String? = null,
    val status: String? = null,
)
