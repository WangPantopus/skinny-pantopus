@file:Suppress("MagicNumber", "LongMethod", "CyclomaticComplexMethod", "LongParameterList")

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.R
import app.pantopus.android.data.api.models.plans.PlanNearbyPlaceDto
import app.pantopus.android.data.api.models.plans.PlanPlaceSuggestionsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanPlaceQuery
import app.pantopus.android.data.plans.planMessage
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
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
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
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * H6: choose a public place (or "You're here now" for a pickup game, or your place where it's allowed). Pickup games
 * and study groups never offer "My place".
 */
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
                hereNow = ui.hereNow,
                gathering = ui.placesGathering,
                placesError = ui.placesError,
                suggestions = ui.suggestions,
            ),
        onClose = vm::closePlaces,
        onUse = vm::usePlace,
        onSearch = vm::searchPlaces,
        onPick = vm::pickPlaceCandidate,
        onRetry = vm::retryPlaces,
        onSuggest = vm::suggestPlaces,
        onHereNow = if (kind == PlanKind.PICKUP_GAME) vm::pickHereNow else null,
        homeRow =
            if (kind != PlanKind.PICKUP_GAME && kind != PlanKind.STUDY_GROUP) {
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
    val hereNow: HereNowState = HereNowState.Idle,
    /** The server is still gathering this area's places (a first look can take up to a minute). */
    val gathering: Boolean = false,
    /** Why the places couldn't load, shown with "Try again". */
    val placesError: String? = null,
    val suggestions: PlaceSuggestions = PlaceSuggestions.Idle,
)

/**
 * H6's "Suggest places" (and "Ask Pantopus" for what the host typed in the search box), as iOS's
 * PlanPlaceSuggestions: Pantopus picks up to three of the public places near the host, each with why.
 */
sealed interface PlaceSuggestions {
    data object Idle : PlaceSuggestions

    /** [gathering]: the area's places are still on their way. */
    data class Loading(
        val gathering: Boolean,
    ) : PlaceSuggestions

    data class Loaded(
        val picks: List<PlanNearbyPlaceDto>,
        val fromAi: Boolean,
    ) : PlaceSuggestions

    data class Empty(
        val line: String,
    ) : PlaceSuggestions

    data class Failed(
        val line: String,
    ) : PlaceSuggestions

    companion object {
        /** What a finished "Suggest places" read shows. */
        fun from(
            result: NetworkResult<PlanPlaceSuggestionsResponse>,
            ask: String?,
        ): PlaceSuggestions =
            when (result) {
                is NetworkResult.Success ->
                    when {
                        result.data.loading -> Failed(PLACES_SLOW)
                        result.data.picks.isEmpty() ->
                            Empty(
                                ask?.let { "Nothing nearby fits “$it”. Try other words, or pick from the list." }
                                    ?: "Nothing nearby fits this plan. Pick from the list below.",
                            )
                        else -> Loaded(result.data.picks, fromAi = result.data.source == "ai")
                    }
                is NetworkResult.Failure ->
                    Failed(
                        when {
                            result.error.code == HTTP_TOO_MANY -> result.error.planMessage
                            result.error is NetworkError.Server -> PLACES_UNAVAILABLE
                            else -> "Couldn't get suggestions. Check your connection and try again."
                        },
                    )
            }
    }
}

internal const val PLACES_SLOW = "Places near you are taking longer than usual to load. Try again in a minute."
internal const val PLACES_UNAVAILABLE = "Places near you aren't loading right now. Try again in a minute."
private const val HTTP_TOO_MANY = 429

/** The server's "unavailable" (its map servers failed just now), offline, or anything else (as on iOS). */
internal fun placesFailure(error: NetworkError): String =
    when (error) {
        is NetworkError.Server -> PLACES_UNAVAILABLE
        is NetworkError.Transport -> "Couldn't load places. Check your connection and try again."
        else -> error.planMessage
    }

/**
 * What H6's list is for: the plan's kind, a pickup game's sport, and its time, as the server reads them
 * ([PlanPlaceQuery]).
 */
internal fun placeQuery(
    kind: PlanKind,
    sport: String?,
    start: LocalDateTime,
    end: LocalDateTime?,
    zone: ZoneId,
): PlanPlaceQuery =
    PlanPlaceQuery(
        kind = kind.wire,
        sport = sport.takeIf { kind == PlanKind.PICKUP_GAME },
        startsAt = start.atZone(zone).toInstant().toString(),
        endsAt = (end ?: start.plusHours(1)).atZone(zone).toInstant().toString(),
    )

/**
 * H6's picker: search, a small map, "Suggest places", the public places near you, then "Use …". [onHereNow] adds
 * "You're here now" (pickup games): it finds the public place the host is at, and once found the row names it, as
 * board H4 does ("City courts / You're here now"); [homeRow] adds "My place" after the places (the host flow only);
 * [onSuggest] asks Pantopus for places that suit the plan (with the search text when the host asked from there).
 */
@Composable
internal fun PublicPlacePicker(
    state: PlacePickerState,
    onClose: () -> Unit,
    onUse: () -> Unit,
    onSearch: (String) -> Unit,
    onPick: (PickedPlace) -> Unit,
    onRetry: () -> Unit = {},
    onSuggest: ((ask: String?) -> Unit)? = null,
    onHereNow: (() -> Unit)? = null,
    homeRow: (@Composable (first: Boolean) -> Unit)? = null,
) {
    val kind = state.kind
    val candidate = state.candidate
    val query = state.query.trim()
    val searching = query.length >= 2
    // By name or kind of place, as the server's search reads `q` (so "cafe" keeps the cafés it found).
    val places =
        remember(state.places, query, kind) {
            orderedForKind(
                state.places.filter {
                    query.isEmpty() ||
                        it.name.orEmpty().contains(query, ignoreCase = true) ||
                        it.category.orEmpty().contains(query, ignoreCase = true)
                },
                kind,
            )
        }
    HostStepScaffold(
        title = "Where?",
        step = null,
        leadingClose = true,
        onLeading = onClose,
        trailingClose = true,
        footer = {
            state.error?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error) }
            // Greyed out until a place is picked, as on iOS.
            HostFooterButton(
                title = candidate?.let { "Use ${it.name}" } ?: "Choose a place",
                onClick = onUse,
                enabled = candidate != null,
            )
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            PlanTextArea(
                value = state.query,
                onValue = onSearch,
                placeholder = if (kind == PlanKind.STUDY_GROUP) "Search libraries, cafés" else "Search parks, courts, cafés",
                label = "Search places",
                singleLine = true,
            )
            PickerMap(origin = state.origin, picked = candidate, kind = kind)
            if (onSuggest != null) {
                // "Suggest places" once the list is in; from the search box, "Ask Pantopus" once the search is in and
                // the words name no place ("big screens and food", as on iOS).
                val ask = query.take(ASK_MAX).takeIf { searching }
                val listIn = !state.loading && state.placesError == null
                val namesAPlace = places.any { it.name.orEmpty().contains(query, ignoreCase = true) }
                val shows = if (searching) listIn && !namesAPlace else listIn && places.isNotEmpty()
                if (shows) {
                    PlaceSuggestionsSection(state = state, ask = ask, onSuggest = { onSuggest(ask) }, onPick = onPick)
                }
            }
            Column {
                PlanOverline(if (searching) "Results" else "Public places near you", modifier = Modifier.padding(bottom = 2.dp))
                var first = true
                if (onHereNow != null) {
                    val found = candidate?.takeIf { it.hereNow }
                    val line =
                        when {
                            found != null -> "You're here now"
                            state.hereNow == HereNowState.Locating -> "Finding where you are…"
                            state.hereNow == HereNowState.NoPlace -> "No public place right here. Pick one below."
                            state.hereNow == HereNowState.NoLocation -> "Turn on location to use where you are."
                            else -> "Use the park or court you're at"
                        }
                    PlanRow(
                        title = found?.name ?: "You're here now",
                        subtitle = line,
                        end = if (found != null) PlanRowEnd.Check else PlanRowEnd.None,
                        first = true,
                        leading = { PlanIconTile(PantopusIcon.Navigation, PantopusColors.primary100, PantopusColors.primary700) },
                        spoken = "${found?.name ?: "You're here now"}, $line${if (found != null) ", selected" else ""}",
                        onClick = onHereNow.takeIf { state.hereNow != HereNowState.Locating },
                    )
                    first = false
                }
                when {
                    state.loading && places.isEmpty() -> {
                        PlanRowsSkeleton(rows = 3)
                        if (state.gathering) {
                            Text(
                                text = "Gathering the public places near you. The first look at an area can take up to a minute.",
                                style = PantopusTextStyle.small.copy(fontSize = 13.sp),
                                color = PantopusColors.appTextSecondary,
                                modifier = Modifier.padding(top = Spacing.s1).testTag("planPlaceGathering"),
                            )
                        }
                    }
                    state.placesError != null && places.isEmpty() ->
                        Column(
                            modifier = Modifier.padding(vertical = Spacing.s3),
                            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                        ) {
                            Text(
                                text = state.placesError,
                                style = PantopusTextStyle.small,
                                color = PantopusColors.appTextSecondary,
                                modifier = Modifier.testTag("planPlaceError"),
                            )
                            PlanTonalButton(title = "Try again", onClick = onRetry, modifier = Modifier.testTag("planPlaceRetry"))
                        }
                    places.isEmpty() ->
                        Text(
                            text =
                                if (query.isEmpty()) {
                                    "No public places are on the map within 3 miles of you yet."
                                } else {
                                    "No public places match “$query” within 3 miles."
                                },
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                            modifier = Modifier.padding(vertical = Spacing.s3),
                        )
                    else ->
                        places.forEach { place ->
                            val picked = place.toPicked() ?: return@forEach
                            PlaceRow(place = place, picked = picked, kind = kind, candidate = candidate, first = first, onPick = onPick)
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

/**
 * One public place: its kind and distance, then what matters for the plan's time ("Open until 11 PM · Outdoor
 * seating", or "Closes at 2 PM" in amber), and for a suggestion why it suits the plan (as iOS's PlanPlaceRow).
 */
@Composable
private fun PlaceRow(
    place: PlanNearbyPlaceDto,
    picked: PickedPlace,
    kind: PlanKind,
    candidate: PickedPlace?,
    first: Boolean,
    onPick: (PickedPlace) -> Unit,
) {
    val selected = candidate?.name == picked.name && candidate.latitude == picked.latitude
    val caption = placeRowCaption(picked)
    val why = place.why?.takeIf(String::isNotBlank)
    val detail = place.detail?.takeIf { !it.text.isNullOrBlank() }
    PlanRow(
        title = picked.name,
        subtitle = caption,
        end = if (selected) PlanRowEnd.Check else PlanRowEnd.None,
        first = first,
        leading = {
            if (selected) {
                PlanTile(kind)
            } else {
                PlanIconTile(iconFor(place.category), PantopusColors.appSurfaceSunken, PantopusColors.appTextStrong)
            }
        },
        spoken = listOfNotNull(picked.name, caption, why, detail?.text, "selected".takeIf { selected }).joinToString(", "),
        onClick = { onPick(picked) },
        below =
            if (why == null && detail == null) {
                null
            } else {
                {
                    if (why != null) {
                        Row(
                            modifier = Modifier.padding(top = 2.dp),
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            PantopusIconImage(
                                icon = PantopusIcon.Sparkles,
                                contentDescription = null,
                                size = 12.dp,
                                tint = PantopusColors.primary600,
                                modifier = Modifier.padding(top = 3.dp),
                            )
                            Text(text = why, style = PantopusTextStyle.small.copy(fontSize = 13.sp), color = PantopusColors.appTextStrong)
                        }
                    }
                    if (detail != null) {
                        Text(
                            text = detail.text.orEmpty(),
                            style = PantopusTextStyle.small.copy(fontSize = 13.sp),
                            color = if (detail.isWarning) PantopusColors.warning else PantopusColors.appTextSecondary,
                            maxLines = 2,
                        )
                    }
                }
            },
    )
}

/** "Suggest places" and its picks (H6), or "Ask Pantopus" for what the host typed. */
@Composable
private fun PlaceSuggestionsSection(
    state: PlacePickerState,
    ask: String?,
    onSuggest: () -> Unit,
    onPick: (PickedPlace) -> Unit,
) {
    val noun = suggestNoun(state.kind)
    val heading = ask?.let { "For “$it”" } ?: "Suggested for your $noun"
    val status = Modifier.testTag("planPlaceSuggestStatus")
    Column(modifier = Modifier.fillMaxWidth().testTag("planPlaceSuggestions")) {
        when (val suggestions = state.suggestions) {
            PlaceSuggestions.Idle ->
                PlanRow(
                    title = ask?.let { "Ask Pantopus: “$it”" } ?: "Suggest places for your $noun",
                    subtitle =
                        if (ask == null) {
                            "Pantopus picks from the public places near you, for your plan's time"
                        } else {
                            "Find places nearby that fit what you typed"
                        },
                    end = PlanRowEnd.Chevron,
                    first = true,
                    leading = { PlanIconTile(PantopusIcon.Sparkles, PantopusColors.primary100, PantopusColors.primary700) },
                    onClick = onSuggest,
                    modifier = Modifier.testTag(if (ask == null) "planPlaceSuggest" else "planPlaceAskPantopus"),
                )
            is PlaceSuggestions.Loading -> {
                PlanOverline(heading, modifier = Modifier.padding(bottom = 2.dp))
                PlanRowsSkeleton(rows = 2)
                Text(
                    text =
                        if (suggestions.gathering) {
                            "Gathering the public places near you first…"
                        } else {
                            "Pantopus is picking places for your $noun…"
                        },
                    style = PantopusTextStyle.small.copy(fontSize = 13.sp),
                    color = PantopusColors.appTextSecondary,
                    modifier = status,
                )
            }
            is PlaceSuggestions.Loaded -> {
                PlanOverline(heading, modifier = Modifier.padding(bottom = 2.dp))
                suggestions.picks.forEachIndexed { index, place ->
                    val picked = place.toPicked() ?: return@forEachIndexed
                    PlaceRow(
                        place = place,
                        picked = picked,
                        kind = state.kind,
                        candidate = state.candidate,
                        first = index == 0,
                        onPick = onPick,
                    )
                }
                Text(
                    text =
                        if (suggestions.fromAi) {
                            "Picked by Pantopus from the public places near you. Check the details before you go."
                        } else {
                            "Good fits from the public places near you."
                        },
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = Spacing.s1),
                )
            }
            is PlaceSuggestions.Empty -> {
                PlanOverline(heading, modifier = Modifier.padding(bottom = 2.dp))
                Text(
                    text = suggestions.line,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    modifier = status.padding(vertical = Spacing.s2),
                )
            }
            is PlaceSuggestions.Failed ->
                Column(modifier = Modifier.padding(vertical = Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(
                        text = suggestions.line,
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                        modifier = status,
                    )
                    PlanTonalButton(title = "Try again", onClick = onSuggest, height = 40.dp)
                }
        }
    }
}

/** "Suggested for your watch party", "… your game" (as on iOS). */
private fun suggestNoun(kind: PlanKind): String =
    when (kind) {
        PlanKind.WATCH_PARTY -> "watch party"
        PlanKind.PLAYDATE -> "playdate"
        PlanKind.PICKUP_GAME -> "game"
        PlanKind.WALK_COFFEE -> "walk"
        PlanKind.STUDY_GROUP -> "study group"
    }

private const val ASK_MAX = 120

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

/**
 * The kind's own public places first, in the server's order within each (its nearest first, a pickup game's courts
 * for its sport first), then the rest, as iOS's `PlanPlaceFit` orders them; places open for only part of the plan
 * after those open for all of it, closed ones last (`fitOrder` in backend/services/plans/planPlaces.js). Never a bar
 * for a playdate.
 */
internal fun orderedForKind(
    places: List<PlanNearbyPlaceDto>,
    kind: PlanKind,
): List<PlanNearbyPlaceDto> {
    val preferred =
        when (kind) {
            PlanKind.WATCH_PARTY -> listOf("bar", "restaurant", "cafe", "community_center")
            PlanKind.PLAYDATE -> listOf("playground", "park", "library", "community_center")
            PlanKind.PICKUP_GAME -> listOf("court", "park", "playground", "community_center")
            PlanKind.WALK_COFFEE -> listOf("trail", "park", "cafe")
            PlanKind.STUDY_GROUP -> listOf("library", "cafe", "community_center")
        }
    val allowed = places.filter { kind != PlanKind.PLAYDATE || it.category?.lowercase() != "bar" }
    // A stable sort: places of the same rank keep the server's order.
    return allowed.sortedBy { place ->
        val category = preferred.indexOf(place.category?.lowercase()).takeIf { it >= 0 } ?: preferred.size
        val hours =
            when {
                place.hours?.isClosed == true -> 2
                place.hours?.isPartial == true -> 1
                else -> 0
            }
        hours * HOURS_TIER + category
    }
}

private const val HOURS_TIER = 100

internal fun PlanNearbyPlaceDto.toPicked(): PickedPlace? {
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
                        text = "· ${draft.spots} ${if (kind == PlanKind.PLAYDATE) {
                            if (draft.spots == 1) "family" else "families"
                        } else {
                            if (draft.spots == 1) "spot" else "spots"
                        }}",
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
