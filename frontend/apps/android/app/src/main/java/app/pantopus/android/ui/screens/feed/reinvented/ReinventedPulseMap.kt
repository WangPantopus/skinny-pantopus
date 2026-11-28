@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import app.pantopus.android.R
import app.pantopus.android.data.pulse.ReinventedBox
import app.pantopus.android.ui.screens.feed.living.LivingBeamsLayer
import app.pantopus.android.ui.screens.feed.living.LivingLight
import app.pantopus.android.ui.screens.feed.living.LivingPin
import app.pantopus.android.ui.screens.feed.living.livingBox
import app.pantopus.android.ui.screens.feed.living.livingMapStyle
import app.pantopus.android.ui.screens.feed.living.rememberLivingLight
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.moments.components.MomentMapPin
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.rememberCameraPositionState

/** The zoom the map opens at: a town and what's around it. */
private const val OPEN_ZOOM = 12.5f

/**
 * The one map (PHASE-1 §2 piece 7, flat first: board B4): a ring is a Moment (today's ring pin), a mark on the ground is
 * a post that stays (a kept Moment too), a ticket is a plan. A Heads-up is red, pulsing and always on top. A tap on a
 * pin opens it ([onOpen]). [padding] is the part of the map the list covers: the map keeps its middle clear of it.
 */
@Composable
internal fun ReinventedPulseMap(
    state: ReinventedMapState,
    camera: CameraPositionState,
    focused: String?,
    padding: PaddingValues,
    onMoved: (ReinventedBox) -> Unit,
    onOpen: (ReinventedMapItem) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var ready by remember { mutableStateOf(false) }
    val light = rememberLivingLight(state, camera)
    val center = state.center
    // The map opens on the phone's place (or the home) once it is known, and never jumps there again.
    var centered by remember { mutableStateOf(false) }
    LaunchedEffect(center, ready) {
        if (center == null || centered || !ready) return@LaunchedEffect
        centered = true
        camera.move(CameraUpdateFactory.newLatLngZoom(LatLng(center.latitude, center.longitude), OPEN_ZOOM))
    }
    // Each box is read once the map is still.
    LaunchedEffect(camera.isMoving, ready, centered) {
        if (camera.isMoving || !ready || !centered) return@LaunchedEffect
        val bounds = camera.projection?.visibleRegion?.latLngBounds ?: return@LaunchedEffect
        onMoved(bounds.livingBox())
    }
    val properties =
        remember(context, light.dark) {
            MapProperties(
                isMyLocationEnabled = locationAllowed(context),
                mapStyleOptions = livingMapStyle(context, light.dark, R.raw.nearby_map_style),
            )
        }
    val uiSettings =
        remember {
            MapUiSettings(myLocationButtonEnabled = false, zoomControlsEnabled = false, compassEnabled = false, mapToolbarEnabled = false)
        }
    Box(modifier = modifier.fillMaxSize().testTag("reinventedPulse.map")) {
        GoogleMap(
            modifier = Modifier.fillMaxSize().semantics { contentDescription = "Map of Pulse near you" },
            cameraPositionState = camera,
            properties = properties,
            uiSettings = uiSettings,
            contentPadding = padding,
            onMapLoaded = { ready = true },
        )
        // Live beams (phase 4); never on My Atlas, the person's own private map.
        if (ready && !state.atlas) LivingBeamsLayer(camera, state.time, light.dark)
        if (ready) ReinventedMapPins(state.drawOrder, focused, camera, light, onOpen)
    }
}

/** Where the map starts before it knows the place: the whole country, until the place comes. */
@Composable
internal fun rememberReinventedCamera(): CameraPositionState =
    rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(LatLng(39.5, -98.35), 3.5f) }

/** The pins over the map, each standing on its point, moved with the camera without recomposing. */
@Composable
private fun ReinventedMapPins(
    items: List<ReinventedMapItem>,
    focused: String?,
    camera: CameraPositionState,
    light: LivingLight,
    onOpen: (ReinventedMapItem) -> Unit,
) {
    Layout(
        modifier = Modifier.fillMaxSize(),
        content = {
            items.forEach { item ->
                key(
                    item.id,
                ) {
                    LivingPin(item, light, item.id == focused, Modifier.clickable(role = Role.Button) { onOpen(item) }) { tap ->
                        ReinventedMapPin(item, focused = item.id == focused, modifier = tap)
                    }
                }
            }
        },
    ) { measurables, constraints ->
        val placeables = measurables.map { it.measure(Constraints()) }
        layout(constraints.maxWidth, constraints.maxHeight) {
            // Reading the camera here moves the pins with the map.
            camera.position
            val projection = camera.projection ?: return@layout
            placeables.forEachIndexed { index, placeable ->
                val item = items.getOrNull(index) ?: return@forEachIndexed
                val point = projection.toScreenLocation(LatLng(item.latitude, item.longitude))
                if (point.x !in 0..constraints.maxWidth || point.y !in 0..constraints.maxHeight) return@forEachIndexed
                // The pin's bottom middle stands on its point.
                placeable.place(IntOffset(point.x - placeable.width / 2, point.y - placeable.height))
            }
        }
    }
}

/** One pin: a ring for a Moment, a mark on the ground for a post that stays, a ticket for a plan. */
@Composable
internal fun ReinventedMapPin(
    item: ReinventedMapItem,
    focused: Boolean,
    modifier: Modifier = Modifier,
) {
    val scale = if (focused) 1.18f else 1f
    Box(modifier = modifier.graphicsLayer(scaleX = scale, scaleY = scale).testTag("reinventedPulse.pin.${item.id}")) {
        when (item) {
            is ReinventedMapItem.Ring ->
                MomentMapPin(
                    author = item.ring.author,
                    seen = item.ring.moments.map { it.seen },
                    preview = item.ring.preview,
                    live = item.ring.liveUntil != null,
                    modifier = Modifier.semantics { contentDescription = "${item.ring.author.firstName ?: "Someone"}'s Moment" },
                )
            is ReinventedMapItem.Mark -> MarkPin(PulseIntent.fromPostType(item.mark.post.postType), item.mark.headsUp)
            is ReinventedMapItem.Kept -> MarkPin(null, headsUp = false, spoken = "A kept Moment")
            is ReinventedMapItem.Ticket -> TicketPin(item.ticket.title.orEmpty())
        }
    }
}

/** A post that stays: a mark on the ground with its kind; a Heads-up red and pulsing. */
@Composable
private fun MarkPin(
    intent: PulseIntent?,
    headsUp: Boolean,
    spoken: String = if (headsUp) "Heads-up" else "A post that stays",
) {
    Box(modifier = Modifier.size(46.dp).semantics { contentDescription = spoken }, contentAlignment = Alignment.Center) {
        if (headsUp) {
            val pulse = rememberInfiniteTransition(label = "headsUp")
            val grow by pulse.animateFloat(0.85f, 1.35f, infiniteRepeatable(tween(1400), RepeatMode.Restart), label = "grow")
            Box(
                Modifier
                    .size(46.dp)
                    .scale(grow)
                    .graphicsLayer(alpha = (1.35f - grow) / 0.5f)
                    .background(PantopusColors.error.copy(alpha = 0.35f), CircleShape),
            )
        }
        val shape = RoundedCornerShape(9.dp)
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(shape)
                    .background(if (headsUp) PantopusColors.error else PantopusColors.appSurface)
                    .border(if (headsUp) 0.dp else 1.dp, PantopusColors.appBorder, shape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = if (headsUp) PantopusIcon.AlertTriangle else intent?.icon ?: PantopusIcon.Image,
                contentDescription = null,
                size = 16.dp,
                tint = if (headsUp) Color.White else PantopusColors.primary600,
            )
        }
    }
}

/** A plan: a small ticket with its title. */
@Composable
private fun TicketPin(title: String) {
    Row(
        modifier =
            Modifier
                .height(26.dp)
                .widthIn(max = 150.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(PantopusColors.primary600)
                .padding(horizontal = 8.dp)
                .semantics(mergeDescendants = true) { contentDescription = "Plan: $title" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.CalendarCheck, contentDescription = null, size = 13.dp, tint = Color.White)
        Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** The blue dot shows only where the person let Pantopus see their location. */
private fun locationAllowed(context: Context): Boolean =
    listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }
