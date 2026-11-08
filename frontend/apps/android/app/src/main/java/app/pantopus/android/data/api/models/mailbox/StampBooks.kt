@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class StampBalance(
    val available: Int,
    val books: List<StampBook>,
    @Json(name = "google_account") val googleAccount: String,
    /** False once books stop selling for the season; sending goes on until December 31. */
    @Json(name = "sales_open") val salesOpen: Boolean = true,
)

@JsonClass(generateAdapter = true)
data class StampBook(val id: String, val credits: Int)

@JsonClass(generateAdapter = true)
data class StampConfirmation(
    val provider: String = "google",
    val reference: String,
    @Json(name = "product_id") val productId: String,
)

@JsonClass(generateAdapter = true)
data class StampConfirmed(val available: Int)
