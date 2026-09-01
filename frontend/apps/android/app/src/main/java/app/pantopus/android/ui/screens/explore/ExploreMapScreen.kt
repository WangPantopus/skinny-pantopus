@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "CyclomaticComplexMethod", "LongParameterList", "TooManyFunctions")
@file:OptIn(com.google.maps.android.compose.MapsComposeExperimentalApi::class)

package app.pantopus.android.ui.screens.explore

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.R
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.saved_places.PendingSavePlace
import app.pantopus.android.ui.screens.saved_places.SaveBookmarkButton
import app.pantopus.android.ui.screens.saved_places.SavePlaceSheet
import app.pantopus.android.ui.screens.saved_places.SavedPlaceUndo
import app.pantopus.android.ui.screens.saved_places.SavedPlacesStoreViewModel
import app.pantopus.android.ui.screens.saved_places.SavedPlacesToast
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.Dash
import com.google.android.gms.maps.model.Gap
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.Circle
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ln

/**
 * A11.2 Explore — cross-type discovery map. Full-bleed map, mixed
 * task/item/post/spot pins, top type toggle, shared FilterSheetShell, and
 * a 3-stop draggable sheet whose rail filters live with the map markers.
 */
@Composable
fun ExploreMapScreen(
    focus: ExploreMapFocus? = null,
    onOpenEntity: (ExploreEntity) -> Unit = {},
    onOpenSaved: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    viewModel: ExploreMapViewModel = hiltViewModel(),
    savedPlacesStore: SavedPlacesStoreViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeKind by viewModel.activeKind.collectAsStateWithLifecycle()
    val activeSort by viewModel.activeSort.collectAsStateWithLifecycle()
    val sheetStop by viewModel.sheetStop.collectAsStateWithLifecycle()
    val userCoord by viewModel.userCoordinate.collectAsStateWithLifecycle()
    val filters by viewModel.filters.collectAsStateWithLifecycle()
    val savedPlaces by savedPlacesStore.saved.collectAsStateWithLifecycle()
    val pendingSave by savedPlacesStore.pendingSave.collectAsStateWithLifecycle()
    val undo by savedPlacesStore.undo.collectAsStateWithLifecycle()
    val saveToast by savedPlacesStore.toast.collectAsStateWithLifecycle()
    var showFilters by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.load()
        savedPlacesStore.loadIfNeeded()
    }

    val cameraState =
        rememberCameraPositionState {
            position =
                CameraPosition.fromLatLngZoom(
                    LatLng(userCoord?.latitude ?: 40.7484, userCoord?.longitude ?: -73.9857),
                    15f,
                )
        }
    LaunchedEffect(userCoord, focus) {
        if (focus == null) {
            userCoord?.let { coord ->
                cameraState.position = CameraPosition.fromLatLngZoom(LatLng(coord.latitude, coord.longitude), 15f)
            }
        }
    }
    LaunchedEffect(focus) {
        focus?.let { target ->
            viewModel.selectEntity(null)
            viewModel.setSheetStop(ExploreSheetStop.Standard)
            cameraState.position = CameraPosition.fromLatLngZoom(LatLng(target.latitude, target.longitude), 15f)
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
                .testTag("exploreMap"),
    ) {
        ExploreMapLayer(
            cameraState = cameraState,
            markers = (state as? ExploreMapUiState.Loaded)?.markers.orEmpty(),
            selectedId = (state as? ExploreMapUiState.Loaded)?.selectedId,
            userCoordinate = userCoord,
            showSearchRadius = (state as? ExploreMapUiState.Loaded)?.isEmpty == true,
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
        ExploreFloatingPill(
            activeFilterCount = filters.activeCount,
            onBack = onBack,
            onOpenSaved = onOpenSaved,
            onOpenFilters = { showFilters = true },
            modifier =
                Modifier
                    .padding(WindowInsets.statusBars.asPaddingValues())
                    .padding(top = Spacing.s2, start = 14.dp, end = 14.dp)
                    .align(Alignment.TopCenter)
                    .fillMaxWidth(),
        )
        ExploreTypeToggle(
            active = activeKind,
            onSelect = viewModel::selectKind,
            modifier =
                Modifier
                    .padding(WindowInsets.statusBars.asPaddingValues())
                    .padding(top = Spacing.s16)
                    .align(Alignment.TopCenter)
                    .fillMaxWidth(),
        )
        ExploreBottomSheet(
            state = state,
            activeSort = activeSort,
            activeFilterCount = filters.activeCount,
            sheetStop = sheetStop,
            screenHeightPx = screenHeightPx,
            savedPlaces = savedPlaces,
            onSelectSort = viewModel::selectSort,
            onSelectStop = viewModel::setSheetStop,
            onTapEntity = { entity ->
                viewModel.selectEntity(entity.id)
                onOpenEntity(entity)
            },
            onClearFilters = viewModel::clearFilters,
            onWidenArea = viewModel::widenArea,
            onRefresh = viewModel::refresh,
            onToggleSave = { entity -> savedPlacesStore.toggle(entity.pendingSavePlace()) },
            modifier = Modifier.align(Alignment.BottomCenter),
        )
        ExploreMapControls(
            sheetStop = sheetStop,
            screenHeightPx = screenHeightPx,
            onLocate = {
                userCoord?.let { coord ->
                    cameraState.position = CameraPosition.fromLatLngZoom(LatLng(coord.latitude, coord.longitude), 15f)
                }
            },
            onFitAll = { fitAll(cameraState, state, userCoord) },
            modifier = Modifier.align(Alignment.BottomEnd),
        )
        if (showFilters) {
            ExploreFilterSheet(
                criteria = filters,
                onApply = viewModel::applyFilters,
                onDismiss = { showFilters = false },
            )
        }
        undo?.let { snapshot ->
            ExploreSaveUndoSnackbar(
                undo = snapshot,
                onUndo = savedPlacesStore::undoRemove,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s12, start = Spacing.s4, end = Spacing.s4),
            )
        }
        saveToast?.let { toast ->
            ExploreSaveToast(
                toast = toast,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 88.dp, start = Spacing.s4, end = Spacing.s4),
            )
        }
    }
    LaunchedEffect(undo) {
        if (undo != null) {
            delay(4_000L)
            savedPlacesStore.dismissUndo()
        }
    }
    LaunchedEffect(saveToast) {
        if (saveToast != null) {
            delay(2_500L)
            savedPlacesStore.dismissToast()
        }
    }
    pendingSave?.let { pending ->
        SavePlaceSheet(
            pending = pending,
            onSave = savedPlacesStore::commitSave,
            onClose = savedPlacesStore::closeSheet,
        )
    }
}

// MARK: - Map layer

@Composable
private fun ExploreMapLayer(
    cameraState: CameraPositionState,
    markers: List<ExploreMarker>,
    selectedId: String?,
    userCoordinate: UserCoordinate?,
    showSearchRadius: Boolean,
    onPinTap: (ExploreEntity) -> Unit,
    onClusterTap: (ExploreCluster) -> Unit,
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
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("exploreGoogleMap")
                .semantics { contentDescription = "Explore map" },
        cameraPositionState = cameraState,
        properties = mapProperties,
        uiSettings = uiSettings,
    ) {
        if (showSearchRadius && userCoordinate != null) {
            Circle(
                center = LatLng(userCoordinate.latitude, userCoordinate.longitude),
                fillColor = PantopusColors.primary600.copy(alpha = 0.05f),
                radius = 800.0,
                strokeColor = PantopusColors.primary600.copy(alpha = 0.45f),
                strokePattern = listOf(Dash(12f), Gap(8f)),
                strokeWidth = 2f,
            )
        }
        markers.forEach { marker ->
            when (marker) {
                is ExploreMarker.Cluster -> {
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
                        ExploreClusterDot(cluster = cluster)
                    }
                }
                is ExploreMarker.Entity -> {
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
                        ExploreTypedPin(entity = entity, isActive = active)
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
                ExploreYouAreHereDot()
            }
        }
    }
}

@Composable
internal fun ExploreTypedPin(
    entity: ExploreEntity,
    isActive: Boolean,
) {
    val shape: Shape = if (entity.kind.isSquarePin) RoundedCornerShape(Radii.md) else CircleShape
    Box(
        modifier =
            Modifier
                .size(50.dp)
                .semantics { contentDescription = "${entity.kind.singularLabel}: ${entity.title}" },
        contentAlignment = Alignment.Center,
    ) {
        if (isActive) {
            Box(
                modifier =
                    Modifier
                        .size(46.dp)
                        .clip(shape)
                        .background(entity.kind.color.copy(alpha = 0.25f)),
            )
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(shape)
                        .background(entity.kind.color.copy(alpha = 0.35f)),
            )
        }
        if (entity.state == ExploreEntityState.Pending) {
            PendingOutline(kind = entity.kind, color = entity.kind.color)
        }
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .shadow(elevation = 2.dp, shape = shape)
                    .clip(shape)
                    .background(entity.kind.color)
                    .border(
                        width = if (entity.state == ExploreEntityState.Confirmed) 2.dp else 0.dp,
                        color = if (entity.state == ExploreEntityState.Confirmed) Color.White else Color.Transparent,
                        shape = shape,
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = entity.kind.glyph,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.4f,
                tint = Color.White,
            )
        }
    }
}

@Composable
private fun PendingOutline(
    kind: ExploreKind,
    color: Color,
) {
    val strokeWidthPx = with(LocalDensity.current) { 2.dp.toPx() }
    val dash = floatArrayOf(8f, 5f)
    Canvas(modifier = Modifier.size(32.dp)) {
        val stroke = Stroke(width = strokeWidthPx, pathEffect = PathEffect.dashPathEffect(dash, 0f))
        if (kind.isSquarePin) {
            drawRoundRect(
                color = color,
                cornerRadius = CornerRadius(10.dp.toPx(), 10.dp.toPx()),
                style = stroke,
            )
        } else {
            drawCircle(color = color, radius = (size.minDimension - strokeWidthPx) / 2, style = stroke)
        }
    }
}

@Composable
internal fun ExploreClusterDot(cluster: ExploreCluster) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .semantics { contentDescription = "Cluster of ${cluster.count} nearby pins" },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(cluster.kind.color.copy(alpha = 0.20f)),
        )
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .shadow(elevation = 3.dp, shape = CircleShape)
                    .clip(CircleShape)
                    .background(cluster.kind.color)
                    .border(3.dp, Color.White, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "${cluster.count}",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
        }
    }
}

@Composable
internal fun ExploreYouAreHereDot() {
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
private fun ExploreFloatingPill(
    activeFilterCount: Int,
    onBack: (() -> Unit)?,
    onOpenSaved: () -> Unit,
    onOpenFilters: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .shadow(elevation = 8.dp, shape = RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s1, vertical = Spacing.s1)
                .testTag("exploreFloatingPill"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TopPillIconButton(
            icon = PantopusIcon.ChevronLeft,
            label = "Back",
            enabled = onBack != null,
            onClick = { onBack?.invoke() },
            testTag = "exploreBack",
        )
        Text(
            text = "Explore",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f).semantics { heading() },
            textAlign = TextAlign.Center,
        )
        ExploreTopActionButton(
            icon = PantopusIcon.Bookmark,
            label = "Saved",
            contentDescription = "Saved places",
            testTag = "savedPlaces.entry.explore",
            onClick = onOpenSaved,
        )
        Box(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onOpenFilters)
                    .semantics {
                        contentDescription =
                            if (activeFilterCount > 0) {
                                "Filter, $activeFilterCount active"
                            } else {
                                "Filter"
                            }
                        role = Role.Button
                    }
                    .testTag("exploreFilterButton"),
            contentAlignment = Alignment.Center,
        ) {
            Row(
                modifier =
                    Modifier
                        .height(32.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary50)
                        .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.pill))
                        .padding(horizontal = 11.dp),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.SlidersHorizontal,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.primary700,
                )
                Text(
                    text = "Filter",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
                if (activeFilterCount > 0) {
                    ActiveFilterChip(count = activeFilterCount, testTag = "exploreFilterButtonBadge")
                }
            }
        }
    }
}

@Composable
private fun ExploreTopActionButton(
    icon: PantopusIcon,
    label: String,
    contentDescription: String,
    testTag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .height(32.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = 11.dp)
                .semantics {
                    this.contentDescription = contentDescription
                    role = Role.Button
                }
                .testTag(testTag),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2.4f,
            tint = PantopusColors.primary700,
        )
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary700,
        )
    }
}

@Composable
private fun TopPillIconButton(
    icon: PantopusIcon,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    testTag: String,
) {
    Box(
        modifier =
            Modifier
                .size(48.dp)
                .clip(CircleShape)
                .clickable(enabled = enabled, onClick = onClick)
                .semantics {
                    contentDescription = label
                    role = Role.Button
                }
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.2f,
            tint = if (enabled) PantopusColors.appText else PantopusColors.appTextMuted.copy(alpha = 0f),
        )
    }
}

@Composable
private fun ExploreTypeToggle(
    active: ExploreKind?,
    onSelect: (ExploreKind?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 14.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .shadow(elevation = 4.dp, shape = RoundedCornerShape(Radii.pill))
                .padding(horizontal = 3.dp)
                .testTag("exploreTypeToggle"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ExploreTypeSegment(kind = null, label = "All", active = active == null, onSelect = onSelect)
        ExploreKind.entries.forEach { kind ->
            ExploreTypeSegment(kind = kind, label = kind.pluralLabel, active = active == kind, onSelect = onSelect)
        }
    }
}

@Composable
private fun ExploreTypeSegment(
    kind: ExploreKind?,
    label: String,
    active: Boolean,
    onSelect: (ExploreKind?) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .width(66.dp)
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .clickable { onSelect(kind) }
                .semantics {
                    contentDescription = label
                    selected = active
                    role = Role.Tab
                }
                .testTag("exploreTypeSegment_${kind?.key ?: "all"}"),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            modifier =
                Modifier
                    .height(28.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(if (active) PantopusColors.appText else Color.Transparent)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            if (kind != null) {
                Box(
                    modifier =
                        Modifier
                            .size(6.dp)
                            .clip(if (kind.isSquarePin) RoundedCornerShape(1.5.dp) else CircleShape)
                            .background(if (active) PantopusColors.appTextInverse else kind.color),
                )
            }
            Text(
                text = label,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
            )
        }
    }
}

@Composable
private fun ExploreMapControls(
    sheetStop: ExploreSheetStop,
    screenHeightPx: Float,
    onLocate: () -> Unit,
    onFitAll: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    val bottomOffset = with(density) { (screenHeightPx * sheetStop.heightFraction).toDp() + 14.dp }
    val animatedBottom by animateDpAsState(targetValue = bottomOffset, label = "exploreMapControlsBottom")
    Column(
        modifier =
            modifier
                .padding(end = 14.dp, bottom = animatedBottom)
                .testTag("exploreMapControls"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        ExploreMapControlButton(icon = PantopusIcon.MapPin, label = "Locate me", onClick = onLocate, testTag = "exploreControl_locate")
        ExploreMapControlButton(icon = PantopusIcon.Map, label = "Fit all pins", onClick = onFitAll, testTag = "exploreControl_fitAll")
    }
}

@Composable
private fun ExploreMapControlButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    testTag: String,
) {
    Box(
        modifier =
            Modifier
                .size(48.dp)
                .clip(CircleShape)
                .clickable(onClick = onClick)
                .semantics {
                    contentDescription = label
                    role = Role.Button
                }
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface.copy(alpha = 0.96f))
                    .border(1.dp, PantopusColors.appBorder, CircleShape)
                    .shadow(elevation = 4.dp, shape = CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = Radii.xl, tint = PantopusColors.appText)
        }
    }
}

// MARK: - Bottom sheet

@Composable
private fun ExploreBottomSheet(
    state: ExploreMapUiState,
    activeSort: ExploreSort,
    activeFilterCount: Int,
    sheetStop: ExploreSheetStop,
    screenHeightPx: Float,
    savedPlaces: List<SavedPlaceDto>,
    onSelectSort: (ExploreSort) -> Unit,
    onSelectStop: (ExploreSheetStop) -> Unit,
    onTapEntity: (ExploreEntity) -> Unit,
    onClearFilters: () -> Unit,
    onWidenArea: () -> Unit,
    onRefresh: () -> Unit,
    onToggleSave: (ExploreEntity) -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    var dragDelta by remember { mutableStateOf(0f) }
    val baseHeightPx = screenHeightPx * sheetStop.heightFraction
    val targetHeightPx = (baseHeightPx - dragDelta).coerceIn(120f * density.density, screenHeightPx * 0.85f)
    val targetHeightDp = with(density) { targetHeightPx.toDp() }
    val animatedHeight by animateDpAsState(
        targetValue = targetHeightDp,
        animationSpec = tween(durationMillis = 240),
        label = "exploreSheetHeight",
    )
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
                .testTag("exploreSheet"),
    ) {
        ExploreDragHandle()
        ExploreSheetHeader(
            countLabel = exploreHeaderCountLabel(state, activeFilterCount),
            activeFilterCount = activeFilterCount,
            activeSort = activeSort,
            onSelectSort = onSelectSort,
        )
        when (state) {
            is ExploreMapUiState.Loading -> ExploreSkeletonRail()
            is ExploreMapUiState.Error -> ExploreSheetError(state.message, onRetry = onRefresh)
            is ExploreMapUiState.Loaded ->
                if (state.isEmpty) {
                    ExploreEmptyBody(onClearFilters = onClearFilters, onWidenArea = onWidenArea)
                } else {
                    when (sheetStop) {
                        ExploreSheetStop.Collapsed -> ExploreCollapsedBody(onExpand = { onSelectStop(ExploreSheetStop.Standard) })
                        ExploreSheetStop.Standard ->
                            ExploreStandardBody(
                                entities = state.entities,
                                selectedId = state.selectedId,
                                savedPlaces = savedPlaces,
                                onTap = onTapEntity,
                                onToggleSave = onToggleSave,
                            )
                        ExploreSheetStop.Expanded ->
                            ExploreExpandedBody(
                                entities = state.entities,
                                selectedId = state.selectedId,
                                savedPlaces = savedPlaces,
                                onTap = onTapEntity,
                                onToggleSave = onToggleSave,
                            )
                    }
                }
        }
    }
}

private fun resolveStop(
    currentStop: ExploreSheetStop,
    dragDelta: Float,
    velocity: Float,
): ExploreSheetStop {
    val velocityThreshold = 1_200f
    if (velocity < -velocityThreshold) {
        return when (currentStop) {
            ExploreSheetStop.Collapsed -> ExploreSheetStop.Standard
            ExploreSheetStop.Standard -> ExploreSheetStop.Expanded
            ExploreSheetStop.Expanded -> ExploreSheetStop.Expanded
        }
    }
    if (velocity > velocityThreshold) {
        return when (currentStop) {
            ExploreSheetStop.Expanded -> ExploreSheetStop.Standard
            ExploreSheetStop.Standard -> ExploreSheetStop.Collapsed
            ExploreSheetStop.Collapsed -> ExploreSheetStop.Collapsed
        }
    }
    val magnitude = abs(dragDelta)
    if (magnitude < 60) return currentStop
    return if (dragDelta < 0) {
        when (currentStop) {
            ExploreSheetStop.Collapsed -> ExploreSheetStop.Standard
            ExploreSheetStop.Standard -> ExploreSheetStop.Expanded
            ExploreSheetStop.Expanded -> ExploreSheetStop.Expanded
        }
    } else {
        when (currentStop) {
            ExploreSheetStop.Expanded -> ExploreSheetStop.Standard
            ExploreSheetStop.Standard -> ExploreSheetStop.Collapsed
            ExploreSheetStop.Collapsed -> ExploreSheetStop.Collapsed
        }
    }
}

@Composable
private fun ExploreDragHandle() {
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
private fun ExploreSheetHeader(
    countLabel: String,
    activeFilterCount: Int,
    activeSort: ExploreSort,
    onSelectSort: (ExploreSort) -> Unit,
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
            modifier =
                Modifier
                    .semantics { heading() }
                    .testTag("exploreSheetCount"),
        )
        if (activeFilterCount > 0) {
            Spacer(modifier = Modifier.width(Spacing.s2))
            ActiveFilterChip(count = activeFilterCount, testTag = "exploreSheetFilterCount")
        }
        Spacer(modifier = Modifier.weight(1f))
        Box {
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable { expanded = true }
                        .padding(horizontal = 2.dp)
                        .testTag("exploreSheetSort")
                        .semantics {
                            contentDescription = "Sort by ${activeSort.label}"
                            role = Role.Button
                        },
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
                ExploreSort.entries.forEach { sort ->
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

private fun exploreHeaderCountLabel(
    state: ExploreMapUiState,
    activeFilterCount: Int,
): String =
    when (state) {
        is ExploreMapUiState.Loaded -> {
            val filterSuffix =
                if (activeFilterCount > 0) {
                    " · $activeFilterCount ${if (activeFilterCount == 1) "filter" else "filters"} on"
                } else {
                    ""
                }
            "${state.entities.size} nearby$filterSuffix"
        }
        else -> "Explore"
    }

@Composable
private fun ActiveFilterChip(
    count: Int,
    testTag: String,
) {
    Box(
        modifier =
            Modifier
                .heightIn(min = 16.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary600)
                .padding(horizontal = 5.dp)
                .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "$count",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun ExploreCollapsedBody(onExpand: () -> Unit) {
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
                .testTag("exploreSheetCollapsedPrompt")
                .semantics {
                    contentDescription = "Drag up to see the list"
                    role = Role.Button
                },
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
private fun ExploreStandardBody(
    entities: List<ExploreEntity>,
    selectedId: String?,
    savedPlaces: List<SavedPlaceDto>,
    onTap: (ExploreEntity) -> Unit,
    onToggleSave: (ExploreEntity) -> Unit,
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
                    .testTag("exploreSheetRail"),
            contentPadding = PaddingValues(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(items = entities.take(12), key = { it.id }) { entity ->
                ExploreEntityCard(
                    entity = entity,
                    selected = entity.id == selectedId,
                    isSaved = savedPlaces.isSaved(entity),
                    onTap = { onTap(entity) },
                    onToggleSave = { onToggleSave(entity) },
                )
            }
        }
        ExplorePaginationDots(total = minOf(entities.size, 4), index = 0)
    }
}

@Composable
private fun ExploreExpandedBody(
    entities: List<ExploreEntity>,
    selectedId: String?,
    savedPlaces: List<SavedPlaceDto>,
    onTap: (ExploreEntity) -> Unit,
    onToggleSave: (ExploreEntity) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("exploreSheetList"),
        contentPadding = PaddingValues(bottom = 80.dp),
    ) {
        items(items = entities, key = { it.id }) { entity ->
            ExploreEntityRow(
                entity = entity,
                selected = entity.id == selectedId,
                isSaved = savedPlaces.isSaved(entity),
                onTap = { onTap(entity) },
                onToggleSave = { onToggleSave(entity) },
            )
        }
    }
}

@Composable
internal fun ExploreEntityCard(
    entity: ExploreEntity,
    selected: Boolean,
    isSaved: Boolean,
    onTap: () -> Unit,
    onToggleSave: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .width(240.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (selected) 2.dp else 1.dp,
                    color = if (selected) entity.kind.color else PantopusColors.appBorder,
                    shape = RoundedCornerShape(14.dp),
                )
                .shadow(elevation = 2.dp, shape = RoundedCornerShape(14.dp))
                .padding(Spacing.s3)
                .testTag("exploreCard_${entity.id}")
                .semantics {
                    contentDescription = "${entity.kind.singularLabel}: ${entity.title}"
                    role = Role.Button
                },
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f).clickable(onClick = onTap),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ExploreEntityTile(entity.kind, size = 48.dp, iconSize = 22.dp)
            Column(modifier = Modifier.weight(1f)) {
                ExploreKindTag(kind = entity.kind)
                Text(
                    text = entity.title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 17.sp,
                    modifier = Modifier.padding(top = 3.dp),
                )
                Row(
                    modifier = Modifier.padding(top = Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Text(
                        text = "${entity.metaLead} · ${entity.distanceLabel}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (entity.badge != null) {
                        Spacer(modifier = Modifier.weight(1f))
                        ExploreBadgeChip(badge = entity.badge)
                    }
                }
            }
        }
        SaveBookmarkButton(isSaved = isSaved, onToggle = onToggleSave, size = 30.dp)
    }
}

@Composable
private fun ExploreEntityRow(
    entity: ExploreEntity,
    selected: Boolean,
    isSaved: Boolean,
    onTap: () -> Unit,
    onToggleSave: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(if (selected) entity.kind.color.copy(alpha = 0.06f) else PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("exploreRow_${entity.id}")
                .semantics {
                    contentDescription = "${entity.kind.singularLabel}: ${entity.title}"
                    role = Role.Button
                },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f).clickable(onClick = onTap),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ExploreEntityTile(entity.kind, size = 44.dp, iconSize = 20.dp)
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    ExploreKindTag(kind = entity.kind)
                    Text(
                        text = entity.distanceLabel,
                        fontSize = 10.sp,
                        color = PantopusColors.appTextSecondary,
                    )
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
                    Text(
                        text = entity.metaLead,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextStrong,
                    )
                    if (entity.badge != null) {
                        ExploreBadgeChip(badge = entity.badge)
                    }
                }
            }
        }
        SaveBookmarkButton(isSaved = isSaved, onToggle = onToggleSave, size = 32.dp)
    }
}

@Composable
private fun ExploreEntityTile(
    kind: ExploreKind,
    size: androidx.compose.ui.unit.Dp,
    iconSize: androidx.compose.ui.unit.Dp,
) {
    Box(
        modifier =
            Modifier
                .size(size)
                .clip(RoundedCornerShape(if (kind.isSquarePin) 8.dp else 10.dp))
                .background(kind.color),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = kind.glyph,
            contentDescription = null,
            size = iconSize,
            tint = Color.White,
        )
    }
}

@Composable
private fun ExploreKindTag(kind: ExploreKind) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(kind.color.copy(alpha = 0.12f))
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = kind.singularLabel.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = kind.color,
        )
    }
}

@Composable
private fun ExploreBadgeChip(badge: ExploreBadge) {
    val colors = exploreBadgeColors(badge.tone)
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(colors.first)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = badge.text,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = colors.second,
        )
    }
}

private fun exploreBadgeColors(tone: ExploreBadgeTone): Pair<Color, Color> =
    when (tone) {
        ExploreBadgeTone.Bids -> PantopusColors.warningBg to PantopusColors.warning
        ExploreBadgeTone.New -> PantopusColors.homeBg to PantopusColors.home
        ExploreBadgeTone.Replies -> PantopusColors.personalBg to PantopusColors.personal
        ExploreBadgeTone.Rating -> PantopusColors.warningBg to PantopusColors.warning
    }

@Composable
internal fun ExploreEmptyBody(
    onClearFilters: () -> Unit,
    onWidenArea: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp, vertical = 10.dp)
                .testTag("exploreEmptyState"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.primary50)
                    .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.xl)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Compass,
                contentDescription = null,
                size = Radii.xl3,
                tint = PantopusColors.primary600,
            )
        }
        Text(
            text = "No activity in this area yet",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s3),
        )
        Text(
            text =
                "3 filters are narrowing this view. Try clearing them, or widen the area to surface " +
                    "neighbors a little further out.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
            lineHeight = 18.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 5.dp).width(264.dp),
        )
        Row(
            modifier = Modifier.padding(top = 14.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            ExploreActionPill(
                title = "Clear filters",
                icon = PantopusIcon.X,
                primary = true,
                onClick = onClearFilters,
                testTag = "exploreClearFilters",
            )
            ExploreActionPill(
                title = "Widen area",
                icon = PantopusIcon.Globe,
                primary = false,
                onClick = onWidenArea,
                testTag = "exploreWidenArea",
            )
        }
    }
}

@Composable
private fun ExploreActionPill(
    title: String,
    icon: PantopusIcon,
    primary: Boolean,
    onClick: () -> Unit,
    testTag: String,
) {
    val bg = if (primary) PantopusColors.primary600 else PantopusColors.appSurface
    val fg = if (primary) PantopusColors.appTextInverse else PantopusColors.appTextStrong
    Row(
        modifier =
            Modifier
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(
                    width = if (primary) 0.dp else 1.dp,
                    color = if (primary) Color.Transparent else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp)
                .testTag(testTag)
                .semantics {
                    contentDescription = title
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = fg)
        Text(
            text = title,
            fontSize = 13.sp,
            fontWeight = if (primary) FontWeight.Bold else FontWeight.SemiBold,
            color = fg,
        )
    }
}

@Composable
internal fun ExploreSheetError(
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
        ExploreActionPill(
            title = "Try again",
            icon = PantopusIcon.RefreshCw,
            primary = true,
            onClick = onRetry,
            testTag = "exploreRetry",
        )
    }
}

@Composable
internal fun ExploreSkeletonRail() {
    LazyRow(
        modifier = Modifier.fillMaxWidth().testTag("exploreSkeletonRail"),
        contentPadding = PaddingValues(horizontal = Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(4) {
            Row(
                modifier =
                    Modifier
                        .width(240.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                        .padding(Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Shimmer(width = 48.dp, height = 48.dp, cornerRadius = 10.dp)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
                    Shimmer(width = 44.dp, height = 10.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 132.dp, height = 12.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 90.dp, height = 10.dp, cornerRadius = Radii.xs)
                }
            }
        }
    }
}

@Composable
private fun ExplorePaginationDots(
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

// MARK: - Saved-place helpers

@Composable
private fun ExploreSaveUndoSnackbar(
    undo: SavedPlaceUndo,
    onUndo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appText.copy(alpha = 0.95f))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("savedPlaces.undoSnackbar"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CheckCircle,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = "Removed \"${undo.dto.label}\"",
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextInverse,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        Text(
            text = "Undo",
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary300,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onUndo)
                    .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        )
    }
}

@Composable
private fun ExploreSaveToast(
    toast: SavedPlacesToast,
    modifier: Modifier = Modifier,
) {
    Text(
        text = toast.text,
        color = PantopusColors.appTextInverse,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (toast.isError) PantopusColors.error else PantopusColors.appText)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
    )
}

private fun ExploreEntity.pendingSavePlace(): PendingSavePlace =
    PendingSavePlace(
        label = title,
        latitude = latitude,
        longitude = longitude,
        city = city,
        state = stateName,
        geocodePlaceId = geocodePlaceId,
        sourceId = sourceId,
    )

private fun List<SavedPlaceDto>.isSaved(entity: ExploreEntity): Boolean {
    val target = savedPlaceMatchKey(entity.geocodePlaceId, entity.latitude, entity.longitude)
    return any { dto -> savedPlaceMatchKey(dto.geocodePlaceId, dto.latitude, dto.longitude) == target }
}

private fun savedPlaceMatchKey(
    geocodePlaceId: String?,
    latitude: Double,
    longitude: Double,
): String =
    if (!geocodePlaceId.isNullOrBlank()) {
        "gid:$geocodePlaceId"
    } else {
        String.format(Locale.US, "ll:%.5f,%.5f", latitude, longitude)
    }

// MARK: - Camera helpers

private fun zoomToCluster(
    cameraState: CameraPositionState,
    cluster: ExploreCluster,
) {
    val latDelta = (cluster.maxLatitude - cluster.minLatitude).coerceAtLeast(0.003) * 1.4
    val lonDelta = (cluster.maxLongitude - cluster.minLongitude).coerceAtLeast(0.003) * 1.4
    val degreesAcross = maxOf(latDelta, lonDelta)
    cameraState.position =
        CameraPosition.fromLatLngZoom(
            LatLng(
                (cluster.minLatitude + cluster.maxLatitude) / 2,
                (cluster.minLongitude + cluster.maxLongitude) / 2,
            ),
            zoomForDegrees(degreesAcross),
        )
}

private fun fitAll(
    cameraState: CameraPositionState,
    state: ExploreMapUiState,
    fallback: UserCoordinate?,
) {
    val entities = (state as? ExploreMapUiState.Loaded)?.entities.orEmpty()
    if (entities.isEmpty()) {
        fallback?.let { coord ->
            cameraState.position = CameraPosition.fromLatLngZoom(LatLng(coord.latitude, coord.longitude), 15f)
        }
        return
    }
    val lats = entities.map { it.latitude }
    val lons = entities.map { it.longitude }
    val minLat = lats.min()
    val maxLat = lats.max()
    val minLon = lons.min()
    val maxLon = lons.max()
    val degreesAcross = maxOf((maxLat - minLat) * 1.4, (maxLon - minLon) * 1.4, 0.01)
    cameraState.position =
        CameraPosition.fromLatLngZoom(
            LatLng((minLat + maxLat) / 2, (minLon + maxLon) / 2),
            zoomForDegrees(degreesAcross),
        )
}

private fun zoomForDegrees(degreesAcross: Double): Float = (ln(360.0 / degreesAcross) / ln(2.0)).toFloat().coerceIn(2f, 19f)
