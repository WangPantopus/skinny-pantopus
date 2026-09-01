@file:Suppress(
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "PackageNaming",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.mailbox.mailbox_map

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridDetent
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridDetentResolver
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private val SelectedMapHeight = 230.dp

@Composable
fun MailboxMapScreen(
    onBack: () -> Unit = {},
    viewModel: MailboxMapViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val detent by viewModel.detent.collectAsStateWithLifecycle()
    val activeKind by viewModel.activeKind.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.load() }

    MailboxMapScaffold(
        state = state,
        detent = detent,
        activeKind = activeKind,
        todayWeekday = viewModel.todayWeekday,
        onBack = onBack,
        onDetentChange = viewModel::setDetent,
        onSelectKind = viewModel::selectKind,
        onSelectSpot = viewModel::select,
        onBackToList = viewModel::backToList,
        onRetry = viewModel::refresh,
        onDirections = { spot -> openDirections(context, spot) },
    )
}

@Composable
internal fun MailboxMapStaticPreview(
    state: MailboxMapUiState,
    detent: MapListHybridDetent = MapListHybridDetent.Standard,
    activeKind: MailboxSpotKind? = null,
    todayWeekday: Int = 4,
    modifier: Modifier = Modifier,
) {
    MailboxMapScaffold(
        state = state,
        detent = detent,
        activeKind = activeKind,
        todayWeekday = todayWeekday,
        onBack = {},
        onDetentChange = {},
        onSelectKind = {},
        onSelectSpot = {},
        onBackToList = {},
        onRetry = {},
        onDirections = {},
        modifier = modifier,
    )
}

@Composable
private fun MailboxMapScaffold(
    state: MailboxMapUiState,
    detent: MapListHybridDetent,
    activeKind: MailboxSpotKind?,
    todayWeekday: Int,
    onBack: () -> Unit,
    onDetentChange: (MapListHybridDetent) -> Unit,
    onSelectKind: (MailboxSpotKind?) -> Unit,
    onSelectSpot: (String) -> Unit,
    onBackToList: () -> Unit,
    onRetry: () -> Unit,
    onDirections: (MailboxSpot) -> Unit,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("mailboxMap"),
    ) {
        val selected = state is MailboxMapUiState.Selected
        val mapHeight by animateDpAsState(
            targetValue = if (selected) SelectedMapHeight else maxHeight,
            animationSpec = tween(durationMillis = 240),
            label = "mailboxMapHeight",
        )
        val highlightedKind =
            when (state) {
                is MailboxMapUiState.Selected -> state.spot.kind
                else -> activeKind
            }

        MailboxMapCanvas(
            state = state,
            height = mapHeight,
            onSelectSpot = onSelectSpot,
            modifier = Modifier.align(Alignment.TopCenter),
        )

        Box(
            modifier =
                Modifier
                    .padding(WindowInsets.statusBars.asPaddingValues())
                    .padding(top = Spacing.s2, start = 14.dp, end = 14.dp)
                    .align(Alignment.TopCenter)
                    .fillMaxWidth(),
        ) {
            MailboxMapTopPill(onBack = onBack)
        }

        Box(
            modifier =
                Modifier
                    .padding(WindowInsets.statusBars.asPaddingValues())
                    .padding(top = 56.dp)
                    .align(Alignment.TopCenter)
                    .fillMaxWidth(),
        ) {
            MailboxCategoryChips(activeKind = highlightedKind, onSelectKind = onSelectKind)
        }

        if (selected) {
            val selectedState = state as MailboxMapUiState.Selected
            MailboxDetailPanel(
                spot = selectedState.spot,
                todayWeekday = todayWeekday,
                onBackToList = onBackToList,
                onDirections = { onDirections(selectedState.spot) },
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .height((maxHeight - SelectedMapHeight + 22.dp).coerceAtLeast(360.dp)),
            )
        } else {
            MailboxBottomSheet(
                state = state,
                detent = detent,
                containerHeight = maxHeight,
                onDetentChange = onDetentChange,
                onSelectSpot = onSelectSpot,
                onSelectKind = onSelectKind,
                onRetry = onRetry,
                onDirections = onDirections,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

@Composable
private fun MailboxMapCanvas(
    state: MailboxMapUiState,
    height: Dp,
    onSelectSpot: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(0.dp))
                .background(PantopusColors.appSurfaceSunken)
                .testTag("mailboxMapCanvas"),
    ) {
        MailboxMapDecor()
        when (state) {
            is MailboxMapUiState.Populated -> {
                state.spots.forEachIndexed { index, spot ->
                    MailboxMapPin(
                        kind = spot.kind,
                        pulsing = index == 0,
                        modifier =
                            Modifier
                                .offset(x = maxWidth * spot.mapX - 27.dp, y = maxHeight * spot.mapY - 27.dp)
                                .clickable { onSelectSpot(spot.id) }
                                .testTag("mailboxMapPin_${spot.id}")
                                .semantics { contentDescription = "${spot.name}, ${spot.kind.label}" },
                    )
                }
                YouAreHereDot(
                    modifier =
                        Modifier.offset(
                            x = maxWidth * MailboxMapSampleData.userAnchor.x - 14.dp,
                            y = maxHeight * MailboxMapSampleData.userAnchor.y - 14.dp,
                        ),
                )
            }
            is MailboxMapUiState.Selected -> {
                val pinPoint = Offset(0.30f, 0.42f)
                val anchorPoint = Offset(0.52f, 0.78f)
                state.spots
                    .filter { it.id != state.spot.id }
                    .take(3)
                    .forEach { spot ->
                        MailboxMapPin(
                            kind = spot.kind,
                            dimmed = true,
                            modifier =
                                Modifier.offset(
                                    x = maxWidth * spot.mapX - 27.dp,
                                    y = maxHeight * spot.mapY.coerceIn(0.16f, 0.62f) - 27.dp,
                                ),
                        )
                    }
                RouteLine(from = anchorPoint, to = pinPoint, modifier = Modifier.fillMaxSize())
                MailboxMapPin(
                    kind = state.spot.kind,
                    pulsing = true,
                    modifier =
                        Modifier
                            .offset(x = maxWidth * pinPoint.x - 27.dp, y = maxHeight * pinPoint.y - 27.dp)
                            .testTag("mailboxMapPin_${state.spot.id}")
                            .semantics { contentDescription = "${state.spot.name}, selected" },
                )
                YouAreHereDot(
                    modifier =
                        Modifier.offset(
                            x = maxWidth * anchorPoint.x - 14.dp,
                            y = maxHeight * anchorPoint.y - 14.dp,
                        ),
                )
            }
            MailboxMapUiState.Loading,
            is MailboxMapUiState.Error,
            -> {
                YouAreHereDot(
                    modifier =
                        Modifier.offset(
                            x = maxWidth * MailboxMapSampleData.userAnchor.x - 14.dp,
                            y = maxHeight * MailboxMapSampleData.userAnchor.y - 14.dp,
                        ),
                )
            }
        }
    }
}

@Composable
private fun MailboxMapDecor() {
    Canvas(modifier = Modifier.fillMaxSize()) {
        drawOval(
            color = PantopusColors.homeBg,
            topLeft = Offset(x = -20f, y = size.height * 0.10f),
            size = Size(width = 150f, height = 110f),
        )
        drawOval(
            color = PantopusColors.homeBg,
            topLeft = Offset(x = size.width * 0.78f, y = size.height * 0.30f),
            size = Size(width = 96f, height = 70f),
        )
        drawOval(
            color = PantopusColors.primary50,
            topLeft = Offset(x = size.width * 0.70f, y = -30f),
            size = Size(width = 190f, height = 140f),
        )
        val streetStroke = Stroke(width = 6f, cap = StrokeCap.Round)
        val thinStreetStroke = Stroke(width = 4f, cap = StrokeCap.Round)

        fun streetPath(
            y: Float,
            amplitude: Float,
        ): Path =
            Path().apply {
                moveTo(0f, size.height * y)
                quadraticBezierTo(
                    size.width * 0.5f,
                    size.height * (y + amplitude),
                    size.width,
                    size.height * (y + 0.02f),
                )
            }
        drawPath(streetPath(0.18f, -0.03f), Color.White, style = streetStroke)
        drawPath(streetPath(0.40f, 0.03f), Color.White, style = thinStreetStroke)
        drawPath(streetPath(0.62f, -0.02f), Color.White, style = streetStroke)
        listOf(0.26f to thinStreetStroke, 0.58f to streetStroke, 0.82f to thinStreetStroke).forEach { (x, stroke) ->
            val path =
                Path().apply {
                    moveTo(size.width * x, 0f)
                    quadraticBezierTo(
                        size.width * (x - 0.03f),
                        size.height * 0.5f,
                        size.width * (x + 0.02f),
                        size.height,
                    )
                }
            drawPath(path, Color.White, style = stroke)
        }
    }
}

@Composable
private fun RouteLine(
    from: Offset,
    to: Offset,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier) {
        val start = Offset(size.width * from.x, size.height * from.y)
        val end = Offset(size.width * to.x, size.height * to.y)
        val path =
            Path().apply {
                moveTo(start.x, start.y)
                quadraticBezierTo(
                    (start.x + end.x) / 2f - 24f,
                    (start.y + end.y) / 2f - 12f,
                    end.x,
                    end.y,
                )
            }
        drawPath(
            path = path,
            color = PantopusColors.primary600.copy(alpha = 0.85f),
            style =
                Stroke(
                    width = 3f,
                    cap = StrokeCap.Round,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(2f, 6f)),
                ),
        )
    }
}

@Composable
private fun MailboxMapPin(
    kind: MailboxSpotKind,
    modifier: Modifier = Modifier,
    pulsing: Boolean = false,
    dimmed: Boolean = false,
) {
    val inspection = LocalInspectionMode.current
    val pulseScale: Float
    val pulseAlpha: Float
    if (pulsing && !inspection) {
        val transition = rememberInfiniteTransition(label = "mailboxPinPulse")
        pulseScale =
            transition.animateFloat(
                initialValue = 0.7f,
                targetValue = 1.5f,
                animationSpec =
                    infiniteRepeatable(
                        animation = tween(durationMillis = 1600),
                        repeatMode = RepeatMode.Restart,
                    ),
                label = "mailboxPinPulseScale",
            ).value
        pulseAlpha =
            transition.animateFloat(
                initialValue = 0.6f,
                targetValue = 0f,
                animationSpec =
                    infiniteRepeatable(
                        animation = tween(durationMillis = 1600),
                        repeatMode = RepeatMode.Restart,
                    ),
                label = "mailboxPinPulseAlpha",
            ).value
    } else {
        pulseScale = if (pulsing) 1.18f else 1f
        pulseAlpha = if (pulsing) 0.22f else 0f
    }

    Box(
        modifier = modifier.size(54.dp).alpha(if (dimmed) 0.42f else 1f),
        contentAlignment = Alignment.Center,
    ) {
        if (pulsing) {
            Box(
                modifier =
                    Modifier
                        .size(54.dp)
                        .scale(pulseScale)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(kind.color.copy(alpha = pulseAlpha)),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(7.dp)
                    .offset(y = 14.dp)
                    .graphicsLayer { rotationZ = 45f }
                    .background(kind.color),
        )
        Box(
            modifier =
                Modifier
                    .size(26.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(kind.color)
                    .border(2.dp, Color.White, RoundedCornerShape(Radii.sm))
                    .shadow(elevation = 3.dp, shape = RoundedCornerShape(Radii.sm)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = kind.glyph,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun YouAreHereDot(modifier: Modifier = Modifier) {
    Box(modifier = modifier.size(28.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600.copy(alpha = 0.18f)),
        )
        Box(
            modifier =
                Modifier
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600)
                    .border(3.dp, Color.White, CircleShape),
        )
    }
}

@Composable
private fun MailboxMapTopPill(onBack: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.pill))
                .background(Color.White.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .shadow(elevation = 8.dp, shape = RoundedCornerShape(Radii.pill))
                .padding(start = 6.dp, end = Spacing.s2, top = Spacing.s2, bottom = Spacing.s2)
                .testTag("mailboxMapPill"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onBack)
                    .testTag("mailboxMapBack")
                    .semantics { contentDescription = "Back" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appText,
            )
        }
        Row(
            modifier = Modifier.weight(1f).semantics { heading() },
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Mailbox map",
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Spacer(modifier = Modifier.width(Spacing.s8))
    }
}

@Composable
private fun MailboxCategoryChips(
    activeKind: MailboxSpotKind?,
    onSelectKind: (MailboxSpotKind?) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 14.dp)
                .testTag("mailboxMapChips"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        MailboxCategoryChip(
            label = "All",
            color = PantopusColors.primary600,
            active = activeKind == null,
            tag = "all",
            onClick = { onSelectKind(null) },
        )
        MailboxSpotKind.entries.forEach { kind ->
            MailboxCategoryChip(
                label = kind.label,
                color = kind.color,
                active = activeKind == kind,
                tag = kind.key,
                onClick = { onSelectKind(kind) },
            )
        }
    }
}

@Composable
private fun MailboxCategoryChip(
    label: String,
    color: Color,
    active: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .height(28.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (active) color else Color.White.copy(alpha = 0.96f))
                .border(
                    width = if (active) 0.dp else 1.dp,
                    color = if (active) Color.Transparent else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .shadow(elevation = 4.dp, shape = RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag("mailboxMapChip_$tag"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (tag != "all") {
            Box(
                modifier =
                    Modifier
                        .size(7.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(if (active) PantopusColors.appTextInverse else color),
            )
        }
        Text(
            text = label,
            style = PantopusTextStyle.overline,
            fontWeight = FontWeight.SemiBold,
            color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
            maxLines = 1,
        )
    }
}

@Composable
private fun MailboxBottomSheet(
    state: MailboxMapUiState,
    detent: MapListHybridDetent,
    containerHeight: Dp,
    onDetentChange: (MapListHybridDetent) -> Unit,
    onSelectSpot: (String) -> Unit,
    onSelectKind: (MailboxSpotKind?) -> Unit,
    onRetry: () -> Unit,
    onDirections: (MailboxSpot) -> Unit,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    var dragDelta by remember { mutableFloatStateOf(0f) }
    val baseHeight = detent.height(containerHeight)
    val baseHeightPx = with(density) { baseHeight.toPx() }
    val targetHeightPx = (baseHeightPx - dragDelta).coerceAtLeast(with(density) { 120.dp.toPx() })
    val targetHeight = with(density) { targetHeightPx.toDp() }
    val animatedHeight by animateDpAsState(
        targetValue = targetHeight,
        animationSpec = tween(durationMillis = 220),
        label = "mailboxSheetHeight",
    )
    val spots = (state as? MailboxMapUiState.Populated)?.spots.orEmpty()

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .height(animatedHeight)
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .background(PantopusColors.appSurface)
                .shadow(elevation = 10.dp, shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .draggable(
                    orientation = Orientation.Vertical,
                    state = rememberDraggableState { delta -> dragDelta += delta },
                    onDragStopped = { velocity ->
                        val targetsPx =
                            MapListHybridDetent.entries.associateWith { stop ->
                                with(density) { stop.height(containerHeight).toPx() }
                            }
                        val next =
                            MapListHybridDetentResolver.resolve(
                                current = detent,
                                velocity = velocity,
                                displacedHeightPx = baseHeightPx - dragDelta,
                                targetsPx = targetsPx,
                            )
                        onDetentChange(next)
                        dragDelta = 0f
                    },
                )
                .testTag("mailboxMapSheet"),
    ) {
        SheetGrabber()
        SheetHeader(
            title =
                when (state) {
                    MailboxMapUiState.Loading -> "Finding spots nearby"
                    is MailboxMapUiState.Populated -> "${spots.size} ${if (spots.size == 1) "spot" else "spots"} nearby"
                    is MailboxMapUiState.Error -> "Mailbox spots"
                    is MailboxMapUiState.Selected -> ""
                },
            showDirections = spots.isNotEmpty(),
            onDirections = { spots.firstOrNull()?.let(onDirections) },
        )
        when (state) {
            MailboxMapUiState.Loading -> LoadingRail()
            is MailboxMapUiState.Populated -> PopulatedSheetBody(state.spots, detent, onSelectSpot, onSelectKind, onDirections)
            is MailboxMapUiState.Error -> ErrorSheet(message = state.message, onRetry = onRetry)
            is MailboxMapUiState.Selected -> Unit
        }
    }
}

@Composable
private fun SheetGrabber() {
    Box(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2, bottom = Spacing.s1),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(width = 40.dp, height = 4.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appBorderStrong),
        )
    }
}

@Composable
private fun SheetHeader(
    title: String,
    showDirections: Boolean,
    onDirections: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 18.dp, end = 18.dp, top = Spacing.s1, bottom = Spacing.s3)
                .testTag("mailboxMapSheetHeader"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        if (showDirections) {
            Row(
                modifier =
                    Modifier
                        .height(32.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable(onClick = onDirections)
                        .padding(horizontal = Spacing.s2)
                        .testTag("mailboxMapHeaderDirections")
                        .semantics { contentDescription = "Directions to nearest mailbox spot" },
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Navigation,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.primary700,
                )
                Text(
                    text = "Directions",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
            }
        }
    }
}

@Composable
private fun PopulatedSheetBody(
    spots: List<MailboxSpot>,
    detent: MapListHybridDetent,
    onSelectSpot: (String) -> Unit,
    onSelectKind: (MailboxSpotKind?) -> Unit,
    onDirections: (MailboxSpot) -> Unit,
) {
    if (spots.isEmpty()) {
        EmptySheet(onShowAll = { onSelectKind(null) })
        return
    }
    when (detent) {
        MapListHybridDetent.Collapsed -> CollapsedPrompt()
        MapListHybridDetent.Standard -> StandardRail(spots, onSelectSpot, onDirections)
        MapListHybridDetent.Expanded -> ExpandedSpotList(spots, onSelectSpot, onDirections)
    }
}

@Composable
private fun StandardRail(
    spots: List<MailboxSpot>,
    onSelectSpot: (String) -> Unit,
    onDirections: (MailboxSpot) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier =
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .testTag("mailboxMapRail"),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            spots.forEachIndexed { index, spot ->
                MailboxSpotCard(
                    spot = spot,
                    active = index == 0,
                    onTap = { onSelectSpot(spot.id) },
                    onDirections = { onDirections(spot) },
                )
            }
        }
        PaginationDots(total = minOf(spots.size, 4), index = 0, modifier = Modifier.padding(vertical = Spacing.s3))
    }
}

@Composable
private fun ExpandedSpotList(
    spots: List<MailboxSpot>,
    onSelectSpot: (String) -> Unit,
    onDirections: (MailboxSpot) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .testTag("mailboxMapList"),
    ) {
        spots.forEach { spot ->
            MailboxSpotRow(
                spot = spot,
                onTap = { onSelectSpot(spot.id) },
                onDirections = { onDirections(spot) },
            )
        }
        Spacer(modifier = Modifier.height(80.dp))
    }
}

@Composable
private fun MailboxSpotCard(
    spot: MailboxSpot,
    active: Boolean,
    onTap: () -> Unit,
    onDirections: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .width(266.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (active) 2.dp else 1.dp,
                    color = if (active) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(14.dp),
                )
                .shadow(
                    elevation = if (active) 6.dp else 2.dp,
                    shape = RoundedCornerShape(14.dp),
                )
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("mailboxMapCard_${spot.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        KindTile(kind = spot.kind, size = 44.dp, radius = Radii.md)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = spot.name,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                StatusBadge(open = spot.isOpen)
                Text(
                    text = spot.hoursLabel,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            ServiceChipRow(services = spot.services.take(2))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 11.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = spot.walkLabel,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                )
            }
        }
        DirectionGlyphButton(
            active = active,
            contentDescription = "Directions to ${spot.name}",
            tag = "mailboxMapCardDirections_${spot.id}",
            onClick = onDirections,
        )
    }
}

@Composable
private fun MailboxSpotRow(
    spot: MailboxSpot,
    onTap: () -> Unit,
    onDirections: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .clickable(onClick = onTap)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("mailboxMapRow_${spot.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        KindTile(kind = spot.kind, size = 44.dp, radius = 10.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = spot.name,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                StatusBadge(open = spot.isOpen)
                Text(text = spot.hoursLabel, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
            ServiceChipRow(services = spot.services.take(3))
            Text(text = spot.walkLabel, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        DirectionGlyphButton(
            active = false,
            contentDescription = "Directions to ${spot.name}",
            tag = "mailboxMapRowDirections_${spot.id}",
            onClick = onDirections,
        )
    }
}

@Composable
private fun KindTile(
    kind: MailboxSpotKind,
    size: Dp,
    radius: Dp,
) {
    Box(
        modifier =
            Modifier
                .size(size)
                .clip(RoundedCornerShape(radius))
                .background(kind.color),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = kind.glyph,
            contentDescription = null,
            size = Radii.xl2,
            strokeWidth = 2f,
            tint = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun DirectionGlyphButton(
    active: Boolean,
    contentDescription: String,
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (active) PantopusColors.primary600 else PantopusColors.primary50)
                .border(
                    width = if (active) 0.dp else 1.dp,
                    color = if (active) Color.Transparent else PantopusColors.primary200,
                    shape = RoundedCornerShape(10.dp),
                )
                .clickable(onClick = onClick)
                .testTag(tag)
                .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Navigation,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2.2f,
            tint = if (active) PantopusColors.appTextInverse else PantopusColors.primary700,
        )
    }
}

@Composable
private fun ServiceChipRow(services: List<MailboxServiceType>) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        services.forEach { service ->
            Text(
                text = service.chipLabel,
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextStrong,
                maxLines = 1,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(PantopusColors.appSurfaceMuted)
                        .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.xs))
                        .padding(horizontal = 5.dp, vertical = 1.dp),
            )
        }
    }
}

@Composable
private fun StatusBadge(open: Boolean) {
    Text(
        text = if (open) "OPEN" else "CLOSED",
        style = PantopusTextStyle.overline,
        fontWeight = FontWeight.Bold,
        color = if (open) PantopusColors.success else PantopusColors.error,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.xs))
                .background(if (open) PantopusColors.successBg else PantopusColors.errorBg)
                .padding(horizontal = 5.dp, vertical = 1.dp),
    )
}

@Composable
private fun CollapsedPrompt() {
    Box(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4), contentAlignment = Alignment.Center) {
        Row(
            modifier =
                Modifier
                    .height(36.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                    .padding(horizontal = Spacing.s3)
                    .testTag("mailboxMapCollapsedPrompt"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronUp,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(text = "Drag up to see the list", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun EmptySheet(onShowAll: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s6).testTag("mailboxMapEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        KindTile(kind = MailboxSpotKind.Post, size = 48.dp, radius = Radii.lg)
        Text(
            text = "No spots match this filter",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Try all mailbox kinds nearby.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Box(
            modifier =
                Modifier
                    .height(40.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onShowAll)
                    .padding(horizontal = Spacing.s4)
                    .testTag("mailboxMapShowAll"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Show all spots",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun LoadingRail() {
    Row(
        modifier =
            Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .testTag("mailboxMapLoading"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        repeat(3) {
            Row(
                modifier =
                    Modifier
                        .width(266.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                        .padding(Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Shimmer(width = 44.dp, height = 44.dp, cornerRadius = Radii.md)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Shimmer(width = 128.dp, height = 14.dp)
                    Shimmer(width = 96.dp, height = 12.dp)
                    Shimmer(width = 150.dp, height = 12.dp)
                }
                Spacer(modifier = Modifier.weight(1f))
                Shimmer(width = 44.dp, height = 44.dp, cornerRadius = 10.dp)
            }
        }
    }
}

@Composable
private fun ErrorSheet(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s6).testTag("mailboxMapError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 28.dp,
            tint = PantopusColors.error,
        )
        Text(text = message, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary, textAlign = TextAlign.Center)
        Box(
            modifier =
                Modifier
                    .height(38.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4)
                    .testTag("mailboxMapRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "Try again", style = PantopusTextStyle.caption, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
    }
}

@Composable
private fun MailboxDetailPanel(
    spot: MailboxSpot,
    todayWeekday: Int,
    onBackToList: () -> Unit,
    onDirections: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .background(PantopusColors.appSurface)
                .shadow(elevation = 10.dp, shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                .testTag("mailboxMapDetail"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier =
                    Modifier
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable(onClick = onBackToList)
                        .padding(end = Spacing.s2)
                        .testTag("mailboxMapBackToList"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Back to list",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Spacer(modifier = Modifier.weight(1f))
        }

        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 18.dp, vertical = Spacing.s3),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KindTile(kind = spot.kind, size = 44.dp, radius = 10.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = spot.name, style = PantopusTextStyle.body, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                    Text(text = spot.address, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
            }
            DetailStatusChips(spot = spot, modifier = Modifier.padding(top = Spacing.s3))
            DetailServices(spot = spot, modifier = Modifier.padding(top = 14.dp))
            WeekHoursStrip(spot = spot, todayWeekday = todayWeekday, modifier = Modifier.padding(top = 14.dp))
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorderSubtle)
                    .padding(start = 14.dp, end = 14.dp, top = 10.dp, bottom = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(46.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onDirections)
                        .testTag("mailboxMapDetailDirections")
                        .semantics { contentDescription = "Directions to ${spot.name}" },
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Navigation,
                    contentDescription = null,
                    size = Radii.xl,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextInverse,
                )
                Spacer(modifier = Modifier.width(Spacing.s2))
                Text(
                    text = "Directions",
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun DetailStatusChips(
    spot: MailboxSpot,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            MetaChip(
                text = spot.statusLabel,
                icon = null,
                color = if (spot.isOpen) PantopusColors.success else PantopusColors.error,
                background = if (spot.isOpen) PantopusColors.successBg else PantopusColors.errorBg,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            MetaChip(text = spot.walkLabel, icon = PantopusIcon.MapPin)
            spot.lastPickupLabel?.let { MetaChip(text = it, icon = PantopusIcon.Clock) }
        }
    }
}

@Composable
private fun MetaChip(
    text: String,
    icon: PantopusIcon? = null,
    color: Color = PantopusColors.appTextStrong,
    background: Color = PantopusColors.appSurfaceMuted,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (icon == null) {
            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(color))
        } else {
            PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, strokeWidth = 2.2f, tint = color)
        }
        Text(text = text, style = PantopusTextStyle.caption, fontWeight = FontWeight.Bold, color = color)
    }
}

@Composable
private fun DetailServices(
    spot: MailboxSpot,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionLabel("Services")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("mailboxMapServices")) {
            spot.services.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
                    row.forEach { service ->
                        ServiceGridCell(service = service, modifier = Modifier.weight(1f))
                    }
                    if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ServiceGridCell(
    service: MailboxServiceType,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = service.icon,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.primary700,
            )
        }
        Text(
            text = service.label,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun WeekHoursStrip(
    spot: MailboxSpot,
    todayWeekday: Int,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth().testTag("mailboxMapHours"), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionLabel("Hours this week")
        Row(horizontalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.fillMaxWidth()) {
            spot.weekHours.forEach { day ->
                val today = day.weekday == todayWeekday
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (today) PantopusColors.primary50 else PantopusColors.appSurfaceMuted)
                            .border(
                                1.dp,
                                if (today) PantopusColors.primary200 else PantopusColors.appBorderSubtle,
                                RoundedCornerShape(Radii.md),
                            )
                            .padding(vertical = 7.dp)
                            .semantics { contentDescription = "${day.label}: ${day.hours}${if (today) ", today" else ""}" },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = day.label,
                        style = PantopusTextStyle.overline,
                        fontWeight = FontWeight.Bold,
                        color = if (today) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = day.hours,
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.SemiBold,
                        color = if (today) PantopusColors.primary700 else PantopusColors.appTextStrong,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appTextMuted,
    )
}

@Composable
private fun PaginationDots(
    total: Int,
    index: Int,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
        repeat(total.coerceAtLeast(1)) { i ->
            Box(
                modifier =
                    Modifier
                        .padding(horizontal = 2.5.dp)
                        .size(width = if (i == index) 16.dp else 5.dp, height = 5.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (i == index) PantopusColors.primary600 else PantopusColors.appBorderStrong),
            )
        }
    }
}

private fun openDirections(
    context: Context,
    spot: MailboxSpot,
) {
    val uri = Uri.parse("geo:0,0?q=${Uri.encode(spot.address)}")
    val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(intent) }
}
