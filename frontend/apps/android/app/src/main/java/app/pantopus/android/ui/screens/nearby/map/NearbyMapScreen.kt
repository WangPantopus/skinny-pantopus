@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "CyclomaticComplexMethod")
@file:OptIn(com.google.maps.android.compose.MapsComposeExperimentalApi::class)

package app.pantopus.android.ui.screens.nearby.map

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.R
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * T2.4 Map+List Hybrid. Single-canvas Google Maps view with a custom
 * 3-stop bottom sheet (collapsed / standard / expanded), category-
 * colored pins, floating top pill, dot-legend category chips, right-
 * edge map controls anchored above the sheet edge, and a pin↔card
 * selection link.
 */
@Composable
fun NearbyMapScreen(
    onOpenEntity: (MapEntity) -> Unit = {},
    onBack: (() -> Unit)? = null,
    initialCategory: app.pantopus.android.ui.screens.gigs.GigsCategory? = null,
    listTestTag: String? = null,
    viewModel: NearbyMapViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeCategory by viewModel.activeCategory.collectAsStateWithLifecycle()
    val activeSort by viewModel.activeSort.collectAsStateWithLifecycle()
    val sheetStop by viewModel.sheetStop.collectAsStateWithLifecycle()
    val userCoord by viewModel.userCoordinate.collectAsStateWithLifecycle()
    val filters by viewModel.filters.collectAsStateWithLifecycle()
    var showFilters by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        // Seed the chip first so the initial fetch already filters
        // by the caller's preferred category (selectCategory will
        // refetch internally; if it's already the active value the
        // call is a no-op and load() drives the initial fetch).
        if (initialCategory != null && viewModel.activeCategory.value != initialCategory) {
            viewModel.selectCategory(initialCategory)
        } else {
            viewModel.load()
        }
    }

    val cameraState =
        rememberCameraPositionState {
            position =
                CameraPosition.fromLatLngZoom(
                    LatLng(userCoord?.latitude ?: 40.7484, userCoord?.longitude ?: -73.9857),
                    15f,
                )
        }
    LaunchedEffect(userCoord) {
        userCoord?.let { coord ->
            cameraState.position = CameraPosition.fromLatLngZoom(LatLng(coord.latitude, coord.longitude), 15f)
        }
    }

    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val screenHeightPx = with(density) { configuration.screenHeightDp.dp.toPx() }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("nearbyMap"),
    ) {
        MapLayer(
            cameraState = cameraState,
            markers = (state as? NearbyMapUiState.Loaded)?.markers.orEmpty(),
            selectedId = (state as? NearbyMapUiState.Loaded)?.selectedId,
            userCoordinate = userCoord,
            onPinTap = { entity ->
                viewModel.selectEntity(entity.id)
                onOpenEntity(entity)
            },
            onClusterTap = { cluster ->
                zoomToCluster(cameraState, cluster)
                viewModel.setClusterRadius(
                    maxOf(
                        cluster.maxLatitude - cluster.minLatitude,
                        cluster.maxLongitude - cluster.minLongitude,
                    ).coerceAtLeast(0.001) * 0.35,
                )
            },
        )
        FloatingTopPill(
            onBack = onBack,
            onOpenFilters = { showFilters = true },
            modifier =
                Modifier
                    .padding(WindowInsets.statusBars.asPaddingValues())
                    .padding(top = Spacing.s2, start = 14.dp, end = 14.dp)
                    .align(Alignment.TopCenter)
                    .fillMaxWidth(),
        )
        CategoryDotChips(
            active = activeCategory,
            onSelect = viewModel::selectCategory,
            modifier =
                Modifier
                    .padding(WindowInsets.statusBars.asPaddingValues())
                    .padding(top = 56.dp)
                    .align(Alignment.TopCenter)
                    .fillMaxWidth(),
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .then(if (listTestTag != null) Modifier.testTag(listTestTag) else Modifier),
        ) {
            BottomSheet(
                state = state,
                activeSort = activeSort,
                sheetStop = sheetStop,
                screenHeightPx = screenHeightPx,
                onSelectSort = viewModel::selectSort,
                onSelectStop = viewModel::setSheetStop,
                onTapEntity = { entity ->
                    viewModel.selectEntity(entity.id)
                    onOpenEntity(entity)
                },
                onRefresh = viewModel::refresh,
            )
        }
        MapControls(
            sheetStop = sheetStop,
            screenHeightPx = screenHeightPx,
            onLocate = {
                userCoord?.let { coord ->
                    cameraState.position = CameraPosition.fromLatLngZoom(LatLng(coord.latitude, coord.longitude), 15f)
                }
            },
            onLayers = { showFilters = true },
            modifier = Modifier.align(Alignment.BottomEnd),
        )
        if (showFilters) {
            MapFilterSheet(
                criteria = filters,
                onApply = viewModel::applyFilters,
                onDismiss = { showFilters = false },
            )
        }
    }
}

// MARK: - Map layer

@Composable
private fun MapLayer(
    cameraState: CameraPositionState,
    markers: List<MapMarker>,
    selectedId: String?,
    userCoordinate: UserCoordinate?,
    onPinTap: (MapEntity) -> Unit,
    onClusterTap: (MapCluster) -> Unit,
) {
    val context = LocalContext.current
    val mapProperties =
        remember(context) {
            MapProperties(
                isMyLocationEnabled = false,
                mapStyleOptions = MapStyleOptions.loadRawResourceStyle(context, R.raw.nearby_map_style),
            )
        }
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
        modifier = Modifier.fillMaxSize().testTag("nearbyGoogleMap"),
        cameraPositionState = cameraState,
        properties = mapProperties,
        uiSettings = uiSettings,
    ) {
        markers.forEach { marker ->
            when (marker) {
                is MapMarker.Cluster -> {
                    val cluster = marker.cluster
                    val clusterPosition = LatLng(cluster.latitude, cluster.longitude)
                    val clusterMarkerState =
                        remember(cluster.id, cluster.latitude, cluster.longitude) {
                            MarkerState(position = clusterPosition)
                        }
                    MarkerComposable(
                        keys = arrayOf<Any>(cluster.id, cluster.count),
                        state = clusterMarkerState,
                        anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
                        onClick = { _ ->
                            onClusterTap(cluster)
                            true
                        },
                    ) {
                        MapClusterDot(cluster = cluster)
                    }
                }
                is MapMarker.Entity -> {
                    val entity = marker.entity
                    val active = entity.id == selectedId
                    val entityPosition = LatLng(entity.latitude, entity.longitude)
                    val entityMarkerState =
                        remember(entity.id, entity.latitude, entity.longitude) {
                            MarkerState(position = entityPosition)
                        }
                    MarkerComposable(
                        keys = arrayOf<Any>(entity.id, active),
                        state = entityMarkerState,
                        anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
                        onClick = { _ ->
                            onPinTap(entity)
                            true
                        },
                    ) {
                        MapPinDot(entity = entity, isActive = active)
                    }
                }
            }
        }
        if (userCoordinate != null) {
            val userPosition = LatLng(userCoordinate.latitude, userCoordinate.longitude)
            val userMarkerState =
                remember(userCoordinate.latitude, userCoordinate.longitude) {
                    MarkerState(position = userPosition)
                }
            MarkerComposable(
                keys = arrayOf<Any>("user"),
                state = userMarkerState,
                anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
            ) {
                YouAreHereDot()
            }
        }
    }
}

@Composable
internal fun MapPinDot(
    entity: MapEntity,
    isActive: Boolean,
) {
    Box(
        modifier = Modifier.size(50.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (isActive) {
            Box(
                modifier =
                    Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(entity.category.color.copy(alpha = 0.25f)),
            )
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(entity.category.color.copy(alpha = 0.35f)),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(entity.category.color)
                    .border(
                        width = if (entity.state == MapEntityState.Confirmed) 2.dp else 0.dp,
                        color = if (entity.state == MapEntityState.Confirmed) Color.White else Color.Transparent,
                        shape = CircleShape,
                    )
                    .shadow(elevation = 2.dp, shape = CircleShape),
        )
        if (entity.state == MapEntityState.Pending) {
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .border(2.dp, entity.category.color, CircleShape),
            )
        }
    }
}

@Composable
internal fun MapClusterDot(cluster: MapCluster) {
    Box(
        modifier = Modifier.size(44.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(cluster.category.color.copy(alpha = 0.20f)),
        )
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(cluster.category.color)
                    .border(2.dp, Color.White, CircleShape)
                    .shadow(elevation = 2.dp, shape = CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "${cluster.count}",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
        }
    }
}

@Composable
internal fun YouAreHereDot() {
    Box(
        modifier = Modifier.size(28.dp),
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

// MARK: - Floating chrome

@Composable
private fun FloatingTopPill(
    onBack: (() -> Unit)?,
    onOpenFilters: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(Color.White.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .shadow(elevation = 8.dp, shape = RoundedCornerShape(Radii.pill))
                .padding(start = 6.dp, end = Spacing.s2, top = Spacing.s2, bottom = Spacing.s2)
                .testTag("nearbyFloatingPill"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 18.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appText,
                )
            }
        } else {
            Spacer(modifier = Modifier.width(Spacing.s8))
        }
        Text(
            text = "Gigs",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onOpenFilters),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.SlidersHorizontal,
                contentDescription = "Filters",
                size = Radii.xl,
                strokeWidth = 2.2f,
                tint = PantopusColors.appText,
            )
        }
    }
}

@Composable
private fun CategoryDotChips(
    active: GigsCategory,
    onSelect: (GigsCategory) -> Unit,
    modifier: Modifier = Modifier,
) {
    val scrollState = rememberScrollState()
    Row(
        modifier =
            modifier
                .horizontalScroll(scrollState)
                .padding(horizontal = 14.dp)
                .testTag("nearbyCategoryChips"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GigsCategory.entries.forEach { category ->
            val selected = category == active
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (selected) category.color else Color.White.copy(alpha = 0.96f))
                        .border(
                            width = if (selected) 0.dp else 1.dp,
                            color = if (selected) Color.Transparent else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.pill),
                        )
                        .shadow(elevation = 4.dp, shape = RoundedCornerShape(Radii.pill))
                        .clickable { onSelect(category) }
                        .padding(horizontal = Spacing.s3)
                        .heightIn(min = 28.dp)
                        .testTag("nearbyCategoryChip_${category.key}"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                if (category != GigsCategory.All) {
                    Box(
                        modifier =
                            Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (selected) Color.White else category.color),
                    )
                }
                Text(
                    text = category.label,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun MapControls(
    sheetStop: SheetStop,
    screenHeightPx: Float,
    onLocate: () -> Unit,
    onLayers: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    val bottomOffset = with(density) { (screenHeightPx * sheetStop.heightFraction).toDp() + 14.dp }
    val animatedBottom by animateDpAsState(targetValue = bottomOffset, label = "mapControlsBottom")
    Column(
        modifier =
            modifier
                .padding(end = 14.dp, bottom = animatedBottom)
                .testTag("nearbyMapControls"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        MapControlButton(icon = PantopusIcon.MapPin, label = "Locate me", onClick = onLocate)
        MapControlButton(icon = PantopusIcon.Map, label = "Layers", onClick = onLayers)
    }
}

@Composable
private fun MapControlButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, CircleShape)
                .shadow(elevation = 4.dp, shape = CircleShape)
                .clickable(onClick = onClick)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = Radii.xl, tint = PantopusColors.appText)
    }
}

// MARK: - Bottom sheet

@Composable
private fun BottomSheet(
    state: NearbyMapUiState,
    activeSort: NearbySort,
    sheetStop: SheetStop,
    screenHeightPx: Float,
    onSelectSort: (NearbySort) -> Unit,
    onSelectStop: (SheetStop) -> Unit,
    onTapEntity: (MapEntity) -> Unit,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    var dragDelta by remember { mutableStateOf(0f) }
    val baseHeightPx = screenHeightPx * sheetStop.heightFraction
    val targetHeightPx = (baseHeightPx - dragDelta).coerceIn(120f * density.density, screenHeightPx * 0.85f)
    val targetHeightDp = with(density) { targetHeightPx.toDp() }
    val animatedHeight by animateDpAsState(targetValue = targetHeightDp, animationSpec = tween(durationMillis = 240), label = "sheetHeight")

    val draggable =
        rememberDraggableState { delta ->
            dragDelta += delta
        }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .height(animatedHeight)
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .background(PantopusColors.appSurface)
                .shadow(elevation = 10.dp, shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .draggable(
                    state = draggable,
                    orientation = Orientation.Vertical,
                    onDragStopped = { velocity ->
                        val target = resolveStop(currentStop = sheetStop, dragDelta = dragDelta, velocity = velocity)
                        onSelectStop(target)
                        dragDelta = 0f
                    },
                )
                .testTag("nearbySheet"),
    ) {
        DragHandle()
        SheetHeader(
            countLabel = headerCountLabel(state),
            activeSort = activeSort,
            onSelectSort = onSelectSort,
        )
        when (state) {
            is NearbyMapUiState.Loading -> SheetLoading()
            is NearbyMapUiState.Error -> SheetError(state.message, onRetry = onRefresh)
            is NearbyMapUiState.Loaded ->
                when (sheetStop) {
                    SheetStop.Collapsed -> CollapsedBody(onExpand = { onSelectStop(SheetStop.Standard) })
                    SheetStop.Standard -> StandardBody(entities = state.entities, selectedId = state.selectedId, onTap = onTapEntity)
                    SheetStop.Expanded -> ExpandedBody(entities = state.entities, selectedId = state.selectedId, onTap = onTapEntity)
                }
        }
    }
}

/**
 * Cluster tap — recenter the camera on the cluster's bounding box
 * (+40 % margin) so the underlying pins re-split as the user zooms in.
 * Companion in the VM shrinks the cluster radius accordingly.
 */
private fun zoomToCluster(
    cameraState: CameraPositionState,
    cluster: MapCluster,
) {
    val latDelta = (cluster.maxLatitude - cluster.minLatitude).coerceAtLeast(0.003) * 1.4
    val lonDelta = (cluster.maxLongitude - cluster.minLongitude).coerceAtLeast(0.003) * 1.4
    val degreesAcross = maxOf(latDelta, lonDelta)
    // Convert the largest delta into a Google Maps zoom level. The
    // formula `log2(360 / degrees)` is the well-known approximation
    // for the standard 256-pixel-tile projection.
    val zoom = (kotlin.math.ln(360.0 / degreesAcross) / kotlin.math.ln(2.0)).toFloat().coerceIn(2f, 19f)
    cameraState.position =
        CameraPosition.fromLatLngZoom(
            LatLng(
                (cluster.minLatitude + cluster.maxLatitude) / 2,
                (cluster.minLongitude + cluster.maxLongitude) / 2,
            ),
            zoom,
        )
}

private fun resolveStop(
    currentStop: SheetStop,
    dragDelta: Float,
    velocity: Float,
): SheetStop {
    val velocityThreshold = 1_200f
    if (velocity < -velocityThreshold) {
        return when (currentStop) {
            SheetStop.Collapsed -> SheetStop.Standard
            SheetStop.Standard -> SheetStop.Expanded
            SheetStop.Expanded -> SheetStop.Expanded
        }
    }
    if (velocity > velocityThreshold) {
        return when (currentStop) {
            SheetStop.Expanded -> SheetStop.Standard
            SheetStop.Standard -> SheetStop.Collapsed
            SheetStop.Collapsed -> SheetStop.Collapsed
        }
    }
    val magnitude = abs(dragDelta)
    if (magnitude < 60) return currentStop
    return if (dragDelta < 0) {
        when (currentStop) {
            SheetStop.Collapsed -> SheetStop.Standard
            SheetStop.Standard -> SheetStop.Expanded
            SheetStop.Expanded -> SheetStop.Expanded
        }
    } else {
        when (currentStop) {
            SheetStop.Expanded -> SheetStop.Standard
            SheetStop.Standard -> SheetStop.Collapsed
            SheetStop.Collapsed -> SheetStop.Collapsed
        }
    }
}

@Composable
private fun DragHandle() {
    Box(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2, bottom = Spacing.s1),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(Radii.xs))
                    .background(PantopusColors.appBorderStrong),
        )
    }
}

@Composable
private fun SheetHeader(
    countLabel: String,
    activeSort: NearbySort,
    onSelectSort: (NearbySort) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 18.dp, end = 18.dp, top = Spacing.s1, bottom = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = countLabel,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.weight(1f))
        Box {
            Row(
                modifier = Modifier.clickable { expanded = true }.testTag("nearbySheetSort"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Sort:",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = activeSort.label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextStrong,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = Radii.lg,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextStrong,
                )
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                NearbySort.entries.forEach { sort ->
                    DropdownMenuItem(
                        text = { Text(sort.label) },
                        onClick = {
                            expanded = false
                            onSelectSort(sort)
                        },
                    )
                }
            }
        }
    }
}

private fun headerCountLabel(state: NearbyMapUiState): String =
    when (state) {
        is NearbyMapUiState.Loaded -> {
            val n = state.entities.size
            "$n ${if (n == 1) "gig" else "gigs"} nearby"
        }
        else -> "Nearby"
    }

@Composable
private fun SheetLoading() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(top = Spacing.s3)
                .semantics {
                    contentDescription = "Loading nearby"
                }
                .testTag("nearbyMapLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(5) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Shimmer(width = 44.dp, height = 44.dp, cornerRadius = Radii.lg)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 180.dp, height = 14.dp)
                    Shimmer(width = 120.dp, height = 12.dp)
                }
            }
        }
    }
}

@Composable
private fun SheetError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 28.dp, tint = PantopusColors.error)
        Text(
            text = message,
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4)
                    .heightIn(min = 38.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun CollapsedBody(onExpand: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onExpand)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("nearbySheetCollapsedPrompt"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ChevronUp,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Drag up to see the list",
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun StandardBody(
    entities: List<MapEntity>,
    selectedId: String?,
    onTap: (MapEntity) -> Unit,
) {
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    LaunchedEffect(selectedId) {
        val index = entities.indexOfFirst { it.id == selectedId }
        if (index >= 0) {
            coroutineScope.launch { listState.animateScrollToItem(index) }
        }
    }
    Column(modifier = Modifier.fillMaxWidth()) {
        LazyRow(
            state = listState,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("nearbySheetRail"),
            contentPadding = PaddingValues(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(items = entities.take(12), key = { it.id }) { entity ->
                NearbyEntityCard(entity = entity, selected = entity.id == selectedId, onTap = { onTap(entity) })
            }
        }
        PaginationDots(total = minOf(entities.size, 3), index = 0)
    }
}

@Composable
private fun ExpandedBody(
    entities: List<MapEntity>,
    selectedId: String?,
    onTap: (MapEntity) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("nearbySheetList"),
        contentPadding = PaddingValues(bottom = Spacing.s4),
    ) {
        items(items = entities, key = { it.id }) { entity ->
            NearbyEntityRow(entity = entity, selected = entity.id == selectedId, onTap = { onTap(entity) })
        }
    }
}

@Composable
private fun NearbyEntityCard(
    entity: MapEntity,
    selected: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .width(240.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (selected) 2.dp else 1.dp,
                    color = if (selected) entity.category.color else PantopusColors.appBorder,
                    shape = RoundedCornerShape(14.dp),
                )
                .shadow(elevation = 2.dp, shape = RoundedCornerShape(14.dp))
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("nearbyCard_${entity.id}"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(entity.category.color, entity.category.color.copy(alpha = 0.8f)),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = iconFor(category = entity.category, kind = entity.kind),
                contentDescription = null,
                size = 22.dp,
                tint = Color.White,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = entity.title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 17.sp,
            )
            Row(
                modifier = Modifier.padding(top = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (entity.price != null) {
                    Text(
                        text = entity.price,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.primary600,
                    )
                }
                if (entity.distanceLabel != null) {
                    Text(
                        text = "· ${entity.distanceLabel}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                if (entity.bidCount > 0) {
                    Box(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.warningBg)
                                .padding(horizontal = 6.dp, vertical = 1.dp),
                    ) {
                        Text(
                            text = "${entity.bidCount}",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.warning,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NearbyEntityRow(
    entity: MapEntity,
    selected: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(if (selected) entity.category.color.copy(alpha = 0.06f) else PantopusColors.appSurface)
                .clickable(onClick = onTap)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("nearbyRow_${entity.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(entity.category.color, entity.category.color.copy(alpha = 0.8f)),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = iconFor(category = entity.category, kind = entity.kind),
                contentDescription = null,
                size = Radii.xl2,
                tint = Color.White,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(entity.category.color.copy(alpha = 0.12f))
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                ) {
                    Text(
                        text = entity.category.label.uppercase(),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = entity.category.color,
                        letterSpacing = 0.4.sp,
                    )
                }
                if (entity.distanceLabel != null) {
                    Text(
                        text = entity.distanceLabel,
                        fontSize = 10.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
            Text(
                text = entity.title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 17.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
            Row(
                modifier = Modifier.padding(top = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                if (entity.price != null) {
                    Text(
                        text = entity.price,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.primary600,
                    )
                }
                if (entity.bidCount > 0) {
                    Box(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.warningBg)
                                .padding(horizontal = 7.dp, vertical = 1.dp),
                    ) {
                        Text(
                            text = "${entity.bidCount} bids",
                            fontSize = 9.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.warning,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PaginationDots(
    total: Int,
    index: Int,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(5.dp, alignment = Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(maxOf(total, 1)) { i ->
            val active = i == index
            Box(
                modifier =
                    Modifier
                        .width(if (active) 16.dp else 5.dp)
                        .height(5.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(if (active) PantopusColors.primary600 else PantopusColors.appBorderStrong),
            )
        }
    }
}

private fun iconFor(
    category: GigsCategory,
    kind: MapEntityKind,
): PantopusIcon {
    if (kind == MapEntityKind.Listing) return PantopusIcon.ShoppingBag
    return when (category) {
        GigsCategory.Handyman -> PantopusIcon.Hammer
        GigsCategory.Cleaning -> PantopusIcon.Sun
        GigsCategory.Moving -> PantopusIcon.Send
        GigsCategory.PetCare -> PantopusIcon.Heart
        GigsCategory.ChildCare -> PantopusIcon.HelpCircle
        GigsCategory.Tutoring -> PantopusIcon.Lightbulb
        GigsCategory.Tech -> PantopusIcon.Lightbulb
        GigsCategory.Delivery -> PantopusIcon.Send
        GigsCategory.All -> PantopusIcon.Circle
    }
}
