@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.universal_search

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage

/**
 * S2 — Universal search. Search field + six tab chips (All / Tasks /
 * People / Beacons / Businesses / Homes) over grouped result sections,
 * mirroring RN `src/app/discover.tsx` and the A08 "Discover hub" design
 * frame (top bar → chip strip → overline section headers → hairline
 * rows inside a rounded card).
 *
 * Reached from the navigation drawer's "Search" row; gig-only search
 * stays reachable from the Tasks tab here and from the Gigs feed search
 * bar.
 */
@Composable
fun UniversalSearchScreen(
    onOpen: (UniversalSearchDestination) -> Unit = {},
    onBrowseNearbyBusinesses: () -> Unit = {},
    onBack: () -> Unit = {},
    viewModel: UniversalSearchViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val activeTab by viewModel.activeTab.collectAsStateWithLifecycle()

    UniversalSearchContent(
        state = state,
        query = query,
        activeTab = activeTab,
        onQueryChange = viewModel::onQueryChange,
        onClear = viewModel::clearQuery,
        onSelectTab = viewModel::selectTab,
        onRetry = viewModel::refresh,
        onOpen = onOpen,
        onBrowseNearbyBusinesses = onBrowseNearbyBusinesses,
        onBack = onBack,
    )
}

/** State-driven body — split out so Paparazzi can render each phase. */
@Composable
internal fun UniversalSearchContent(
    state: UniversalSearchUiState,
    query: String,
    activeTab: UniversalSearchTab,
    onQueryChange: (String) -> Unit,
    onClear: () -> Unit,
    onSelectTab: (UniversalSearchTab) -> Unit,
    onRetry: () -> Unit,
    onOpen: (UniversalSearchDestination) -> Unit,
    onBrowseNearbyBusinesses: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("universalSearch"),
    ) {
        Header(
            query = query,
            onQueryChange = onQueryChange,
            onClear = onClear,
            onBack = onBack,
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        TabStrip(activeTab = activeTab, onSelectTab = onSelectTab)
        Box(modifier = Modifier.fillMaxSize()) {
            when (state) {
                UniversalSearchUiState.Idle ->
                    PromptSection(
                        tag = "universalSearchIdle",
                        headline = "Search Pantopus",
                        subcopy = "Find tasks, people, Beacons, businesses, and homes nearby.",
                        showBrowseNearby = activeTab == UniversalSearchTab.Businesses,
                        onBrowseNearbyBusinesses = onBrowseNearbyBusinesses,
                    )
                UniversalSearchUiState.Loading -> ShimmerSection()
                is UniversalSearchUiState.Empty ->
                    PromptSection(
                        tag = "universalSearchEmpty",
                        headline =
                            if (state.beaconsUnavailable) "Beacon search is off" else "No results found",
                        subcopy =
                            if (state.beaconsUnavailable) {
                                "Beacon discovery isn't enabled on this server yet. Try another tab."
                            } else {
                                "Try a different search term or category."
                            },
                        showBrowseNearby = activeTab == UniversalSearchTab.Businesses,
                        onBrowseNearbyBusinesses = onBrowseNearbyBusinesses,
                    )
                is UniversalSearchUiState.Error ->
                    ErrorState(
                        headline = "Couldn't search",
                        message = state.message,
                        modifier = Modifier.testTag("universalSearchError"),
                        onRetry = onRetry,
                    )
                is UniversalSearchUiState.Loaded ->
                    ResultsSection(
                        state = state,
                        showSectionHeaders = activeTab == UniversalSearchTab.All,
                        showBrowseNearby = activeTab == UniversalSearchTab.Businesses,
                        onRetry = onRetry,
                        onOpen = onOpen,
                        onBrowseNearbyBusinesses = onBrowseNearbyBusinesses,
                    )
            }
        }
    }
}

// ─── Header ────────────────────────────────────────────────────

@Composable
private fun Header(
    query: String,
    onQueryChange: (String) -> Unit,
    onClear: () -> Unit,
    onBack: () -> Unit,
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        // Mirror iOS's on-appear focus so the keyboard pops the moment
        // the surface opens.
        runCatching { focusRequester.requestFocus() }
    }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clickable(onClick = onBack)
                        .testTag("universalSearchBack")
                        .semantics { contentDescription = "Back" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            SearchField(
                query = query,
                onQueryChange = onQueryChange,
                onClear = onClear,
                focusRequester = focusRequester,
                modifier = Modifier.weight(1f),
            )
        }
        UniversalSearchViewModel.thresholdHint(query)?.let { hint ->
            Text(
                text = hint,
                fontSize = 12.sp,
                color = PantopusColors.appTextMuted,
                modifier =
                    Modifier
                        .padding(start = Spacing.s12 + Spacing.s3)
                        .testTag("universalSearchHint"),
            )
        }
    }
}

@Composable
private fun SearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    onClear: () -> Unit,
    focusRequester: FocusRequester,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.appTextSecondary,
        )
        Box(modifier = Modifier.weight(1f)) {
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                singleLine = true,
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .focusRequester(focusRequester)
                        .testTag("universalSearchField"),
                decorationBox = { inner ->
                    if (query.isEmpty()) {
                        Text(
                            text = "Search tasks, people, Beacons, businesses…",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    inner()
                },
            )
        }
        if (query.isNotEmpty()) {
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clickable(onClick = onClear)
                        .testTag("universalSearchClear")
                        .semantics { contentDescription = "Clear search" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// ─── Tabs ──────────────────────────────────────────────────────

@Composable
private fun TabStrip(
    activeTab: UniversalSearchTab,
    onSelectTab: (UniversalSearchTab) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("universalSearchTabs"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        UniversalSearchTab.entries.forEach { tab ->
            val isActive = tab == activeTab
            Box(
                modifier =
                    Modifier
                        .height(28.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(
                            if (isActive) PantopusColors.primary600 else PantopusColors.appSurface,
                        ).border(
                            width = 1.dp,
                            color = if (isActive) PantopusColors.primary600 else PantopusColors.appBorder,
                            shape = RoundedCornerShape(Radii.pill),
                        ).clickable { onSelectTab(tab) }
                        .padding(horizontal = 14.dp)
                        .testTag("universalSearchTab_${tab.key}"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = tab.title,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color =
                        if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                    maxLines = 1,
                )
            }
        }
    }
}

// ─── Phases ────────────────────────────────────────────────────

@Composable
private fun PromptSection(
    tag: String,
    headline: String,
    subcopy: String,
    showBrowseNearby: Boolean,
    onBrowseNearbyBusinesses: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag(tag)) {
        if (showBrowseNearby) {
            BrowseNearbyBusinessesCta(
                onClick = onBrowseNearbyBusinesses,
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            )
        }
        EmptyState(icon = PantopusIcon.Search, headline = headline, subcopy = subcopy)
    }
}

@Composable
private fun ShimmerSection() {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("universalSearchShimmer"),
        contentPadding = PaddingValues(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        items(6) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 40.dp, height = 40.dp, cornerRadius = Radii.lg)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Shimmer(width = 180.dp, height = 14.dp)
                    Shimmer(width = 120.dp, height = 12.dp)
                }
            }
        }
    }
}

@Composable
private fun ResultsSection(
    state: UniversalSearchUiState.Loaded,
    showSectionHeaders: Boolean,
    showBrowseNearby: Boolean,
    onRetry: () -> Unit,
    onOpen: (UniversalSearchDestination) -> Unit,
    onBrowseNearbyBusinesses: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("universalSearchResults"),
        contentPadding =
            PaddingValues(
                start = Spacing.s4,
                end = Spacing.s4,
                top = Spacing.s1,
                bottom = Spacing.s10,
            ),
    ) {
        if (showBrowseNearby) {
            item("browseNearby") {
                BrowseNearbyBusinessesCta(
                    onClick = onBrowseNearbyBusinesses,
                    modifier = Modifier.padding(top = Spacing.s3),
                )
            }
        }
        items(items = state.failedSources, key = { kind -> "notice-${kind.key}" }) { kind ->
            PartialFailureNotice(kind = kind, onRetry = onRetry)
        }
        state.sections.forEach { section ->
            if (showSectionHeaders) {
                item("header-${section.kind.key}") { SectionHeader(section) }
            }
            item("card-${section.kind.key}") {
                ResultsCard(section = section, onOpen = onOpen)
            }
        }
    }
}

@Composable
private fun SectionHeader(section: UniversalSearchSection) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s4, bottom = Spacing.s2)
                .testTag("universalSearchSection_${section.kind.key}")
                .semantics { heading() },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = section.kind.icon,
            contentDescription = null,
            size = 14.dp,
            tint = section.kind.accent,
        )
        Text(
            text = section.kind.sectionTitle,
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "${section.results.size}",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun ResultsCard(
    section: UniversalSearchSection,
    onOpen: (UniversalSearchDestination) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(bottom = Spacing.s1)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.xl),
                ),
    ) {
        section.results.forEachIndexed { index, result ->
            UniversalSearchRow(result = result, onTap = { onOpen(result.destination) })
            if (index < section.results.lastIndex) {
                HorizontalDivider(
                    color = PantopusColors.appBorderSubtle,
                    thickness = 1.dp,
                    modifier = Modifier.padding(start = Spacing.s12 + Spacing.s3),
                )
            }
        }
    }
}

/**
 * One universal-search row: avatar (or tinted kind glyph), title +
 * subtitle, accent meta, chevron.
 */
@Composable
internal fun UniversalSearchRow(
    result: UniversalSearchResult,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onTap)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("universalSearchRow_${result.kind.key}_${result.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RowLeading(result = result)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = result.title,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            result.subtitle?.let { subtitle ->
                Text(
                    text = subtitle,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        result.meta?.let { meta ->
            Text(
                text = meta,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = result.kind.accent,
                maxLines = 1,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun RowLeading(result: UniversalSearchResult) {
    Box(
        modifier =
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(result.kind.accentBackground),
        contentAlignment = Alignment.Center,
    ) {
        if (result.imageUrl != null) {
            AsyncImage(
                model = result.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(40.dp).clip(RoundedCornerShape(Radii.lg)),
            )
        } else {
            PantopusIconImage(
                icon = result.kind.icon,
                contentDescription = null,
                size = 18.dp,
                tint = result.kind.accent,
            )
        }
    }
}

/**
 * Inline "this one source failed" strip. Shown only on the "All" tab,
 * where the other four still have rows to render.
 */
@Composable
private fun PartialFailureNotice(
    kind: UniversalSearchKind,
    onRetry: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("universalSearchNotice_${kind.key}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.warning,
        )
        Text(
            text = kind.failureNotice,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "Retry",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier = Modifier.clickable(onClick = onRetry),
        )
    }
}

@Composable
private fun BrowseNearbyBusinessesCta(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.primary50)
                .border(
                    width = 1.dp,
                    color = PantopusColors.primary200,
                    shape = RoundedCornerShape(Radii.xl),
                ).clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("universalSearchBrowseNearbyBusinesses"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Building2,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.primary600,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Browse nearby businesses",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
            Text(
                text = "Find trusted businesses near you with neighbor recommendations",
                fontSize = 11.sp,
                color = PantopusColors.appTextMuted,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.primary600,
        )
    }
}
