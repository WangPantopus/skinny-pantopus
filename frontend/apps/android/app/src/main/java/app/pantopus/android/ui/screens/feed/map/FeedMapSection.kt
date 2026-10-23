@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.feed.map

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.changedToDownIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.R
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.components.RefreshFailedLine
import app.pantopus.android.ui.components.RefreshOnStoreChange
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.explore.ExploreCluster
import app.pantopus.android.ui.screens.explore.ExploreEntity
import app.pantopus.android.ui.screens.explore.ExploreMarker
import app.pantopus.android.ui.screens.explore.ExploreYouAreHereDot
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.CameraMoveStartedReason
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.log2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sinh
import kotlin.math.tan

/**
 * Pulse feed — Map mode. The A11 "Map + list hybrid" archetype narrowed to a
 * single layer: a full-bleed, tilted (3D) Google Map of post pins (clustered
 * by the Explore clusterer), a floating "Search this area" pill that appears
 * once the person moves the camera off the fetched viewport, a recenter
 * control, and a bottom preview card for the selected pin (or the posts of a
 * tapped cluster that zooming can't split).
 *
 * The map fills the page under the Pulse header and never resizes with it:
 * [topInset] (px, read while laying out) is where the header's or the reveal
 * capsule's bottom edge is, and the pill sits below it. [onVerticalPan]
 * hears one-finger, mostly vertical drags (true: the content moved up) so the
 * header can hide and come back; null while it must stay (a screen reader).
 *
 * Pins and clusters draw each post's intent (`PulseMapPin`, `PulseMapCluster`)
 * on the Explore pins' disc vocabulary; `ExploreYouAreHereDot` is shared.
 */
@Composable
fun FeedMapSection(
    query: FeedMapQuery,
    onOpenPost: (String) -> Unit,
    modifier: Modifier = Modifier,
    topInset: () -> Int = { 0 },
    onVerticalPan: ((contentMovedUp: Boolean) -> Unit)? = null,
    viewModel: FeedMapViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()
    val region by viewModel.region.collectAsStateWithLifecycle()
    val viewportDirty by viewModel.viewportDirty.collectAsStateWithLifecycle()

    LifecycleResumeEffect(query) {
        viewModel.activate(query)
        onPauseOrDispose { viewModel.suspendContent() }
    }
    RefreshOnStoreChange { viewModel.activate(query) }

    val cameraState =
        rememberCameraPositionState {
            position =
                CameraPosition.fromLatLngZoom(
                    LatLng(region.latitude, region.longitude),
                    zoomForDelta(region.latitudeDelta),
                )
        }

    val scope = rememberCoroutineScope()

    // The map's size in pixels.
    var mapSize by remember { mutableStateOf(IntSize.Zero) }
    // Google Maps has drawn its first tiles: a camera animation started before then ends at once, where it began.
    var mapLoaded by remember { mutableStateOf(false) }
    FeedMapCameraEffect(
        cameraState = cameraState,
        region = region,
        mapSize = mapSize,
        viewportDirty = viewportDirty,
        isMapLoaded = { mapLoaded },
        onSettle = viewModel::cameraDidSettle,
    )
    val panSignal by rememberUpdatedState(onVerticalPan)

    Box(modifier = modifier.fillMaxSize().onSizeChanged { mapSize = it }.testTag("pulseFeedMap")) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .then(
                        if (onVerticalPan != null) {
                            Modifier.pointerInput(Unit) { detectVerticalPans { up -> panSignal?.invoke(up) } }
                        } else {
                            Modifier
                        },
                    ),
        ) {
            val loaded = state as? FeedMapUiState.Loaded
            FeedMapLayer(
                markers = loaded?.markers.orEmpty(),
                selectedId = loaded?.selectedId,
                userCoordinate = loaded?.userCoordinate,
                pinStyles = loaded?.pinStyles.orEmpty(),
                clusterStyles = loaded?.clusterStyles.orEmpty(),
                cameraState = cameraState,
                onMapLoaded = { mapLoaded = true },
                onPinTap = viewModel::selectEntity,
                onClusterTap = { cluster ->
                    // Search would leave it one cluster when its posts share a point
                    // or the camera is already as close as the tap zooms: list them.
                    if (zoomCanSplit(cluster) && clusterZoom(cluster) > cameraState.position.zoom + 0.1f) {
                        scope.launch { zoomToCluster(cameraState, cluster) }
                    } else {
                        viewModel.showClusterPosts(cluster)
                    }
                },
            )
        }
        if (viewportDirty) {
            SearchThisAreaPill(
                onClick = viewModel::searchThisArea,
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .offset { IntOffset(0, topInset()) }
                        .padding(top = Spacing.s3),
            )
        }
        RecenterButton(
            onClick = {
                viewModel.recenter()
                // The compass stays off (the header would cover its corner): Recenter also turns the map back to
                // north-up at the opening tilt.
                scope.launch { levelCamera(cameraState) }
            },
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 14.dp, bottom = 96.dp),
        )
        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        ) {
            refreshNotice?.let { RefreshFailedLine(it) }
            when (val current = state) {
                FeedMapUiState.Loading -> LoadingCard()
                is FeedMapUiState.Error -> ErrorCard(current.message, viewModel::refresh)
                is FeedMapUiState.Loaded -> {
                    val selected = current.entities.firstOrNull { it.id == current.selectedId }
                    val clusterPosts = current.clusterPosts
                    when {
                        selected != null -> PreviewCard(selected) { onOpenPost(selected.id) }
                        clusterPosts.isNotEmpty() ->
                            ClusterPostsCard(
                                posts = clusterPosts,
                                onOpenPost = onOpenPost,
                                onClose = { viewModel.selectEntity(null) },
                            )
                        current.isEmpty ->
                            EmptyCard(
                                hasHint = current.nearestActivityCenter != null,
                                onJump = viewModel::jumpToNearestActivity,
                            )
                        else -> Unit
                    }
                }
            }
        }
    }
}

/**
 * Keeps the camera and the view-model's region in step. Region → camera
 * frames the region to the map's shape (one side exact, the other wider), as
 * MapKit does on iOS, then tilts it to [MAP_TILT] facing north: the zoom is
 * worked out here because `newLatLngBounds` would flatten the camera. The
 * first framing of a real area flies in from higher and flatter (not with
 * Reduce motion, and not again on coming back to the map). Camera → region
 * reports each settle once the camera has framed the region: the camera's
 * target and zoom as a flat region (what "moved?" compares, so the opening,
 * the fly-in, Recenter and a tilted framing aren't moves) and the bounds of
 * what the tilted screen shows (what a search fetches).
 */
@Composable
private fun FeedMapCameraEffect(
    cameraState: CameraPositionState,
    region: FeedMapRegion,
    mapSize: IntSize,
    viewportDirty: Boolean,
    isMapLoaded: () -> Boolean,
    onSettle: (FeedMapViewport) -> Unit,
) {
    val density = LocalDensity.current.density
    val flyIn = !rememberReduceMotion()
    // The map size the camera last framed the region at.
    var framedSize by remember { mutableStateOf(IntSize.Zero) }
    var flewIn by rememberSaveable { mutableStateOf(false) }

    // Guarded so the debounced region commit that follows a user pan doesn't
    // bounce the camera back onto itself; a new map size reframes only while
    // nobody has moved the map.
    LaunchedEffect(region, mapSize) {
        if (mapSize.width == 0 || mapSize.height == 0) return@LaunchedEffect
        val current = cameraState.position.target
        val drifted =
            abs(current.latitude - region.latitude) > region.latitudeDelta * 0.05 ||
                abs(current.longitude - region.longitude) > region.longitudeDelta * 0.05
        // The seed zoom only approximates the region, so always frame once.
        val unframed = framedSize == IntSize.Zero
        val resizedUnmoved = mapSize != framedSize && !viewportDirty && !cameraState.isMoving
        if (drifted || unframed || resizedUnmoved) {
            val framed = framedCamera(region, mapSize.width / density, mapSize.height / density)
            framedSize = mapSize
            // Set, not moved: before the map has loaded, a move waits (and the next one replaces it) while the
            // position is what the map opens on, so the fly-in always starts over the area it lands on.
            // The view-model starts on a placeholder area until it knows the person's; fly in to theirs.
            if (flyIn && !flewIn && region != FeedMapRegion.Fallback) {
                flewIn = true
                flyIn(cameraState, framed, isMapLoaded)
            } else {
                cameraState.position = framed
            }
        }
    }

    // Only fires once the gesture (or the fly-in) settles.
    LaunchedEffect(cameraState.isMoving) {
        if (cameraState.isMoving || framedSize == IntSize.Zero) return@LaunchedEffect
        val bounds = cameraState.projection?.visibleRegion?.latLngBounds ?: return@LaunchedEffect
        val position = cameraState.position
        val northeast = bounds.northeast
        val southwest = bounds.southwest
        onSettle(
            FeedMapViewport(
                camera = flatRegion(position.target, position.zoom, mapSize.width / density, mapSize.height / density),
                visible =
                    FeedMapRegion(
                        latitude = (northeast.latitude + southwest.latitude) / 2,
                        longitude = (northeast.longitude + southwest.longitude) / 2,
                        latitudeDelta = northeast.latitude - southwest.latitude,
                        longitudeDelta = northeast.longitude - southwest.longitude,
                    ),
            ),
        )
    }
}

/**
 * The opening fly-in: from higher and flat to [framed], tilted. It waits for the map to draw (an animation started
 * before ends at once, where it began), and lands on [framed] whenever it is cut short, unless the person took the
 * map.
 */
private suspend fun flyIn(
    cameraState: CameraPositionState,
    framed: CameraPosition,
    isMapLoaded: () -> Boolean,
) {
    cameraState.position = CameraPosition(framed.target, (framed.zoom - FLY_IN_ZOOM_OUT).coerceAtLeast(MIN_ZOOM), 0f, 0f)
    val takenByPerson = { cameraState.cameraMoveStartedReason == CameraMoveStartedReason.GESTURE }
    try {
        snapshotFlow { isMapLoaded() }.first { it }
        cameraState.animate(CameraUpdateFactory.newCameraPosition(framed), FLY_IN_MS)
    } catch (interrupted: CancellationException) {
        // A new map size or region restarted the effect mid-flight, which stops the animation where it was.
        if (!takenByPerson()) cameraState.position = framed
        throw interrupted
    }
    val landed = cameraState.position
    if (!takenByPerson() && (abs(landed.zoom - framed.zoom) > 0.2f || abs(landed.tilt - framed.tilt) > 2f)) {
        cameraState.position = framed
    }
}

/**
 * Zooms in on a tapped cluster, keeping the camera's tilt and heading.
 * Animated, so [FeedMapCameraEffect] reports the settle and "Search this
 * area" appears: an instant move starts and settles within one frame, too
 * fast for the effect to see.
 */
private suspend fun zoomToCluster(
    cameraState: CameraPositionState,
    cluster: ExploreCluster,
) {
    val position = cameraState.position
    cameraState.animate(
        CameraUpdateFactory.newCameraPosition(
            CameraPosition(
                LatLng((cluster.minLatitude + cluster.maxLatitude) / 2, (cluster.minLongitude + cluster.maxLongitude) / 2),
                clusterZoom(cluster),
                position.tilt,
                position.bearing,
            ),
        ),
    )
}

/** Turns the map back to north-up at the opening tilt, where it is (a no-op when it already is). */
private suspend fun levelCamera(cameraState: CameraPositionState) {
    val position = cameraState.position
    if (position.bearing == 0f && position.tilt == MAP_TILT) return
    cameraState.animate(
        CameraUpdateFactory.newCameraPosition(CameraPosition(position.target, position.zoom, MAP_TILT, 0f)),
    )
}

/**
 * Hears one-finger drags on the map without consuming them, so the map still
 * pans: once a drag has gone mostly vertically [HIDE_DRAG] with the content
 * moving up it reports `true`, or [SHOW_DRAG] with the content moving down
 * `false` (asymmetric, so panning around doesn't keep bringing the header
 * back), at most once a drag. A second finger (pinch, turn, tilt) ends the
 * watch for that gesture, and the camera's own moves never come through here.
 */
private suspend fun PointerInputScope.detectVerticalPans(onPan: (contentMovedUp: Boolean) -> Unit) {
    val hideDistance = HIDE_DRAG.toPx()
    val showDistance = SHOW_DRAG.toPx()
    awaitPointerEventScope {
        while (true) {
            val first = awaitPointerEvent(PointerEventPass.Initial)
            if (first.changes.none { it.changedToDownIgnoreConsumed() }) continue
            var watching = first.changes.count { it.pressed } == 1
            var dx = 0f
            var dy = 0f
            do {
                val event = awaitPointerEvent(PointerEventPass.Initial)
                val pressed = event.changes.filter { it.pressed }
                if (pressed.size > 1) watching = false
                if (watching && pressed.size == 1) {
                    val change = pressed.first()
                    dx += change.position.x - change.previousPosition.x
                    dy += change.position.y - change.previousPosition.y
                    if (abs(dy) > abs(dx) && (dy <= -hideDistance || dy >= showDistance)) {
                        onPan(dy < 0f)
                        watching = false
                    }
                }
            } while (pressed.isNotEmpty())
        }
    }
}

/** The zoom a cluster tap moves to: the cluster with a margin, at least 0.004° across. */
private fun clusterZoom(cluster: ExploreCluster): Float {
    val span = max(cluster.maxLatitude - cluster.minLatitude, cluster.maxLongitude - cluster.minLongitude)
    return zoomForDelta(span.coerceAtLeast(0.004) * 1.4)
}

/**
 * Whether zooming in can split [cluster]: its posts fall in more than one
 * bucket at the smallest cluster radius. Approximate-area posts from one
 * 0.005° cell share a displayed point (`backend/utils/locationPrivacy.js`),
 * so a cluster of only those never splits.
 */
private fun zoomCanSplit(cluster: ExploreCluster): Boolean {
    fun bucket(degrees: Double) = floor(degrees / FeedMapViewModel.MIN_CLUSTER_RADIUS)
    return bucket(cluster.minLatitude) != bucket(cluster.maxLatitude) ||
        bucket(cluster.minLongitude) != bucket(cluster.maxLongitude)
}

@Composable
private fun FeedMapLayer(
    markers: List<ExploreMarker>,
    selectedId: String?,
    userCoordinate: UserCoordinate?,
    pinStyles: Map<String, PulsePinStyle>,
    clusterStyles: Map<String, PulseClusterStyle>,
    cameraState: CameraPositionState,
    onMapLoaded: () -> Unit,
    onPinTap: (String) -> Unit,
    onClusterTap: (ExploreCluster) -> Unit,
) {
    val context = LocalContext.current
    // 3D: buildings rise from about zoom 17, and two fingers tilt or turn the map. The compass stays off: it would
    // sit under the Pulse header, and moving it means padding the map, which moves its camera framing too.
    val mapProperties =
        remember(context) {
            MapProperties(
                isBuildingEnabled = true,
                isMyLocationEnabled = false,
                mapStyleOptions = MapStyleOptions.loadRawResourceStyle(context, R.raw.nearby_map_style),
            )
        }
    val uiSettings =
        remember {
            MapUiSettings(
                compassEnabled = false,
                mapToolbarEnabled = false,
                myLocationButtonEnabled = false,
                rotationGesturesEnabled = true,
                tiltGesturesEnabled = true,
                zoomControlsEnabled = false,
            )
        }
    GoogleMap(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("pulseGoogleMap")
                .semantics { contentDescription = "Pulse map" },
        cameraPositionState = cameraState,
        properties = mapProperties,
        uiSettings = uiSettings,
        onMapLoaded = onMapLoaded,
    ) {
        markers.forEach { marker ->
            when (marker) {
                is ExploreMarker.Cluster -> {
                    val cluster = marker.cluster
                    val style = clusterStyles[cluster.id] ?: PulseClusterStyle(mix = emptyList(), isLive = false)
                    val markerState =
                        remember(cluster.id, cluster.latitude, cluster.longitude) {
                            MarkerState(position = LatLng(cluster.latitude, cluster.longitude))
                        }
                    // The keys carry everything the bubble draws, so its bitmap redraws when any of it changes.
                    MarkerComposable(
                        keys = arrayOf<Any>(cluster.id, cluster.count, style),
                        state = markerState,
                        contentDescription = "Cluster of ${cluster.count} posts",
                        anchor = Offset(0.5f, 0.5f),
                        onClick = { _ ->
                            onClusterTap(cluster)
                            true
                        },
                    ) {
                        PulseMapCluster(count = cluster.count, style = style)
                    }
                }
                is ExploreMarker.Entity -> {
                    val entity = marker.entity
                    val active = entity.id == selectedId
                    val style = pinStyles[entity.id] ?: PulsePinStyle(PulseIntent.Generic, isLive = false)
                    val markerState =
                        remember(entity.id, entity.latitude, entity.longitude) {
                            MarkerState(position = LatLng(entity.latitude, entity.longitude))
                        }
                    MarkerComposable(
                        keys = arrayOf<Any>(entity.id, active, style),
                        state = markerState,
                        contentDescription = "${style.intent.label}: ${entity.title}",
                        anchor = Offset(0.5f, 0.5f),
                        zIndex = if (active) 1f else 0f,
                        onClick = { _ ->
                            onPinTap(entity.id)
                            true
                        },
                    ) {
                        PulseMapPin(style = style, isActive = active)
                    }
                }
            }
        }
        if (userCoordinate != null) {
            val userMarkerState =
                remember(userCoordinate.latitude, userCoordinate.longitude) {
                    MarkerState(position = LatLng(userCoordinate.latitude, userCoordinate.longitude))
                }
            MarkerComposable(
                keys = arrayOf<Any>("user"),
                state = userMarkerState,
                anchor = Offset(0.5f, 0.5f),
            ) {
                ExploreYouAreHereDot()
            }
        }
    }
}

@Composable
private fun SearchThisAreaPill(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 10.dp)
                .testTag("pulseMapSearchThisArea"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            "Search this area",
            style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun RecenterButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, CircleShape)
                .clickable(onClick = onClick)
                .testTag("pulseMapRecenter")
                .semantics { contentDescription = "Recenter map" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MapPin,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appText,
        )
    }
}

@Composable
private fun CardSurface(
    tag: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag(tag),
    ) {
        content()
    }
}

@Composable
private fun LoadingCard() {
    CardSurface(tag = "pulseMapLoading") {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(width = 44.dp, height = 44.dp, cornerRadius = Radii.md)
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Shimmer(width = 180.dp, height = 12.dp, cornerRadius = Radii.xs)
                Shimmer(width = 120.dp, height = 10.dp, cornerRadius = Radii.xs)
            }
        }
    }
}

@Composable
private fun ErrorCard(
    message: String,
    onRetry: () -> Unit,
) {
    CardSurface(tag = "pulseMapError") {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.error,
            )
            Text(
                "Couldn't load the map",
                style = PantopusTextStyle.caption.copy(fontSize = 14.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
            )
            Text(
                message,
                style = PantopusTextStyle.caption.copy(fontSize = 12.sp),
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onRetry)
                        .padding(horizontal = 20.dp, vertical = 10.dp)
                        .testTag("pulseMapRetry"),
            ) {
                Text(
                    "Try again",
                    style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun EmptyCard(
    hasHint: Boolean,
    onJump: () -> Unit,
) {
    CardSurface(tag = "pulseMapEmpty") {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MapPinOff,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                "No posts in this area",
                style = PantopusTextStyle.caption.copy(fontSize = 14.sp, fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
            )
            Text(
                if (hasHint) {
                    "Nothing has been posted inside this viewport yet. Jump to the nearest " +
                        "active neighborhood, or drag the map and search again."
                } else {
                    "Nothing has been posted inside this viewport yet. Drag the map and search again."
                },
                style = PantopusTextStyle.caption.copy(fontSize = 12.sp),
                color = PantopusColors.appTextSecondary,
                textAlign = TextAlign.Center,
            )
            if (hasHint) {
                Box(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.primary600)
                            .clickable(onClick = onJump)
                            .padding(horizontal = 20.dp, vertical = 10.dp)
                            .testTag("pulseMapNearestActivity"),
                ) {
                    Text(
                        "Show nearest activity",
                        style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

@Composable
private fun PreviewCard(
    entity: ExploreEntity,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(2.dp, entity.kind.color, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("pulseMapPreviewCard"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PostSummary(entity)
    }
}

/**
 * The posts of a tapped cluster that zooming can't split, in the preview
 * card's slot. Each row opens its post, as the preview card does.
 */
@Composable
private fun ClusterPostsCard(
    posts: List<ExploreEntity>,
    onOpenPost: (String) -> Unit,
    onClose: () -> Unit,
) {
    CardSurface(tag = "pulseMapClusterCard") {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (posts.size == 1) "1 post in this area" else "${posts.size} posts in this area",
                    modifier = Modifier.weight(1f).semantics { heading() },
                    style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                    color = PantopusColors.appText,
                )
                // Shifted into the card's padding so the X lines up with the rows' chevrons.
                Box(
                    modifier =
                        Modifier
                            .offset(x = Spacing.s3)
                            .size(40.dp)
                            .clip(CircleShape)
                            .clickable(onClick = onClose)
                            .testTag("pulseMapClusterCardClose")
                            .semantics { contentDescription = "Close" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
            // About three and a half rows, so a longer list shows that it scrolls.
            Column(modifier = Modifier.heightIn(max = 212.dp).verticalScroll(rememberScrollState())) {
                posts.forEachIndexed { index, post ->
                    if (index > 0) HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clickable { onOpenPost(post.id) }
                                .padding(vertical = Spacing.s2)
                                .testTag("pulseMapClusterRow_${post.id}"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        PostSummary(post)
                    }
                }
            }
        }
    }
}

/** A post's tile, title, meta line and chevron, as the preview card and the cluster list show them. */
@Composable
private fun RowScope.PostSummary(entity: ExploreEntity) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(entity.kind.color),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = entity.kind.glyph,
            contentDescription = null,
            size = 20.dp,
            tint = PantopusColors.appTextInverse,
        )
    }
    Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            entity.title,
            style = PantopusTextStyle.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            "${entity.metaLead} · ${entity.distanceLabel}",
            style = PantopusTextStyle.caption.copy(fontSize = 11.sp),
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
    PantopusIconImage(
        icon = PantopusIcon.ChevronRight,
        contentDescription = null,
        size = 16.dp,
        tint = PantopusColors.appTextMuted,
    )
}

/** Google Maps zoom level that frames a latitude span of [delta] degrees. */
private fun zoomForDelta(delta: Double): Float {
    val safe = delta.coerceAtLeast(0.0005)
    return (ln(360.0 / safe) / ln(2.0)).toFloat().coerceIn(3f, 18f)
}

/** The tilt every framing opens at: the 3D look. */
private const val MAP_TILT = 45f

/** The fly-in starts this many zoom levels out, flat, and takes [FLY_IN_MS] to reach the framed camera. */
private const val FLY_IN_ZOOM_OUT = 1.5f
private const val FLY_IN_MS = 1_200

private const val MIN_ZOOM = 3f
private const val MAX_ZOOM = 20f

/** Google Maps draws the whole world this many dp wide at zoom 0 (untilted). */
private const val WORLD_DP = 256.0

/** One-finger drag distances that hide the header (content up) and bring it back (content down). */
private val HIDE_DRAG = 16.dp
private val SHOW_DRAG = 48.dp

/**
 * The camera that frames [region] on a [widthDp] × [heightDp] map as `newLatLngBounds` would (centred, the tighter
 * side exact, the other wider), tilted to [MAP_TILT] facing north. Built directly because `newLatLngBounds` flattens
 * the camera.
 */
private fun framedCamera(
    region: FeedMapRegion,
    widthDp: Float,
    heightDp: Float,
): CameraPosition {
    val lonZoom = log2(widthDp * 360.0 / (WORLD_DP * region.longitudeDelta.coerceAtLeast(MIN_SPAN)))
    val mercatorSpan = (mercatorY(region.north) - mercatorY(region.south)).coerceAtLeast(MIN_SPAN)
    val latZoom = log2(heightDp * 2 * PI / (WORLD_DP * mercatorSpan))
    val zoom = min(lonZoom, latZoom).toFloat().coerceIn(MIN_ZOOM, MAX_ZOOM)
    return CameraPosition(LatLng(region.latitude, region.longitude), zoom, MAP_TILT, 0f)
}

/**
 * The north-up, untilted region a camera at [target] and [zoom] frames on a [widthDp] × [heightDp] map: the inverse
 * of [framedCamera], so a camera framed there reads back as the same region (one side exact, the other wider), however
 * it is tilted or turned.
 */
private fun flatRegion(
    target: LatLng,
    zoom: Float,
    widthDp: Float,
    heightDp: Float,
): FeedMapRegion {
    val worldDp = WORLD_DP * 2.0.pow(zoom.toDouble())
    val halfMercatorHeight = heightDp * PI / worldDp
    val centre = mercatorY(target.latitude)
    val north = latitudeAt(centre + halfMercatorHeight)
    val south = latitudeAt(centre - halfMercatorHeight)
    return FeedMapRegion(
        latitude = target.latitude,
        longitude = target.longitude,
        latitudeDelta = north - south,
        longitudeDelta = widthDp * 360.0 / worldDp,
    )
}

private const val MIN_SPAN = 1e-6

/** Web Mercator's y for [latitude] (radians of projected height; ±π at the map's edges). */
private fun mercatorY(latitude: Double): Double = ln(tan(PI / 4 + Math.toRadians(latitude.coerceIn(-85.0, 85.0)) / 2))

/** The latitude at Web Mercator's [y]: the inverse of [mercatorY]. */
private fun latitudeAt(y: Double): Double = Math.toDegrees(atan(sinh(y)))
