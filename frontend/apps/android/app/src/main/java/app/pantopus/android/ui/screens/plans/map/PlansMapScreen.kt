@file:Suppress(
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
    "LongMethod",
    "CyclomaticComplexMethod",
    "ComplexCondition",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.plans.map

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.R
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanGameDto
import app.pantopus.android.data.api.models.plans.PlanPinDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanLocation
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.PlanViewerStanding
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planState
import app.pantopus.android.data.plans.standing
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.RefreshOnStoreChange
import app.pantopus.android.ui.screens.plans.PlansGateViewModel
import app.pantopus.android.ui.screens.plans.components.PlanPinBadge
import app.pantopus.android.ui.screens.plans.components.PlanScopeChip
import app.pantopus.android.ui.screens.plans.components.PlanSheet
import app.pantopus.android.ui.screens.plans.components.PlanSheetStop
import app.pantopus.android.ui.screens.plans.components.PlanSwatch
import app.pantopus.android.ui.screens.plans.components.aboveSheet
import app.pantopus.android.ui.screens.plans.planGlass
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import app.pantopus.android.ui.theme.rememberReduceMotion
import com.google.android.gms.maps.CameraUpdate
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.Circle
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapEffect
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MapsComposeExperimentalApi
import com.google.maps.android.compose.rememberCameraPositionState
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/** What the Nearby map opens from it. */
data class PlansMapActions(
    val onOpenPlan: (String) -> Unit,
    val onAsk: (String) -> Unit,
    val onHost: (PlanKind?, PlanGameDto?) -> Unit,
    val onOpenPulse: () -> Unit,
    val onOpenConnections: () -> Unit,
    val onInvite: () -> Unit,
)

/**
 * Nearby on the map (boards F1 to F5): the area pill and the type chips over the map, plan pins on their areas,
 * the Host button, and the list sheet. Shown in place of today's Nearby screen while the `plans` flag is on.
 */
@Composable
fun PlansMapScreen(
    actions: PlansMapActions,
    viewModel: PlansMapViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val gate: PlansGateViewModel = hiltViewModel()
    val online by gate.online.collectAsStateWithLifecycle()
    LifecycleResumeEffect(Unit) {
        viewModel.load()
        onPauseOrDispose { }
    }
    RefreshOnStoreChange(viewModel::load)
    LaunchedEffect(online) { if (online) viewModel.load() }
    val reduceMotion = rememberReduceMotion()
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            if (results.values.any { it }) viewModel.useMyLocation()
        }

    fun askLocation() = permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))

    var stop by rememberSaveable { mutableStateOf(PlanSheetStop.Peek) }
    var sheetHeight by remember { mutableFloatStateOf(0f) }
    var recenter by remember { mutableIntStateOf(0) }
    var zoomOutMiles by remember { mutableIntStateOf(0) }
    // The area pill and the chips cover the top of the map: the map keeps its center below them.
    var chromeHeight by remember { mutableIntStateOf(0) }
    BackHandler(enabled = state.selectedId != null || stop != PlanSheetStop.Peek) {
        if (state.selectedId != null) viewModel.select(null) else stop = PlanSheetStop.Peek
    }
    LaunchedEffect(state.selectedId) { if (state.selectedId != null) stop = PlanSheetStop.Half }
    // The no-location (F5), empty (F4) and posted (H8) sheets rest at their own middle height.
    val restsHalf = state.locationStatus == PlansLocationStatus.Missing || state.isEmpty || state.postedId != null
    LaunchedEffect(restsHalf) { stop = if (restsHalf) PlanSheetStop.Half else PlanSheetStop.Peek }

    Box(modifier = Modifier.fillMaxSize().testTag("plansMap")) {
        PlansMap(
            state = state,
            recenter = recenter,
            zoomOutMiles = zoomOutMiles,
            onZoomedOut = { zoomOutMiles = 0 },
            sheetHeightPx = sheetHeight,
            topPaddingPx = chromeHeight,
            reduceMotion = reduceMotion,
            onViewport = viewModel::setViewport,
            onPin = { viewModel.select(it) },
        )
        // The full list (F2) covers the map: its controls go, for TalkBack too.
        if (state.postedId == null && stop != PlanSheetStop.Full) {
            PlansTopChrome(
                offline = !online,
                state = state,
                onWindow = viewModel::setWindow,
                onKind = viewModel::setKind,
                onLocate = {
                    if (state.location?.source == PlanLocation.Source.GPS) {
                        viewModel.useMyLocation()
                        recenter++
                    } else {
                        askLocation()
                    }
                },
                onUseHome = viewModel::useHome,
                onBackFromCard = { viewModel.select(null) },
                modifier =
                    Modifier.align(Alignment.TopCenter).onSizeChanged { size ->
                        // Measured with the full controls only, so selecting a pin doesn't shift the map.
                        if (state.selectedId == null) chromeHeight = size.height
                    },
            )
        }
        if (state.selectedId == null && stop == PlanSheetStop.Peek && state.locationStatus == PlansLocationStatus.Ready && !state.isEmpty) {
            HostButton(
                onClick = { actions.onHost(null, null) },
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .padding(end = Spacing.s4)
                        .aboveSheet(sheetHeight, with(LocalDensity.current) { 18.dp.toPx() }),
            )
        }
        PlansSheetHost(
            state = state,
            stop = stop,
            onStop = { stop = it },
            onHeight = { sheetHeight = it },
            reduceMotion = reduceMotion,
            viewModel = viewModel,
            actions = actions,
            askLocation = ::askLocation,
            onZoomOut = { miles -> zoomOutMiles = miles },
        )
    }
}

@Composable
private fun PlansSheetHost(
    state: PlansMapUiState,
    stop: PlanSheetStop,
    onStop: (PlanSheetStop) -> Unit,
    onHeight: (Float) -> Unit,
    reduceMotion: Boolean,
    viewModel: PlansMapViewModel,
    actions: PlansMapActions,
    askLocation: () -> Unit,
    onZoomOut: (Int) -> Unit,
) {
    val selected = state.selected
    val context = LocalContext.current
    val half =
        when {
            state.postedId != null -> 0.55f
            state.locationStatus == PlansLocationStatus.Missing -> 0.56f
            state.selectedId != null -> 0.5f
            state.isEmpty -> 0.6f
            else -> PlanSheetStop.Half.fraction
        }
    // The plan card's own height: on a small screen the middle stop grows so its buttons show.
    var cardPx by remember(state.selectedId) { mutableFloatStateOf(0f) }
    val showsCard = state.postedId == null && state.locationStatus != PlansLocationStatus.Missing && selected != null
    PlanSheet(
        stop = stop,
        onStop = onStop,
        halfFraction = half,
        halfContentPx = if (showsCard && state.selectedId != null) cardPx else 0f,
        reduceMotion = reduceMotion,
        onHeight = onHeight,
        modifier = Modifier.fillMaxSize(),
    ) { current ->
        when {
            state.postedId != null && selected != null ->
                PlanPostedContent(
                    plan = selected,
                    onShare = { context.sharePlanLink(selected) },
                    onSeePlan = {
                        viewModel.dismissPosted()
                        actions.onOpenPlan(selected.id)
                    },
                    onDone = viewModel::dismissPosted,
                )
            state.locationStatus == PlansLocationStatus.Missing ->
                PlansNoLocationContent(state.canUseHome, onUseLocation = askLocation, onUseHome = viewModel::useHome)
            state.selectedId != null && selected != null ->
                PlanCardContent(
                    plan = selected,
                    onClose = { viewModel.select(null) },
                    onDetails = { actions.onOpenPlan(selected.id) },
                    onContentHeight = { cardPx = it },
                    onPrimary = {
                        val closed = selected.planState == PlanState.ENDED || selected.planState == PlanState.CANCELLED
                        if (selected.standing == PlanViewerStanding.NONE && !closed) {
                            actions.onAsk(selected.id)
                        } else {
                            actions.onOpenPlan(selected.id)
                        }
                    },
                )
            state.selectedId != null -> PlanRowsSkeleton(rows = 2)
            state.isEmpty ->
                PlansEmptyContent(
                    state,
                    onHost = actions.onHost,
                    onInvite = actions.onInvite,
                    onShowElsewhere = { onZoomOut(state.elsewhere?.miles ?: ELSEWHERE_DEFAULT_MILES) },
                )
            current == PlanSheetStop.Peek ->
                PlansPeekContent(state, onSeeAll = { onStop(PlanSheetStop.Full) }, onOpen = { actions.onOpenPlan(it.id) })
            else ->
                PlansListContent(
                    state = state,
                    onBackToMap = { onStop(PlanSheetStop.Peek) },
                    onOpen = { actions.onOpenPlan(it.id) },
                    onOpenPulse = actions.onOpenPulse,
                    onOpenConnections = actions.onOpenConnections,
                    onRetry = viewModel::refresh,
                )
        }
    }
}

/** The Google map with the pins drawn over it. Without a Maps key the tiles stay blank; the pins still show. */
@OptIn(MapsComposeExperimentalApi::class)
@Composable
private fun PlansMap(
    state: PlansMapUiState,
    recenter: Int,
    zoomOutMiles: Int,
    onZoomedOut: () -> Unit,
    sheetHeightPx: Float,
    topPaddingPx: Int,
    reduceMotion: Boolean,
    onViewport: (Double, Double, Double, Double) -> Unit,
    onPin: (String) -> Unit,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val camera = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(LatLng(0.0, 0.0), 1f) }
    val scope = rememberCoroutineScope()
    var centeredOn by rememberSaveable { mutableStateOf<String?>(null) }
    val location = state.location
    var mapLoaded by remember { mutableStateOf(false) }
    var googleMap by remember { mutableStateOf<GoogleMap?>(null) }
    // The camera as the map has it. The map reports camera moves through listeners that never fire without a Maps
    // key (a dev machine), so this reads the map itself a few times a second while the screen is up.
    var liveCamera by remember { mutableStateOf<CameraPosition?>(null) }
    // Where the camera's target sits on screen: it moves when the map's padding changes, which moves no camera.
    var liveTargetPoint by remember { mutableStateOf<android.graphics.Point?>(null) }
    LaunchedEffect(googleMap) {
        val map = googleMap ?: return@LaunchedEffect
        while (true) {
            val now = map.cameraPosition
            if (now != liveCamera) liveCamera = now
            val point = map.projection.toScreenLocation(now.target)
            if (point != liveTargetPoint) liveTargetPoint = point
            delay(CAMERA_POLL_MS)
        }
    }
    // The map keeps its center above the sheet, but only where the sheet comes to rest: following every frame of a
    // drag would slide the whole map under the person's finger.
    val currentSheet by rememberUpdatedState(sheetHeightPx)
    var restingSheetPx by remember { mutableFloatStateOf(sheetHeightPx) }
    LaunchedEffect(Unit) {
        snapshotFlow { currentSheet }.collectLatest { height ->
            delay(SHEET_REST_MS)
            restingSheetPx = height
        }
    }
    val viewport by rememberUpdatedState(onViewport)
    // Pins for what's on screen: the map's visible region, read once the camera has been still for a moment. The
    // map's own "idle" callback never fires without a Maps key (a dev machine), so this follows the position and
    // also reads right after the app moves the camera itself.
    val reportViewport: () -> Unit = {
        camera.projection?.visibleRegion?.latLngBounds?.let { bounds ->
            val span = bounds.northeast.longitude - bounds.southwest.longitude
            if (mapLoaded && span > 0 && span <= MAX_FETCH_SPAN_DEGREES) {
                viewport(bounds.southwest.latitude, bounds.southwest.longitude, bounds.northeast.latitude, bounds.northeast.longitude)
            }
        }
    }
    val selectedPin = state.pins.firstOrNull { it.id == state.selectedId }
    val selectedLat = selectedPin?.latitude
    val selectedLng = selectedPin?.longitude
    val selectedPoint by rememberUpdatedState(if (selectedLat != null && selectedLng != null) LatLng(selectedLat, selectedLng) else null)
    LaunchedEffect(location, googleMap) {
        val map = googleMap
        if (location == null || map == null) return@LaunchedEffect
        val key = "${location.source}:${location.latitude}:${location.longitude}"
        // Center on a new location, and again whenever the map comes back showing the whole world (a restored
        // camera can be stale when the map never reported its moves). A selected pin (a plan just posted) wins.
        if (centeredOn != key || map.cameraPosition.zoom < MIN_FETCH_ZOOM) {
            centeredOn = key
            val target = selectedPoint ?: LatLng(location.latitude, location.longitude)
            camera.move(CameraUpdateFactory.newLatLngZoom(target, START_ZOOM))
        }
        delay(VIEWPORT_SETTLE_MS)
        reportViewport()
    }
    LaunchedEffect(zoomOutMiles) {
        if (zoomOutMiles <= 0 || location == null) return@LaunchedEffect
        onZoomedOut()
        // Show a town 5 to 15 miles away (F4 "Show"): zoom out until that radius fits.
        val zoom =
            (START_ZOOM - kotlin.math.log2((zoomOutMiles + 1) / START_RADIUS_MILES)).toFloat().coerceIn(
                MIN_FETCH_ZOOM + 0.5f,
                START_ZOOM,
            )
        camera.animateOrMove(
            CameraUpdateFactory.newLatLngZoom(LatLng(location.latitude, location.longitude), zoom),
            if (reduceMotion) 1 else ZOOM_OUT_MS,
        )
        delay(VIEWPORT_SETTLE_MS)
        reportViewport()
    }
    LaunchedEffect(recenter) {
        if (recenter == 0 || location == null) return@LaunchedEffect
        camera.animateOrMove(
            CameraUpdateFactory.newLatLng(LatLng(location.latitude, location.longitude)),
            if (reduceMotion) 1 else RECENTER_MS,
        )
        delay(VIEWPORT_SETTLE_MS)
        reportViewport()
    }
    LaunchedEffect(mapLoaded) {
        if (!mapLoaded) return@LaunchedEffect
        delay(VIEWPORT_SETTLE_MS)
        reportViewport()
    }
    LaunchedEffect(camera) {
        snapshotFlow { if (mapLoaded) liveCamera ?: camera.position else null }
            .filterNotNull()
            .collectLatest {
                delay(VIEWPORT_SETTLE_MS)
                reportViewport()
            }
    }
    // Center the selected pin once it's on the map (a plan just posted shows up with the next pins read) and the
    // map is there to move.
    LaunchedEffect(state.selectedId, selectedPin != null, googleMap != null) {
        if (googleMap == null) return@LaunchedEffect
        val pin = selectedPin ?: return@LaunchedEffect
        val lat = pin.latitude ?: return@LaunchedEffect
        val lng = pin.longitude ?: return@LaunchedEffect
        camera.animateOrMove(CameraUpdateFactory.newLatLng(LatLng(lat, lng)), if (reduceMotion) 1 else SELECT_MS)
    }
    val properties =
        remember(context, state.location?.source) {
            MapProperties(
                isMyLocationEnabled = state.location?.source == PlanLocation.Source.GPS && hasLocationPermission(context),
                mapStyleOptions = MapStyleOptions.loadRawResourceStyle(context, R.raw.nearby_map_style),
            )
        }
    val uiSettings =
        remember {
            MapUiSettings(myLocationButtonEnabled = false, zoomControlsEnabled = false, compassEnabled = false, mapToolbarEnabled = false)
        }
    val bottomPadding = with(density) { restingSheetPx.toDp() }
    val topPadding = with(density) { topPaddingPx.toDp() }
    val dim = state.locationStatus == PlansLocationStatus.Missing || state.isEmpty
    Box(modifier = Modifier.fillMaxSize()) {
        GoogleMap(
            modifier = Modifier.fillMaxSize().testTag("plansGoogleMap").semantics { contentDescription = "Map of plans near you" },
            cameraPositionState = camera,
            properties = properties,
            uiSettings = uiSettings,
            contentPadding = PaddingValues(top = topPadding, bottom = bottomPadding),
            onMapLoaded = { mapLoaded = true },
        ) {
            // The map is ready even when its tiles can't load (no Maps key on a dev machine): fetch pins anyway.
            MapEffect(Unit) { map ->
                googleMap = map
                mapLoaded = true
            }
            if (state.isEmpty && location != null) {
                Circle(
                    center = LatLng(location.latitude, location.longitude),
                    radius = FIVE_MILES_M,
                    fillColor = PantopusColors.mapYou.copy(alpha = 0.07f),
                    strokeColor = PantopusColors.mapYou.copy(alpha = 0.18f),
                    strokeWidth = 2f,
                )
            }
        }
        if (dim) {
            Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appSurface.copy(alpha = 0.18f)).clearAndSetSemantics {})
        }
        if (state.locationStatus == PlansLocationStatus.Ready) {
            PlansMapOverlay(
                cameraState = camera,
                pins = remember(state.pins, state.list, state.mine, state.postedId) { mapPins(state) },
                selectedId = state.selectedId,
                onPin = { onPin(it.id) },
                onCluster = { pins ->
                    val bounds =
                        LatLngBounds
                            .builder()
                            .apply { pins.forEach { include(LatLng(it.latitude, it.longitude)) } }
                            .build()
                    val span =
                        (bounds.northeast.latitude - bounds.southwest.latitude) +
                            (bounds.northeast.longitude - bounds.southwest.longitude)
                    // Plans that share a spot never separate by bounds: zoom to where they spread into a ring.
                    val update =
                        if (span < SHARED_SPOT_DEGREES) {
                            CameraUpdateFactory.newLatLngZoom(bounds.center, SPREAD_ZOOM.toFloat() + 0.5f)
                        } else {
                            CameraUpdateFactory.newLatLngBounds(bounds, CLUSTER_PADDING_PX)
                        }
                    scope.launch { camera.animateOrMove(update, if (reduceMotion) 1 else CLUSTER_MS) }
                },
                reduceMotion = reduceMotion,
                droppingId = state.postedId,
                mapReady = mapLoaded,
                camera = { liveCamera ?: camera.position },
                layoutKey = { liveTargetPoint },
            )
        }
    }
}

private const val START_ZOOM = 14f
private const val VIEWPORT_SETTLE_MS = 350L
private const val SELECT_MS = 350
private const val CLUSTER_MS = 400
private const val ANIMATE_GRACE_MS = 400L
private const val CAMERA_POLL_MS = 120L
private const val SHEET_REST_MS = 150L
private const val ZOOM_OUT_MS = 500
private const val RECENTER_MS = 400

/** Wider than this (about zoom 9 on a phone) the map doesn't ask for pins. */
private const val MAX_FETCH_SPAN_DEGREES = 1.2
private const val ELSEWHERE_DEFAULT_MILES = 8

/** About how many miles from the center to the edge the map shows at [START_ZOOM] on a phone. */
private const val START_RADIUS_MILES = 0.75
private const val MIN_FETCH_ZOOM = 9f
private const val FIVE_MILES_M = 8047.0
private const val CLUSTER_PADDING_PX = 160

/** Pins closer than this (about 100 m) count as one spot. */
private const val SHARED_SPOT_DEGREES = 0.001

/** Pins as the map draws them, with TalkBack words that borrow the list's distance band when the pin has none. */
private fun mapPins(state: PlansMapUiState): List<MapPin> {
    val cards: Map<String, PlanDto> = (state.list + state.mineAll).associateBy { it.id }
    return state.pins.mapNotNull { pin ->
        val mapPin = pin.toMapPin(cards[pin.id]) ?: return@mapNotNull null
        // H8: the plan just posted reads "Your plan · Sun 1:25".
        if (pin.id == state.postedId) mapPin.copy(tag = "Your plan · ${mapPin.tag}") else mapPin
    }
}

private fun PlanPinDto.toMapPin(card: PlanDto?): MapPin? {
    val kind = planKind ?: return null
    val lat = latitude ?: return null
    val lng = longitude ?: return null
    val standing = standing
    return MapPin(
        id = id,
        kind = kind,
        latitude = lat,
        longitude = lng,
        tag = PlanFormat.pinTag(this),
        spoken = PlanFormat.pinSpoken(this, card?.distanceBand),
        live = planState == PlanState.LIVE,
        full = isFull && standing != PlanViewerStanding.IN && standing != PlanViewerStanding.HOSTING,
        badge =
            when (standing) {
                PlanViewerStanding.IN -> PlanPinBadge.In
                PlanViewerStanding.HOSTING -> PlanPinBadge.Hosting
                PlanViewerStanding.REQUESTED, PlanViewerStanding.WAITLISTED -> PlanPinBadge.Waiting
                else -> PlanPinBadge.None
            },
        neighborhood = precision == "neighborhood" || kind == PlanKind.PLAYDATE,
        areaLabel = if (kind == PlanKind.PLAYDATE) areaLabel ?: card?.area?.label else null,
    )
}

private fun hasLocationPermission(context: android.content.Context): Boolean =
    listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
        androidx.core.content.ContextCompat.checkSelfPermission(context, it) == android.content.pm.PackageManager.PERMISSION_GRANTED
    }

/** The floating controls over the map (board F1), or the back button and privacy chip over a selected pin (F3). */
@Composable
private fun PlansTopChrome(
    offline: Boolean,
    state: PlansMapUiState,
    onWindow: (app.pantopus.android.data.plans.PlanWindow) -> Unit,
    onKind: (PlanKind?) -> Unit,
    onLocate: () -> Unit,
    onUseHome: () -> Unit,
    onBackFromCard: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = Spacing.s2, start = Spacing.s3, end = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (offline) OfflineBannerHost(isOffline = true, modifier = Modifier.clip(RoundedCornerShape(Radii.lg))) {}
        val selected = state.selected
        if (state.selectedId != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                GlassCircleButton(icon = PantopusIcon.ChevronLeft, label = "Back to all plans", onClick = onBackFromCard)
                Spacer(modifier = Modifier.weight(1f))
                val inOrHosting = selected?.standing == PlanViewerStanding.IN || selected?.standing == PlanViewerStanding.HOSTING
                if (!inOrHosting) {
                    PlanScopeChip(
                        text =
                            if (selected?.planKind == PlanKind.PLAYDATE) {
                                "Neighborhood only until you're in"
                            } else {
                                "Area only until you're in"
                            },
                    )
                }
            }
            return@Column
        }
        if (state.locationStatus == PlansLocationStatus.Missing) return@Column
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            AreaPill(state = state, onWindow = onWindow, onLocate = onLocate, onUseHome = onUseHome, modifier = Modifier.weight(1f))
            if (!state.isEmpty) GlassCircleButton(icon = PantopusIcon.Navigation, label = "Show my location", onClick = onLocate)
        }
        if (!state.isEmpty) KindChips(state = state, onKind = onKind)
    }
}

@Composable
private fun AreaPill(
    state: PlansMapUiState,
    onWindow: (app.pantopus.android.data.plans.PlanWindow) -> Unit,
    onLocate: () -> Unit,
    onUseHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var open by remember { mutableStateOf(false) }
    // The town: the person's own, else the one the nearby plans are in ("Camas"), else "Near you".
    val area = state.location?.label ?: (state.list + state.mineAll).firstNotNullOfOrNull { it.area?.city } ?: "Near you"
    Box(modifier = modifier) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .pantopusShadow(PantopusElevations.md, RoundedCornerShape(24.dp))
                    .clip(RoundedCornerShape(24.dp))
                    .background(planGlass)
                    .clickable(role = Role.Button) { open = true }
                    .padding(horizontal = Spacing.s4)
                    .clearAndSetSemantics {
                        contentDescription = "Area and time: $area, ${state.window.label.lowercase()}"
                        role = Role.Button
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.MapPin, contentDescription = null, size = 18.dp, tint = PantopusColors.appText)
            Text(
                text =
                    buildAnnotatedString {
                        append(area)
                        withStyle(SpanStyle(color = PantopusColors.appTextSecondary, fontWeight = FontWeight.Medium)) {
                            append(" · ${state.window.label}")
                        }
                    },
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 16.dp, tint = PantopusColors.appText)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            windowChoices.forEach { window ->
                DropdownMenuItem(
                    text = { Text(window.label) },
                    onClick = {
                        open = false
                        onWindow(window)
                    },
                    trailingIcon = {
                        if (window == state.window) {
                            PantopusIconImage(
                                icon = PantopusIcon.Check,
                                contentDescription = "Selected",
                                size = 18.dp,
                                tint = PantopusColors.primary600,
                            )
                        }
                    },
                )
            }
            HorizontalDivider()
            DropdownMenuItem(
                text = { Text("Use my location") },
                onClick = {
                    open = false
                    onLocate()
                },
            )
            DropdownMenuItem(
                text = { Text("Use my home") },
                onClick = {
                    open = false
                    onUseHome()
                },
            )
        }
    }
}

@Composable
private fun KindChips(
    state: PlansMapUiState,
    onKind: (PlanKind?) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        MapChip(label = "All", selected = state.kind == null, onClick = { onKind(null) }, leading = null)
        state.kinds.forEach { kind ->
            MapChip(
                label = kind.label,
                selected = state.kind == kind,
                onClick = { onKind(if (state.kind == kind) null else kind) },
                leading = { PlanSwatch(kind) },
            )
        }
    }
}

/** A type chip over the map (board P2 "map filter chips"): glass, 36 dp, the selected one in sky with a check. */
@Composable
private fun MapChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    leading: (@Composable () -> Unit)?,
) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 36.dp)
                .pantopusShadow(PantopusElevations.md, RoundedCornerShape(Radii.pill))
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (selected) PantopusColors.primary50 else planGlass)
                .then(if (selected) Modifier.border(1.dp, PantopusColors.primary700, RoundedCornerShape(Radii.pill)) else Modifier)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(start = if (leading != null) Spacing.s2 else 10.dp, end = if (leading != null) Spacing.s3 else 14.dp)
                .semantics(mergeDescendants = true) {
                    this.selected = selected
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        if (leading != null) {
            leading()
        } else if (selected) {
            PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 14.dp, tint = PantopusColors.primary700)
        }
        Text(
            text = label,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
            color = if (selected) PantopusColors.primary700 else PantopusColors.appText,
            maxLines = 1,
        )
    }
}

@Composable
private fun GlassCircleButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(48.dp)
                .pantopusShadow(PantopusElevations.md, CircleShape)
                .clip(CircleShape)
                .background(planGlass)
                .clickable(role = Role.Button, onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = PantopusColors.appText)
    }
}

/** "+ Host" (board F1): the one way to start a plan from the map. */
@Composable
private fun HostButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 50.dp)
                .pantopusShadow(PantopusElevations.primary, RoundedCornerShape(25.dp))
                .clip(RoundedCornerShape(25.dp))
                .background(PantopusColors.primary600)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(start = Spacing.s4, end = Spacing.s5)
                .clearAndSetSemantics {
                    contentDescription = "Host a plan"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 20.dp, tint = PantopusColors.appTextInverse)
        Text(text = "Host", style = PantopusTextStyle.body.copy(fontWeight = FontWeight.Bold), color = PantopusColors.appTextInverse)
    }
}

/** The system share sheet with a plan's link (the web preview shows the area only). */
private fun android.content.Context.sharePlanLink(plan: PlanDto) {
    val url = plan.shareUrl ?: return
    val send =
        android.content.Intent(android.content.Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(android.content.Intent.EXTRA_TEXT, "${plan.title}\n$url")
            .putExtra(android.content.Intent.EXTRA_TITLE, plan.title)
    runCatching { startActivity(android.content.Intent.createChooser(send, null)) }
}

/**
 * Animates the camera, or jumps there when the map can't animate (without a Maps key, on a dev machine, the map never
 * finishes an animation).
 */
private suspend fun CameraPositionState.animateOrMove(
    update: CameraUpdate,
    millis: Int,
) {
    val done = withTimeoutOrNull(millis + ANIMATE_GRACE_MS) { animate(update, millis) }
    if (done == null) move(update)
}
