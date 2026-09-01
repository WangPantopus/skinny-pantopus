@file:Suppress("MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.location.SetViewingLocationRequest
import app.pantopus.android.data.api.models.location.ViewingLocationDto
import app.pantopus.android.data.api.models.location.ViewingLocationPayload
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.location.ViewingLocationRepository
import app.pantopus.android.data.saved_places.SavedPlacesRepository
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The Nearby feed's viewing-location switcher. RN renders this as
 * `ContextBar` above the topic row (`FeedScreen.tsx:151-155`) and opens
 * `ContextSheet` on tap, which lists the viewer's homes, saved places
 * and recent locations plus a radius picker.
 *
 * Backend: `GET /api/location` (`backend/routes/location.js:89`),
 * `PUT /api/location` (`backend/routes/location.js:149`),
 * `PUT /api/location/radius` (`backend/routes/location.js:268`),
 * `GET /api/saved-places` (`backend/routes/savedPlaces.js:8`).
 */

/** Which list a switcher row came from. */
enum class FeedLocationKind(
    /** `type` value accepted by `setLocationSchema`. */
    val backendType: String,
    val icon: PantopusIcon,
    val sectionTitle: String,
) {
    Home("home", PantopusIcon.Home, "Your homes"),
    SavedPlace("searched", PantopusIcon.Bookmark, "Saved places"),
    Recent("recent", PantopusIcon.History, "Recent"),
}

/** One selectable place in the switcher sheet. */
data class FeedLocationOption(
    val id: String,
    val kind: FeedLocationKind,
    val label: String,
    val subtitle: String?,
    val latitude: Double,
    val longitude: Double,
    /** Backend row id echoed back as `sourceId`. */
    val sourceId: String?,
    val city: String?,
    val state: String?,
)

/** Render state for the switcher sheet. */
sealed interface FeedLocationSwitcherUiState {
    data object Loading : FeedLocationSwitcherUiState

    data class Loaded(val options: List<FeedLocationOption>) : FeedLocationSwitcherUiState

    data object Empty : FeedLocationSwitcherUiState

    data class Error(val message: String) : FeedLocationSwitcherUiState
}

/**
 * Loads the viewing location + its switcher sources, and writes the
 * user's pick back to `/api/location`.
 */
@HiltViewModel
class FeedContextBarViewModel
    @Inject
    constructor(
        private val repo: ViewingLocationRepository,
        private val savedPlaces: SavedPlacesRepository,
    ) : ViewModel() {
        private val _locationLabel = MutableStateFlow<String?>(null)

        /** Label rendered on the collapsed bar. `null` shows "Set an area". */
        val locationLabel: StateFlow<String?> = _locationLabel.asStateFlow()

        private val _radiusMiles = MutableStateFlow(100.0)

        /** Active radius in miles. RN's default is 100. */
        val radiusMiles: StateFlow<Double> = _radiusMiles.asStateFlow()

        private val _sheetState =
            MutableStateFlow<FeedLocationSwitcherUiState>(FeedLocationSwitcherUiState.Loading)
        val sheetState: StateFlow<FeedLocationSwitcherUiState> = _sheetState.asStateFlow()

        private val _isSheetOpen = MutableStateFlow(false)
        val isSheetOpen: StateFlow<Boolean> = _isSheetOpen.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        /** Raised after a successful switch so the feed refetches. */
        var onChange: () -> Unit = {}

        /** Read the active viewing location for the collapsed bar. */
        fun load() {
            viewModelScope.launch {
                val result = repo.current()
                applyCurrent((result as? NetworkResult.Success)?.data?.viewingLocation)
            }
        }

        /** Open the switcher and (re)load its three source lists. */
        fun openSwitcher() {
            _isSheetOpen.value = true
            _sheetState.value = FeedLocationSwitcherUiState.Loading
            viewModelScope.launch {
                when (val result = repo.current()) {
                    is NetworkResult.Failure ->
                        _sheetState.value = FeedLocationSwitcherUiState.Error(result.error.message)
                    is NetworkResult.Success -> {
                        applyCurrent(result.data.viewingLocation)
                        // Saved places live on their own route; a failure
                        // there just drops that section.
                        val saved =
                            (savedPlaces.list() as? NetworkResult.Success)
                                ?.data
                                ?.savedPlaces
                                .orEmpty()
                        val options = buildOptions(result.data, saved)
                        _sheetState.value =
                            if (options.isEmpty()) {
                                FeedLocationSwitcherUiState.Empty
                            } else {
                                FeedLocationSwitcherUiState.Loaded(options)
                            }
                    }
                }
            }
        }

        fun closeSwitcher() {
            _isSheetOpen.value = false
        }

        fun dismissToast() {
            _toast.value = null
        }

        /** Write the pick to `PUT /api/location` and refresh the feed. */
        fun select(option: FeedLocationOption) {
            viewModelScope.launch {
                val request =
                    SetViewingLocationRequest(
                        type = option.kind.backendType,
                        label = option.label,
                        latitude = option.latitude,
                        longitude = option.longitude,
                        radiusMiles = _radiusMiles.value,
                        isPinned = false,
                        sourceId = option.sourceId,
                        city = option.city,
                        state = option.state,
                    )
                when (val result = repo.set(request)) {
                    is NetworkResult.Success -> {
                        applyCurrent(result.data.viewingLocation)
                        if (result.data.viewingLocation == null) _locationLabel.value = option.label
                        _isSheetOpen.value = false
                        onChange()
                    }
                    is NetworkResult.Failure -> _toast.value = result.error.message
                }
            }
        }

        /**
         * Apply a radius the suggestion banner proposed.
         * `PUT /api/location/radius` 404s when nothing is set yet —
         * treated as a soft failure so the banner just goes away.
         */
        fun applyRadius(
            miles: Double,
            onApplied: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                when (val result = repo.setRadius(miles)) {
                    is NetworkResult.Success -> {
                        _radiusMiles.value = result.data.radiusMiles ?: miles
                        onChange()
                        onApplied(true)
                    }
                    is NetworkResult.Failure -> {
                        _toast.value = result.error.message
                        onApplied(false)
                    }
                }
            }
        }

        private fun applyCurrent(dto: ViewingLocationDto?) {
            if (dto == null) return
            _locationLabel.value = dto.label
            dto.radiusMiles?.let { _radiusMiles.value = it }
        }

        /**
         * Flatten the three sources into one ordered option list — homes,
         * then saved places, then recents (RN `ContextSheet` order).
         */
        private fun buildOptions(
            payload: ViewingLocationPayload,
            saved: List<SavedPlaceDto>,
        ): List<FeedLocationOption> {
            val options = mutableListOf<FeedLocationOption>()
            payload.homes.forEach { home ->
                val lat = home.latitude ?: return@forEach
                val lon = home.longitude ?: return@forEach
                options +=
                    FeedLocationOption(
                        id = "home-${home.id}",
                        kind = FeedLocationKind.Home,
                        label = home.name ?: "Home",
                        subtitle = locality(home.city, home.state),
                        latitude = lat,
                        longitude = lon,
                        sourceId = home.id,
                        city = home.city,
                        state = home.state,
                    )
            }
            saved.forEach { place ->
                options +=
                    FeedLocationOption(
                        id = "saved-${place.id}",
                        kind = FeedLocationKind.SavedPlace,
                        label = place.label,
                        subtitle = locality(place.city, place.state),
                        latitude = place.latitude,
                        longitude = place.longitude,
                        sourceId = place.id,
                        city = place.city,
                        state = place.state,
                    )
            }
            payload.recentLocations.forEach { recent ->
                options +=
                    FeedLocationOption(
                        id = "recent-${recent.id}",
                        kind = FeedLocationKind.Recent,
                        label = recent.label,
                        subtitle = locality(recent.city, recent.state),
                        latitude = recent.latitude,
                        longitude = recent.longitude,
                        sourceId = recent.sourceId,
                        city = recent.city,
                        state = recent.state,
                    )
            }
            return options
        }

        private fun locality(
            city: String?,
            state: String?,
        ): String? = listOfNotNull(city, state).filter { it.isNotBlank() }.joinToString(", ").ifBlank { null }
    }

/** Tappable pill above the Nearby feed showing the active area. */
@Composable
fun FeedContextBar(
    label: String?,
    radiusMiles: Double,
    onOpen: () -> Unit,
) {
    val areaDescription = "Viewing ${label ?: "no area yet"}. Change area"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                // `horizontal` and `top` belong to different padding overloads
                // and cannot be mixed in one call.
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s2)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable { onOpen() }
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .semantics {
                    contentDescription = areaDescription
                }.testTag("pulseContextBar"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MapPin,
            contentDescription = null,
            size = 17.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = label ?: "Set an area",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = FeedRadiusSuggestion.formatRadius(radiusMiles),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s2, vertical = 2.dp),
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

/**
 * Home / saved-place / recent picker. Four render states per the
 * project's state rule.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedLocationSwitcherSheet(
    state: FeedLocationSwitcherUiState,
    activeLabel: String?,
    onSelect: (FeedLocationOption) -> Unit,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                    .testTag("pulseLocationSwitcherSheet"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Viewing area",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            when (state) {
                FeedLocationSwitcherUiState.Loading ->
                    Column(
                        modifier = Modifier.testTag("pulseLocationSwitcherSkeleton"),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        repeat(4) { Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.md) }
                    }
                FeedLocationSwitcherUiState.Empty ->
                    EmptyState(
                        icon = PantopusIcon.MapPinOff,
                        headline = "No places to switch to",
                        subcopy = "Add a home or save a place and it will show up here.",
                        modifier = Modifier.testTag("pulseLocationSwitcherEmpty"),
                    )
                is FeedLocationSwitcherUiState.Error ->
                    EmptyState(
                        icon = PantopusIcon.AlertCircle,
                        headline = "Couldn't load your places",
                        subcopy = state.message,
                        modifier = Modifier.testTag("pulseLocationSwitcherError"),
                        ctaTitle = "Try again",
                        onCta = onRetry,
                    )
                is FeedLocationSwitcherUiState.Loaded ->
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().testTag("pulseLocationSwitcherList"),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        FeedLocationKind.entries.forEach { kind ->
                            val rows = state.options.filter { it.kind == kind }
                            if (rows.isEmpty()) return@forEach
                            item(key = "section-${kind.name}") {
                                Text(
                                    text = kind.sectionTitle,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PantopusColors.appTextSecondary,
                                    modifier = Modifier.padding(top = Spacing.s2),
                                )
                            }
                            items(rows, key = { it.id }) { option ->
                                SwitcherRow(
                                    option = option,
                                    isActive = activeLabel == option.label,
                                    onSelect = onSelect,
                                )
                            }
                        }
                    }
            }
        }
    }
}

@Composable
private fun SwitcherRow(
    option: FeedLocationOption,
    isActive: Boolean,
    onSelect: (FeedLocationOption) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .clickable { onSelect(option) }
                .padding(vertical = Spacing.s2)
                .testTag("pulseLocationOption_${option.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = option.kind.icon,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.primary600,
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = option.label,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            option.subtitle?.let {
                Text(text = it, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
            }
        }
        if (isActive) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 17.dp,
                tint = PantopusColors.success,
            )
        }
    }
}
