package app.pantopus.android.data.api.models.neighborhood

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `GET /api/neighborhood/meter` — the density-gated door's one honest number. */
@JsonClass(generateAdapter = true)
data class NeighborhoodMeter(
    /** no_place | forming | growing | unlocked. */
    val state: String = "no_place",
    /** Null below the k-anon floor. */
    @Json(name = "verified_count") val verifiedCount: Int? = null,
    @Json(name = "k_anon_min") val kAnonMin: Int = 10,
    val threshold: Int = 25,
    val unlocked: Boolean = false,
    val area: NeighborhoodArea? = null,
)

@JsonClass(generateAdapter = true)
data class NeighborhoodArea(
    val city: String? = null,
    val state: String? = null,
)

/**
 * One ~1 km block cell of the Nearby window (Wedge v2 §4). `bucket` is
 * the ONLY thing the server says about it — a floored enum, never a
 * count below the privacy floor, never a point.
 */
@JsonClass(generateAdapter = true)
data class NeighborhoodCell(
    val geohash: String,
    /** [[minLat, minLng], [maxLat, maxLng]]. */
    val bounds: List<List<Double>> = emptyList(),
    /** none | forming | few | growing. */
    val bucket: String = "none",
    @Json(name = "is_home") val isHome: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class NeighborhoodCenter(
    val lat: Double,
    val lng: Double,
)

/** `GET /api/neighborhood/cells` — the 5×5 grid around the viewer's place. */
@JsonClass(generateAdapter = true)
data class NeighborhoodCells(
    /** no_place | ready. */
    val state: String = "no_place",
    @Json(name = "home_cell") val homeCell: String? = null,
    /** The centre of the viewer's CELL, not of their home. */
    val center: NeighborhoodCenter? = null,
    val cells: List<NeighborhoodCell> = emptyList(),
    /** bucket → legend label, written by the server from the same thresholds. */
    val buckets: Map<String, String> = emptyMap(),
    @Json(name = "k_anon_min") val kAnonMin: Int = 10,
)
