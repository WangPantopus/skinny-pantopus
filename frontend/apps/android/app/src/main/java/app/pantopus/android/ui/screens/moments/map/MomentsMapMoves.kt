@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.moments.map

import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.moments.MomentsMapMove
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max

/*
 * When the map moves by itself (founder, 2026-11-11: "automatically move the map zoomed in or out with some kind of
 * triggering events"), as on iPhone (`MomentsMapViewModel+Moves.swift`), and the rules that keep it from fighting the
 * person: it moves once per thing they did, never while a crowded spot is open, never after they have moved the map
 * themselves, and opening on you it only ever zooms out.
 *
 * - The place under a Moment's name, tapped: the map closes in on it.
 * - The viewer closes (a push's Moment included): the last person watched is brought into view when the map isn't
 *   showing them.
 * - The map opens on you: what's new just outside the view is framed with you, and with nothing in view at all the
 *   nearest Moments are.
 */

/** A box on the map, in degrees. */
internal data class MapBox(
    val south: Double,
    val west: Double,
    val north: Double,
    val east: Double,
) {
    val latitudeSpan: Double get() = north - south
    val longitudeSpan: Double get() = east - west
    private val centerLatitude: Double get() = (south + north) / 2
    private val centerLongitude: Double get() = (west + east) / 2

    fun holds(
        latitude: Double,
        longitude: Double,
    ): Boolean = latitude in south..north && longitude in west..east

    /** Whether a spot is inside the box, clear of its edges (the middle nine tenths). */
    fun shows(
        latitude: Double,
        longitude: Double,
    ): Boolean = abs(centerLatitude - latitude) < latitudeSpan * 0.45 && abs(centerLongitude - longitude) < longitudeSpan * 0.45

    /** About the same view as [other]: the map hasn't been moved or zoomed since. */
    fun isAbout(other: MapBox): Boolean =
        abs(centerLatitude - other.centerLatitude) < other.latitudeSpan * 0.1 &&
            abs(centerLongitude - other.centerLongitude) < other.longitudeSpan * 0.1 &&
            abs(latitudeSpan - other.latitudeSpan) < other.latitudeSpan * 0.2
}

/**
 * Reads the box the tab's dot counts in (about two miles around you). New Moments there are worth a move. With nothing
 * in view at all it looks further (about 10, then 50 miles) and takes the nearest. Returns the rings to frame, empty
 * when there's nothing to move for.
 */
internal suspend fun lookAround(
    latitude: Double,
    longitude: Double,
    nothingInView: Boolean,
    watched: Set<String>,
    read: suspend (box: MapBox, zoom: Int) -> List<MomentRingDto>?,
): List<MomentRingDto> {
    var reach = 1.0
    for (step in 0 until LOOK_STEPS) {
        val box = MapBox(latitude - 0.015 * reach, longitude - 0.02 * reach, latitude + 0.015 * reach, longitude + 0.02 * reach)
        val placed = (read(box, 14 - step * 2) ?: return emptyList()).filter { !it.noLocation }
        val fresh = placed.filter { ring -> !ring.mine && ring.moments.any { !it.seen && it.id !in watched } }
        // With something in view only what's new is worth a move; with nothing, anything is.
        val wanted = if (fresh.isEmpty() && nothingInView) placed else fresh
        val near = if (step > 0) nearest(wanted, latitude, longitude) else wanted
        if (near.isNotEmpty() || !nothingInView) return near
        reach *= 5
    }
    return emptyList()
}

/**
 * Frames [rings] with you in the middle, unless the map ([showing]) shows them all already: room around the farthest
 * one, and never closer in than the map is.
 */
internal fun frameMove(
    rings: List<MomentRingDto>,
    latitude: Double,
    longitude: Double,
    showing: MapBox,
): MomentsMapMove? {
    if (rings.all { showing.shows(it.latitude, it.longitude) }) return null
    val tall = rings.maxOf { abs(it.latitude - latitude) }
    val wide = rings.maxOf { abs(it.longitude - longitude) }
    return MomentsMapMove(
        latitude = latitude,
        longitude = longitude,
        kind = MomentsMapMove.Kind.FRAME,
        latitudeSpan = max(tall * FRAME_ROOM, showing.latitudeSpan),
        longitudeSpan = max(wide * FRAME_ROOM, showing.longitudeSpan),
    )
}

/** The nearest ring and the ones about as near (within half again its distance). */
private fun nearest(
    rings: List<MomentRingDto>,
    latitude: Double,
    longitude: Double,
): List<MomentRingDto> {
    fun distance(ring: MomentRingDto): Double = hypot(ring.latitude - latitude, (ring.longitude - longitude) * cos(latitude * PI / 180))
    val closest = rings.minOfOrNull(::distance) ?: return emptyList()
    return rings.filter { distance(it) <= closest * 1.5 + 0.002 }
}

private const val LOOK_STEPS = 3

/** The farthest ring's offset times this is the framed span (2.6 clipped the bubble on iPhone). */
private const val FRAME_ROOM = 3.4
