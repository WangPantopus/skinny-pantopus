@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.host

import android.location.Location
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanRow
import app.pantopus.android.ui.screens.plans.components.PlanRowEnd
import app.pantopus.android.ui.screens.plans.detail.PlanFooter
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.android.gms.maps.model.PointOfInterest
import com.google.maps.android.compose.Circle
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberMarkerState

/**
 * H6's "Pick it on the map": for a public place the list doesn't have, the host taps one of the places Google Maps
 * shows (parks, cafés, restaurants, sports and more). Only a labeled place can be chosen, never a dropped pin, which
 * could land on someone's home: within 3 miles of where the picker looks from (the circle), and not at one of the
 * host's homes (the server refuses that too). As on iOS (PlanPlaceMapPick).
 */
@Composable
internal fun PlaceMapPick(
    kind: PlanKind,
    origin: Pair<Double, Double>,
    homePoints: List<Pair<Double, Double>>,
    onUse: (PickedPlace) -> Unit,
    onClose: () -> Unit,
) {
    BackHandler(onBack = onClose)
    var selected by remember { mutableStateOf<PointOfInterest?>(null) }
    val center = LatLng(origin.first, origin.second)
    val camera = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(center, 14.5f) }
    // Medical, government, worship and school places aren't for plans; a playdate's map shows no businesses (no bars).
    val properties =
        remember(kind) { MapProperties(mapStyleOptions = MapStyleOptions(if (kind == PlanKind.PLAYDATE) PLAYDATE_STYLE else PICK_STYLE)) }
    val settings = remember { MapUiSettings(mapToolbarEnabled = false, myLocationButtonEnabled = false, zoomControlsEnabled = false) }
    val accent = kind.colors.accent
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("planPlaceMapPick")) {
        HostBar(title = "Pick a place", step = null, leadingClose = true, onLeading = onClose, trailingClose = true)
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = camera,
                properties = properties,
                uiSettings = settings,
                onPOIClick = { selected = it },
            ) {
                Circle(
                    center = center,
                    radius = REACH_METERS,
                    strokeColor = accent.copy(alpha = 0.5f),
                    strokeWidth = 4f,
                    fillColor = accent.copy(alpha = 0.06f),
                )
                selected?.let { poi -> Marker(state = rememberMarkerState(key = poi.placeId, position = poi.latLng), title = poiName(poi)) }
            }
        }
        PlanFooter {
            val poi = selected
            if (poi == null) {
                Text(
                    text = "Tap a park, café or other place the map shows, within 3 miles of you.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("planPlaceMapPickHint"),
                )
            } else {
                MapPickCard(kind = kind, poi = poi, meters = metersBetween(center, poi.latLng), homePoints = homePoints, onUse = onUse)
            }
        }
    }
}

/** The tapped place: its name and distance, why it can't be used (too far, or the host's home), and "Use …". */
@Composable
private fun MapPickCard(
    kind: PlanKind,
    poi: PointOfInterest,
    meters: Float,
    homePoints: List<Pair<Double, Double>>,
    onUse: (PickedPlace) -> Unit,
) {
    val name = poiName(poi)
    val problem = mapPickProblem(poi.latLng, meters, homePoints)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanRow(
            title = name,
            subtitle = metersToMiles(meters.toDouble()),
            end = PlanRowEnd.None,
            first = true,
            leading = { PlanIconTile(PantopusIcon.MapPin, kind.colors.tint, kind.colors.accent) },
        )
        if (problem != null) {
            Text(
                text = problem,
                style = PantopusTextStyle.small,
                color = PantopusColors.warning,
                modifier = Modifier.padding(bottom = 4.dp).testTag("planPlaceMapPickProblem"),
            )
        }
        Box(modifier = Modifier.testTag("planPlaceMapPickUse")) {
            HostFooterButton(
                title = "Use $name",
                enabled = problem == null,
                onClick = {
                    onUse(
                        PickedPlace(
                            name = name,
                            address = null,
                            latitude = poi.latLng.latitude,
                            longitude = poi.latLng.longitude,
                            category = null,
                            distanceMeters = meters.toDouble(),
                        ),
                    )
                },
            )
        }
    }
}

/** "Pick on map" on H6's small map, which opens the map pick (the map itself is the button, as on iOS). */
@Composable
internal fun PlaceMapPickChip(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .padding(Spacing.s2)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface.copy(alpha = 0.92f))
                .padding(horizontal = 10.dp, vertical = 6.dp)
                .clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = PantopusIcon.Map, contentDescription = null, size = 14.dp, tint = PantopusColors.appText)
        Text(text = "Pick on map", style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
    }
}

/** "Can't find it? Pick it on the map" under H6's list, also while it loads or when it can't (as on iOS). */
@Composable
internal fun PlaceMapPickRow(onClick: () -> Unit) {
    PlanRow(
        title = "Can't find it? Pick it on the map",
        subtitle = "Tap any park, café or other place the map shows",
        end = PlanRowEnd.Chevron,
        first = false,
        leading = { PlanIconTile(PantopusIcon.Map, PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong) },
        onClick = onClick,
        modifier = Modifier.testTag("planPlacePickOnMap"),
    )
}

/** Google breaks a long place name over lines on the map ("PDX\nConcourse D"); the name reads as one line (as on iOS). */
private fun poiName(poi: PointOfInterest): String = poi.name.lines().joinToString(" ") { it.trim() }.trim().ifEmpty { "This place" }

private fun metersBetween(
    from: LatLng,
    to: LatLng,
): Float {
    val result = FloatArray(1)
    Location.distanceBetween(from.latitude, from.longitude, to.latitude, to.longitude, result)
    return result[0]
}

/** Why the place can't be used, or null: one of the host's homes, or too far to host. */
private fun mapPickProblem(
    spot: LatLng,
    meters: Float,
    homePoints: List<Pair<Double, Double>>,
): String? =
    when {
        homePoints.any { (lat, lng) -> metersBetween(LatLng(lat, lng), spot) <= HOME_GUARD_METERS } ->
            "That's your home. Choose a public place nearby."
        meters > REACH_METERS -> "That's more than 3 miles from you. Choose a place closer by."
        else -> null
    }

/** As far as the list reaches; the server allows hosting within 5 km of a home or a fresh fix. */
private const val REACH_METERS = 3 * 1609.344

/** The server refuses a public place this close to one of the host's homes (planRules.js HOME_GUARD_METERS). */
private const val HOME_GUARD_METERS = 50.0

private const val PICK_STYLE =
    """[{"featureType":"poi.medical","stylers":[{"visibility":"off"}]},""" +
        """{"featureType":"poi.government","stylers":[{"visibility":"off"}]},""" +
        """{"featureType":"poi.place_of_worship","stylers":[{"visibility":"off"}]},""" +
        """{"featureType":"poi.school","stylers":[{"visibility":"off"}]}]"""

private const val PLAYDATE_STYLE =
    """[{"featureType":"poi.medical","stylers":[{"visibility":"off"}]},""" +
        """{"featureType":"poi.government","stylers":[{"visibility":"off"}]},""" +
        """{"featureType":"poi.place_of_worship","stylers":[{"visibility":"off"}]},""" +
        """{"featureType":"poi.school","stylers":[{"visibility":"off"}]},""" +
        """{"featureType":"poi.business","stylers":[{"visibility":"off"}]}]"""
