@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.map_list_hybrid

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp

/**
 * T6.6a (P24) — three snap stops for the map+list hybrid sheet.
 *
 * Heights are screen-relative fractions per the Q9 contract (revised by
 * A11.1 — same fractions on iOS, Android, web so the same gesture lands
 * at the same proportion on every device):
 * - [Collapsed] (20%) — header + drag-to-expand prompt
 * - [Standard] (40%) — header + carousel of rail cards
 * - [Expanded] (90%) — header + full vertical list
 */
enum class MapListHybridDetent(val heightFraction: Float) {
    Collapsed(0.20f),
    Standard(0.40f),
    Expanded(0.90f),
    ;

    /** Absolute sheet height for a given container height. */
    fun height(container: Dp): Dp = container * heightFraction
}

/**
 * One pin on the map. Latitude / longitude are raw doubles so the
 * model stays free of Google Maps imports for consumers that only need
 * the data shape (view-models, tests).
 */
@Immutable
data class MapPin(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val color: Color,
    val state: MapPinState = MapPinState.Confirmed,
)

/**
 * Per-pin lifecycle state — drives the visual treatment per design:
 * confirmed gets a white ring, pending dashes its color outline.
 */
enum class MapPinState { Confirmed, Pending }

/**
 * A11.1 — several pins collapsed into one marker at low zoom (28dp
 * primary disc + white count). Consumers build these from their own pure
 * clustering pass (see `TasksMapGeometry.buildClusteredPins`) so the
 * shell stays free of the maps-utils clustering lib. [id] is the
 * deterministic `cluster_<x>_<y>` bucket key (taps round-trip through
 * it); the `…cluster_<index>` testTags use the render-order ordinal.
 */
@Immutable
data class MapClusterPin(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val count: Int,
)

/**
 * Map-SDK-free viewport descriptor — the shell reports the settled
 * camera through it (`onCameraChange`) and consumers request camera
 * moves with it ([MapListHybridCameraRequest]), so view-models stay
 * unit-testable without Google Maps. Mirrors iOS `MapListHybridRegion`.
 */
@Immutable
data class MapListHybridRegion(
    val centerLatitude: Double,
    val centerLongitude: Double,
    val latitudeSpan: Double,
    val longitudeSpan: Double,
) {
    val minLatitude: Double get() = centerLatitude - latitudeSpan / 2
    val maxLatitude: Double get() = centerLatitude + latitudeSpan / 2
    val minLongitude: Double get() = centerLongitude - longitudeSpan / 2
    val maxLongitude: Double get() = centerLongitude + longitudeSpan / 2

    /** Same center, span multiplied — the "Widen search" ×2.5 zoom-out
     * and the cluster-tap ÷2 zoom-in both go through here. */
    fun scaled(factor: Double): MapListHybridRegion = copy(latitudeSpan = latitudeSpan * factor, longitudeSpan = longitudeSpan * factor)

    /** Same span, new center — rail-page → pan-to-pin sync. */
    fun recentered(
        latitude: Double,
        longitude: Double,
    ): MapListHybridRegion = copy(centerLatitude = latitude, centerLongitude = longitude)
}

/**
 * Token-identified camera move. The shell applies [region] (animated)
 * whenever the value changes — bump [token] to re-request the same
 * region twice.
 */
@Immutable
data class MapListHybridCameraRequest(
    val token: Int,
    val region: MapListHybridRegion,
)

/**
 * Optional "you are here" anchor overlay. Callers pass in their latest
 * `UserCoordinate` snapshot when location is available.
 */
@Immutable
data class MapAnchor(val latitude: Double, val longitude: Double)

/**
 * Pure resolver for the next detent after a drag release. Extracted so
 * the snap-to-nearest + velocity-nudge math is unit-testable without
 * spinning up the Compose hierarchy.
 *
 * Mirrors the iOS `MapListHybridDetentResolver` — same semantics, same
 * thresholds; only the units differ (Android is `Float` pixels/second
 * from `onDragStopped` callbacks).
 */
object MapListHybridDetentResolver {
    /** Pixels-per-second threshold above which a flick advances one detent. */
    const val VELOCITY_THRESHOLD: Float = 1_200f

    fun resolve(
        current: MapListHybridDetent,
        velocity: Float,
        displacedHeightPx: Float,
        targetsPx: Map<MapListHybridDetent, Float>,
    ): MapListHybridDetent {
        val nearest =
            MapListHybridDetent.entries.minByOrNull { stop ->
                val target = targetsPx[stop] ?: Float.MAX_VALUE
                kotlin.math.abs(target - displacedHeightPx)
            } ?: current

        return when {
            velocity > VELOCITY_THRESHOLD ->
                when (current) {
                    MapListHybridDetent.Expanded -> MapListHybridDetent.Standard
                    MapListHybridDetent.Standard -> MapListHybridDetent.Collapsed
                    MapListHybridDetent.Collapsed -> MapListHybridDetent.Collapsed
                }
            velocity < -VELOCITY_THRESHOLD ->
                when (current) {
                    MapListHybridDetent.Collapsed -> MapListHybridDetent.Standard
                    MapListHybridDetent.Standard -> MapListHybridDetent.Expanded
                    MapListHybridDetent.Expanded -> MapListHybridDetent.Expanded
                }
            else -> nearest
        }
    }
}
