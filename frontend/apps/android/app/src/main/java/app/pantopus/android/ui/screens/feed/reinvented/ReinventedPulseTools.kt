@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.reinvented.ReinventedAppliedFiltersDto
import app.pantopus.android.ui.screens.feed.living.LivingAskViewModel
import app.pantopus.android.ui.screens.feed.living.LivingAtlasSearchViewModel
import app.pantopus.android.ui.theme.Spacing
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.CameraPositionState
import kotlinx.coroutines.launch

/*
 * PHASE-6 A1, A2 and PHASE-5 B on the phone: the tools over the map, held together for the layout. The lens in the top
 * line; Ask the map and Listen (one view-model, shared with the map's pins); the filters and their sheet; the rail.
 */

/** The phone's tools over the map, for one composition of the layout. */
internal class ReinventedPhoneTools(
    val lens: ReinventedLens,
    val lensActions: ReinventedLensActions,
    val ask: LivingAskViewModel,
    val filters: ReinventedFilters,
    val filtersModel: ReinventedFiltersViewModel,
    /** The Filters sheet is up. */
    val filtersOpen: MutableState<Boolean>,
    val rail: ReinventedRailActions,
    /** CONTRACT 10a: what the map's last answer says it applied; null with none, or while a new read is out. */
    val applied: ReinventedAppliedFiltersDto? = null,
)

/** What the tools need of the layout: its rest, My Atlas, the map and its camera. */
internal class ReinventedToolsInput(
    val height: ReinventedHeight,
    val onHeight: (ReinventedHeight) -> Unit,
    val atlas: ReinventedAtlasHook,
    val mapState: ReinventedMapState,
    val mapModel: ReinventedMapViewModel,
    val camera: CameraPositionState,
    val filtersModel: ReinventedFiltersViewModel,
)

@Composable
internal fun rememberPhoneTools(input: ReinventedToolsInput): ReinventedPhoneTools {
    val scope = rememberCoroutineScope()
    val lens = rememberReinventedLens()
    val ask: LivingAskViewModel = hiltViewModel()
    val atlasSearch: LivingAtlasSearchViewModel = hiltViewModel()
    ReinventedAskLifetime(ask)
    val atlas = input.atlas
    val lensActions =
        ReinventedLensActions(
            onAsk = { words ->
                if (atlas.on) atlas.onToggle(false)
                ask.ask(words)
                if (input.height == ReinventedHeight.List) input.onHeight(ReinventedHeight.Middle)
            },
            onSearchAtlas = { words ->
                if (!atlas.on) atlas.onToggle(true)
                atlasSearch.search(words)
                if (input.height == ReinventedHeight.Map) input.onHeight(ReinventedHeight.Middle)
            },
        )
    val filters by input.filtersModel.filters.collectAsStateWithLifecycle()
    val filtersOpen = rememberSaveable { mutableStateOf(false) }
    val time = input.mapState.time
    val rail =
        ReinventedRailActions(
            time = time,
            onPickTime = input.mapModel::pickTime,
            atlas = atlas.on,
            filterCount = filters.count(time),
            onFilters = { filtersOpen.value = true },
            onMyPlace = {
                input.mapState.center?.let { at ->
                    scope.launch { input.camera.animate(CameraUpdateFactory.newLatLng(LatLng(at.latitude, at.longitude)), MY_PLACE_MS) }
                }
            },
        )
    return ReinventedPhoneTools(lens, lensActions, ask, filters, input.filtersModel, filtersOpen, rail, input.mapState.applied)
}

/** Clears every filter and puts the time back to Live (the pill's ✕, the sheet's Clear). */
internal fun ReinventedPhoneTools.clearFilters(mapModel: ReinventedMapViewModel) {
    filtersModel.clear(ReinventedMapState.LIVE)
    mapModel.pickTime(ReinventedMapState.LIVE)
}

/** The Filters sheet while it is up. */
@Composable
internal fun ReinventedFiltersHost(
    tools: ReinventedPhoneTools,
    time: String,
    mapModel: ReinventedMapViewModel,
) {
    if (!tools.filtersOpen.value) return
    ReinventedFiltersSheet(
        filters = tools.filters,
        time = time,
        canFresh = tools.filtersModel.since != null,
        onFilters = { tools.filtersModel.set(it, time) },
        onTime = mapModel::pickTime,
        onClear = { tools.clearFilters(mapModel) },
        onDismiss = { tools.filtersOpen.value = false },
    )
}

/**
 * Over the map under the top line ([top]): the pill (right of [left], the panel's edge on a wide window), the rail (its
 * When card over the pill) and the lens's suggestions ([lensWidth] wide, under the top line).
 */
@Composable
@Suppress("LongParameterList") // The tools, where they go, and the map's state.
internal fun BoxScope.ReinventedPhoneOverMap(
    tools: ReinventedPhoneTools,
    top: Dp,
    left: Dp,
    lensWidth: Dp?,
    atlas: Boolean,
    moving: Boolean,
    mapModel: ReinventedMapViewModel,
) {
    val railTop = top + REINVENTED_RAIL_GAP
    ReinventedRailPill(
        ask = tools.ask,
        // The server's own account of what it applied (CONTRACT 10a), the phone's choice until it answers.
        filterWords = reinventedFilterLine(tools.applied, tools.filters, tools.rail.time).takeUnless { atlas },
        onClearFilters = { tools.clearFilters(mapModel) },
        modifier = Modifier.padding(start = left).reinventedPillPlace(railTop),
    )
    ReinventedRail(tools.rail, moving = moving, top = railTop, ask = tools.ask, modifier = Modifier.fillMaxWidth())
    ReinventedLensSuggestions(
        tools.lens,
        tools.lensActions,
        Modifier
            .padding(top = top + 4.dp, start = Spacing.s4, end = Spacing.s4)
            .then(if (lensWidth != null) Modifier.width(lensWidth) else Modifier),
    )
}

private const val MY_PLACE_MS = 600
