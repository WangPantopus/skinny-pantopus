@file:Suppress(
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
    "LongMethod",
    "CyclomaticComplexMethod",
    "MatchingDeclarationName",
)

@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)

package app.pantopus.android.ui.screens.moments.map

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import app.pantopus.android.R
import app.pantopus.android.data.moments.MomentPosting
import app.pantopus.android.ui.components.MessagesButton
import app.pantopus.android.ui.components.MessagesEntryHolder
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.moments.components.MomentHaptics
import app.pantopus.android.ui.screens.moments.components.MomentStripFace
import app.pantopus.android.ui.screens.moments.components.MomentStripPosting
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import com.google.android.gms.maps.CameraUpdate
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.CameraPositionState
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

/** What the Moments map opens from it. */
data class MomentsMapActions(
    /** The viewer, with its queue already handed over ([MomentsMapViewModel.watch], [MomentsMapViewModel.playAll]). */
    val onWatch: () -> Unit,
    /** The camera, to add a Moment (P1). */
    val onAdd: () -> Unit,
    /** The side menu, on every tab (founder decision 2026-10-20); null hides the button. */
    val onOpenMenu: (() -> Unit)? = null,
)

/**
 * The Moments tab (boards M1 to M3 and P5): the map with people's rings where they posted, crowded spots, the strip
 * of faces with Play all, the + and locate buttons, and your Moment's ring while it posts. ☰ on the left and the
 * chat button on the right float over the map, as on Plans.
 */
@Composable
fun MomentsMapScreen(
    actions: MomentsMapActions,
    viewModel: MomentsMapViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val rings by viewModel.rings.collectAsStateWithLifecycle()
    val posts by viewModel.posts.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    LaunchedEffect(Unit) { viewModel.messages.collect { toast.info(it) } }
    // A note from outside the map ("This Moment has ended." after a push) is taken only by the map on screen: a map
    // being replaced as the tab opens would take it and go.
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.repeatOnLifecycle(Lifecycle.State.RESUMED) { viewModel.outsideNotes.collect { toast.info(it) } }
    }
    val context = LocalContext.current
    val view = LocalView.current
    // Your Moment went live: one tap you can feel, with the note.
    LaunchedEffect(Unit) { viewModel.wentLive.collect { MomentHaptics.success(view) } }
    val density = LocalDensity.current
    var mapSize by remember { mutableStateOf(androidx.compose.ui.unit.IntSize.Zero) }
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            if (results.values.any { it }) viewModel.locate(waitForFix = true) else viewModel.locate()
        }

    fun askLocation() = permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    LifecycleResumeEffect(Unit) {
        if (state.center == null) viewModel.locate() else viewModel.refresh()
        onPauseOrDispose { }
    }
    // Each minute the area is read again, so Moments whose time is up leave and new ones arrive.
    LaunchedEffect(Unit) {
        while (true) {
            delay(REFRESH_MS)
            viewModel.refresh()
        }
    }
    var recenter by remember { mutableIntStateOf(0) }
    val camera = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(LatLng(0.0, 0.0), 1f) }
    val scope = rememberCoroutineScope()
    // The top controls cover the top of the map: the map keeps its middle below them.
    var chromeHeight by remember { mutableIntStateOf(0) }
    var bottomHeight by remember { mutableIntStateOf(0) }
    val spot = state.spot
    BackHandler(enabled = spot != null) {
        spot?.returnTo?.let { back -> scope.launch { camera.animateOrMove(CameraUpdateFactory.newCameraPosition(back), CLUSTER_MS) } }
        viewModel.closeSpot()
    }
    val shown =
        remember(rings, spot) {
            val inSpot = spot?.let { s -> rings.filter { it.id in s.ringIds } } ?: rings
            inSpot.sortedWith(
                compareByDescending<MomentRingUi> { it.mine }
                    .thenByDescending { it.anyNew }
                    .thenBy { it.distanceMeters },
            )
        }

    // A Moment that couldn't post: try again, or let it go (nobody saw it).
    var failedPosting by remember { mutableStateOf<MomentPosting?>(null) }
    failedPosting?.let { item ->
        AlertDialog(
            onDismissRequest = { failedPosting = null },
            title = { Text("Your Moment didn't post") },
            text = { Text(item.message ?: "Couldn't post your Moment.") },
            confirmButton = {
                TextButton(onClick = {
                    failedPosting = null
                    viewModel.retryPosting(item.momentId)
                }) { Text("Try again") }
            },
            dismissButton = {
                TextButton(onClick = {
                    failedPosting = null
                    viewModel.discardPosting(item.momentId)
                }) { Text("Discard", color = PantopusColors.error) }
            },
        )
    }

    // The test ids read as resource ids, for UI automation (as My Homes does).
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .onSizeChanged { mapSize = it }
                .testTag("moments.map")
                .semantics { testTagsAsResourceId = true },
    ) {
        MomentsMap(
            state = state,
            rings = rings,
            posts = posts,
            avatarUrl = viewModel.avatarUrl,
            camera = camera,
            recenter = recenter,
            topPaddingPx = chromeHeight,
            bottomPaddingPx = bottomHeight,
            onViewport = viewModel::setViewport,
            onRing = { ring ->
                viewModel.watch(ring, shown.ifEmpty { listOf(ring) })
                actions.onWatch()
            },
            onCluster = { cluster ->
                val returnTo = camera.position
                // Frame the spot between the top controls and the strip, with room for the pins above their spots.
                val (latitude, longitude, zoom) =
                    with(density) {
                        clusterCamera(
                            points = cluster.map { it.latitude to it.longitude },
                            widthDp = mapSize.width.toDp().value.toDouble(),
                            heightDp = (mapSize.height - chromeHeight - bottomHeight).coerceAtLeast(0).toDp().value.toDouble(),
                            minZoom = returnTo.zoom.toDouble(),
                        )
                    }
                val update = CameraUpdateFactory.newLatLngZoom(LatLng(latitude, longitude), zoom)
                scope.launch { camera.animateOrMove(update, CLUSTER_MS) }
                viewModel.openSpot(cluster, returnTo)
            },
            onPosting = { item -> if (item.stage == MomentPosting.Stage.FAILED) failedPosting = item },
        )
        MomentsTopChrome(
            state = state,
            onOpenMenu = actions.onOpenMenu,
            onBackFromSpot = {
                spot?.returnTo?.let { back ->
                    scope.launch { camera.animateOrMove(CameraUpdateFactory.newCameraPosition(back), CLUSTER_MS) }
                }
                viewModel.closeSpot()
            },
            onUseLocation = {
                if (state.center?.fromGps == true) {
                    viewModel.locate()
                    recenter++
                } else {
                    askLocation()
                }
            },
            onUseHome = viewModel::useHome,
            modifier = Modifier.align(Alignment.TopCenter).onSizeChanged { chromeHeight = it.height },
        )
        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s3)
                    .onSizeChanged { bottomHeight = it.height },
            horizontalAlignment = Alignment.End,
        ) {
            val empty = state.loaded && !state.failed && shown.isEmpty() && posts.isEmpty()
            // A Moment that just went live keeps its place in the strip until its ring is read; no second cell then.
            val stripPosts = posts.filter { item -> shown.none { ring -> ring.mine && ring.ring.moments.any { it.id == item.momentId } } }
            MapRoundButton(
                icon = PantopusIcon.Navigation,
                label = "Show my location",
                tint = PantopusColors.primary600,
                onClick = {
                    if (state.center?.fromGps == true && LocationAllowed.check(context)) {
                        viewModel.locate()
                        recenter++
                    } else {
                        askLocation()
                    }
                },
                modifier = Modifier.testTag("moments.locate"),
            )
            if (empty || state.locationMissing) {
                Spacer(Modifier.height(14.dp))
                MomentsEmptyCard(
                    place = state.emptyPlace ?: state.areaLabel,
                    locationMissing = state.locationMissing,
                    onAdd = actions.onAdd,
                    onUseLocation = ::askLocation,
                )
            } else {
                Spacer(Modifier.height(Spacing.s3))
                AddButton(onClick = actions.onAdd)
                Spacer(Modifier.height(9.dp))
                MomentsStrip(
                    shown = shown,
                    posts = stripPosts,
                    avatarUrl = viewModel.avatarUrl,
                    loading = !state.loaded,
                    failed = state.failed,
                    spot = spot,
                    onRing = { ring ->
                        viewModel.watch(ring, shown)
                        actions.onWatch()
                    },
                    onPlayAll = { if (viewModel.playAll(shown)) actions.onWatch() },
                    onRetry = viewModel::refresh,
                    onPosting = { item -> if (item.stage == MomentPosting.Stage.FAILED) failedPosting = item },
                )
            }
        }
        // Notes sit just above the strip (or the empty card), never on it.
        ToastHost(
            controller = toast,
            modifier = Modifier.padding(bottom = (with(density) { bottomHeight.toDp() } - Spacing.s6).coerceAtLeast(0.dp)),
        )
    }
}

/** Whether the app may read the location (permission granted). */
private object LocationAllowed {
    fun check(context: android.content.Context): Boolean =
        listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
            androidx.core.content.ContextCompat.checkSelfPermission(context, it) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }
}

/** The Google map with the rings drawn over it. Without a Maps key the tiles stay blank; the rings still show. */
@OptIn(MapsComposeExperimentalApi::class)
@Composable
private fun MomentsMap(
    state: MomentsMapUiState,
    rings: List<MomentRingUi>,
    posts: List<MomentPosting>,
    avatarUrl: String?,
    camera: CameraPositionState,
    recenter: Int,
    topPaddingPx: Int,
    bottomPaddingPx: Int,
    onViewport: (Double, Double, Double, Double, Float) -> Unit,
    onRing: (MomentRingUi) -> Unit,
    onCluster: (List<MomentRingUi>) -> Unit,
    onPosting: (MomentPosting) -> Unit,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    var centeredOn by rememberSaveable { mutableStateOf<String?>(null) }
    var mapLoaded by remember { mutableStateOf(false) }
    var googleMap by remember { mutableStateOf<GoogleMap?>(null) }
    // The camera as the map has it: its move listeners never fire without a Maps key (a dev machine), so this reads
    // the map itself a few times a second while the screen is up, as Plans does.
    var liveCamera by remember { mutableStateOf<CameraPosition?>(null) }
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
    val viewport by rememberUpdatedState(onViewport)
    val reportViewport: () -> Unit = {
        camera.projection?.visibleRegion?.latLngBounds?.let { bounds ->
            val span = bounds.northeast.longitude - bounds.southwest.longitude
            if (mapLoaded && span > 0 && span <= MAX_FETCH_SPAN_DEGREES) {
                viewport(
                    bounds.southwest.latitude,
                    bounds.southwest.longitude,
                    bounds.northeast.latitude,
                    bounds.northeast.longitude,
                    (liveCamera ?: camera.position).zoom,
                )
            }
        }
    }
    val center = state.center
    LaunchedEffect(center, googleMap) {
        val map = googleMap
        if (center == null || map == null) return@LaunchedEffect
        val key = "${center.fromGps}:${center.latitude}:${center.longitude}"
        // Open on a new center, and again whenever the map comes back showing the whole world.
        if (centeredOn != key || map.cameraPosition.zoom < MIN_FETCH_ZOOM) {
            centeredOn = key
            camera.move(CameraUpdateFactory.newLatLngZoom(LatLng(center.latitude, center.longitude), START_ZOOM))
        }
        delay(VIEWPORT_SETTLE_MS)
        reportViewport()
    }
    LaunchedEffect(recenter) {
        if (recenter == 0 || center == null) return@LaunchedEffect
        camera.animateOrMove(CameraUpdateFactory.newLatLng(LatLng(center.latitude, center.longitude)), RECENTER_MS)
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
    val properties =
        remember(context, center?.fromGps) {
            MapProperties(
                isMyLocationEnabled = center?.fromGps == true && LocationAllowed.check(context),
                mapStyleOptions = MapStyleOptions.loadRawResourceStyle(context, R.raw.nearby_map_style),
            )
        }
    val uiSettings =
        remember {
            MapUiSettings(myLocationButtonEnabled = false, zoomControlsEnabled = false, compassEnabled = false, mapToolbarEnabled = false)
        }
    Box(modifier = Modifier.fillMaxSize()) {
        GoogleMap(
            modifier = Modifier.fillMaxSize().testTag("moments.mapCanvas").semantics { contentDescription = "Map of Moments near you" },
            cameraPositionState = camera,
            properties = properties,
            uiSettings = uiSettings,
            contentPadding = PaddingValues(top = with(density) { topPaddingPx.toDp() }, bottom = with(density) { bottomPaddingPx.toDp() }),
            onMapLoaded = { mapLoaded = true },
        ) {
            // The map is ready even when its tiles can't load (no Maps key on a dev machine): read rings anyway.
            MapEffect(Unit) { map ->
                googleMap = map
                mapLoaded = true
            }
        }
        MomentsMapOverlay(
            cameraState = camera,
            rings = rings,
            posting = posts,
            avatarUrl = avatarUrl,
            onRing = onRing,
            onCluster = onCluster,
            onPosting = onPosting,
            mapReady = mapLoaded,
            camera = { liveCamera ?: camera.position },
            layoutKey = { liveTargetPoint },
        )
    }
}

/** ☰, the area pill and the chat button over the map (board M1); in a crowded spot, "‹ Esther Short Park" (M2). */
@Composable
private fun MomentsTopChrome(
    state: MomentsMapUiState,
    onOpenMenu: (() -> Unit)?,
    onBackFromSpot: () -> Unit,
    onUseLocation: () -> Unit,
    onUseHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = Spacing.s2, start = Spacing.s4, end = Spacing.s4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        onOpenMenu?.let {
            MapRoundButton(icon = PantopusIcon.Menu, label = "Menu", onClick = it, modifier = Modifier.testTag("moments.menu"))
        }
        val spot = state.spot
        if (spot != null) {
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp)
                        .glass(RoundedCornerShape(Radii.xl3))
                        .clickable(role = Role.Button, onClick = onBackFromSpot)
                        .padding(start = Spacing.s3, end = Spacing.s4)
                        .testTag("moments.clusterBack")
                        .clearAndSetSemantics {
                            contentDescription = "Back to ${state.areaLabel ?: "the area"}"
                            role = Role.Button
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PantopusIconImage(icon = PantopusIcon.ChevronLeft, contentDescription = null, size = 18.dp, strokeWidth = 2.25f)
                Text(
                    text = spot.label ?: "This spot",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        } else {
            AreaPill(label = state.areaLabel, onUseLocation = onUseLocation, onUseHome = onUseHome, modifier = Modifier.weight(1f))
        }
        if (onOpenMenu != null && MessagesEntryHolder.current != null) {
            Box(modifier = Modifier.size(48.dp).glass(CircleShape), contentAlignment = Alignment.Center) {
                MessagesButton(testTag = "moments.chat")
            }
        }
    }
}

@Composable
private fun AreaPill(
    label: String?,
    onUseLocation: () -> Unit,
    onUseHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var open by remember { mutableStateOf(false) }
    val area = label ?: "Near you"
    Box(modifier = modifier) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .glass(RoundedCornerShape(Radii.xl3))
                    .clickable(role = Role.Button) { open = true }
                    .padding(horizontal = Spacing.s4)
                    .testTag("moments.areaPill")
                    .clearAndSetSemantics {
                        contentDescription = "Area: $area. Change the area"
                        role = Role.Button
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = area,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 16.dp)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text("Use my location") },
                onClick = {
                    open = false
                    onUseLocation()
                },
                modifier = Modifier.testTag("moments.area.nearYou"),
            )
            DropdownMenuItem(
                text = { Text("Use my home") },
                onClick = {
                    open = false
                    onUseHome()
                },
                modifier = Modifier.testTag("moments.area.home"),
            )
        }
    }
}

/** The strip of faces in view (boards M1, M2, P5): "8 new near you" and Play all over the faces, nearest first. */
@Composable
private fun MomentsStrip(
    shown: List<MomentRingUi>,
    posts: List<MomentPosting>,
    avatarUrl: String?,
    loading: Boolean,
    failed: Boolean,
    spot: MomentsSpot?,
    onRing: (MomentRingUi) -> Unit,
    onPlayAll: () -> Unit,
    onRetry: () -> Unit,
    onPosting: (MomentPosting) -> Unit,
) {
    val newPeople = shown.filter { it.anyNew && !it.mine }.distinctBy { it.author.id }.size
    val people = shown.distinctBy { it.author.id }.size
    // Your posting Moment and your own ring come first: the strip goes back to its start when one arrives, and when
    // the strip changes to a spot's people.
    val list = rememberLazyListState()
    val first = posts.firstOrNull()?.momentId ?: shown.firstOrNull()?.takeIf { it.mine }?.id
    LaunchedEffect(first, spot?.ringIds) { list.animateScrollToItem(0) }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(136.dp)
                .glass(RoundedCornerShape(Radii.xl3))
                .testTag("moments.strip")
                .semantics { contentDescription = if (spot != null) "Moments at ${spot.label ?: "this spot"}" else "Moments in view" },
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().height(44.dp).padding(start = Spacing.s4, end = 6.dp, top = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f).testTag("moments.strip.title")) {
                if (spot != null) {
                    Text(
                        text = spot.label ?: "This spot",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 18.sp,
                        color = PantopusColors.appText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        text = "${if (people == 1) "1 person" else "$people people"} · $newPeople new",
                        fontSize = 12.5.sp,
                        lineHeight = 16.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                } else {
                    Text(
                        text =
                            when {
                                loading -> "Moments near you"
                                failed -> "Couldn't load Moments"
                                newPeople > 0 -> "$newPeople new near you"
                                else -> "All caught up near you"
                            },
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                        modifier = Modifier.semantics { heading() },
                    )
                }
            }
            if (failed) {
                Text(
                    text = "Try again",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.primary600,
                    modifier = Modifier.clickable(role = Role.Button, onClick = onRetry).padding(horizontal = 10.dp, vertical = Spacing.s3),
                )
            } else if (shown.isNotEmpty()) {
                Row(
                    modifier =
                        Modifier
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(Radii.lg))
                            .clickable(role = Role.Button, onClick = onPlayAll)
                            .padding(horizontal = 10.dp)
                            .testTag("moments.playAll"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    PantopusIconImage(icon = PantopusIcon.Play, contentDescription = null, size = 14.dp, tint = PantopusColors.primary600)
                    Text(text = "Play all", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
                }
            }
        }
        if (loading) {
            Row(modifier = Modifier.padding(start = Spacing.s2, top = 2.dp), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                repeat(5) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Shimmer(width = 56.dp, height = 56.dp, cornerRadius = 28.dp)
                        Shimmer(width = 40.dp, height = 10.dp)
                    }
                }
            }
            return@Column
        }
        LazyRow(
            state = list,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = Spacing.s2, end = Spacing.s2, top = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            items(posts, key = { "posting:${it.momentId}" }) { item ->
                val author = item.author
                if (item.stage == MomentPosting.Stage.DONE && author != null) {
                    // Live: the cell its ring will be, until the map's read brings the ring.
                    MomentStripFace(
                        author = author,
                        seen = listOf(false),
                        label = "You",
                        modifier = Modifier.testTag("moments.strip.posting"),
                    )
                    return@items
                }
                MomentStripPosting(
                    progress = item.progress,
                    avatarUrl = avatarUrl,
                    author = author,
                    label = if (item.stage == MomentPosting.Stage.FAILED) "Try again" else "Posting",
                    modifier =
                        Modifier
                            .testTag("moments.strip.posting")
                            .clickable(role = Role.Button) { onPosting(item) }
                            .clearAndSetSemantics {
                                contentDescription = postingLabel(item)
                                role = Role.Button
                            },
                )
            }
            items(shown, key = { it.id }) { ring ->
                MomentStripFace(
                    author = ring.author,
                    seen = ring.seen,
                    label = ring.stripLabel,
                    modifier =
                        Modifier
                            .testTag("moments.strip.ring.${ring.id}")
                            .clickable(role = Role.Button) { onRing(ring) }
                            .clearAndSetSemantics {
                                contentDescription = ring.spoken
                                role = Role.Button
                            },
                )
            }
        }
    }
}

/** M3: nothing in view, so the card invites the first Moment. Without location, it asks for it. */
@Composable
private fun MomentsEmptyCard(
    place: String?,
    locationMissing: Boolean,
    onAdd: () -> Unit,
    onUseLocation: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .glass(RoundedCornerShape(Radii.xl3))
                .padding(18.dp)
                .testTag(if (locationMissing) "moments.locationAsk" else "moments.empty"),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape).background(PantopusColors.primary100),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CircleDashed,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.primary600,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = if (locationMissing) "See Moments near you" else "Nothing here right now",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    lineHeight = 20.sp,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text =
                        when {
                            locationMissing -> "Turn on location to see Moments around you."
                            place != null -> "Share what's happening at $place."
                            else -> "Share what's happening around you."
                        },
                    fontSize = 14.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(Radii.xl3))
                    .background(PantopusColors.primary600)
                    .clickable(role = Role.Button, onClick = if (locationMissing) onUseLocation else onAdd)
                    .testTag(if (locationMissing) "moments.locationAsk.use" else "moments.empty.add"),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (!locationMissing) {
                PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 18.dp, strokeWidth = 2.5f, tint = Color.White)
                Spacer(Modifier.width(Spacing.s2))
            }
            Text(
                text = if (locationMissing) "Use my location" else "Add a Moment",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
            )
        }
    }
}

/** The big + (board M1): sky, 60 dp, with its glow. */
@Composable
private fun AddButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .size(60.dp)
                .pantopusShadow(PantopusElevations.primary, CircleShape)
                .clip(CircleShape)
                .background(PantopusColors.primary600)
                .clickable(role = Role.Button, onClick = onClick)
                .testTag("moments.add")
                .clearAndSetSemantics {
                    contentDescription = "Add a Moment"
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 26.dp, strokeWidth = 2.5f, tint = Color.White)
    }
}

@Composable
private fun MapRoundButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = PantopusColors.appText,
) {
    Box(
        modifier =
            modifier
                .size(48.dp)
                .glass(CircleShape)
                .clickable(role = Role.Button, onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 20.dp, tint = tint)
    }
}

/** Glass over the map (board M1): white at 82%, a hairline border and the soft shadow. */
private fun Modifier.glass(shape: androidx.compose.ui.graphics.Shape): Modifier =
    this
        .pantopusShadow(PantopusElevations.md, shape)
        .clip(shape)
        .background(PantopusColors.mapGlass)
        .border(0.5.dp, PantopusColors.appBorder.copy(alpha = 0.5f), shape)

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

/** About neighborhood zoom, where the map opens (the proposal: "at about neighborhood zoom"). */
private const val START_ZOOM = 15f
private const val MIN_FETCH_ZOOM = 9f
private const val VIEWPORT_SETTLE_MS = 350L
private const val CAMERA_POLL_MS = 120L
private const val CLUSTER_MS = 400
private const val RECENTER_MS = 400
private const val ANIMATE_GRACE_MS = 400L
private const val REFRESH_MS = 60_000L

/** Wider than this (about zoom 9 on a phone) the map doesn't ask for rings. */
private const val MAX_FETCH_SPAN_DEGREES = 1.2
