@file:Suppress("MagicNumber", "LongMethod", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.plans.host

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.R
import app.pantopus.android.data.api.models.plans.PlanNearbyPlaceDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.components.PlanAreaGlow
import app.pantopus.android.ui.screens.plans.components.PlanAvatar
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanRow
import app.pantopus.android.ui.screens.plans.components.PlanRowEnd
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTile
import app.pantopus.android.ui.screens.plans.components.PlanTypeTag
import app.pantopus.android.ui.screens.plans.components.PlanVerifiedBadge
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PlanAreaPreviewMap
import app.pantopus.android.ui.screens.plans.map.PlanRowsSkeleton
import app.pantopus.android.ui.screens.plans.map.planH3
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberMarkerState

/** H6: choose a public place (or "You're here now" for a pickup game, or your place where it's allowed). */
@Composable
internal fun PlacePickerStep(
    ui: HostUi,
    vm: HostFlowViewModel,
) {
    val kind = ui.draft.kind ?: PlanKind.PICKUP_GAME
    PublicPlacePicker(
        state =
            PlacePickerState(
                kind = kind,
                candidate = ui.placeCandidate,
                query = ui.placesQuery,
                places = ui.places,
                loading = ui.placesLoading,
                attribution = ui.placesAttribution,
                origin = ui.origin,
                error = ui.error,
            ),
        onClose = vm::closePlaces,
        onUse = vm::usePlace,
        onSearch = vm::searchPlaces,
        onPick = vm::pickPlaceCandidate,
        onHereNow = if (kind == PlanKind.PICKUP_GAME) vm::pickHereNow else null,
        homeRow =
            if (kind != PlanKind.PICKUP_GAME) {
                { first ->
                    HomeRow(kind = kind, home = ui.home, first = first) {
                        vm.setAtHome(true)
                        vm.closePlaces()
                    }
                }
            } else {
                null
            },
    )
}

/** What H6's list and map show: the host flow's, or H11's when a public plan moves. */
internal data class PlacePickerState(
    val kind: PlanKind,
    val candidate: PickedPlace?,
    val query: String,
    val places: List<PlanNearbyPlaceDto>,
    val loading: Boolean,
    val attribution: String?,
    val origin: Pair<Double, Double>?,
    val error: String?,
)

/**
 * H6's picker: search, a small map, the public places near you, then "Use …". [onHereNow] adds "You're here now"
 * (pickup games); [homeRow] adds "My place" after the places (the host flow only).
 */
@Composable
internal fun PublicPlacePicker(
    state: PlacePickerState,
    onClose: () -> Unit,
    onUse: () -> Unit,
    onSearch: (String) -> Unit,
    onPick: (PickedPlace) -> Unit,
    onHereNow: (() -> Unit)? = null,
    homeRow: (@Composable (first: Boolean) -> Unit)? = null,
) {
    val kind = state.kind
    val candidate = state.candidate
    val query = state.query.trim()
    val places =
        remember(state.places, query) {
            state.places.filter { query.isEmpty() || it.name.orEmpty().contains(query, ignoreCase = true) }
        }
    HostStepScaffold(
        title = "Where?",
        step = null,
        leadingClose = true,
        onLeading = onClose,
        trailingClose = true,
        footer = {
            state.error?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error) }
            HostFooterButton(title = candidate?.let { "Use ${it.name}" } ?: "Choose a place", onClick = onUse)
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            PlanTextArea(
                value = state.query,
                onValue = onSearch,
                placeholder = "Search parks, courts, cafés",
                label = "Search places",
                singleLine = true,
            )
            PickerMap(origin = state.origin, picked = candidate, kind = kind)
            Column {
                PlanOverline("Public places near you", modifier = Modifier.padding(bottom = 2.dp))
                var first = true
                if (onHereNow != null) {
                    val here = candidate?.name == "Where I am now"
                    PlanRow(
                        title = "You're here now",
                        subtitle = "The pin shows the area, never your exact spot",
                        end = if (here) PlanRowEnd.Check else PlanRowEnd.None,
                        first = true,
                        leading = { PlanIconTile(PantopusIcon.Navigation, PantopusColors.primary100, PantopusColors.primary700) },
                        spoken = "You're here now${if (here) ", selected" else ""}",
                        onClick = onHereNow,
                    )
                    first = false
                }
                when {
                    state.loading && places.isEmpty() -> PlanRowsSkeleton(rows = 3)
                    places.isEmpty() ->
                        Text(
                            text =
                                if (query.isEmpty()) {
                                    "No public places found nearby. Search for one."
                                } else {
                                    "No places match “$query”."
                                },
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                            modifier = Modifier.padding(vertical = Spacing.s3),
                        )
                    else ->
                        places.forEach { place ->
                            val picked = place.toPicked() ?: return@forEach
                            val selected = candidate?.name == picked.name && candidate.latitude == picked.latitude
                            PlanRow(
                                title = picked.name,
                                subtitle = placeRowCaption(picked),
                                end = if (selected) PlanRowEnd.Check else PlanRowEnd.None,
                                first = first,
                                leading = {
                                    if (selected) {
                                        PlanTile(kind)
                                    } else {
                                        PlanIconTile(iconFor(place.category), PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong)
                                    }
                                },
                                spoken = "${picked.name}, ${placeRowCaption(picked)}${if (selected) ", selected" else ""}",
                                onClick = { onPick(picked) },
                            )
                            first = false
                        }
                }
                state.attribution?.takeIf { places.isNotEmpty() }?.let { credit ->
                    Text(
                        text = "Places $credit",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(top = Spacing.s1, bottom = Spacing.s2),
                    )
                }
                homeRow?.invoke(first)
            }
            Text(
                text = "You can host within 3 miles of where you live or where you are now.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

/** "My place" / "My porch" under H6's places: only where hosting at home is allowed (never playdates). */
@Composable
private fun HomeRow(
    kind: PlanKind,
    home: HostHome?,
    first: Boolean,
    onUseHome: () -> Unit,
) {
    val homeAllowed = kind != PlanKind.PLAYDATE && home != null
    Box(modifier = Modifier.alpha(if (homeAllowed) 1f else 0.5f)) {
        PlanRow(
            title = if (kind == PlanKind.WALK_COFFEE) "My porch" else "My place",
            subtitle =
                when {
                    kind == PlanKind.PLAYDATE -> "Not for playdates: they meet in public places"
                    home == null -> "Add your home to host there"
                    else -> "Only people you accept see the address"
                },
            end = PlanRowEnd.None,
            first = first,
            leading = { PlanIconTile(PantopusIcon.Home, PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong) },
            onClick = if (homeAllowed) onUseHome else null,
        )
    }
}

private fun PlanNearbyPlaceDto.toPicked(): PickedPlace? {
    val lat = center?.lat ?: latitude ?: return null
    val lng = center?.lng ?: longitude ?: return null
    return PickedPlace(
        name = name ?: return null,
        address = address ?: fullAddress,
        latitude = lat,
        longitude = lng,
        category = category?.split(',')?.firstOrNull()?.trim(),
        distanceMeters = distanceMeters,
        categories = categories.orEmpty().ifEmpty { listOfNotNull(category) },
    )
}

private fun iconFor(category: String?): PantopusIcon {
    val c = category.orEmpty().lowercase()
    return when {
        "park" in c || "playground" in c -> PantopusIcon.Trees
        "café" in c || "cafe" in c || "coffee" in c -> PantopusIcon.Coffee
        "court" in c || "sport" in c || "field" in c -> PantopusIcon.Ball
        "librar" in c -> PantopusIcon.Building2
        else -> PantopusIcon.MapPin
    }
}

/** H6's small map: the place you picked, as a pin, near where you are. */
@Composable
private fun PickerMap(
    origin: Pair<Double, Double>?,
    picked: PickedPlace?,
    kind: PlanKind,
) {
    origin ?: return
    val center = picked?.let { LatLng(it.latitude, it.longitude) } ?: LatLng(origin.first, origin.second)
    val camera = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(center, 14.5f) }
    LaunchedEffect(center) { camera.position = CameraPosition.fromLatLngZoom(center, 14.5f) }
    val context = LocalContext.current
    val properties =
        remember(context) { MapProperties(mapStyleOptions = MapStyleOptions.loadRawResourceStyle(context, R.raw.nearby_map_style)) }
    val settings =
        remember {
            MapUiSettings(
                compassEnabled = false,
                mapToolbarEnabled = false,
                myLocationButtonEnabled = false,
                scrollGesturesEnabled = false,
                zoomGesturesEnabled = false,
                rotationGesturesEnabled = false,
                tiltGesturesEnabled = false,
                zoomControlsEnabled = false,
            )
        }
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(150.dp)
                .clip(RoundedCornerShape(Radii.xl))
                .clearAndSetSemantics {},
    ) {
        GoogleMap(modifier = Modifier.fillMaxSize(), cameraPositionState = camera, properties = properties, uiSettings = settings) {
            if (picked != null) {
                val state =
                    rememberMarkerState(
                        key = "${picked.latitude},${picked.longitude}",
                        position = LatLng(picked.latitude, picked.longitude),
                    )
                Marker(state = state, title = picked.name)
            }
        }
        if (picked != null) {
            PlanAreaGlow(
                color = kind.colors.accent,
                radiusPx = 120f,
                modifier = Modifier.align(Alignment.Center).fillMaxSize(),
            )
        }
    }
}

/** H7: what neighbors see, and what only the people you accept see. */
@Composable
internal fun HostPreviewStep(
    ui: HostUi,
    onBack: () -> Unit,
    onPost: () -> Unit,
) {
    val draft = ui.draft
    val kind = draft.kind ?: return
    HostStepScaffold(
        title = "Preview",
        step = "3 of 3",
        leadingClose = false,
        onLeading = onBack,
        footer = {
            ui.error?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error) }
            HostFooterButton(title = "Post plan", onClick = onPost, loading = ui.posting)
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            PlanOverline("What neighbors see")
            NeighborsCard(ui, kind)
            PlanOverline(
                if (kind == PlanKind.PLAYDATE) "Families you accept also see" else "People you accept also see",
                modifier = Modifier.padding(top = Spacing.s1),
            )
            PlanFormCard {
                PlanOptionRow(first = true) {
                    PantopusIconImage(
                        icon = if (draft.atHome) PantopusIcon.Home else PantopusIcon.MapPin,
                        contentDescription = null,
                        size = 18.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = if (draft.atHome) "Your address" else "The exact spot: ${draft.place?.name ?: "your place"}",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                }
                if (draft.note.isNotBlank()) {
                    PlanOptionRow {
                        PantopusIconImage(
                            icon = PantopusIcon.Lock,
                            contentDescription = null,
                            size = 18.dp,
                            tint = PantopusColors.appTextSecondary,
                        )
                        Text(
                            text = "Your note: “${draft.note.trim()}”",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appText,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                // A playdate's exact time is its own row, as on iOS (neighbors see only the part of the day).
                if (kind == PlanKind.PLAYDATE) {
                    PlanOptionRow {
                        PantopusIconImage(
                            icon = PantopusIcon.Clock,
                            contentDescription = null,
                            size = 18.dp,
                            tint = PantopusColors.appTextSecondary,
                        )
                        Text(
                            text = "The exact time",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appText,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                PlanOptionRow {
                    PantopusIconImage(
                        icon = PantopusIcon.Users,
                        contentDescription = null,
                        size = 18.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = "Who's going, and the group chat",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appText,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            Text(
                text =
                    "You can change or cancel it any time. If you move the time or the place, everyone who's in is asked " +
                        "“Still coming?”",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun NeighborsCard(
    ui: HostUi,
    kind: PlanKind,
) {
    val draft = ui.draft
    val start = draft.start
    val end = draft.end
    val whenText =
        when {
            start == null -> ""
            // As neighbors will see it, with Today/Tomorrow (as on iOS).
            kind == PlanKind.PLAYDATE -> PlanFormat.dayPartPhrase(start.atZone(ui.zone))
            else -> PlanFormat.whenLine(start.atZone(ui.zone), end?.atZone(ui.zone))
        }
    // The place's city once looked up (as on iOS); a plan at home can use the home's city meanwhile.
    val near = ui.previewArea ?: ui.home?.city?.takeIf { draft.atHome }?.let { "Near $it" }
    val point = previewPoint(ui)
    Column(modifier = Modifier.fillMaxWidth().planCard()) {
        Box(modifier = Modifier.fillMaxWidth().height(120.dp).background(PantopusColors.appSurfaceSunken)) {
            if (point != null) {
                PlanAreaPreviewMap(center = point, kind = kind, modifier = Modifier.fillMaxSize())
            } else {
                PlanAreaGlow(color = kind.colors.accent, radiusPx = 180f, modifier = Modifier.fillMaxSize())
            }
        }
        Column(
            modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, top = 14.dp, bottom = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PlanTypeTag(kind)
            Text(text = draft.title.ifBlank { kind.label }, style = planH3, color = PantopusColors.appText)
            Text(
                text = listOfNotNull(whenText, near).filter(String::isNotBlank).joinToString(" · "),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PlanAvatar(name = ui.hostName, avatarUrl = ui.hostAvatar, size = 30.dp)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = ui.hostName,
                        style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    // Neighbors see the badge when the host's address is verified (board H7).
                    if (ui.canHostPlaydates) PlanVerifiedBadge(text = "Verified")
                    Text(
                        text = "· ${draft.spots} ${if (kind == PlanKind.PLAYDATE) "families" else "spots"}",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appText,
                    )
                }
            }
        }
    }
}

/** Where the preview map centers: the picked place, or the home for a plan at home (the host's own preview only). */
private fun previewPoint(ui: HostUi): LatLng? =
    if (ui.draft.atHome) {
        val lat = ui.home?.latitude
        val lng = ui.home?.longitude
        if (lat != null && lng != null) LatLng(lat, lng) else null
    } else {
        ui.draft.place?.let { LatLng(it.latitude, it.longitude) }
    }
