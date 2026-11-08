@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `GET /api/mailbox/stamp-books`: the digital stamps left, the books, and (with `history=1`) the latest stamp moves. */
@JsonClass(generateAdapter = true)
data class StampBalance(
    val available: Int,
    @Json(name = "free_remaining") val freeRemaining: Int = 0,
    @Json(name = "paid_remaining") val paidRemaining: Int = 0,
    val books: List<StampBook>,
    @Json(name = "google_account") val googleAccount: String,
    /** False once books stop selling for the season; sending goes on until December 31. */
    @Json(name = "sales_open") val salesOpen: Boolean = true,
    /** Whether cards cost stamps for this person now (the Stamps wallet shows only then). */
    val enabled: Boolean = false,
    /** The latest stamp moves, newest first (asked for with `history=1`). */
    val history: List<StampMove>? = null,
    /** The stamps used on cards that went (asked for with `history=1`). */
    @Json(name = "used_total") val usedTotal: Int? = null,
)

@JsonClass(generateAdapter = true)
data class StampBook(val id: String, val credits: Int)

/** One stamp move: welcome, purchase, send, return or revoke; [at] is ISO with Z. Only kinds and counts. */
@JsonClass(generateAdapter = true)
data class StampMove(
    val kind: String,
    val delta: Int,
    val at: String,
)

@JsonClass(generateAdapter = true)
data class StampConfirmation(
    val provider: String = "google",
    val reference: String,
    @Json(name = "product_id") val productId: String,
)

@JsonClass(generateAdapter = true)
data class StampConfirmed(val available: Int)
