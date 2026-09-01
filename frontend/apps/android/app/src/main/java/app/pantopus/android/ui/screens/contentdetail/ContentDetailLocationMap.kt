@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.Circle
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState

/**
 * Mini map for gig/task detail — privacy-aware pin or ~500m circle,
 * tappable to open a full-screen interactive explorer.
 */
@Composable
fun ContentDetailLocationMapSection(
    map: ContentDetailModule.LocationMap,
    renderGoogleMap: Boolean = true,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .testTag("contentDetailLocationMapPreview"),
        horizontalAlignment = Alignment.Start,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .shadow(10.dp, RoundedCornerShape(Radii.lg), clip = false)
                    .clip(RoundedCornerShape(Radii.lg))
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .clickable(enabled = renderGoogleMap) { expanded = true },
        ) {
            LocationMapCanvas(
                map = map,
                interactive = false,
                renderGoogleMap = renderGoogleMap,
                modifier = Modifier.fillMaxSize(),
            )
            if (renderGoogleMap) {
                ExploreChip(
                    modifier =
                        Modifier
                            .align(Alignment.BottomEnd)
                            .padding(Spacing.s3),
                )
            }
        }
        Text(
            text = map.footnote,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.s2),
        )
    }

    if (expanded) {
        LocationMapExpandedDialog(
            map = map,
            renderGoogleMap = renderGoogleMap,
            onDismiss = { expanded = false },
        )
    }
}

@Composable
private fun LocationMapExpandedDialog(
    map: ContentDetailModule.LocationMap,
    renderGoogleMap: Boolean,
    onDismiss: () -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appSurface)
                    .testTag("contentDetailLocationMapExpanded"),
        ) {
            LocationMapCanvas(
                map = map,
                interactive = true,
                renderGoogleMap = renderGoogleMap,
                modifier = Modifier.fillMaxSize(),
            )
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(start = Spacing.s4, top = Spacing.s4)
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.92f))
                        .border(1.dp, PantopusColors.appBorder.copy(alpha = 0.7f), CircleShape)
                        .clickable(onClick = onDismiss)
                        .testTag("contentDetailLocationMapClose"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Close map",
                    size = 16.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appText,
                )
            }
        }
    }
}

@Composable
private fun LocationMapCanvas(
    map: ContentDetailModule.LocationMap,
    interactive: Boolean,
    renderGoogleMap: Boolean,
    modifier: Modifier = Modifier,
) {
    if (!renderGoogleMap) {
        StaticLocationMapPreview(category = map.category, modifier = modifier)
        return
    }

    val coordinate = remember(map.latitude, map.longitude) { LatLng(map.latitude, map.longitude) }
    val zoom = if (map.isApproximate) 13f else 15f
    val cameraState =
        rememberCameraPositionState {
            position = CameraPosition.fromLatLngZoom(coordinate, zoom)
        }
    val uiSettings =
        remember(interactive) {
            MapUiSettings(
                compassEnabled = interactive,
                mapToolbarEnabled = false,
                myLocationButtonEnabled = interactive,
                rotationGesturesEnabled = interactive,
                scrollGesturesEnabled = interactive,
                tiltGesturesEnabled = false,
                zoomControlsEnabled = interactive,
                zoomGesturesEnabled = interactive,
            )
        }

    GoogleMap(
        modifier = modifier,
        cameraPositionState = cameraState,
        properties = MapProperties(isMyLocationEnabled = false),
        uiSettings = uiSettings,
    ) {
        if (map.isApproximate) {
            Circle(
                center = coordinate,
                radius = 500.0,
                fillColor = PantopusColors.primary600.copy(alpha = 0.14f),
                strokeColor = PantopusColors.primary600.copy(alpha = 0.85f),
                strokeWidth = 2f,
            )
        } else {
            val markerState = remember(coordinate) { MarkerState(position = coordinate) }
            MarkerComposable(
                keys = arrayOf<Any>("task"),
                state = markerState,
                anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
            ) {
                TaskMapPin(category = map.category)
            }
        }
    }
}

@Composable
private fun StaticLocationMapPreview(
    category: GigsCategory,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier.background(
                Brush.linearGradient(
                    listOf(PantopusColors.primary50, PantopusColors.appSurfaceSunken),
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        TaskMapPin(category = category)
    }
}

@Composable
private fun TaskMapPin(category: GigsCategory) {
    Box(contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(category.color.copy(alpha = 0.22f)),
        )
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .pantopusShadow(PantopusElevations.sm, CircleShape)
                    .clip(CircleShape)
                    .background(category.color)
                    .border(2.5.dp, Color.White, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MapPin,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 2.4f,
                tint = Color.White,
            )
        }
    }
}

@Composable
private fun ExploreChip(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(Color.White.copy(alpha = 0.92f))
                .border(1.dp, PantopusColors.appBorder.copy(alpha = 0.7f), RoundedCornerShape(Radii.pill))
                .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ExternalLink,
            contentDescription = null,
            size = 12.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appText,
        )
        Text(
            text = "Explore",
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(start = 4.dp),
        )
    }
}
