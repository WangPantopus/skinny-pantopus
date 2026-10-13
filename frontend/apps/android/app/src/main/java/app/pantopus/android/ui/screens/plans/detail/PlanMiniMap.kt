@file:Suppress("MagicNumber", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.plans.detail

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import app.pantopus.android.R
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.PlanViewerStanding
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planState
import app.pantopus.android.data.plans.standing
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.components.PlanAreaGlow
import app.pantopus.android.ui.screens.plans.components.PlanAreaLabel
import app.pantopus.android.ui.screens.plans.components.PlanPin
import app.pantopus.android.ui.screens.plans.components.PlanPinBadge
import app.pantopus.android.ui.screens.plans.components.planPinAnchorFromTop
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapEffect
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MapsComposeExperimentalApi
import com.google.maps.android.compose.rememberCameraPositionState
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.roundToInt

/** Height of the map at the top of a plan page (boards J1 to J9, H9). */
val PLAN_MAP_HEIGHT: Dp = 236.dp

/**
 * The map at the top of a plan page. Before you're in it shows the area (about 500 m, a playdate's neighborhood);
 * once you're in, or for the host, the exact pin with its badge and the place's name. When [reveal] is true it
 * plays the reveal from board P3: the area contracts toward the true point and fades (0 to 280 ms), the pin grows
 * from its tip to 106% and settles (200 to 420 ms), with a success haptic as it lands. Under Reduce Motion it is a
 * 150 ms crossfade. Not interactive: the page scrolls over it.
 */
@Composable
fun PlanMiniMap(
    plan: PlanDto,
    reveal: Boolean,
    reduceMotion: Boolean,
    onRevealDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val kind = plan.planKind ?: PlanKind.WATCH_PARTY
    val areaPoint = plan.area?.let { a -> if (a.latitude != null && a.longitude != null) LatLng(a.latitude, a.longitude) else null }
    val exactPoint = plan.place?.let { p -> if (p.latitude != null && p.longitude != null) LatLng(p.latitude, p.longitude) else null }
    val center = exactPoint ?: areaPoint ?: return
    val camera = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(center, ZOOM) }
    LaunchedEffect(center) { camera.position = CameraPosition.fromLatLngZoom(center, ZOOM) }
    val progress = remember { Animatable(if (reveal) 0f else 1f) }
    val view = LocalView.current
    val done by rememberUpdatedState(onRevealDone)
    var ready by remember { mutableStateOf(false) }
    // The reveal waits for the map, so the person sees the area become the pin.
    LaunchedEffect(reveal, ready) {
        if (!reveal || !ready) return@LaunchedEffect
        progress.snapTo(0f)
        progress.animateTo(1f, tween(if (reduceMotion) 150 else REVEAL_MS, easing = LinearEasing))
        view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
        done()
    }
    Box(modifier = modifier.fillMaxWidth().height(PLAN_MAP_HEIGHT).clearAndSetSemantics {}) {
        StaticMap(camera, onReady = { ready = true })
        if (!ready) return@Box
        val neighborhood = kind == PlanKind.PLAYDATE || plan.area?.precision == "neighborhood"
        val radiusDp = ((if (neighborhood) 1000.0 else 500.0) / metersPerDp(center.latitude)).toFloat()
        if (exactPoint == null) {
            AreaAt(
                camera,
                areaPoint ?: center,
                radiusDp,
                kind,
                label = if (kind == PlanKind.PLAYDATE) plan.area?.label else null,
                strength = 1f,
            )
        } else {
            val t = progress.value
            val areaT = if (reduceMotion) 1f else (t * REVEAL_MS / AREA_MS).coerceIn(0f, 1f)
            val pinT = if (reduceMotion) t else ((t * REVEAL_MS - PIN_START_MS) / PIN_MS).coerceIn(0f, 1f)
            val from = areaPoint ?: exactPoint
            val areaCenter = LatLng(lerp(from.latitude, exactPoint.latitude, areaT), lerp(from.longitude, exactPoint.longitude, areaT))
            val areaStrength = if (reduceMotion) 1f - t else 1f - 0.6f * areaT
            AreaAt(camera, areaCenter, radiusDp * (1f - 0.7f * areaT), kind, label = null, strength = areaStrength, ghost = areaT >= 1f)
            val closed = plan.planState == PlanState.CANCELLED || plan.planState == PlanState.ENDED
            val badge =
                when {
                    closed -> PlanPinBadge.None
                    plan.standing == PlanViewerStanding.HOSTING -> PlanPinBadge.Hosting
                    plan.standing == PlanViewerStanding.IN -> PlanPinBadge.In
                    else -> PlanPinBadge.None
                }
            val tag =
                when {
                    plan.standing == PlanViewerStanding.HOSTING && plan.placeKind == "home" -> "Your place"
                    else -> plan.place?.name
                }
            PinAt(
                camera,
                exactPoint,
                kind,
                tag,
                badge,
                scale = if (reduceMotion) 1f else growFromTip(pinT),
                alpha = if (reduceMotion) t else 1f,
            )
        }
    }
}

private const val ZOOM = 14.5f
private const val REVEAL_MS = 450
private const val AREA_MS = 280f
private const val PIN_START_MS = 200f
private const val PIN_MS = 220f

private fun lerp(
    a: Double,
    b: Double,
    t: Float,
): Double = a + (b - a) * t

/** 0 to 106% and back to 100%: a light spring, as a curve. */
private fun growFromTip(t: Float): Float = if (t < 0.7f) t / 0.7f * 1.06f else 1.06f - (t - 0.7f) / 0.3f * 0.06f

private fun metersPerDp(latitude: Double): Double = cos(latitude * PI / 180.0) * 40_075_016.686 / (256.0 * 2.0.pow(ZOOM.toDouble()))

@OptIn(MapsComposeExperimentalApi::class)
@Composable
private fun StaticMap(
    camera: CameraPositionState,
    onReady: () -> Unit,
) {
    val context = LocalContext.current
    val properties =
        remember(context) {
            MapProperties(mapStyleOptions = MapStyleOptions.loadRawResourceStyle(context, R.raw.nearby_map_style))
        }
    val settings =
        remember {
            MapUiSettings(
                compassEnabled = false,
                mapToolbarEnabled = false,
                myLocationButtonEnabled = false,
                rotationGesturesEnabled = false,
                scrollGesturesEnabled = false,
                tiltGesturesEnabled = false,
                zoomControlsEnabled = false,
                zoomGesturesEnabled = false,
            )
        }
    GoogleMap(modifier = Modifier.fillMaxSize(), cameraPositionState = camera, properties = properties, uiSettings = settings) {
        // Ready even when tiles can't load (no Maps key on a dev machine), so the area and pin still place.
        MapEffect(Unit) { onReady() }
    }
}

/** Places [content] so its center (or, with [anchorFromTop], that point) sits on [point]. */
@Composable
private fun AtPoint(
    camera: CameraPositionState,
    point: LatLng,
    anchorFromTop: Dp?,
    content: @Composable () -> Unit,
) {
    val density = LocalDensity.current
    val size = remember { mutableStateOf(IntSize.Zero) }
    Box(
        modifier =
            Modifier
                .onSizeChanged { size.value = it }
                .offset {
                    camera.position
                    val projected = camera.projection?.toScreenLocation(point) ?: return@offset IntOffset(-10_000, -10_000)
                    val anchorY = anchorFromTop?.let { with(density) { it.toPx() } } ?: (size.value.height / 2f)
                    IntOffset((projected.x - size.value.width / 2f).roundToInt(), (projected.y - anchorY).roundToInt())
                },
    ) { content() }
}

@Composable
private fun AreaAt(
    camera: CameraPositionState,
    point: LatLng,
    radiusDp: Float,
    kind: PlanKind,
    label: String?,
    strength: Float,
    ghost: Boolean = false,
) {
    val color = kind.colors.accent
    val radius = radiusDp.coerceIn(8f, 600f)
    AtPoint(camera, point, anchorFromTop = null) {
        Box(modifier = Modifier.size((radius * 2).dp)) {
            PlanAreaGlow(
                color = color,
                radiusPx = with(LocalDensity.current) { radius.dp.toPx() },
                strength = strength,
                ghost = ghost,
                modifier = Modifier.fillMaxSize(),
            )
            if (label != null) {
                PlanAreaLabel(text = label, color = color, modifier = Modifier.align(androidx.compose.ui.Alignment.Center))
            }
        }
    }
}

@Composable
private fun PinAt(
    camera: CameraPositionState,
    point: LatLng,
    kind: PlanKind,
    tag: String?,
    badge: PlanPinBadge,
    scale: Float,
    alpha: Float,
) {
    AtPoint(camera, point, anchorFromTop = planPinAnchorFromTop()) {
        PlanPin(
            kind = kind,
            tag = tag,
            selected = true,
            badge = badge,
            modifier =
                Modifier
                    .alpha(alpha)
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        transformOrigin = TransformOrigin(0.5f, PIN_TIP_FRACTION)
                    },
        )
    }
}

/** Where the tip sits in the pin composable's height (the head box over the tag), for "grows from its tip". */
private const val PIN_TIP_FRACTION = 0.8f
