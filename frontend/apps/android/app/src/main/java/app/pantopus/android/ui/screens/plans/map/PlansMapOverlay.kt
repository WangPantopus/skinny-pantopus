@file:Suppress("MagicNumber", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.plans.map

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.components.PlanAreaGlow
import app.pantopus.android.ui.screens.plans.components.PlanAreaLabel
import app.pantopus.android.ui.screens.plans.components.PlanCluster
import app.pantopus.android.ui.screens.plans.components.PlanPin
import app.pantopus.android.ui.screens.plans.components.PlanPinBadge
import app.pantopus.android.ui.screens.plans.components.planPinAnchorFromTop
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.CameraPositionState
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

/** One pin as the map draws it. */
data class MapPin(
    val id: String,
    val kind: PlanKind,
    val latitude: Double,
    val longitude: Double,
    val tag: String,
    val spoken: String,
    val live: Boolean = false,
    val full: Boolean = false,
    val badge: PlanPinBadge = PlanPinBadge.None,
    /** Playdates show the neighborhood (about 1 km) instead of the area (about 500 m). */
    val neighborhood: Boolean = false,
    val areaLabel: String? = null,
)

/** What the overlay places: a pin, a cluster of pins, or the selected pin's area. */
private sealed interface MapItem {
    val key: String
    val latitude: Double
    val longitude: Double

    data class Single(
        val pin: MapPin,
        /** Where a pin sharing its spot with others sits on their ring, in dp from the spot (zoomed in). */
        val ringDx: Float = 0f,
        val ringDy: Float = 0f,
    ) : MapItem {
        override val key: String get() = "pin:${pin.id}"
        override val latitude: Double get() = pin.latitude
        override val longitude: Double get() = pin.longitude
    }

    data class Group(
        val pins: List<MapPin>,
    ) : MapItem {
        override val key: String get() = "cluster:${pins.map { it.id }.sorted().joinToString(",")}"
        override val latitude: Double get() = pins.map { it.latitude }.average()
        override val longitude: Double get() = pins.map { it.longitude }.average()
    }

    data class Area(
        val pin: MapPin,
        val radiusDp: Float,
    ) : MapItem {
        override val key: String get() = "area:${pin.id}"
        override val latitude: Double get() = pin.latitude
        override val longitude: Double get() = pin.longitude
    }
}

/**
 * Pins over the Google map (board P1), placed where the map projects them and moved with every camera change.
 * Drawn in Compose rather than as map markers so they can animate (selection, the live halo, the reveal) and so
 * TalkBack reads each one ("Watch party, Sunday 1:25 PM, about 1 mile, 3 spots left"). Pins closer than about
 * 40 dp merge into a cluster; tapping a cluster zooms in on it. Taps anywhere else reach the map.
 */
@Composable
fun PlansMapOverlay(
    cameraState: CameraPositionState,
    pins: List<MapPin>,
    selectedId: String?,
    onPin: (MapPin) -> Unit,
    onCluster: (List<MapPin>) -> Unit,
    reduceMotion: Boolean,
    modifier: Modifier = Modifier,
    droppingId: String? = null,
    mapReady: Boolean = true,
    camera: () -> CameraPosition = { cameraState.position },
    layoutKey: () -> Any? = { null },
) {
    val zoom by remember(cameraState) { derivedStateOf { (camera().zoom * 2f).roundToInt() / 2f } }
    val items =
        remember(pins, selectedId, zoom) {
            buildItems(pins, selectedId, zoom.toDouble())
        }
    val density = LocalDensity.current
    val pxPerDp = density.density
    val pinAnchor = with(density) { planPinAnchorFromTop().toPx() }
    Layout(
        // Pins near an edge never draw over the status bar or the tab bar.
        modifier = modifier.fillMaxSize().clipToBounds(),
        content = {
            items.forEach { item ->
                key(item.key) {
                    when (item) {
                        is MapItem.Area -> AreaItem(item)
                        is MapItem.Single ->
                            PinItem(
                                pin = item.pin,
                                selected = item.pin.id == selectedId,
                                dimmed = selectedId != null && item.pin.id != selectedId,
                                reduceMotion = reduceMotion,
                                drop = item.pin.id == droppingId,
                                onTap = { onPin(item.pin) },
                            )
                        is MapItem.Group -> ClusterItem(item.pins, dimmed = selectedId != null) { onCluster(item.pins) }
                    }
                }
            }
        },
    ) { measurables, constraints ->
        val placeables = measurables.map { it.measure(Constraints()) }
        layout(constraints.maxWidth, constraints.maxHeight) {
            // Reading the camera here moves the pins with the map without recomposing them; [layoutKey] adds what
            // else moves them (the map's padding moves its center).
            camera()
            layoutKey()
            if (!mapReady) return@layout
            val projection = cameraState.projection ?: return@layout
            placeables.forEachIndexed { index, placeable ->
                val item = items.getOrNull(index) ?: return@forEachIndexed
                val point = projection.toScreenLocation(LatLng(item.latitude, item.longitude))
                // Off the map: not placed, so TalkBack doesn't reach a pin nobody can see.
                if (item !is MapItem.Area && (point.x !in 0..constraints.maxWidth || point.y !in 0..constraints.maxHeight)) {
                    return@forEachIndexed
                }
                val anchorY =
                    when (item) {
                        is MapItem.Single -> pinAnchor
                        else -> placeable.height / 2f
                    }
                val ring = item as? MapItem.Single
                placeable.place(
                    x = (point.x - placeable.width / 2f + (ring?.ringDx ?: 0f) * pxPerDp).roundToInt(),
                    y = (point.y - anchorY + (ring?.ringDy ?: 0f) * pxPerDp).roundToInt(),
                )
            }
        }
    }
}

@Composable
private fun AreaItem(item: MapItem.Area) {
    val color = item.pin.kind.colors.accent
    Box(modifier = Modifier.size((item.radiusDp * 2).dp).clearAndSetSemantics {}) {
        PlanAreaGlow(color = color, radiusPx = with(LocalDensity.current) { item.radiusDp.dp.toPx() }, modifier = Modifier.fillMaxSize())
        item.pin.areaLabel?.let { label ->
            PlanAreaLabel(text = label, color = color, modifier = Modifier.align(androidx.compose.ui.Alignment.Center))
        }
    }
}

@Composable
private fun PinItem(
    pin: MapPin,
    selected: Boolean,
    dimmed: Boolean,
    reduceMotion: Boolean,
    drop: Boolean,
    onTap: () -> Unit,
) {
    // Board P3 "Post a plan": the new pin drops 16 dp onto its spot in 220 ms with a small bounce, and a success
    // haptic as it lands.
    val fall = remember { Animatable(if (drop && !reduceMotion) -DROP_DP else 0f) }
    val view = LocalView.current
    LaunchedEffect(drop) {
        if (!drop) return@LaunchedEffect
        if (!reduceMotion) fall.animateTo(0f, spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessMedium))
        view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
    }
    PlanPin(
        kind = pin.kind,
        tag = pin.tag,
        selected = selected,
        dimmed = dimmed,
        full = pin.full,
        live = pin.live,
        badge = pin.badge,
        reduceMotion = reduceMotion,
        modifier =
            Modifier
                .graphicsLayer { translationY = fall.value * density }
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    role = Role.Button,
                    onClick = onTap,
                ).clearAndSetSemantics {
                    contentDescription = pin.spoken
                    role = Role.Button
                    this.selected = selected
                    onClick(label = "Show this plan") {
                        onTap()
                        true
                    }
                },
    )
}

@Composable
private fun ClusterItem(
    pins: List<MapPin>,
    dimmed: Boolean,
    onTap: () -> Unit,
) {
    PlanCluster(
        count = pins.size,
        kinds = pins.map { it.kind },
        modifier =
            Modifier
                .alpha(if (dimmed) DIMMED_ALPHA else 1f)
                .clickable(role = Role.Button, onClick = onTap)
                .clearAndSetSemantics {
                    contentDescription = "${pins.size} plans here"
                    role = Role.Button
                    onClick(label = "Zoom in") {
                        onTap()
                        true
                    }
                },
    )
}

private const val DROP_DP = 16f
private const val DIMMED_ALPHA = 0.4f
private const val CLUSTER_DP = 40.0

/** From this zoom, plans sharing a spot spread into a ring instead of a cluster. */
const val SPREAD_ZOOM = 16.0
private const val RING_DP = 30.0
private const val RING_DP_MAX = 72.0
private const val RING_GAP_DP = 64.0
private const val AREA_METERS = 500.0
private const val NEIGHBORHOOD_METERS = 1000.0
private const val EARTH_CIRCUMFERENCE_M = 40_075_016.686
private const val TILE_DP = 256.0

/** Meters per dp at [latitude] and [zoom] (Google Maps draws 256 dp tiles). */
private fun metersPerDp(
    latitude: Double,
    zoom: Double,
): Double = cos(latitude * PI / 180.0) * EARTH_CIRCUMFERENCE_M / (TILE_DP * 2.0.pow(zoom))

/** Web Mercator position in dp at [zoom], for distances between pins. */
private fun worldDp(
    latitude: Double,
    longitude: Double,
    zoom: Double,
): Pair<Double, Double> {
    val scale = TILE_DP * 2.0.pow(zoom)
    val x = (longitude + 180.0) / 360.0 * scale
    val s = sin(latitude * PI / 180.0).coerceIn(-0.9999, 0.9999)
    val y = (0.5 - ln((1 + s) / (1 - s)) / (4 * PI)) * scale
    return x to y
}

/** [pins] around their shared spot, one per step of a circle, wide enough that neighbors' time labels don't touch. */
private fun ring(pins: List<MapPin>): List<MapItem.Single> {
    val radius = (RING_GAP_DP / 2 / sin(PI / pins.size.coerceAtLeast(2))).coerceIn(RING_DP, RING_DP_MAX)
    return pins.mapIndexed { index, pin ->
        val angle = 2 * PI * index / pins.size - PI / 2
        MapItem.Single(pin, ringDx = (radius * cos(angle)).toFloat(), ringDy = (radius * sin(angle)).toFloat())
    }
}

private fun buildItems(
    pins: List<MapPin>,
    selectedId: String?,
    zoom: Double,
): List<MapItem> {
    val selected = pins.firstOrNull { it.id == selectedId }
    val rest = pins.filter { it.id != selectedId }
    val positions = rest.associate { it.id to worldDp(it.latitude, it.longitude, zoom) }
    val used = mutableSetOf<String>()
    val singles = mutableListOf<MapItem>()
    val groups = mutableListOf<MapItem>()
    rest.forEach { pin ->
        if (pin.id in used) return@forEach
        val (x, y) = positions.getValue(pin.id)
        val near =
            rest.filter { other ->
                other.id !in used && positions.getValue(other.id).let { (ox, oy) -> hypot(ox - x, oy - y) < CLUSTER_DP }
            }
        used += near.map { it.id }
        when {
            near.size < 2 -> singles += MapItem.Single(pin)
            // Zoomed in, plans that share a spot (area points sit on a ~500 m grid) fan out in a ring so each one
            // can be tapped; zooming in further would never pull them apart.
            zoom >= SPREAD_ZOOM -> singles += ring(near)
            else -> groups += MapItem.Group(near)
        }
    }
    val area =
        selected?.let {
            val meters = if (it.neighborhood) NEIGHBORHOOD_METERS else AREA_METERS
            MapItem.Area(it, (meters / metersPerDp(it.latitude, zoom)).toFloat())
        }
    // Areas under everything, the selected pin on top.
    return listOfNotNull(area) + groups + singles + listOfNotNull(selected?.let { MapItem.Single(it) })
}
