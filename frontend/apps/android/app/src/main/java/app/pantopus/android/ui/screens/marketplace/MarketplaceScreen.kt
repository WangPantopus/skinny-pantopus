@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.marketplace

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
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/**
 * Marketplace tab (T2.5). Bespoke 2-column image grid. Three frames:
 * shimmer loading, shopping-bag empty + radius hint, populated grid.
 * Card has a 104dp gradient-placeholder image with an icon glyph
 * until a photo loads, 2-line title with min-height for grid
 * alignment, price (primary blue or success green + "Free"), and
 * distance · age meta. Optional condition badge top-left of image,
 * suppressed for Rentals / Free per design. Compose FAB is identity-
 * business violet.
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun MarketplaceScreen(
    onOpenListing: (String) -> Unit = {},
    onCompose: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    viewModel: MarketplaceViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeCategory by viewModel.activeCategory.collectAsStateWithLifecycle()
    val searchText by viewModel.searchText.collectAsStateWithLifecycle()
    val isLoadingMore by viewModel.isLoadingMore.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()

    // Re-fires when popping back from the compose wizard or a listing
    // detail — refresh so a just-posted listing appears (iOS onAppear).
    LaunchedEffect(Unit) { viewModel.load() }

    val pullState = rememberPullRefreshState(refreshing = isRefreshing, onRefresh = viewModel::refresh)
    // Cold first load shimmers the whole chrome (A08 loading frame);
    // later loads keep the search bar + chips live.
    val isInitialLoading = state is MarketplaceUiState.Loading && !viewModel.hasLoadedOnce

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("marketplace"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            MarketTopBar(onBack = onBack)
            if (isInitialLoading) {
                MarketplaceChromeSkeleton()
            } else {
                MarketSearchBar(
                    text = searchText,
                    onTextChange = viewModel::setSearchText,
                    onSubmit = viewModel::submitSearch,
                )
                MarketCategoryChips(active = activeCategory, onSelect = viewModel::selectCategory)
            }
            Box(modifier = Modifier.fillMaxSize().pullRefresh(pullState)) {
                when (val s = state) {
                    is MarketplaceUiState.Loading -> LoadingFrame()
                    is MarketplaceUiState.Empty ->
                        EmptyFrame(
                            radiusMiles = s.radiusMiles,
                            canWiden = viewModel.canWidenRadius,
                            onWiden = viewModel::widenRadius,
                            onCompose = onCompose,
                        )
                    is MarketplaceUiState.Loaded ->
                        PopulatedFrame(
                            rows = s.rows,
                            isLoadingMore = isLoadingMore,
                            onOpen = onOpenListing,
                            onItemVisible = viewModel::loadMoreIfNeeded,
                        )
                    is MarketplaceUiState.Error -> ErrorFrame(message = s.message, onRetry = viewModel::refresh)
                }
                PullRefreshIndicator(
                    refreshing = isRefreshing,
                    state = pullState,
                    modifier = Modifier.align(Alignment.TopCenter),
                )
            }
        }
        ComposeFab(
            onClick = onCompose,
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = Spacing.s4, bottom = Spacing.s10)
                    .testTag("marketplaceComposeFAB"),
        )
    }
}

// MARK: - Chrome

@Composable
private fun MarketTopBar(onBack: (() -> Unit)?) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s4, end = Spacing.s2, top = Spacing.s3, bottom = Spacing.s1)
                .testTag("marketplaceTopBar"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
        }
        Text(
            text = "Marketplace",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
    }
}

@Composable
private fun MarketSearchBar(
    text: String,
    onTextChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 14.dp)
                .heightIn(min = 44.dp)
                .testTag("marketplaceSearchBar"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 17.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Box(modifier = Modifier.weight(1f)) {
            if (text.isEmpty()) {
                Text(
                    text = "Search goods, rentals, free…",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                )
            }
            BasicTextField(
                value = text,
                onValueChange = onTextChange,
                textStyle =
                    TextStyle(
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appText,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { onSubmit() }),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (text.isNotEmpty()) {
            Box(
                modifier =
                    Modifier
                        .size(20.dp)
                        .clip(CircleShape)
                        .clickable {
                            onTextChange("")
                            onSubmit()
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = "Clear search",
                    size = 14.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
internal fun MarketCategoryChips(
    active: MarketplaceCategory,
    onSelect: (MarketplaceCategory) -> Unit,
) {
    val scrollState = rememberScrollState()
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(scrollState)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("marketplaceChipRow"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MarketplaceCategory.entries.forEach { category ->
            val selected = category == active
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (selected) PantopusColors.primary600 else PantopusColors.appSurface)
                        .border(
                            width = if (selected) 0.dp else 1.dp,
                            color = if (selected) Color.Transparent else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.pill),
                        )
                        .clickable { onSelect(category) }
                        .padding(horizontal = 14.dp)
                        .heightIn(min = 28.dp)
                        .testTag("marketplaceChip_${category.key}"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = category.label,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (selected) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                )
            }
        }
    }
}

@Composable
private fun ComposeFab(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(52.dp)
                .shadow(elevation = 12.dp, shape = CircleShape)
                .clip(CircleShape)
                .background(PantopusColors.business)
                .clickable(onClick = onClick)
                .semantics { contentDescription = "Snap & sell" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Camera,
            contentDescription = null,
            size = 22.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextInverse,
        )
    }
}

// MARK: - Frames

/**
 * A08 cold-load frame — the search bar and chip row shimmer together
 * with the grid until the first fetch completes. Mirrors iOS
 * `MarketplaceChromeSkeleton`.
 */
@Composable
internal fun MarketplaceChromeSkeleton() {
    Column(modifier = Modifier.fillMaxWidth()) {
        Shimmer(
            height = 44.dp,
            cornerRadius = Radii.lg,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            listOf(50, 64, 76, 60, 84).forEach { width ->
                Shimmer(width = width.dp, height = 28.dp, cornerRadius = Radii.pill)
            }
        }
    }
}

@Composable
internal fun LoadingFrame() {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize().testTag("marketplaceLoading"),
        contentPadding = PaddingValues(start = Spacing.s4, end = Spacing.s4, top = Spacing.s1, bottom = 110.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(6) { ListingSkeletonCard() }
    }
}

@Composable
internal fun EmptyFrame(
    radiusMiles: Double,
    canWiden: Boolean,
    onWiden: () -> Unit,
    onCompose: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s6)
                .testTag("marketplaceEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShoppingBag,
                contentDescription = null,
                size = 32.dp,
                strokeWidth = 1.8f,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.size(Spacing.s3))
        Text(
            text = "Nothing for sale nearby yet",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(modifier = Modifier.size(Spacing.s1))
        Text(
            text = "Be the first to post. Tap the camera to snap and sell.",
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.width(260.dp),
        )
        Spacer(modifier = Modifier.size(Spacing.s3))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onCompose)
                    .padding(horizontal = 22.dp)
                    .heightIn(min = 44.dp)
                    .testTag("marketplaceEmptySnap"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Camera,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Snap & sell",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Spacer(modifier = Modifier.size(Spacing.s4))
        WidenRadiusPill(radiusMiles = radiusMiles, canWiden = canWiden, onWiden = onWiden)
    }
}

/**
 * Tappable radius pill — widens 2 → 5 → 10 → 25 mi and refetches.
 * Inert with a "max radius" caption at the 25 mi ceiling. Mirrors the
 * iOS `marketplaceWidenRadius` control.
 */
@Composable
private fun WidenRadiusPill(
    radiusMiles: Double,
    canWiden: Boolean,
    onWiden: () -> Unit,
) {
    val label =
        if (radiusMiles % 1.0 == 0.0) {
            "${radiusMiles.toInt()} mi"
        } else {
            String.format("%.1f mi", radiusMiles)
        }
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(enabled = canWiden, onClick = onWiden)
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .testTag("marketplaceWidenRadius"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MapPin,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "Showing within ",
            fontSize = 11.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextStrong,
        )
        Text(
            text = if (canWiden) " · tap to widen" else " · max radius",
            fontSize = 11.5.sp,
            color = if (canWiden) PantopusColors.primary600 else PantopusColors.appTextSecondary,
        )
    }
}

@Composable
internal fun PopulatedFrame(
    rows: List<MarketplaceCardContent>,
    isLoadingMore: Boolean,
    onOpen: (String) -> Unit,
    onItemVisible: (String) -> Unit = {},
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize().testTag("marketplaceGrid"),
        contentPadding = PaddingValues(start = Spacing.s4, end = Spacing.s4, top = Spacing.s1, bottom = 110.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(items = rows, key = { it.id }) { row ->
            ListingCard(content = row, onClick = { onOpen(row.id) })
            // Composes when the card nears the viewport — load-more
            // trigger for the last few rows (iOS onAppear parity).
            LaunchedEffect(row.id) { onItemVisible(row.id) }
        }
        if (isLoadingMore) {
            items(2) { ListingSkeletonCard() }
        }
    }
}

@Composable
private fun ListingCard(
    content: MarketplaceCardContent,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .clickable(onClick = onClick)
                .testTag("marketplaceCard_${content.id}"),
    ) {
        ListingImage(content = content)
        Column(
            modifier = Modifier.padding(start = 10.dp, end = 10.dp, top = Spacing.s2, bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                text = content.title,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 14.sp,
                modifier = Modifier.defaultMinSize(minHeight = 28.dp),
            )
            Text(
                text = content.price,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = if (content.isFree) PantopusColors.success else PantopusColors.primary600,
            )
            if (content.metaLine.isNotEmpty()) {
                Text(
                    text = content.metaLine,
                    fontSize = 9.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun ListingImage(content: MarketplaceCardContent) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(104.dp)
                .background(
                    Brush.linearGradient(
                        colors = listOf(content.placeholderGradient.start, content.placeholderGradient.end),
                    ),
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (!content.imageUrl.isNullOrEmpty()) {
            AsyncImage(
                model = content.imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            PantopusIconImage(
                icon = content.placeholderIcon,
                contentDescription = null,
                size = 34.dp,
                strokeWidth = 1.6f,
                tint = Color.White.copy(alpha = 0.85f),
            )
        }
        if (content.conditionBadge != null) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(start = 6.dp, top = 6.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(Color.Black.copy(alpha = 0.78f))
                        .padding(horizontal = 7.dp, vertical = 2.dp),
            ) {
                Text(
                    text = content.conditionBadge.uppercase(),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    letterSpacing = 0.6.sp,
                )
            }
        }
    }
}

@Composable
private fun ListingSkeletonCard() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp)),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(104.dp)
                    .background(PantopusColors.appSurfaceSunken),
        )
        Column(
            modifier = Modifier.padding(start = 10.dp, end = 10.dp, top = Spacing.s2, bottom = 10.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            ShimmerBar(fillFraction = 0.92f, height = 9.dp)
            ShimmerBar(fillFraction = 0.68f, height = 9.dp)
            ShimmerBar(fillFraction = 0.4f, height = 11.dp, topPadding = 3.dp)
            ShimmerBar(fillFraction = 0.5f, height = 8.dp)
        }
    }
}

@Composable
private fun ShimmerBar(
    fillFraction: Float,
    height: androidx.compose.ui.unit.Dp,
    topPadding: androidx.compose.ui.unit.Dp = 0.dp,
) {
    Box(
        modifier =
            Modifier
                .padding(top = topPadding)
                .fillMaxWidth(fillFraction)
                .height(height)
                .clip(RoundedCornerShape(Radii.xs))
                .background(PantopusColors.appSurfaceSunken),
    )
}

@Composable
private fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s6)
                .testTag("marketplaceError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.error,
        )
        Spacer(modifier = Modifier.size(Spacing.s3))
        Text(
            text = "Couldn't load Marketplace",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.size(Spacing.s2))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.size(Spacing.s4))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 22.dp)
                    .heightIn(min = 44.dp)
                    .testTag("marketplaceRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}
