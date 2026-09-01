@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.ToJson
import java.math.BigDecimal

/**
 * One row from `GET /api/homes/:id/bills` —
 * `backend/routes/home.js:4506`.
 *
 * Backend stores `amount` as a NUMERIC column; on the wire it can be
 * a number or a string. [DecimalAdapter] normalises both shapes to a
 * [BigDecimal]. A legacy `amount_cents` is also accepted in case
 * older records still carry it.
 */
@JsonClass(generateAdapter = true)
data class BillDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "bill_type") val billType: String,
    @Json(name = "provider_name") val providerName: String? = null,
    val amount: BigDecimal,
    @Json(name = "amount_cents") val amountCents: Long? = null,
    val currency: String? = null,
    @Json(name = "period_start") val periodStart: String? = null,
    @Json(name = "period_end") val periodEnd: String? = null,
    @Json(name = "due_date") val dueDate: String? = null,
    val status: String = "pending",
    @Json(name = "paid_at") val paidAt: String? = null,
    @Json(name = "paid_by") val paidBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    /** Backend-stored JSONB bag. Used today only by the Add Bill
     *  wizard to round-trip the recurrence selection through
     *  `details.schedule` / `details.frequency`. */
    val details: Map<String, String>? = null,
) {
    /** Best-effort cents-or-decimal → BigDecimal extraction. Treats
     *  `amount_cents` as authoritative when set, then falls back to
     *  `amount`. */
    val displayAmount: BigDecimal
        get() =
            amountCents
                ?.let { BigDecimal.valueOf(it).movePointLeft(2) }
                ?: amount
}

/** Envelope for `GET /api/homes/:id/bills`. */
@JsonClass(generateAdapter = true)
data class GetHomeBillsResponse(
    val bills: List<BillDto> = emptyList(),
)

/** Envelope for `POST /api/homes/:id/bills` and `PUT …/:billId`. */
@JsonClass(generateAdapter = true)
data class HomeBillResponse(
    val bill: BillDto,
)

/** Body for `POST /api/homes/:id/bills`. */
@JsonClass(generateAdapter = true)
data class CreateBillRequest(
    @Json(name = "bill_type") val billType: String,
    @Json(name = "provider_name") val providerName: String? = null,
    val amount: BigDecimal,
    @Json(name = "due_date") val dueDate: String? = null,
    val details: Map<String, String>? = null,
)

/** Body for `PUT /api/homes/:id/bills/:billId`. All fields optional —
 *  the whitelist mirrors `backend/routes/home.js:4593`. */
@JsonClass(generateAdapter = true)
data class UpdateBillRequest(
    val status: String? = null,
    @Json(name = "paid_at") val paidAt: String? = null,
    val amount: BigDecimal? = null,
    @Json(name = "provider_name") val providerName: String? = null,
    @Json(name = "due_date") val dueDate: String? = null,
    val details: Map<String, String>? = null,
)

/** One row from `GET /api/homes/:id/bills/:billId/splits` —
 *  `backend/routes/home.js:4627`. */
@JsonClass(generateAdapter = true)
data class BillSplitDto(
    val id: String,
    @Json(name = "bill_id") val billId: String,
    @Json(name = "user_id") val userId: String,
    val amount: BigDecimal,
    val status: String? = null,
    val user: SplitUserDto? = null,
)

@JsonClass(generateAdapter = true)
data class SplitUserDto(
    val id: String,
    val username: String? = null,
    val name: String? = null,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
)

/** Envelope for `GET /api/homes/:id/bills/:billId/splits`. */
@JsonClass(generateAdapter = true)
data class GetBillSplitsResponse(
    val splits: List<BillSplitDto> = emptyList(),
)

/**
 * Decode `amount` from either a JSON number or a JSON string. Backend
 * returns NUMERIC columns as strings (`"142.80"`) but tests and some
 * older clients pass them as numbers — accept both. Register this
 * adapter in `NetworkModule` so every BillDto / split decoded through
 * Retrofit / Moshi sees the normalisation.
 */
class BillDecimalAdapter {
    @FromJson
    fun fromJson(reader: com.squareup.moshi.JsonReader): BigDecimal =
        when (reader.peek()) {
            // `BigDecimal.valueOf(double)` round-trips through
            // `Double.toString` — more deterministic than the lossy
            // `BigDecimal(double)` constructor.
            com.squareup.moshi.JsonReader.Token.NUMBER ->
                BigDecimal.valueOf(reader.nextDouble())
            com.squareup.moshi.JsonReader.Token.STRING -> {
                val raw = reader.nextString()
                raw.toBigDecimalOrNull() ?: BigDecimal.ZERO
            }
            com.squareup.moshi.JsonReader.Token.NULL -> {
                reader.nextNull<Any>()
                BigDecimal.ZERO
            }
            else -> {
                reader.skipValue()
                BigDecimal.ZERO
            }
        }

    @ToJson
    fun toJson(
        writer: com.squareup.moshi.JsonWriter,
        value: BigDecimal,
    ) {
        writer.value(value)
    }
}
