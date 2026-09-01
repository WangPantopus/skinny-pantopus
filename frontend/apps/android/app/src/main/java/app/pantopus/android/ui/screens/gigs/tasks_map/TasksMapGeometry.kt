@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.gigs.tasks_map

import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapClusterPin
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridRegion
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapPin
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Maps-SDK-free geometry helpers for the Tasks map. Pure functions so
 * unit tests drive them directly; the view-model is their only
 * production caller. Mirrors iOS `TasksMapGeometry` exactly — same
 * thresholds, same bucket math, same deterministic ids.
 */
object TasksMapGeometry {
    /**
     * "Search this area" trigger — true when the settled camera's center
     * moved by more than ~25% of the previously fetched span, or its
     * span changed by more than ~50% (zoomed in/out).
     */
    fun regionChangedSignificantly(
        from: MapListHybridRegion,
        to: MapListHybridRegion,
    ): Boolean {
        if (abs(to.centerLatitude - from.centerLatitude) > from.latitudeSpan * 0.25) return true
        if (abs(to.centerLongitude - from.centerLongitude) > from.longitudeSpan * 0.25) return true
        val latRatio = to.latitudeSpan / max(from.latitudeSpan, Double.MIN_VALUE)
        val lonRatio = to.longitudeSpan / max(from.longitudeSpan, Double.MIN_VALUE)
        return latRatio > 1.5 || latRatio < 1 / 1.5 || lonRatio > 1.5 || lonRatio < 1 / 1.5
    }

    /** Result of the clustering pass — pins that stay individual plus
     * the cluster markers replacing dense groups. */
    data class ClusteredPins(
        val singles: List<MapPin>,
        val clusters: List<MapClusterPin>,
    )

    /**
     * Client-side clustering — grid-bucket keyed off the viewport span.
     * Pins whose on-screen separation would be under [thresholdDp]
     * (~44 dp ≈ one pin tap target) share a bucket; buckets with two or
     * more pins collapse into a [MapClusterPin] at their centroid. At
     * high zoom the cell shrinks below typical pin spacing, so
     * everything stays a single — no explicit zoom gate needed.
     *
     * Output is stable for a given input: singles keep the input pin
     * order, clusters surface in first-seen bucket order with
     * deterministic `cluster_<x>_<y>` ids.
     */
    fun buildClusteredPins(
        pins: List<MapPin>,
        span: Double,
        mapWidthDp: Double = 390.0,
        thresholdDp: Double = 44.0,
    ): ClusteredPins {
        if (span <= 0 || pins.size <= 1) return ClusteredPins(singles = pins, clusters = emptyList())
        val cellDegrees = span * thresholdDp / mapWidthDp

        data class Cell(val x: Int, val y: Int)

        val buckets = LinkedHashMap<Cell, MutableList<MapPin>>()
        for (pin in pins) {
            val cell =
                Cell(
                    x = floor(pin.longitude / cellDegrees).toInt(),
                    y = floor(pin.latitude / cellDegrees).toInt(),
                )
            buckets.getOrPut(cell) { mutableListOf() }.add(pin)
        }
        val singles = mutableListOf<MapPin>()
        val clusters = mutableListOf<MapClusterPin>()
        for ((cell, members) in buckets) {
            if (members.size == 1) {
                singles += members
            } else {
                clusters +=
                    MapClusterPin(
                        id = "cluster_${cell.x}_${cell.y}",
                        latitude = members.sumOf { it.latitude } / members.size,
                        longitude = members.sumOf { it.longitude } / members.size,
                        count = members.size,
                    )
            }
        }
        return ClusteredPins(singles = singles, clusters = clusters)
    }

    /**
     * Camera region fitting every pin with padding — backs the
     * focus-on-pins map control. `null` when there are no pins.
     */
    fun fittingRegion(
        pins: List<MapPin>,
        paddingFactor: Double = 1.4,
        minimumSpan: Double = 0.005,
    ): MapListHybridRegion? {
        val first = pins.firstOrNull() ?: return null
        var minLat = first.latitude
        var maxLat = first.latitude
        var minLon = first.longitude
        var maxLon = first.longitude
        for (pin in pins.drop(1)) {
            minLat = min(minLat, pin.latitude)
            maxLat = max(maxLat, pin.latitude)
            minLon = min(minLon, pin.longitude)
            maxLon = max(maxLon, pin.longitude)
        }
        return MapListHybridRegion(
            centerLatitude = (minLat + maxLat) / 2,
            centerLongitude = (minLon + maxLon) / 2,
            latitudeSpan = max((maxLat - minLat) * paddingFactor, minimumSpan),
            longitudeSpan = max((maxLon - minLon) * paddingFactor, minimumSpan),
        )
    }
}
