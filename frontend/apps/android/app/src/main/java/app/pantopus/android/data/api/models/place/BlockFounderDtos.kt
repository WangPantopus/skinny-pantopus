package app.pantopus.android.data.api.models.place

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Block Founders (Wave 3, final slice) — the growth surface. A verified
 * occupant's permanent founding rank in their geohash-6 block, the
 * per-section unlock meters, and real postcard invites to nearby
 * addresses.
 *
 * Both authed routes are hard T4-gated server-side
 * (`backend/routes/blockFounders.js`). Parity: the web
 * `frontend/packages/api/src/endpoints/blockFounders.ts` types.
 */
@JsonClass(generateAdapter = true)
data class BlockMeter(
    /** "real_rent" · "bill_benchmark" · "block_growing". */
    val id: String,
    val label: String,
    /** Already clamped to [needed] by the server. */
    val current: Int = 0,
    val needed: Int = 0,
    val unlocked: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class BlockStatus(
    val available: Boolean = false,
    /** e.g. "NO_COORDINATES" when the home has no map location. */
    val reason: String? = null,
    /** 1-based founding order; null while rank assignment is unavailable. */
    val rank: Int? = null,
    @Json(name = "established_at") val establishedAt: String? = null,
    /** Raw verified-homes count — T4 insiders only, by server contract. */
    @Json(name = "verified_count") val verifiedCount: Int = 0,
    /** Rent reports in the cell — what the `real_rent` meter counts. */
    @Json(name = "rent_reports") val rentReports: Int = 0,
    val meters: List<BlockMeter> = emptyList(),
    /** Wedge v2 D5: the first-5 tier; null on older backends. */
    val founding: BlockFounding? = null,
    @Json(name = "invites_remaining") val invitesRemaining: Int = 0,
    @Json(name = "invites_weekly_cap") val invitesWeeklyCap: Int = 0,
)

@JsonClass(generateAdapter = true)
data class BlockStatusResponse(
    val block: BlockStatus = BlockStatus(),
)

@JsonClass(generateAdapter = true)
data class BlockInviteRecipient(
    val line1: String,
    val city: String,
    /** Two-letter state code; the server rejects anything else. */
    val state: String,
    val zip: String,
)

@JsonClass(generateAdapter = true)
data class BlockInviteRequest(
    val recipient: BlockInviteRecipient,
)

@JsonClass(generateAdapter = true)
data class BlockInviteResult(
    val sent: Boolean = false,
    @Json(name = "invites_remaining") val invitesRemaining: Int = 0,
)

private const val MILLIS_PER_DAY = 86_400_000.0

/**
 * The Founding Neighbor tier (Wedge v2 D5): the first `slots_total`
 * verified homes in a block cell, taken within the cell's window.
 * Derived server-side from the permanent founder rows; never stored.
 */
@JsonClass(generateAdapter = true)
data class BlockFounding(
    @Json(name = "is_founding") val isFounding: Boolean = false,
    val slot: Int? = null,
    @Json(name = "slots_total") val slotsTotal: Int = 0,
    @Json(name = "slots_taken") val slotsTaken: Int = 0,
    @Json(name = "slots_open") val slotsOpen: Int = 0,
    @Json(name = "window_open") val windowOpen: Boolean = false,
    @Json(name = "window_ends_at") val windowEndsAt: String? = null,
) {
    /**
     * The one line the rank card shows — or nothing, when the window is
     * closed and the viewer is not a Founding Neighbor. Same copy as iOS.
     */
    fun line(nowMillis: Long = System.currentTimeMillis()): String? {
        if (isFounding && slot != null) return "Founding Neighbor · slot $slot of $slotsTotal. Permanent."
        if (!windowOpen || slotsOpen <= 0) return null
        val slots = if (slotsOpen == 1) "slot" else "slots"
        val endMillis = windowEndsAt?.let { runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull() }
        if (endMillis != null) {
            val days = maxOf(0L, kotlin.math.ceil((endMillis - nowMillis) / MILLIS_PER_DAY).toLong())
            return "$slotsOpen Founding Neighbor $slots still open · closes in $days ${if (days == 1L) "day" else "days"}"
        }
        return "$slotsOpen Founding Neighbor $slots still open"
    }
}
