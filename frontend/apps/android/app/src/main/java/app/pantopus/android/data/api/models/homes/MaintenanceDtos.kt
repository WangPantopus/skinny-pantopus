@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.JsonQualifier
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.ToJson
import java.math.BigDecimal

/**
 * One row from `GET /api/homes/:id/maintenance` —
 * `backend/routes/home.js` (added in T6.3b / P10).
 *
 * `cost` is a NUMERIC column (mirrors `HomeBill.amount`); on the wire
 * it can be a number or a string. [MaintenanceCostJsonAdapter] preserves
 * an absent cost and delegates non-null amounts to [BillDecimalAdapter].
 */
@JsonClass(generateAdapter = true)
data class MaintenanceTaskDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    val task: String = "",
    val vendor: String? = null,
    @MaintenanceCost val cost: BigDecimal? = null,
    val recurrence: String = "one_time",
    @Json(name = "due_date") val dueDate: String? = null,
    @Json(name = "performed_at") val performedAt: String? = null,
    val status: String = "scheduled",
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
)

@Retention(AnnotationRetention.RUNTIME)
@JsonQualifier
annotation class MaintenanceCost

/** A cleared maintenance cost is distinct from a recorded zero amount. */
class MaintenanceCostJsonAdapter {
    private val decimalAdapter = BillDecimalAdapter()

    @FromJson
    @MaintenanceCost
    fun fromJson(reader: JsonReader): BigDecimal? =
        if (reader.peek() == JsonReader.Token.NULL) reader.nextNull() else decimalAdapter.fromJson(reader)

    @ToJson
    fun toJson(
        writer: JsonWriter,
        @MaintenanceCost value: BigDecimal?,
    ) = decimalAdapter.toJson(writer, value)
}

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
    @Json(name = "performed_at") val performedAt: String? = null,
    val status: String? = null,
    val clientRequestId: String? = null,
)

/** Body for `PUT /api/homes/:id/maintenance/:taskId`. All fields optional. */
data class UpdateMaintenanceRequest(
    val task: String? = null,
    val vendor: String? = null,
    val cost: BigDecimal? = null,
    val recurrence: String? = null,
    @Json(name = "due_date") val dueDate: String? = null,
    @Json(name = "performed_at") val performedAt: String? = null,
    val status: String? = null,
    val clearVendor: Boolean = false,
    val clearCost: Boolean = false,
)

/** Preserve omitted fields while sending deliberate clears as JSON null. */
class UpdateMaintenanceRequestJsonAdapter {
    @ToJson
    fun toJson(
        writer: JsonWriter,
        value: UpdateMaintenanceRequest,
    ) {
        val previous = writer.serializeNulls
        writer.serializeNulls = true
        try {
            writer.beginObject()
            value.task?.let { writer.name("task").value(it) }
            if (value.vendor != null || value.clearVendor) writer.name("vendor").value(value.vendor)
            if (value.cost != null || value.clearCost) writer.name("cost").value(value.cost)
            value.recurrence?.let { writer.name("recurrence").value(it) }
            value.dueDate?.let { writer.name("due_date").value(it) }
            value.performedAt?.let { writer.name("performed_at").value(it) }
            value.status?.let { writer.name("status").value(it) }
            writer.endObject()
        } finally {
            writer.serializeNulls = previous
        }
    }

    @Suppress("UnusedParameter")
    @FromJson
    fun fromJson(reader: JsonReader): UpdateMaintenanceRequest =
        error("UpdateMaintenanceRequest is request-only; deserialization is not supported.")
}
