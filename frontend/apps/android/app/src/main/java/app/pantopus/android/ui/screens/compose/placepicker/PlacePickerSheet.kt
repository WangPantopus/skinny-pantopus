@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.compose.placepicker

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.geo.GeoPlace
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.util.Locale
import kotlin.math.roundToInt

const val PLACE_PICKER_TAG = "placePickerSheet"

/** Runtime prompt payload — fine first, coarse as the graceful fallback. */
private val LOCATION_PERMISSIONS =
    arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )

private val ICON_SM = 16.dp
private val ICON_LG = 24.dp
private val ROW_MIN_HEIGHT = 44.dp
private val ANCHOR_CHIP_MIN_HEIGHT = 32.dp
private val NO_MATCH_CIRCLE = 52.dp
private val HEADER_SPACER_WIDTH = 56.dp
private val HAIRLINE = 1.dp
private val SKELETON_TITLE_WIDTH = 160.dp
private val SKELETON_SUBTITLE_WIDTH = 220.dp
private val SKELETON_LINE_HEIGHT = 14.dp
private const val SKELETON_ROW_COUNT = 3

/** Meters-per-mile / feet-per-meter for the trailing distance label. */
private const val METERS_PER_MILE = 1609.344
private const val FEET_PER_METER = 3.28084
private const val SHORT_DISTANCE_MILES = 0.1

/**
 * Instagram-style venue picker — a searchable bottom sheet opened from the
 * composers' "Add location" row. NEARBY POIs + the enclosing locality from
 * the device fix, plus a proximity-biased search. Chrome mirrors
 * `TimezonePickerSheet`; testTags mirror the iOS accessibility ids 1:1.
 *
 * The runtime location prompt fires here (the `TasksMapScreen` launcher
 * pattern) because `DeviceLocationProvider` only *checks* permission;
 * denial degrades to search-only mode.
 *
 * ADDENDUM 2 — [mediaLocation] is the composer's media capture anchor
 * (where the attached photo/video was taken). Non-null renders the
 * "Photo location" / "Near me" chips, defaults the picker to the photo
 * anchor, and skips the open-time permission prompt (the photo anchor
 * needs no fix; "Near me" prompts on tap instead). PRIVACY: a local
 * anchor input only — it never reaches an outgoing body.
 */
@Composable
fun PlacePickerSheet(
    currentTag: PostPlaceTag?,
    onSelect: (PostPlaceTag) -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    mediaLocation: MediaCaptureLocation? = null,
    viewModel: PlacePickerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val searchOnly by viewModel.searchOnly.collectAsStateWithLifecycle()
    val anchor by viewModel.anchor.collectAsStateWithLifecycle()
    val context = LocalContext.current

    val permissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { results ->
            if (results.values.any { it }) {
                viewModel.load()
            } else {
                viewModel.enterSearchOnlyMode()
            }
        }

    LaunchedEffect(Unit) {
        // The Hilt VM outlives sheet dismissals (it is scoped to the host
        // screen) — refresh the per-presentation inputs on every open:
        // re-seed the media anchor from the CURRENT attachment set (not
        // a value captured at VM construction) and clear any stale
        // query, like iOS's fresh per-presentation view-model.
        viewModel.setMediaLocation(mediaLocation)
        viewModel.onQueryChange("")
        when {
            // Photo anchor needs no device fix — don't prompt for
            // location permission just to open the sheet; the "Near me"
            // chip prompts on tap.
            mediaLocation != null -> viewModel.load()
            hasLocationPermission(context) -> viewModel.load()
            else -> permissionLauncher.launch(LOCATION_PERMISSIONS)
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag(PLACE_PICKER_TAG),
    ) {
        Header(onDone = onDismiss)
        SearchBox(query = query, onQueryChange = viewModel::onQueryChange)
        if (mediaLocation != null) {
            // Rendered only when the media carries a capture location —
            // untagged media keeps today's sheet byte-identical.
            AnchorChips(
                active = anchor,
                onSelect = { selected ->
                    viewModel.selectAnchor(selected)
                    // "Near me" without permission asks now; denial falls
                    // into search-only mode while the photo chip stays live.
                    if (selected == PlacePickerAnchor.Current && !hasLocationPermission(context)) {
                        permissionLauncher.launch(LOCATION_PERMISSIONS)
                    }
                },
            )
        }
        if (currentTag != null) {
            RemoveRow(tagName = currentTag.name, onRemove = onRemove)
        }
        // Header + search + remove row stay pinned; the list area scrolls
        // (nearby POIs + locality can exceed the sheet, especially with
        // the keyboard up) — mirrors the iOS ScrollView structure.
        ListArea(
            state = state,
            query = query,
            searchOnly = searchOnly,
            onSelect = onSelect,
            onRetry = viewModel::retry,
        )
    }
}

/** The scrollable state-driven list body under the pinned chrome. */
@Composable
private fun ColumnScope.ListArea(
    state: PlacePickerUiState,
    query: String,
    searchOnly: Boolean,
    onSelect: (PostPlaceTag) -> Unit,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .weight(1f, fill = false)
                .verticalScroll(rememberScrollState()),
    ) {
        when (val current = state) {
            PlacePickerUiState.Loading -> SkeletonRows()
            is PlacePickerUiState.Loaded ->
                when {
                    searchOnly -> SearchOnlyHint()
                    current.nearby.isEmpty() && current.locality == null -> NoNearbyPlaces()
                    else ->
                        NearbySection(
                            nearby = current.nearby,
                            locality = current.locality,
                            onSelect = onSelect,
                        )
                }
            is PlacePickerUiState.SearchResults ->
                ResultsSection(places = current.places, onSelect = onSelect)
            PlacePickerUiState.Empty -> NoMatch(query = query)
            is PlacePickerUiState.Error ->
                ErrorCard(message = current.message, onRetry = onRetry)
        }
        Spacer(modifier = Modifier.height(Spacing.s6))
    }
}

private fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

@Composable
private fun Header(onDone: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(width = HEADER_SPACER_WIDTH, height = HAIRLINE))
        Text(
            text = "Add location",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "Done",
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier = Modifier.clickable(onClick = onDone),
        )
    }
}

@Composable
private fun SearchBox(
    query: String,
    onQueryChange: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .border(HAIRLINE, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = ICON_SM,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Box(modifier = Modifier.weight(1f)) {
            if (query.isEmpty()) {
                Text(
                    text = "Search for a place",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextMuted,
                )
            }
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                cursorBrush = SolidColor(PantopusColors.primary600),
                textStyle = PantopusTextStyle.small.copy(color = PantopusColors.appText),
                modifier = Modifier.fillMaxWidth().testTag("placePickerSearchField"),
            )
        }
        if (query.isNotEmpty()) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Clear search",
                size = ICON_SM,
                tint = PantopusColors.appTextMuted,
                modifier = Modifier.clickable { onQueryChange("") },
            )
        }
    }
}

/**
 * ADDENDUM 2 — capture-location anchor chips, shown below the search
 * field when the composer's media is geotagged. "Photo location" (the
 * default, Instagram behavior) anchors NEARBY + search proximity on
 * where the media was taken; "Near me" is today's device-fix flow.
 * testTags mirror the iOS ids 1:1.
 */
@Composable
private fun AnchorChips(
    active: PlacePickerAnchor,
    onSelect: (PlacePickerAnchor) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s1),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        AnchorChip(
            label = "Photo location",
            icon = PantopusIcon.Image,
            isActive = active == PlacePickerAnchor.Photo,
            onClick = { onSelect(PlacePickerAnchor.Photo) },
            modifier = Modifier.testTag("placePickerAnchorPhoto"),
        )
        AnchorChip(
            label = "Near me",
            icon = PantopusIcon.Navigation,
            isActive = active == PlacePickerAnchor.Current,
            onClick = { onSelect(PlacePickerAnchor.Current) },
            modifier = Modifier.testTag("placePickerAnchorCurrent"),
        )
    }
}

@Composable
private fun AnchorChip(
    label: String,
    icon: PantopusIcon,
    isActive: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val fg = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong
    val bg = if (isActive) PantopusColors.primary600 else PantopusColors.appSurface
    val border = if (isActive) Color.Transparent else PantopusColors.appBorder
    Row(
        modifier =
            modifier
                .heightIn(min = ANCHOR_CHIP_MIN_HEIGHT)
                .clip(RoundedCornerShape(Radii.pill))
                .background(bg)
                .border(HAIRLINE, border, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = ICON_SM,
            tint = fg,
        )
        Text(
            text = label,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = fg,
        )
    }
}

@Composable
private fun RemoveRow(
    tagName: String,
    onRemove: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .clip(RoundedCornerShape(Radii.lg))
                .border(HAIRLINE, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onRemove)
                .heightIn(min = ROW_MIN_HEIGHT)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("placePickerRemoveRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.X,
            contentDescription = null,
            size = ICON_SM,
            tint = PantopusColors.error,
        )
        Column {
            Text(
                text = "Remove location",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.error,
            )
            Text(
                text = tagName,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(horizontal = Spacing.s5, vertical = Spacing.s2),
    )
}

@Composable
private fun NearbySection(
    nearby: List<GeoPlace>,
    locality: GeoPlace?,
    onSelect: (PostPlaceTag) -> Unit,
) {
    SectionLabel("Nearby")
    PlaceListCard {
        nearby.forEachIndexed { index, place ->
            PlaceRow(
                place = place,
                onClick = { onSelect(PostPlaceTag(place)) },
                modifier = Modifier.testTag("placePickerRow_$index"),
            )
        }
        locality?.let { place ->
            if (nearby.isNotEmpty()) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Spacing.s4)
                            .height(HAIRLINE)
                            .background(PantopusColors.appBorder),
                )
            }
            PlaceRow(
                place = place,
                onClick = { onSelect(PostPlaceTag(place)) },
                modifier = Modifier.testTag("placePickerLocalityRow"),
            )
        }
    }
}

@Composable
private fun ResultsSection(
    places: List<GeoPlace>,
    onSelect: (PostPlaceTag) -> Unit,
) {
    SectionLabel("Results")
    PlaceListCard {
        places.forEachIndexed { index, place ->
            PlaceRow(
                place = place,
                onClick = { onSelect(PostPlaceTag(place)) },
                modifier = Modifier.testTag("placePickerRow_$index"),
            )
        }
    }
}

@Composable
private fun PlaceListCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(HAIRLINE, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        content()
    }
}

@Composable
private fun PlaceRow(
    place: GeoPlace,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .heightIn(min = ROW_MIN_HEIGHT)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MapPin,
            contentDescription = null,
            size = ICON_SM,
            tint = PantopusColors.appTextSecondary,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = place.name,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            // Address first, category fallback, locality full line last —
            // mirrors iOS `secondaryLine(for:)` so the locality row
            // (address=null, category=null) still gets a subtitle.
            val secondary =
                place.address?.takeIf { it.isNotBlank() }
                    ?: place.category?.takeIf { it.isNotBlank() }
                    ?: place.fullAddress?.takeIf { it.isNotBlank() && it != place.name }
            if (!secondary.isNullOrBlank()) {
                Text(
                    text = secondary,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        place.distanceM?.let { meters ->
            Text(
                text = distanceLabel(meters),
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun SkeletonRows() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(HAIRLINE, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("placePickerSkeleton"),
    ) {
        repeat(SKELETON_ROW_COUNT) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Shimmer(width = SKELETON_TITLE_WIDTH, height = SKELETON_LINE_HEIGHT)
                Shimmer(width = SKELETON_SUBTITLE_WIDTH, height = SKELETON_LINE_HEIGHT)
            }
        }
    }
}

/**
 * No device fix — nudge toward the search field instead of an empty
 * NEARBY section. Copy mirrors the iOS `searchOnlyHint`.
 */
@Composable
private fun SearchOnlyHint() {
    Text(
        text = "Turn on location access to see nearby places, or search above.",
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5, vertical = Spacing.s2),
    )
}

/** A fix resolved but Mapbox found nothing — copy mirrors iOS. */
@Composable
private fun NoNearbyPlaces() {
    EmptyStateCard(
        icon = PantopusIcon.MapPin,
        headline = "No places nearby",
        body = "Search for a restaurant, café, or landmark instead.",
    )
}

@Composable
private fun NoMatch(query: String) {
    val trimmed = query.trim()
    EmptyStateCard(
        icon = if (trimmed.isEmpty()) PantopusIcon.MapPin else PantopusIcon.SearchX,
        headline = if (trimmed.isEmpty()) "Search for a place" else "No places match \"$trimmed\"",
        body = "Try a business, landmark, or city name.",
    )
}

@Composable
private fun EmptyStateCard(
    icon: PantopusIcon,
    headline: String,
    body: String,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(NO_MATCH_CIRCLE).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = icon,
                contentDescription = null,
                size = ICON_LG,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = headline,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text = body,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ErrorCard(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = message,
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Retry",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                    .testTag("placePickerRetry"),
        )
    }
}

/** "450 ft" under a tenth of a mile, "0.4 mi" above — US-market copy. */
internal fun distanceLabel(meters: Double): String {
    val miles = meters / METERS_PER_MILE
    return if (miles < SHORT_DISTANCE_MILES) {
        "${(meters * FEET_PER_METER).roundToInt()} ft"
    } else {
        String.format(Locale.US, "%.1f mi", miles)
    }
}
