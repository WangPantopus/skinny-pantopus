@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.discoverhub

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the Discover hub screen root container. */
const val DISCOVER_HUB_TAG = "discoverHub"

/**
 * A11.3 Discover magazine. Compact map at the top, entity chips in the
 * sheet header, and three grouped rails in the body.
 */
@Composable
fun DiscoverHubScreen(
    onBack: () -> Unit,
    onSelect: (DiscoverHubTarget) -> Unit,
    onOpenMap: () -> Unit,
    viewModel: DiscoverHubViewModel = hiltViewModel(),
) {
    val state by viewModel.magazineState.collectAsStateWithLifecycle()
    val selectedFilter by viewModel.selectedMagazineFilter.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.onSelect = onSelect
        viewModel.loadMagazine()
    }

    DiscoverHubMagazineScreen(
        state = state,
        selectedFilter = selectedFilter,
        onBack = onBack,
        onOpenMap = onOpenMap,
        onSelectFilter = viewModel::selectMagazineFilter,
        onSelectTask = viewModel::selectTask,
        onSelectMarketplace = viewModel::selectMarketplaceItem,
        onSelectPost = viewModel::selectPost,
        onSeeAllTasks = viewModel::seeAllTasks,
        onSeeAllMarketplace = viewModel::seeAllMarketplace,
        onSeeAllPosts = viewModel::seeAllPosts,
        onRetry = viewModel::refreshMagazine,
        onNotify = viewModel::notifyWhenActive,
    )
}

@Composable
internal fun DiscoverHubMagazineScreen(
    state: DiscoverHubMagazineUiState,
    selectedFilter: DiscoverHubMapKind?,
    onBack: () -> Unit,
    onOpenMap: () -> Unit,
    onSelectFilter: (DiscoverHubMapKind?) -> Unit,
    onSelectTask: (String) -> Unit,
    onSelectMarketplace: (String) -> Unit,
    onSelectPost: (String) -> Unit,
    onSeeAllTasks: () -> Unit,
    onSeeAllMarketplace: () -> Unit,
    onSeeAllPosts: () -> Unit,
    onRetry: () -> Unit,
    onNotify: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val pins = (state as? DiscoverHubMagazineUiState.Populated)?.content?.pins.orEmpty()
    val cluster = (state as? DiscoverHubMagazineUiState.Populated)?.content?.cluster
    val statusTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .testTag(DISCOVER_HUB_TAG),
    ) {
        DiscoverCompactMapPreview(
            pins = pins,
            cluster = cluster,
            onOpenMap = onOpenMap,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(190.dp)
                    .align(Alignment.TopCenter),
        )

        DiscoverTopPill(
            onBack = onBack,
            onSearch = {},
            modifier =
                Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = statusTop + Spacing.s2, start = Spacing.s3, end = Spacing.s3),
        )

        DiscoverExpandMapButton(
            onOpenMap = onOpenMap,
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 150.dp, end = Spacing.s3),
        )

        Column(
            modifier =
                Modifier
                    .padding(top = 172.dp)
                    .fillMaxSize()
                    .shadow(elevation = 12.dp, shape = RoundedCornerShape(topStart = Radii.xl2, topEnd = Radii.xl2))
                    .clip(RoundedCornerShape(topStart = Radii.xl2, topEnd = Radii.xl2))
                    .background(PantopusColors.appSurface)
                    .testTag("discoverHubSheet"),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier =
                    Modifier
                        .padding(top = Spacing.s2, bottom = Spacing.s1)
                        .width(40.dp)
                        .height(4.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appBorderStrong),
            )
            DiscoverEntityChipRow(selectedFilter = selectedFilter, onSelect = onSelectFilter)
            when (state) {
                DiscoverHubMagazineUiState.Loading -> DiscoverHubLoadingBody()
                DiscoverHubMagazineUiState.Empty -> DiscoverHubEmptyBody(onNotify = onNotify)
                is DiscoverHubMagazineUiState.Populated ->
                    DiscoverHubRailsBody(
                        content = state.content,
                        onSelectTask = onSelectTask,
                        onSelectMarketplace = onSelectMarketplace,
                        onSelectPost = onSelectPost,
                        onSeeAllTasks = onSeeAllTasks,
                        onSeeAllMarketplace = onSeeAllMarketplace,
                        onSeeAllPosts = onSeeAllPosts,
                    )
                is DiscoverHubMagazineUiState.Error -> DiscoverHubErrorBody(message = state.message, onRetry = onRetry)
            }
        }
    }
}

// MARK: - Compact map

@Composable
private fun DiscoverCompactMapPreview(
    pins: List<DiscoverHubMapPin>,
    cluster: DiscoverHubMapCluster?,
    onOpenMap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        modifier =
            modifier
                .background(PantopusColors.appSurfaceSunken)
                .clickable(onClick = onOpenMap)
                .semantics { contentDescription = "Compact discover map. Opens Explore Map." }
                .testTag("discoverHubMapPreview"),
    ) {
        MapBlob(modifier = Modifier.offset(x = (-28).dp, y = 32.dp).size(width = 132.dp, height = 88.dp))
        MapBlob(modifier = Modifier.align(Alignment.BottomEnd).offset(x = (-30).dp, y = (-14).dp).size(width = 86.dp, height = 60.dp))
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 42.dp, y = (-44).dp)
                    .size(width = 158.dp, height = 120.dp)
                    .clip(RoundedCornerShape(Radii.xl3))
                    .background(PantopusColors.primary100),
        )
        MapRoads(modifier = Modifier.matchParentSize())
        pins.forEach { pin ->
            DiscoverMiniPin(
                pin = pin,
                modifier =
                    Modifier.offset(
                        x = maxWidth * pin.x - 21.dp,
                        y = maxHeight * pin.y - 21.dp,
                    ),
            )
        }
        if (cluster != null) {
            DiscoverMapCluster(
                cluster = cluster,
                modifier =
                    Modifier.offset(
                        x = maxWidth * cluster.x - 17.dp,
                        y = maxHeight * cluster.y - 17.dp,
                    ),
            )
        }
        DiscoverYouAreHereDot(
            modifier =
                Modifier.offset(
                    x = maxWidth * 0.46f - 14.dp,
                    y = maxHeight * 0.79f - 14.dp,
                ),
        )
    }
}

@Composable
private fun MapBlob(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.xl3))
                .background(PantopusColors.homeBg),
    )
}

@Composable
private fun MapRoads(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        fun road(
            strokeWidth: Float = 6f,
            build: Path.() -> Unit,
        ) {
            val path = Path().apply(build)
            drawPath(
                path = path,
                color = PantopusColors.appSurface.copy(alpha = 0.75f),
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
            )
        }
        road {
            moveTo(0f, size.height * 0.32f)
            cubicTo(size.width * 0.28f, size.height * 0.24f, size.width * 0.60f, size.height * 0.44f, size.width, size.height * 0.42f)
        }
        road(strokeWidth = 4f) {
            moveTo(0f, size.height * 0.76f)
            cubicTo(size.width * 0.26f, size.height * 0.88f, size.width * 0.58f, size.height * 0.72f, size.width, size.height * 0.84f)
        }
        road(strokeWidth = 4f) {
            moveTo(size.width * 0.22f, 0f)
            cubicTo(size.width * 0.26f, size.height * 0.28f, size.width * 0.16f, size.height * 0.64f, size.width * 0.24f, size.height)
        }
        road {
            moveTo(size.width * 0.50f, 0f)
            cubicTo(size.width * 0.56f, size.height * 0.32f, size.width * 0.46f, size.height * 0.58f, size.width * 0.50f, size.height)
        }
        road(strokeWidth = 4f) {
            moveTo(size.width * 0.78f, 0f)
            cubicTo(size.width * 0.72f, size.height * 0.34f, size.width * 0.84f, size.height * 0.62f, size.width * 0.74f, size.height)
        }
    }
}

@Composable
private fun DiscoverMiniPin(
    pin: DiscoverHubMapPin,
    modifier: Modifier = Modifier,
) {
    val pinShape = if (pin.kind == DiscoverHubMapKind.Item) RoundedCornerShape(Radii.sm) else CircleShape
    Box(modifier = modifier.size(42.dp), contentAlignment = Alignment.Center) {
        if (pin.pulses) {
            Box(
                modifier =
                    Modifier
                        .size(42.dp)
                        .clip(pinShape)
                        .background(pin.kind.color.copy(alpha = 0.22f)),
            )
        }
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .shadow(elevation = 4.dp, shape = pinShape)
                    .clip(pinShape)
                    .background(pin.kind.color)
                    .border(2.dp, PantopusColors.appSurface, pinShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = pin.kind.icon,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 2.6f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun DiscoverMapCluster(
    cluster: DiscoverHubMapCluster,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(34.dp)
                .shadow(elevation = 5.dp, shape = CircleShape)
                .clip(CircleShape)
                .background(PantopusColors.primary600)
                .border(3.dp, PantopusColors.appSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = cluster.count.toString(),
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appTextInverse,
        )
    }
}

@Composable
private fun DiscoverYouAreHereDot(modifier: Modifier = Modifier) {
    Box(modifier = modifier.size(28.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600.copy(alpha = 0.20f)),
        )
        Box(
            modifier =
                Modifier
                    .size(13.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600)
                    .border(3.dp, PantopusColors.appSurface, CircleShape)
                    .semantics { contentDescription = "You are here" },
        )
    }
}

// MARK: - Chrome

@Composable
private fun DiscoverTopPill(
    onBack: () -> Unit,
    onSearch: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(52.dp)
                .shadow(elevation = 8.dp, shape = RoundedCornerShape(Radii.pill))
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = Spacing.s1)
                .testTag("discoverHubTopPill"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButtonLike(
            icon = PantopusIcon.ChevronLeft,
            label = "Back",
            testTagId = "discoverHubBack",
            onClick = onBack,
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = "Discover",
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.weight(1f))
        IconButtonLike(
            icon = PantopusIcon.Search,
            label = "Search discovery",
            testTagId = "discoverHubSearch",
            onClick = onSearch,
        )
    }
}

@Composable
private fun IconButtonLike(
    icon: PantopusIcon,
    label: String,
    testTagId: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .clickable(onClick = onClick)
                .semantics { contentDescription = label }
                .testTag(testTagId),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appText,
        )
    }
}

@Composable
private fun DiscoverExpandMapButton(
    onOpenMap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .heightIn(min = 48.dp)
                .shadow(elevation = 6.dp, shape = RoundedCornerShape(Radii.pill))
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface.copy(alpha = 0.96f))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onOpenMap)
                .padding(horizontal = Spacing.s3)
                .semantics { contentDescription = "Expand map" }
                .testTag("discoverHubExpandMap"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(PantopusIcon.Map, contentDescription = null, size = 13.dp, strokeWidth = 2.2f)
        Text(
            text = "Expand map",
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
        )
    }
}

@Composable
private fun DiscoverEntityChipRow(
    selectedFilter: DiscoverHubMapKind?,
    onSelect: (DiscoverHubMapKind?) -> Unit,
) {
    val chips = listOf(null) + DiscoverHubMapKind.entries
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .testTag("discoverHubChips"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        chips.forEach { kind ->
            val active = kind == selectedFilter
            val label = kind?.pluralLabel ?: "All"
            Row(
                modifier =
                    Modifier
                        .height(44.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable { onSelect(kind) }
                        .semantics { contentDescription = if (kind == null) "Show all discovery" else "Show $label" }
                        .testTag("discoverHubChip_${kind?.key ?: "all"}"),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier =
                        Modifier
                            .height(28.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (active) PantopusColors.appText else PantopusColors.appSurface)
                            .border(
                                width = if (active) 0.dp else 1.dp,
                                color = if (active) Color.Transparent else PantopusColors.appBorder,
                                shape = RoundedCornerShape(Radii.pill),
                            )
                            .padding(horizontal = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    if (kind != null) {
                        Box(
                            modifier =
                                Modifier
                                    .size(7.dp)
                                    .clip(if (kind == DiscoverHubMapKind.Item) RoundedCornerShape(Radii.xs) else CircleShape)
                                    .background(if (active) PantopusColors.appTextInverse else kind.color),
                        )
                    }
                    Text(
                        text = label,
                        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                        color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                    )
                }
            }
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
}

// MARK: - Rails

@Composable
private fun DiscoverHubRailsBody(
    content: DiscoverHubMagazineContent,
    onSelectTask: (String) -> Unit,
    onSelectMarketplace: (String) -> Unit,
    onSelectPost: (String) -> Unit,
    onSeeAllTasks: () -> Unit,
    onSeeAllMarketplace: () -> Unit,
    onSeeAllPosts: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .testTag("discoverHubRails"),
    ) {
        DiscoverRailSectionHeader(
            icon = PantopusIcon.Hammer,
            color = DiscoverHubMapKind.Task.color,
            title = "Tasks near you",
            subcopy = "Closest first - 0.5 mi radius",
            onSeeAll = onSeeAllTasks,
            testTagId = "discoverHubTasksSeeAll",
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                    .testTag("discoverHubTasksRail"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            content.tasks.forEach { item -> DiscoverTaskRailCard(item = item, onTap = { onSelectTask(item.id) }) }
        }

        DiscoverRailSectionHeader(
            icon = PantopusIcon.Tag,
            color = DiscoverHubMapKind.Item.color,
            title = "Marketplace picks",
            subcopy = "Fresh listings - 4 new today",
            onSeeAll = onSeeAllMarketplace,
            testTagId = "discoverHubMarketplaceSeeAll",
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                    .testTag("discoverHubMarketplaceRail"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            content.marketplace.forEach { item ->
                DiscoverMarketplaceRailCard(item = item, onTap = { onSelectMarketplace(item.id) })
            }
        }

        DiscoverRailSectionHeader(
            icon = PantopusIcon.MessageCircle,
            color = DiscoverHubMapKind.Post.color,
            title = "From your block",
            subcopy = "Pulse posts - last 24h",
            onSeeAll = onSeeAllPosts,
            testTagId = "discoverHubPostsSeeAll",
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s1, bottom = Spacing.s4)
                    .testTag("discoverHubPostsRail"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            content.posts.forEach { item -> DiscoverPostRailCard(item = item, onTap = { onSelectPost(item.id) }) }
        }
    }
}

@Composable
private fun DiscoverRailSectionHeader(
    icon: PantopusIcon,
    color: Color,
    title: String,
    subcopy: String,
    onSeeAll: () -> Unit,
    testTagId: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4, bottom = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(color.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, strokeWidth = 2.4f, tint = color)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
            )
            Text(
                text = subcopy,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Row(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clickable(onClick = onSeeAll)
                    .semantics { contentDescription = "See all $title" }
                    .testTag(testTagId),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = "See all",
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.primary600,
            )
            PantopusIconImage(
                PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun DiscoverTaskRailCard(
    item: DiscoverHubTaskCard,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .width(208.dp)
                .shadow(elevation = 2.dp, shape = RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .semantics { contentDescription = "${item.title}, ${item.price}, ${item.distance}, ${item.bids}" }
                .testTag("discoverHubTaskCard_${item.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(42.dp).clip(RoundedCornerShape(Radii.lg)).background(DiscoverHubMapKind.Task.color),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.Hammer, contentDescription = null, size = Radii.xl2, tint = PantopusColors.appTextInverse)
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title,
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = item.price,
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.primary600,
                )
                Text(
                    text = "- ${item.distance}",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun DiscoverMarketplaceRailCard(
    item: DiscoverHubMarketplaceCard,
    onTap: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .width(148.dp)
                .shadow(elevation = 2.dp, shape = RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .semantics { contentDescription = "${item.title}, ${item.price}, ${item.distance}" }
                .testTag("discoverHubMarketplaceCard_${item.id}"),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(104.dp)
                    .background(DiscoverHubMapKind.Item.softColor),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(item.icon, contentDescription = null, size = 32.dp, strokeWidth = 1.7f, tint = DiscoverHubMapKind.Item.color)
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(Spacing.s2)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, DiscoverHubMapKind.Item.color.copy(alpha = 0.22f), RoundedCornerShape(Radii.pill))
                        .padding(horizontal = Spacing.s2),
            ) {
                Text(
                    text = "ITEM",
                    style = PantopusTextStyle.overline,
                    color = DiscoverHubMapKind.Item.color,
                )
            }
        }
        Column(modifier = Modifier.padding(Spacing.s2)) {
            Text(
                text = item.title,
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                minLines = 2,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = item.price,
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.primary600,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(text = item.distance, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
    }
}

@Composable
private fun DiscoverPostRailCard(
    item: DiscoverHubPostCard,
    onTap: () -> Unit,
) {
    val intentColor = if (item.intent == "Recommend") PantopusColors.home else PantopusColors.primary700
    val intentBackground = if (item.intent == "Recommend") PantopusColors.homeBg else PantopusColors.primary50
    Column(
        modifier =
            Modifier
                .width(264.dp)
                .shadow(elevation = 2.dp, shape = RoundedCornerShape(Radii.lg))
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onTap)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .semantics { contentDescription = "${item.intent}, ${item.title}, by ${item.author}, ${item.replies} replies" }
                .testTag("discoverHubPostCard_${item.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(intentBackground)
                        .padding(horizontal = Spacing.s2),
            ) {
                Text(text = item.intent.uppercase(), style = PantopusTextStyle.overline, color = intentColor)
            }
            Text(text = item.author, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        Text(
            text = item.title,
            style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = item.body,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextStrong,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(
                PantopusIcon.MessageSquare,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(text = "${item.replies} replies", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

// MARK: - Loading / empty / error

@Composable
private fun DiscoverHubLoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .semantics { contentDescription = "Loading discovery" }
                .testTag("discoverHubLoading"),
    ) {
        repeat(3) { index ->
            DiscoverSkeletonHeader(titleWidth = if (index == 1) 164.dp else 142.dp)
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                repeat(3) { DiscoverRailSkeletonCard(tall = index == 1) }
            }
        }
    }
}

@Composable
private fun DiscoverHubEmptyBody(onNotify: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s6, vertical = Spacing.s4)
                .testTag("discoverHubEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.primary50)
                    .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.xl)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                PantopusIcon.Sparkles,
                contentDescription = null,
                size = 22.dp,
                strokeWidth = 1.9f,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.height(Spacing.s3))
        Text(
            text = "Nothing to discover yet",
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Check back soon - as verified neighbors near you post, things will surface here grouped by category.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s1).widthIn(max = 264.dp),
        )
        Column(
            modifier = Modifier.padding(top = Spacing.s3).widthIn(max = 280.dp),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            DiscoverHubSampleData.emptySkeletonRailTitles.forEach { title ->
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(text = title.uppercase(), style = PantopusTextStyle.overline, color = PantopusColors.appTextMuted)
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        repeat(3) { DiscoverDiagonalSkeleton(modifier = Modifier.weight(1f)) }
                    }
                }
            }
        }
        Row(
            modifier =
                Modifier
                    .padding(top = Spacing.s4)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onNotify)
                    .padding(horizontal = Spacing.s4)
                    .semantics { contentDescription = "Notify me when active" }
                    .testTag("discoverHubNotify"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                PantopusIcon.Bell,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Notify me when active",
                style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appTextStrong,
            )
        }
    }
}

@Composable
private fun DiscoverHubErrorBody(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s6, vertical = Spacing.s8)
                .testTag("discoverHubError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(PantopusIcon.AlertCircle, contentDescription = null, size = 28.dp, tint = PantopusColors.error)
        Text(
            text = message,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Box(
            modifier =
                Modifier
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s5)
                    .semantics { contentDescription = "Try again" }
                    .testTag("discoverHubRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun DiscoverSkeletonHeader(titleWidth: androidx.compose.ui.unit.Dp) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s4, bottom = Spacing.s1),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(24.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken))
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Box(
                modifier =
                    Modifier.width(
                        titleWidth,
                    ).height(14.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken),
            )
            Box(
                modifier =
                    Modifier.width(
                        128.dp,
                    ).height(10.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken),
            )
        }
    }
}

@Composable
private fun DiscoverRailSkeletonCard(tall: Boolean) {
    if (tall) {
        Column(
            modifier =
                Modifier
                    .width(148.dp)
                    .height(164.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier.fillMaxWidth().height(
                        92.dp,
                    ).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
            )
            Box(
                modifier =
                    Modifier.width(
                        104.dp,
                    ).height(12.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken),
            )
            Box(
                modifier =
                    Modifier.width(
                        72.dp,
                    ).height(10.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken),
            )
        }
    } else {
        Row(
            modifier =
                Modifier
                    .width(208.dp)
                    .height(72.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.size(42.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken))
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Box(
                    modifier =
                        Modifier.width(
                            112.dp,
                        ).height(12.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken),
                )
                Box(
                    modifier =
                        Modifier.width(
                            78.dp,
                        ).height(10.dp).clip(RoundedCornerShape(Radii.sm)).background(PantopusColors.appSurfaceSunken),
                )
            }
        }
    }
}

@Composable
private fun DiscoverDiagonalSkeleton(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.md)),
    )
}
