package app.pantopus.android.ui.screens.nearby

import android.content.Context
import android.content.pm.PackageManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodCells
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Polygon
import com.google.maps.android.compose.rememberCameraPositionState

// ============================================================
// Nearby — the density-gated door and its window (Wedge v2 D2 / §4).
// One honest meter decides what this page is; the cells map is alive
// from the first minute. Locked surfaces render as a preview of a
// reward with a meter, never as empty rooms. Mirrors the web
// `/app/nearby` page.
// ============================================================

private data class NearbySurface(val icon: PantopusIcon, val title: String, val subtitle: String)

private val SURFACES =
    listOf(
        NearbySurface(PantopusIcon.Rss, "Pulse", "What your verified neighbors are saying"),
        NearbySurface(PantopusIcon.ShoppingBag, "Marketplace", "Buy, sell, and lend within walking distance"),
        NearbySurface(PantopusIcon.Briefcase, "Tasks", "Small jobs for the people next door"),
    )

@Composable
fun NearbyScreen(
    onClaim: () -> Unit,
    onOpenPulse: () -> Unit,
    onOpenMarketplace: () -> Unit,
    onOpenTasks: () -> Unit,
    viewModel: NearbyViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    Column(
        modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).verticalScroll(rememberScrollState()).testTag("nearbyTab"),
    ) {
        Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)) {
            Text("Nearby", fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp, color = PantopusColors.appText)
            Text(
                "Who's verified around your place, and what opens when enough households have. " +
                    "Day one here is real neighbors, not empty rooms.",
                fontSize = 13.5.sp,
                lineHeight = 19.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        when (val current = state) {
            NearbyUiState.Loading -> Placeholders()
            is NearbyUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::refresh)
            is NearbyUiState.Loaded ->
                Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (current.meter.state == "no_place") {
                        NoPlaceCard(onClaim)
                    } else {
                        current.cells?.let { NearbyCellsMap(it) }
                        if (current.meter.unlocked) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                PantopusIconImage(
                                    PantopusIcon.Sparkles,
                                    null,
                                    size = 16.dp,
                                    strokeWidth = 2f,
                                    tint = PantopusColors.primary600,
                                )
                                Text(
                                    "Your neighborhood is open — ${current.meter.verifiedCount ?: 0} verified households ${areaLabel(
                                        current.meter,
                                    )}.",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = PantopusColors.primary600,
                                )
                            }
                            SurfaceRows(locked = false, onOpenPulse, onOpenMarketplace, onOpenTasks)
                        } else {
                            MeterCard(current.meter)
                            Text(
                                "What opens at ${current.meter.threshold}",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = PantopusColors.appText,
                            )
                            SurfaceRows(locked = true, onOpenPulse, onOpenMarketplace, onOpenTasks)
                        }
                    }
                    Spacer(modifier = Modifier.height(96.dp))
                }
        }
    }
}

private fun areaLabel(meter: NeighborhoodMeter): String {
    val city = meter.area?.city?.takeIf { it.isNotBlank() } ?: return "near you"
    return "in $city"
}

// ─── The window: density by block cell ───────────────────────

/**
 * Verified households by block cell around the viewer's place, shaded by
 * the same floored buckets as the public preview. Nobody's home,
 * including the viewer's, is a point on this map.
 */
@Composable
fun NearbyCellsMap(cells: NeighborhoodCells) {
    val center = cells.center ?: return
    val target = remember(center) { LatLng(center.lat, center.lng) }
    val cameraState = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(target, CELLS_ZOOM) }
    val properties = remember { MapProperties(isMyLocationEnabled = false) }
    val uiSettings =
        remember {
            MapUiSettings(
                compassEnabled = false,
                mapToolbarEnabled = false,
                myLocationButtonEnabled = false,
                rotationGesturesEnabled = false,
                scrollGesturesEnabled = false,
                tiltGesturesEnabled = false,
                zoomControlsEnabled = false,
                zoomGesturesEnabled = false,
            )
        }
    // Without a Maps key (or offline) the Compose map draws a blank tile;
    // the cells still carry the whole message, so draw them flat instead,
    // the way web does when tiles are missing.
    val context = LocalContext.current
    val hasMapsKey = remember { hasGoogleMapsKey(context) }
    Column(modifier = Modifier.fillMaxWidth().placeCard().testTag("nearbyCellsMap")) {
        Box(modifier = Modifier.fillMaxWidth().height(240.dp).clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))) {
            if (hasMapsKey) {
                GoogleMap(
                    modifier = Modifier.fillMaxSize(),
                    cameraPositionState = cameraState,
                    properties = properties,
                    uiSettings = uiSettings,
                ) {
                    cells.cells.forEach { cell ->
                        val b = cell.bounds
                        if (b.size == 2 && b[0].size == 2 && b[1].size == 2) {
                            val (minLat, minLng) = b[0]
                            val (maxLat, maxLng) = b[1]
                            Polygon(
                                points =
                                    listOf(
                                        LatLng(minLat, minLng),
                                        LatLng(minLat, maxLng),
                                        LatLng(maxLat, maxLng),
                                        LatLng(maxLat, minLng),
                                    ),
                                fillColor = PantopusColors.primary600.copy(alpha = cellFillAlpha(cell.bucket)),
                                strokeColor = if (cell.isHome) PantopusColors.appText else PantopusColors.primary600.copy(alpha = 0.6f),
                                strokeWidth = if (cell.isHome) 5f else 2f,
                            )
                        }
                    }
                }
            } else {
                FlatCellsGrid(cells, modifier = Modifier.fillMaxSize().testTag("nearbyCellsGridFallback"))
            }
        }
        CellsLegend(cells)
    }
}

/** Four buckets in two columns at every width: no swatch ever orphans on a wrapped line. */
@Composable
private fun CellsLegend(cells: NeighborhoodCells) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CELL_LEGEND_ORDER.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                pair.forEach { bucket ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f),
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .size(11.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(
                                        PantopusColors.primary600.copy(
                                            alpha = maxOf(LEGEND_SWATCH_MIN_ALPHA, cellFillAlpha(bucket) + LEGEND_SWATCH_BOOST),
                                        ),
                                    ),
                        )
                        Text(
                            cells.buckets[bucket] ?: bucket,
                            fontSize = 12.sp,
                            color = PantopusColors.appTextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
        Text(
            "Cells, not rooftops: about a kilometre each, shaded by how many households have verified. " +
                "Your cell is outlined. No home is ever a dot.",
            fontSize = 12.sp,
            lineHeight = 16.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

/** True when the manifest carries a Google Maps key; the debug build may not. */
private fun hasGoogleMapsKey(context: Context): Boolean =
    runCatching {
        val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        !info.metaData?.getString("com.google.android.geo.API_KEY").isNullOrBlank()
    }.getOrDefault(false)

/**
 * The 5×5 cells drawn flat on the app background: same fills, same
 * outlined home cell, no basemap. Reads exactly like the map version.
 */
@Composable
private fun FlatCellsGrid(
    cells: NeighborhoodCells,
    modifier: Modifier = Modifier,
) {
    val boxes = cells.cells.filter { it.bounds.size == 2 && it.bounds[0].size == 2 && it.bounds[1].size == 2 }
    if (boxes.isEmpty()) return
    val minLat = boxes.minOf { it.bounds[0][0] }
    val maxLat = boxes.maxOf { it.bounds[1][0] }
    val minLng = boxes.minOf { it.bounds[0][1] }
    val maxLng = boxes.maxOf { it.bounds[1][1] }
    val fill = PantopusColors.primary600
    val outline = PantopusColors.appText
    val ground = PantopusColors.appSurfaceSunken
    Canvas(modifier = modifier.background(ground)) {
        val latSpan = (maxLat - minLat).takeIf { it > 0 } ?: return@Canvas
        val lngSpan = (maxLng - minLng).takeIf { it > 0 } ?: return@Canvas
        // Keep the cells square-ish and centered, whatever the card's aspect.
        val scale = minOf(size.width / lngSpan.toFloat(), size.height / latSpan.toFloat()) * GRID_INSET
        val gridW = lngSpan.toFloat() * scale
        val gridH = latSpan.toFloat() * scale
        val left = (size.width - gridW) / 2f
        val top = (size.height - gridH) / 2f
        val stroke = 1.dp.toPx()
        boxes.forEach { cell ->
            val x = left + ((cell.bounds[0][1] - minLng).toFloat() * scale)
            val w = ((cell.bounds[1][1] - cell.bounds[0][1]).toFloat() * scale)
            // Latitude grows upward; the canvas grows downward.
            val y = top + ((maxLat - cell.bounds[1][0]).toFloat() * scale)
            val h = ((cell.bounds[1][0] - cell.bounds[0][0]).toFloat() * scale)
            drawRect(color = fill.copy(alpha = cellFillAlpha(cell.bucket)), topLeft = Offset(x, y), size = Size(w, h))
            drawRect(
                color = if (cell.isHome) outline else fill.copy(alpha = 0.6f),
                topLeft = Offset(x, y),
                size = Size(w, h),
                style = Stroke(width = if (cell.isHome) stroke * 2.5f else stroke),
            )
        }
    }
}

private const val GRID_INSET = 0.9f

// ─── The meter ───────────────────────────────────────────────

@Composable
private fun MeterCard(meter: NeighborhoodMeter) {
    val forming = meter.state == "forming"
    val count = meter.verifiedCount ?: 0
    val fraction =
        if (forming) METER_MIN_FRACTION else (count.toFloat() / meter.threshold.coerceAtLeast(1)).coerceIn(METER_MIN_FRACTION, 1f)
    Column(
        modifier = Modifier.fillMaxWidth().placeCard().padding(20.dp).testTag("nearbyMeter"),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "VERIFIED NEIGHBORS ${areaLabel(meter).uppercase()}",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
            Text(
                "${if (forming) "< ${meter.kAnonMin}" else "$count"} / ${meter.threshold}",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
        }
        Box(modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)).background(PantopusColors.appBorder)) {
            Box(
                modifier =
                    Modifier.fillMaxWidth(
                        fraction,
                    ).fillMaxHeight().clip(RoundedCornerShape(5.dp)).background(PantopusColors.primary600),
            )
        }
        Text(
            if (forming) {
                "Your area is just forming — be one of the first ${meter.kAnonMin} verified households here. " +
                    "The neighborhood opens at ${meter.threshold}."
            } else {
                "$count households have verified their address nearby. At ${meter.threshold}, the neighborhood opens for everyone."
            },
            fontSize = 13.5.sp,
            lineHeight = 19.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun SurfaceRows(
    locked: Boolean,
    onOpenPulse: () -> Unit,
    onOpenMarketplace: () -> Unit,
    onOpenTasks: () -> Unit,
) {
    val actions = listOf(onOpenPulse, onOpenMarketplace, onOpenTasks)
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SURFACES.forEachIndexed { i, s ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .placeCard()
                        .then(if (locked) Modifier else Modifier.clickable(onClick = actions[i]))
                        .padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (locked) PantopusColors.appSurfaceSunken else PantopusColors.primary600),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        s.icon,
                        null,
                        size = 20.dp,
                        strokeWidth = 2f,
                        tint = if (locked) PantopusColors.appTextMuted else PantopusColors.appSurface,
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(s.title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                    Text(s.subtitle, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
                }
                PantopusIconImage(
                    if (locked) PantopusIcon.Lock else PantopusIcon.ChevronRight,
                    if (locked) "Locked" else null,
                    size = 16.dp,
                    strokeWidth = 2.25f,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun NoPlaceCard(onClaim: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().placeCard().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.Home, null, size = 28.dp, strokeWidth = 2f, tint = PantopusColors.home)
        }
        Text("First, tell us where home is", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            "Your neighborhood is measured around your place. Claim your address and this page becomes your block's progress meter.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            textAlign = TextAlign.Center,
            color = PantopusColors.appTextSecondary,
        )
        PrimaryButton(title = "Claim your address", onClick = onClaim, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun Placeholders() {
    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        listOf(240.dp, 112.dp, 80.dp).forEach { h ->
            Box(modifier = Modifier.fillMaxWidth().height(h).clip(RoundedCornerShape(16.dp)).background(PantopusColors.appSurfaceSunken))
        }
    }
}
