@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.feed.map

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.R
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.explore.ExploreCluster
import app.pantopus.android.ui.screens.explore.ExploreClusterDot
import app.pantopus.android.ui.screens.explore.ExploreEntity
import app.pantopus.android.ui.screens.explore.ExploreMarker
import app.pantopus.android.ui.screens.explore.ExploreTypedPin
import app.pantopus.android.ui.screens.explore.ExploreYouAreHereDot
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
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
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.max

/**
 * Pulse feed — Map mode. The A11 "Map + list hybrid" archetype narrowed to a
 * single layer: a full-bleed Google Map of post pins (clustered by the
 * Explore clusterer), a floating "Search this area" pill that appears once
 * the camera leaves the fetched viewport, a recenter control, and a bottom
 * preview card for the selected pin.
 *
 * Reuses `ExploreTypedPin` / `ExploreClusterDot` / `ExploreYouAreHereDot` so
 * Pulse and Explore render one pin vocabulary.
 */
@Composable
fun FeedMapSection(
    query: FeedMapQuery,
    onOpenPost: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: FeedMapViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val region by viewModel.region.collectAsStateWithLifecycle()
    val viewportDirty by viewModel.viewportDirty.collectAsStateWithLifecycle()

    LaunchedEffect(query) { viewModel.activate(query) }

    val cameraState =
        rememberCameraPositionState {
            position =
                CameraPosition.fromLatLngZoom(
                    LatLng(region.latitude, region.longitude),
                    zoomForDelta(region.latitudeDelta),
                )
        }

    // Region → camera. Guarded so the debounced region commit that follows a
    // user pan doesn't bounce the camera back onto itself.
    LaunchedEffect(region) {
        val current = cameraState.position.target
        val drifted =
            abs(current.latitude - region.latitude) > region.latitudeDelta * 0.05 ||
                abs(current.longitude - region.longitude) > region.longitudeDelta * 0.05
        if (drifted) {
            cameraState.position =
                CameraPosition.fromLatLngZoom(
                    LatLng(region.latitude, region.longitude),
                    zoomForDelta(region.latitudeDelta),
                )
        }
    }

    // Camera → region. Only fires once the gesture settles.
    LaunchedEffect(cameraState.isMoving) {
        if (cameraState.isMoving) return@LaunchedEffect
        val bounds = cameraState.projection?.visibleRegion?.latLngBounds ?: return@LaunchedEffect
        val northeast = bounds.northeast
        val southwest = bounds.southwest
        viewModel.cameraDidSettle(
            FeedMapRegion(
                latitude = (northeast.latitude + southwest.latitude) / 2,
                longitude = (northeast.longitude + southwest.longitude) / 2,
                latitudeDelta = northeast.latitude - southwest.latitude,
                longitudeDelta = northeast.longitude - southwest.longitude,
            ),
        )
    }

    Box(modifier = modifier.fillMaxSize().testTag("pulseFeedMap")) {
        FeedMapLayer(
            markers = (state as? FeedMapUiState.Loaded)?.markers.orEmpty(),
            selectedId = (state as? FeedMapUiState.Loaded)?.selectedId,
            userCoordinate = (state as? FeedMapUiState.Loaded)?.userCoordinate,
            cameraState = cameraState,
            onPinTap = viewModel::selectEntity,
            onClusterTap = { cluster ->
                cameraState.position =
                    CameraPosition.fromLatLngZoom(
                        LatLng(
                            (cluster.minLatitude + cluster.maxLatitude) / 2,
                            (cluster.minLongitude + cluster.maxLongitude) / 2,
                        ),
                        zoomForDelta(
                            max(
                                cluster.maxLatitude - cluster.minLatitude,
                                cluster.maxLongitude - cluster.minLongitude,
                            ).coerceAtLeast(0.004) * 1.4,
                        ),
                    )
            },
        )
        if (viewportDirty) {
            SearchThisAreaPill(
                onClick = viewModel::searchThisArea,
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = Spacing.s3),
            )
        }
        RecenterButton(
            onClick = viewModel::recenter,
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 14.dp, bottom = 96.dp),
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        ) {
            when (val current = state) {
                FeedMapUiState.Loading -> LoadingCard()
                is FeedMapUiState.Error -> ErrorCard(current.message, viewModel::refresh)
                is FeedMapUiState.Loaded -> {
                    val selected = current.entities.firstOrNull { it.id == current.selectedId }
                    when {
                        selected != null -> PreviewCard(selected) { onOpenPost(selected.id) }
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

@Composable
private fun FeedMapLayer(
    markers: List<ExploreMarker>,
    selectedId: String?,
    userCoordinate: UserCoordinate?,
    cameraState: CameraPositionState,
    onPinTap: (String) -> Unit,
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
        androidx.compose.runtime.remember {
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
                .testTag("pulseGoogleMap")
                .semantics { contentDescription = "Pulse map" },
        cameraPositionState = cameraState,
        properties = mapProperties,
        uiSettings = uiSettings,
    ) {
        markers.forEach { marker ->
            when (marker) {
                is ExploreMarker.Cluster -> {
                    val cluster = marker.cluster
                    val markerState =
                        remember(cluster.id, cluster.latitude, cluster.longitude) {
                            MarkerState(position = LatLng(cluster.latitude, cluster.longitude))
                        }
                    MarkerComposable(
                        keys = arrayOf<Any>(cluster.id, cluster.count),
                        state = markerState,
                        anchor = Offset(0.5f, 0.5f),
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
                    val markerState =
                        remember(entity.id, entity.latitude, entity.longitude) {
                            MarkerState(position = LatLng(entity.latitude, entity.longitude))
                        }
                    MarkerComposable(
                        keys = arrayOf<Any>(entity.id, active),
                        state = markerState,
                        anchor = Offset(0.5f, 0.5f),
                        onClick = { _ ->
                            onPinTap(entity.id)
                            true
                        },
                    ) {
                        ExploreTypedPin(entity = entity, isActive = active)
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
}

/** Google Maps zoom level that frames a latitude span of [delta] degrees. */
private fun zoomForDelta(delta: Double): Float {
    val safe = delta.coerceAtLeast(0.0005)
    return (ln(360.0 / safe) / ln(2.0)).toFloat().coerceIn(3f, 18f)
}
