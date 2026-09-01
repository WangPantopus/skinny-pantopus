@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "CyclomaticComplexMethod", "LongParameterList")
@file:OptIn(com.google.maps.android.compose.MapsComposeExperimentalApi::class)

package app.pantopus.android.ui.screens.shared.map_list_hybrid

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState

/** Locate + layers stack (two 38dp buttons + 8dp gap). */
internal val MAP_CONTROLS_STACK_HEIGHT = 84.dp

/** A11.1 — sheet gap + controls + gap before the Post-task FAB. */
internal val FAB_LIFT_ABOVE_SHEET = 112.dp

/** Room below the status bar for the FAB when the sheet is expanded. */
internal val FAB_TOP_RESERVE = 56.dp

internal val SHEET_TO_CONTROLS_GAP = 14.dp

/**
 * T6.6a (P24) — shared archetype for map+list hybrid surfaces.
 *
 * Full-bleed Google Maps canvas underneath, five chrome slots overlaid
 * (top pill, category chips at the top edge, map-controls stack pinned
 * to the right above the sheet edge), and a draggable bottom sheet
 * that snaps between three detents per Q9 (screen-relative fractions,
 * revised by A11.1): [MapListHybridDetent.Collapsed] (20%),
 * [MapListHybridDetent.Standard] (40%), and
 * [MapListHybridDetent.Expanded] (90%).
 *
 * The shell owns:
 * - the Google Maps canvas (rendering supplied [pins] + optional [anchor] disc)
 * - the sheet shell + drag-to-snap gesture
 * - the chrome layout
 *
 * The shell does **not** own data or chrome content — every slot is a
 * `@Composable` lambda so consumers supply their own back-pill, category
 * strip, locate-me / layers buttons, sheet header, and sheet body.
 *
 * Pin↔list sync is the consumer's job: when a pin is tapped the shell
 * fires [onPinTap]; the consumer typically updates its own selection
 * state and snaps the [detent] to `Standard` so the matching list item
 * surfaces.
 */
@Composable
fun MapListHybridShell(
    pins: List<MapPin>,
    detent: MapListHybridDetent,
    onDetentChange: (MapListHybridDetent) -> Unit,
    modifier: Modifier = Modifier,
    anchor: MapAnchor? = null,
    selectedPinId: String? = null,
    recenterTrigger: Int = 0,
    showSearchRadius: Boolean = false,
    onPinTap: (String) -> Unit = {},
    // A11.1 — cluster markers from the consumer's clustering pass, the
    // settled-camera report, and token-identified camera requests. All
    // default to inert so existing callers keep compiling.
    clusters: List<MapClusterPin> = emptyList(),
    onClusterTap: (String) -> Unit = {},
    onCameraChange: (MapListHybridRegion) -> Unit = {},
    cameraRequest: MapListHybridCameraRequest? = null,
    // Marker/sheet testTag namespace ("tasksMap" → "tasksMap.pin_<id>");
    // null keeps the legacy mapListHybrid* ids.
    markerTagPrefix: String? = null,
    // Height of the consumer's control stack — the clamp that stops the
    // 90% detent pushing the controls off the top of the screen.
    controlsStackHeight: Dp = MAP_CONTROLS_STACK_HEIGHT,
    reduceMotionOverride: Boolean? = null,
    topPill: @Composable () -> Unit = {},
    categoryChips: @Composable () -> Unit = {},
    mapControls: @Composable () -> Unit = {},
    floatingAction: @Composable () -> Unit = {},
    sheetHeader: @Composable () -> Unit = {},
    sheetBody: @Composable () -> Unit = {},
) {
    val context = LocalContext.current
    val reduceMotion =
        reduceMotionOverride ?: remember(context) { systemReduceMotion(context) }
    val density = LocalDensity.current

    val cameraStartCoord =
        anchor?.let { LatLng(it.latitude, it.longitude) }
            ?: pins.firstOrNull()?.let { LatLng(it.latitude, it.longitude) }
            ?: LatLng(40.7484, -73.9857)

    val cameraState =
        rememberCameraPositionState {
            position = CameraPosition.fromLatLngZoom(cameraStartCoord, 15f)
        }

    // Recenter the camera when the supplied anchor changes — mirrors
    // the iOS `onChange(of: anchor)` recenter + the web
    // `RecenterOnAnchor` effect. Without this, callers that resolve
    // the user's location after first composition see a stale camera.
    LaunchedEffect(anchor?.latitude, anchor?.longitude) {
        if (anchor != null) {
            cameraState.position =
                CameraPosition.fromLatLngZoom(LatLng(anchor.latitude, anchor.longitude), 15f)
        }
    }

    // Recenter on demand (locate-me) — increment [recenterTrigger] to
    // snap the camera back to the anchor without changing it.
    LaunchedEffect(recenterTrigger) {
        if (recenterTrigger != 0 && anchor != null) {
            cameraState.position =
                CameraPosition.fromLatLngZoom(LatLng(anchor.latitude, anchor.longitude), 15f)
        }
    }

    // A11.1 — settled-camera report. Google Maps' isMoving → false edge
    // stands in for the design's ~350 ms debounce; the projection's
    // visible bounds become a maps-SDK-free region for the consumer's
    // "Search this area" machine + clustering pass.
    LaunchedEffect(cameraState) {
        snapshotFlow { cameraState.isMoving }
            .collect { moving ->
                if (!moving) {
                    val bounds = cameraState.projection?.visibleRegion?.latLngBounds ?: return@collect
                    onCameraChange(
                        MapListHybridRegion(
                            centerLatitude = (bounds.southwest.latitude + bounds.northeast.latitude) / 2,
                            centerLongitude = (bounds.southwest.longitude + bounds.northeast.longitude) / 2,
                            latitudeSpan = bounds.northeast.latitude - bounds.southwest.latitude,
                            longitudeSpan = bounds.northeast.longitude - bounds.southwest.longitude,
                        ),
                    )
                }
            }
    }

    // A11.1 — apply token-identified camera requests (cluster zoom, rail
    // pan, widen, jump-to-activity, focus-on-pins), animated.
    LaunchedEffect(cameraRequest?.token) {
        val request = cameraRequest ?: return@LaunchedEffect
        val region = request.region
        cameraState.animate(
            CameraUpdateFactory.newLatLngBounds(
                LatLngBounds(
                    LatLng(region.minLatitude, region.minLongitude),
                    LatLng(region.maxLatitude, region.maxLongitude),
                ),
                0,
            ),
        )
    }

    var dragDelta by remember { mutableStateOf(0f) }

    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("mapListHybridShell"),
    ) {
        val containerHeight = maxHeight
        val baseHeightDp = detent.height(containerHeight)
        val baseHeightPx = with(density) { baseHeightDp.toPx() }
        val minHeightPx = 120f * density.density
        val targetHeightPx = (baseHeightPx - dragDelta).coerceAtLeast(minHeightPx)
        val targetHeightDp = with(density) { targetHeightPx.toDp() }
        val animatedHeight by animateDpAsState(
            targetValue = targetHeightDp,
            animationSpec = if (reduceMotion) tween(1) else tween(durationMillis = 240),
            label = "mapListHybridSheetHeight",
        )
        // Map controls follow the sheet edge but clamp so the 90% detent
        // can't push the stack (e.g. a Post-task FAB) off the top.
        val statusBarTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
        val maxControlsBottom =
            (containerHeight - statusBarTop - controlsStackHeight - SHEET_TO_CONTROLS_GAP)
                .coerceAtLeast(SHEET_TO_CONTROLS_GAP)
        val maxFabBottom =
            (containerHeight - statusBarTop - FAB_TOP_RESERVE).coerceAtLeast(FAB_LIFT_ABOVE_SHEET)
        val controlsBottom = minOf(targetHeightDp + SHEET_TO_CONTROLS_GAP, maxControlsBottom)
        val fabBottom = minOf(targetHeightDp + FAB_LIFT_ABOVE_SHEET, maxFabBottom)

        MapLayer(
            cameraState = cameraState,
            pins = pins,
            clusters = clusters,
            selectedPinId = selectedPinId,
            anchor = anchor,
            showSearchRadius = showSearchRadius,
            reduceMotion = reduceMotion,
            onPinTap = onPinTap,
            onClusterTap = onClusterTap,
            markerTagPrefix = markerTagPrefix,
        )

        Box(
            modifier =
                Modifier
                    .padding(WindowInsets.statusBars.asPaddingValues())
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .testTag("mapListHybridTopPill"),
        ) {
            topPill()
        }

        Box(
            modifier =
                Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .testTag("mapListHybridChips"),
        ) {
            categoryChips()
        }

        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 14.dp, bottom = controlsBottom)
                    .testTag("mapListHybridMapControls"),
        ) {
            mapControls()
        }

        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 14.dp, bottom = fabBottom)
                    .testTag("mapListHybridFloatingAction"),
        ) {
            floatingAction()
        }

        BottomSheet(
            heightDp = animatedHeight,
            onDrag = { delta -> dragDelta += delta },
            onDragReleased = { velocity ->
                val displacedPx = baseHeightPx - dragDelta
                val targetsPx =
                    MapListHybridDetent.entries.associateWith { stop ->
                        with(density) { stop.height(containerHeight).toPx() }
                    }
                val next =
                    MapListHybridDetentResolver.resolve(
                        current = detent,
                        velocity = velocity,
                        displacedHeightPx = displacedPx,
                        targetsPx = targetsPx,
                    )
                onDetentChange(next)
                dragDelta = 0f
            },
            sheetHeader = sheetHeader,
            sheetBody = sheetBody,
            modifier = Modifier.align(Alignment.BottomCenter),
            tag = markerTagPrefix?.let { "$it.sheet" } ?: "mapListHybridSheet",
        )
    }
}

@Composable
private fun MapLayer(
    cameraState: CameraPositionState,
    pins: List<MapPin>,
    clusters: List<MapClusterPin>,
    selectedPinId: String?,
    anchor: MapAnchor?,
    showSearchRadius: Boolean,
    reduceMotion: Boolean,
    onPinTap: (String) -> Unit,
    onClusterTap: (String) -> Unit,
    markerTagPrefix: String?,
) {
    val mapProperties = remember { MapProperties(isMyLocationEnabled = false) }
    val uiSettings =
        remember {
            MapUiSettings(
                myLocationButtonEnabled = false,
                zoomControlsEnabled = false,
                compassEnabled = false,
                mapToolbarEnabled = false,
            )
        }
    GoogleMap(
        modifier = Modifier.fillMaxSize().testTag("mapListHybridMap"),
        cameraPositionState = cameraState,
        properties = mapProperties,
        uiSettings = uiSettings,
    ) {
        pins.forEach { pin ->
            val pinPosition = LatLng(pin.latitude, pin.longitude)
            val markerState =
                remember(pin.id, pin.latitude, pin.longitude) {
                    MarkerState(position = pinPosition)
                }
            val isActive = pin.id == selectedPinId
            MarkerComposable(
                keys = arrayOf<Any>(pin.id, isActive),
                state = markerState,
                anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
                onClick = {
                    onPinTap(pin.id)
                    true
                },
            ) {
                MapListHybridPinDot(
                    pin = pin,
                    isActive = isActive,
                    reduceMotion = reduceMotion,
                    tag = markerTagPrefix?.let { "$it.pin_${pin.id}" } ?: "mapListHybridPin_${pin.id}",
                )
            }
        }
        clusters.forEachIndexed { index, cluster ->
            val clusterState =
                remember(cluster.id, cluster.latitude, cluster.longitude) {
                    MarkerState(position = LatLng(cluster.latitude, cluster.longitude))
                }
            MarkerComposable(
                keys = arrayOf<Any>(cluster.id, cluster.count),
                state = clusterState,
                anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
                onClick = {
                    onClusterTap(cluster.id)
                    true
                },
            ) {
                MapListHybridClusterDot(
                    count = cluster.count,
                    tag = markerTagPrefix?.let { "$it.cluster_$index" } ?: "mapListHybridCluster_$index",
                )
            }
        }
        if (anchor != null) {
            if (showSearchRadius) {
                // A11.1 — dashed search-radius ring, screen-fixed at
                // ~220 dp to match the design frame (not a geo circle).
                val ringState =
                    remember(anchor.latitude, anchor.longitude) {
                        MarkerState(position = LatLng(anchor.latitude, anchor.longitude))
                    }
                MarkerComposable(
                    keys = arrayOf<Any>("radiusRing"),
                    state = ringState,
                    anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
                ) {
                    MapListHybridRadiusRing(
                        tag = markerTagPrefix?.let { "$it.radiusRing" } ?: "mapListHybridRadiusRing",
                    )
                }
            }
            val anchorState =
                remember(anchor.latitude, anchor.longitude) {
                    MarkerState(position = LatLng(anchor.latitude, anchor.longitude))
                }
            MarkerComposable(
                keys = arrayOf<Any>("anchor"),
                state = anchorState,
                anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
            ) {
                MapListHybridAnchorDot(
                    tag = markerTagPrefix?.let { "$it.youAreHere" } ?: "mapListHybridAnchor",
                )
            }
        }
    }
}

/** A11.1 — 28dp cluster marker: primary disc, white ring + count. */
@Composable
internal fun MapListHybridClusterDot(
    count: Int,
    tag: String = "mapListHybridCluster",
) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600)
                    .border(2.dp, Color.White, CircleShape)
                    .shadow(elevation = 2.dp, shape = CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = count.toString(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
        }
    }
}

/** A11.1 — dashed search-radius ring (1.5dp dash primary@45%, 5% fill). */
@Composable
internal fun MapListHybridRadiusRing(tag: String = "mapListHybridRadiusRing") {
    val ringColor = PantopusColors.primary600
    Canvas(
        modifier =
            Modifier
                .size(220.dp)
                .testTag(tag),
    ) {
        drawCircle(color = ringColor.copy(alpha = 0.05f))
        drawCircle(
            color = ringColor.copy(alpha = 0.45f),
            style =
                Stroke(
                    width = 1.5.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 8f)),
                ),
        )
    }
}

@Composable
private fun BottomSheet(
    heightDp: Dp,
    onDrag: (Float) -> Unit,
    onDragReleased: (Float) -> Unit,
    sheetHeader: @Composable () -> Unit,
    sheetBody: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    tag: String = "mapListHybridSheet",
) {
    val draggable =
        rememberDraggableState { delta -> onDrag(delta) }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .height(heightDp)
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .background(PantopusColors.appSurface)
                .shadow(elevation = 10.dp, shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .draggable(
                    state = draggable,
                    orientation = Orientation.Vertical,
                    onDragStopped = { velocity -> onDragReleased(velocity) },
                )
                .testTag(tag),
    ) {
        MapListHybridSheetGrabber()
        Box(modifier = Modifier.testTag("mapListHybridSheetHeader")) { sheetHeader() }
        Box(modifier = Modifier.testTag("mapListHybridSheetBody")) { sheetBody() }
    }
}

/** 40 × 4 dp pill grabber at the top of the sheet. */
@Composable
fun MapListHybridSheetGrabber(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = Spacing.s2, bottom = Spacing.s1),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.appBorderStrong)
                    .semantics { contentDescription = "Drag handle" },
        )
    }
}

@Composable
internal fun MapListHybridPinDot(
    pin: MapPin,
    isActive: Boolean,
    reduceMotion: Boolean,
    tag: String = "mapListHybridPin_${pin.id}",
) {
    Box(
        modifier =
            Modifier
                .size(56.dp)
                .testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        // A11.1 — two pulsing halos behind the selected pin (scale
        // 0.6→1.6, alpha 0.6→0, 1.6 s ease-out, second layer +0.4 s).
        // Under reduce-motion the pulse collapses to a thin static ring
        // so selection remains visible without an infinite animation.
        if (isActive) {
            if (reduceMotion) {
                Box(
                    modifier =
                        Modifier
                            .size(46.dp)
                            .border(2.dp, pin.color.copy(alpha = 0.45f), CircleShape),
                )
            } else {
                MapListHybridPinPulseHalo(color = pin.color, delayMillis = 0)
                MapListHybridPinPulseHalo(color = pin.color, delayMillis = 400)
            }
        }
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(pin.color)
                    .border(
                        width = if (pin.state == MapPinState.Confirmed) 2.dp else 0.dp,
                        color = if (pin.state == MapPinState.Confirmed) Color.White else Color.Transparent,
                        shape = CircleShape,
                    )
                    .shadow(elevation = 2.dp, shape = CircleShape),
        )
        if (pin.state == MapPinState.Pending) {
            // Dashed "pending" outline 2dp outside the dot (A11.1).
            val pendingColor = pin.color
            Canvas(modifier = Modifier.size(30.dp)) {
                drawCircle(
                    color = pendingColor,
                    style =
                        Stroke(
                            width = 2.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 7f)),
                        ),
                )
            }
        }
    }
}

/** One animated pulse layer behind the active pin. */
@Composable
private fun MapListHybridPinPulseHalo(
    color: Color,
    delayMillis: Int,
) {
    val transition = rememberInfiniteTransition(label = "pinPulse")
    val progress by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 1600, easing = androidx.compose.animation.core.EaseOut),
                repeatMode = RepeatMode.Restart,
                initialStartOffset = StartOffset(delayMillis),
            ),
        label = "pinPulseProgress",
    )
    val scale = 0.6f + progress
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    alpha = (1f - progress) * 0.6f
                }
                .clip(CircleShape)
                .background(color),
    )
}

@Composable
internal fun MapListHybridAnchorDot(tag: String = "mapListHybridAnchor") {
    Box(
        modifier = Modifier.size(28.dp).testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600.copy(alpha = 0.18f)),
        )
        Box(
            modifier =
                Modifier
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600)
                    .border(3.dp, Color.White, CircleShape)
                    .semantics { contentDescription = "You are here" },
        )
    }
}

/** Reads the device's transition-animation-scale to infer reduce-motion. */
internal fun systemReduceMotion(context: Context): Boolean =
    Settings.Global.getFloat(
        context.contentResolver,
        Settings.Global.TRANSITION_ANIMATION_SCALE,
        1f,
    ) == 0f
