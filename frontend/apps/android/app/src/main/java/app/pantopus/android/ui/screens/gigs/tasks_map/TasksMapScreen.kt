@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.gigs.tasks_map

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.gigs.GigFilterSheet
import app.pantopus.android.ui.screens.gigs.GigRow
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.gigs.GigsSort
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridDetent
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridShell
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapListHybridShellStaticPreview
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Locate + layers + focus-on-pins + Post-task stack
 * (three 38dp buttons + 48dp pill + three 8dp gaps). */
internal val TASKS_MAP_CONTROLS_HEIGHT = 186.dp

/**
 * A11.1 Tasks map — the Gigs-only mode of the MapListHybrid archetype.
 * Full design chrome: floating top pill (back · title · filters), the
 * category-dot chip strip below it, a "Search this area" pill when the
 * camera strays from the fetched viewport, a three-stop sheet (rail at
 * the standard detent, full `GigRow` list when expanded), client-side
 * pin clustering, and the empty-state widen → jump-to-activity ladder.
 *
 * Mirrors iOS `TasksMapView`.
 */
@Composable
fun TasksMapScreen(
    onOpenTask: (String) -> Unit = {},
    onCompose: (GigsCategory) -> Unit = {},
    onBack: () -> Unit = {},
    viewModel: TasksMapViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeCategory by viewModel.activeCategory.collectAsStateWithLifecycle()
    val activeSort by viewModel.activeSort.collectAsStateWithLifecycle()
    val selectedId by viewModel.selectedId.collectAsStateWithLifecycle()
    val anchor by viewModel.anchor.collectAsStateWithLifecycle()
    val showsSearchThisArea by viewModel.showsSearchThisArea.collectAsStateWithLifecycle()
    val cameraTarget by viewModel.cameraTarget.collectAsStateWithLifecycle()
    val mapPins by viewModel.mapPins.collectAsStateWithLifecycle()
    val mapClusters by viewModel.mapClusters.collectAsStateWithLifecycle()
    val emptyAction by viewModel.emptyAction.collectAsStateWithLifecycle()
    // P2 follow-up — criteria live in the VM so the layers sheet actually
    // filters the pins (not just the badge).
    val filterCriteria by viewModel.filterCriteria.collectAsStateWithLifecycle()

    var detent by remember { mutableStateOf(MapListHybridDetent.Standard) }
    var recenterToken by remember { mutableIntStateOf(0) }
    var showFilters by remember { mutableStateOf(false) }

    val permissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { results ->
            if (results.values.any { it }) {
                viewModel.locate()
                recenterToken++
            }
        }

    fun requestLocate() {
        if (hasLocationPermission(context)) {
            viewModel.locate()
            recenterToken++
        } else {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        }
    }

    LaunchedEffect(Unit) {
        if (!hasLocationPermission(context)) {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        }
        viewModel.load()
    }

    val items = (state as? TasksMapUiState.Populated)?.items.orEmpty()

    MapListHybridShell(
        pins = mapPins,
        clusters = mapClusters,
        detent = detent,
        onDetentChange = { detent = it },
        anchor = anchor,
        selectedPinId = selectedId,
        recenterTrigger = recenterToken,
        showSearchRadius = state is TasksMapUiState.Empty,
        onPinTap = { id ->
            viewModel.select(id)
            detent = MapListHybridDetent.Standard
        },
        onClusterTap = viewModel::tapCluster,
        onCameraChange = viewModel::cameraSettled,
        cameraRequest = cameraTarget,
        markerTagPrefix = "tasksMap",
        controlsStackHeight = TASKS_MAP_CONTROLS_HEIGHT,
        topPill = {
            TasksMapTopPill(
                filterCount = filterCriteria.activeCount,
                onBack = onBack,
                onFilters = { showFilters = true },
            )
        },
        categoryChips = {
            TasksMapChipsOverlay(
                active = activeCategory,
                onSelect = viewModel::selectCategory,
                showsSearchThisArea = showsSearchThisArea,
                onSearchThisArea = viewModel::searchThisArea,
            )
        },
        mapControls = {
            TasksMapMapControls(
                onLocate = { requestLocate() },
                onLayers = { showFilters = true },
                onFocus = viewModel::focusOnPins,
                onPost = { onCompose(activeCategory) },
            )
        },
        sheetHeader = {
            TasksMapSheetHeader(
                count = items.size,
                activeSort = activeSort,
                onSelectSort = viewModel::selectSort,
            )
        },
        sheetBody = {
            TasksMapSheetBody(
                state = state,
                mode = TasksMapSheetMode.mode(detent),
                selectedId = selectedId,
                emptyAction = emptyAction,
                onTap = { id ->
                    viewModel.select(id)
                    onOpenTask(id)
                },
                onPageSettled = viewModel::selectIndex,
                onPost = { onCompose(activeCategory) },
                onWiden = viewModel::widenSearch,
                onJump = viewModel::jumpToActivity,
                onRetry = viewModel::refresh,
            )
        },
        modifier = Modifier.testTag("tasksMap"),
    )

    if (showFilters) {
        GigFilterSheet(
            criteria = filterCriteria,
            onApply = viewModel::applyFilters,
            onDismiss = { showFilters = false },
        )
    }
}

// MARK: - Chrome

/**
 * A11.1 floating top pill — back chevron · centered "Tasks map" ·
 * filters icon with an active-criteria badge. White translucent, pill
 * radius, soft shadow.
 */
@Composable
internal fun TasksMapTopPill(
    filterCount: Int,
    onBack: () -> Unit,
    onFilters: () -> Unit,
) {
    val pillSurface = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f)
    Row(
        modifier =
            Modifier
                .padding(horizontal = 14.dp)
                .fillMaxWidth()
                .shadow(elevation = 8.dp, shape = RoundedCornerShape(Radii.pill))
                .clip(RoundedCornerShape(Radii.pill))
                .background(pillSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .padding(horizontal = 6.dp, vertical = 6.dp)
                .testTag("tasksMapPill")
                .semantics {
                    contentDescription = "Tasks map"
                    heading()
                },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onBack)
                    .testTag("tasksMap.backPill")
                    .semantics { contentDescription = "Back to list" },
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
        Text(
            text = "Tasks map",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .clickable(onClick = onFilters)
                    .testTag("tasksMap.filters")
                    .semantics { contentDescription = "Filters" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.SlidersHorizontal,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appText,
            )
            if (filterCount > 0) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopEnd)
                            .size(14.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.primary600),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = filterCount.toString(),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

/**
 * Chips strip + the conditional "Search this area" pill, stacked below
 * the floating top pill (which owns the status-bar inset in the shell).
 */
@Composable
internal fun TasksMapChipsOverlay(
    active: GigsCategory,
    onSelect: (GigsCategory) -> Unit,
    showsSearchThisArea: Boolean,
    onSearchThisArea: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .padding(WindowInsets.statusBars.asPaddingValues())
                .padding(top = 54.dp)
                .fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        TasksMapCategoryChips(active = active, onSelect = onSelect)
        if (showsSearchThisArea) {
            Spacer(modifier = Modifier.height(Spacing.s2))
            TasksMapSearchThisAreaPill(onClick = onSearchThisArea)
        }
    }
}

/** Floating "Search this area" pill — appears when the settled camera
 * differs significantly from the last-fetched viewport. */
@Composable
internal fun TasksMapSearchThisAreaPill(onClick: () -> Unit) {
    val pillSurface = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f)
    Row(
        modifier =
            Modifier
                .shadow(elevation = 6.dp, shape = RoundedCornerShape(Radii.pill))
                .clip(RoundedCornerShape(Radii.pill))
                .background(pillSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp)
                .height(32.dp)
                .testTag("tasksMap.searchThisArea")
                .semantics { contentDescription = "Search this area" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary600,
        )
        Text(
            text = "Search this area",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
        )
    }
}

@Composable
private fun TasksMapCategoryChip(
    category: GigsCategory,
    active: Boolean,
    onSelect: (GigsCategory) -> Unit,
) {
    val chipSurface = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f)
    val chipBorder = MaterialTheme.colorScheme.outline
    val chipText = MaterialTheme.colorScheme.onSurface
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (active) category.color else chipSurface)
                .border(
                    width = if (active) 0.dp else 1.dp,
                    color = if (active) Color.Transparent else chipBorder,
                    shape = RoundedCornerShape(Radii.pill),
                )
                .shadow(elevation = 4.dp, shape = RoundedCornerShape(Radii.pill))
                .clickable { onSelect(category) }
                .padding(horizontal = Spacing.s3)
                .height(28.dp)
                .testTag("tasksMap.chip_${category.key}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (category != GigsCategory.All) {
            Box(
                modifier =
                    Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(if (active) PantopusColors.appTextInverse else category.color),
            )
        }
        Text(
            text = category.label,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (active) PantopusColors.appTextInverse else chipText,
        )
    }
}

@Composable
internal fun TasksMapCategoryChips(
    active: GigsCategory,
    onSelect: (GigsCategory) -> Unit,
) {
    val scrollState = rememberScrollState()
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(scrollState)
                .padding(horizontal = 14.dp)
                .testTag("tasksMapCategoryChips"),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GigsCategory.entries.forEach { category ->
            TasksMapCategoryChip(
                category = category,
                active = category == active,
                onSelect = onSelect,
            )
        }
    }
}

@Composable
internal fun TasksMapPostFab(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .shadow(elevation = 12.dp, shape = RoundedCornerShape(Radii.pill))
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary600)
                .clickable(onClick = onClick)
                .padding(start = 14.dp, end = 18.dp)
                .height(48.dp)
                .testTag("tasksMap.postTask")
                .semantics { contentDescription = "Post task" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Plus,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2.6f,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = "Post task",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

/**
 * Locate / layers / focus-pins stack with the "Post task" pill at the
 * bottom — product call, diverges from the A11.1 frame which drew the
 * FAB on top. Mirrors iOS `TasksMapView.mapControls`.
 */
@Composable
internal fun TasksMapMapControls(
    onLocate: () -> Unit,
    onLayers: () -> Unit,
    onFocus: () -> Unit,
    onPost: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        TasksMapControlButton(
            icon = PantopusIcon.MapPin,
            label = "Locate me",
            testTagId = "tasksMap.locate",
            onClick = onLocate,
        )
        TasksMapControlButton(
            icon = PantopusIcon.Map,
            label = "Layers",
            testTagId = "tasksMap.layers",
            onClick = onLayers,
        )
        TasksMapControlButton(
            icon = PantopusIcon.Maximize,
            label = "Focus on pins",
            testTagId = "tasksMap.focusPins",
            onClick = onFocus,
        )
        TasksMapPostFab(onClick = onPost)
    }
}

@Composable
internal fun TasksMapControlButton(
    icon: PantopusIcon,
    label: String,
    testTagId: String,
    onClick: () -> Unit,
    iconSize: androidx.compose.ui.unit.Dp = 16.dp,
) {
    val controlSurface = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f)
    val controlBorder = MaterialTheme.colorScheme.outline
    val controlTint = MaterialTheme.colorScheme.onBackground
    Box(
        modifier =
            Modifier
                .size(38.dp)
                .shadow(elevation = 4.dp, shape = CircleShape)
                .clip(CircleShape)
                .background(controlSurface)
                .border(1.dp, controlBorder, CircleShape)
                .clickable(onClick = onClick)
                .testTag(testTagId)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = iconSize,
            tint = controlTint,
        )
    }
}

@Composable
internal fun TasksMapSheetHeader(
    count: Int,
    activeSort: GigsSort,
    onSelectSort: (GigsSort) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 18.dp, end = 18.dp, top = Spacing.s1, bottom = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "$count ${if (count == 1) "task" else "tasks"} nearby",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.testTag("tasksMapCount").semantics { heading() },
        )
        Spacer(modifier = Modifier.weight(1f))
        Box {
            Row(
                modifier = Modifier.clickable { expanded = true }.testTag("tasksMap.sheet.sort"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = "Sort:",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                )
                Text(
                    text = activeSort.label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextStrong,
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = Radii.lg,
                    strokeWidth = 2.4f,
                    tint = PantopusColors.appTextStrong,
                )
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                GigsSort.entries.forEach { sort ->
                    DropdownMenuItem(
                        text = { Text(sort.label) },
                        onClick = {
                            expanded = false
                            onSelectSort(sort)
                        },
                    )
                }
            }
        }
    }
}

// MARK: - Sheet body (four states × three detent modes)

@Composable
internal fun TasksMapSheetBody(
    state: TasksMapUiState,
    mode: TasksMapSheetMode,
    selectedId: String?,
    emptyAction: TasksMapEmptyAction,
    onTap: (String) -> Unit,
    onPageSettled: (Int) -> Unit,
    onPost: () -> Unit,
    onWiden: () -> Unit,
    onJump: () -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is TasksMapUiState.Loading -> TasksMapLoadingRail()
        is TasksMapUiState.Populated ->
            when (mode) {
                TasksMapSheetMode.HeaderOnly -> Unit
                TasksMapSheetMode.Rail ->
                    TasksMapRail(
                        items = state.items,
                        selectedId = selectedId,
                        onTap = onTap,
                        onPageSettled = onPageSettled,
                    )
                TasksMapSheetMode.FullList ->
                    TasksMapFullList(items = state.items, onTap = onTap)
            }
        is TasksMapUiState.Empty ->
            TasksMapEmptyHero(
                emptyAction = emptyAction,
                onPost = onPost,
                onWiden = onWiden,
                onJump = onJump,
            )
        is TasksMapUiState.Error -> TasksMapErrorBody(message = state.message, onRetry = onRetry)
    }
}

/**
 * Standard-detent horizontal rail: snap fling, two-way selection sync
 * (selected pin → scroll to its card; settled page → select that pin),
 * and live pagination dots with the elongated active dot.
 */
@Composable
private fun TasksMapRail(
    items: List<TaskMapItem>,
    selectedId: String?,
    onTap: (String) -> Unit,
    onPageSettled: (Int) -> Unit,
) {
    val railState = rememberLazyListState()
    val fling = rememberSnapFlingBehavior(lazyListState = railState)
    val selectedIndex = items.indexOfFirst { it.id == selectedId }

    // Pin tap → scroll the rail so the matching card surfaces.
    LaunchedEffect(selectedId) {
        if (selectedIndex >= 0) railState.animateScrollToItem(selectedIndex)
    }
    // Rail page settle → select that pin (the VM no-ops when the page is
    // already the selection, which breaks the feedback loop).
    LaunchedEffect(railState) {
        snapshotFlow { railState.isScrollInProgress to railState.firstVisibleItemIndex }
            .collect { (moving, index) -> if (!moving) onPageSettled(index) }
    }

    Column {
        LazyRow(
            state = railState,
            flingBehavior = fling,
            contentPadding = PaddingValues(start = Spacing.s4, end = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = Spacing.s3)
                    .testTag("tasksMapRail"),
        ) {
            items(items, key = { it.id }) { item ->
                TaskRailCard(
                    item = item,
                    selected = item.id == selectedId,
                    onTap = { onTap(item.id) },
                )
            }
        }
        TasksMapPaginationDots(
            total = minOf(items.size, 5),
            index = selectedIndex.coerceIn(0, maxOf(minOf(items.size, 5) - 1, 0)),
        )
    }
}

/** Expanded-detent vertical list — the same `GigRow` as the Gigs feed. */
@Composable
private fun TasksMapFullList(
    items: List<TaskMapItem>,
    onTap: (String) -> Unit,
) {
    LazyColumn(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("tasksMap.fullList"),
    ) {
        items(items, key = { it.id }) { item ->
            GigRow(content = item.cardContent(), onTap = { onTap(item.id) })
        }
    }
}

@Composable
internal fun TaskRailCard(
    item: TaskMapItem,
    selected: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .width(240.dp)
                .shadow(elevation = 2.dp, shape = RoundedCornerShape(14.dp))
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (selected) 2.dp else 1.dp,
                    color = if (selected) item.category.color else PantopusColors.appBorder,
                    shape = RoundedCornerShape(14.dp),
                )
                .clickable(onClick = onTap)
                .padding(Spacing.s3)
                .testTag("tasksMap.railCard_${item.id}"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        // A11.1 — 135° category gradient (color → color@80%).
                        Brush.linearGradient(
                            colors = listOf(item.category.color, item.category.color.copy(alpha = 0.8f)),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = taskCategoryGlyph(item.category),
                contentDescription = null,
                size = 22.dp,
                tint = Color.White,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 17.sp,
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = item.price,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary600,
                )
                Text(
                    text = "· ${item.distanceLabel}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                )
                Spacer(modifier = Modifier.weight(1f))
                if (item.bidCount > 0) {
                    Box(
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.warningBg)
                                .padding(horizontal = 6.dp, vertical = 1.dp),
                    ) {
                        Text(
                            text = "${item.bidCount} ${if (item.bidCount == 1) "bid" else "bids"}",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.warning,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TasksMapPaginationDots(
    total: Int,
    index: Int,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(bottom = Spacing.s3)
                .testTag("tasksMap.pageDots"),
        horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(maxOf(total, 1)) { i ->
            Box(
                modifier =
                    Modifier
                        .width(if (i == index) 16.dp else 5.dp)
                        .height(5.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (i == index) PantopusColors.primary600 else PantopusColors.appBorderStrong),
            )
        }
    }
}

@Composable
private fun TasksMapLoadingRail() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s3)
                .testTag("tasksMapLoading"),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        repeat(3) {
            Row(
                modifier =
                    Modifier
                        .width(240.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                        .padding(Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(PantopusColors.appSurfaceSunken),
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(12.dp)
                                .clip(RoundedCornerShape(Radii.sm))
                                .background(PantopusColors.appSurfaceSunken),
                    )
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth(0.6f)
                                .height(12.dp)
                                .clip(RoundedCornerShape(Radii.sm))
                                .background(PantopusColors.appSurfaceSunken),
                    )
                }
            }
        }
    }
}

@Composable
internal fun TasksMapEmptyHero(
    emptyAction: TasksMapEmptyAction,
    onPost: () -> Unit,
    onWiden: () -> Unit,
    onJump: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp, vertical = Spacing.s3)
                .testTag("tasksMapEmpty"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.primary50)
                    .border(1.dp, PantopusColors.primary100, RoundedCornerShape(Radii.xl)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MapPinOff,
                contentDescription = null,
                size = Radii.xl3,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(modifier = Modifier.height(Spacing.s3))
        Text(
            text = "No tasks in this area yet",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Spacer(modifier = Modifier.height(5.dp))
        Text(
            text = "Be the first to post one — verified neighbors within a half-mile will see it.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
            lineHeight = 18.sp,
            modifier = Modifier.widthIn(max = 248.dp),
        )
        Spacer(modifier = Modifier.height(14.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onPost)
                        .padding(horizontal = 14.dp)
                        .height(36.dp)
                        .testTag("tasksMap.empty.postTask"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Plus,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.6f,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = "Post a task",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
            when (emptyAction) {
                is TasksMapEmptyAction.Widen ->
                    TasksMapEmptySecondaryButton(
                        label = "Widen search",
                        icon = PantopusIcon.Search,
                        tag = "tasksMap.empty.widenSearch",
                        onClick = onWiden,
                    )
                is TasksMapEmptyAction.JumpToActivity ->
                    TasksMapEmptySecondaryButton(
                        label = "Jump to activity",
                        icon = PantopusIcon.MapPin,
                        tag = "tasksMap.empty.jumpToActivity",
                        onClick = onJump,
                    )
            }
        }
    }
}

@Composable
private fun TasksMapEmptySecondaryButton(
    label: String,
    icon: PantopusIcon,
    tag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp)
                .height(36.dp)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun TasksMapErrorBody(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s6, vertical = Spacing.s1)
                .testTag("tasksMapError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 28.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4)
                    .height(38.dp)
                    .testTag("tasksMapRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

private fun hasLocationPermission(context: Context): Boolean {
    val fine =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
    val coarse =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
    return fine || coarse
}

/**
 * Static, render-only assembly of the Tasks-map chrome over the shell's
 * flat map stand-in. Used by Paparazzi (and `@Preview`) so the populated /
 * empty / expanded frames snapshot without spinning up Google Maps.
 */
@Composable
internal fun TasksMapStaticPreview(
    state: TasksMapUiState,
    activeCategory: GigsCategory = GigsCategory.All,
    selectedId: String? = null,
    activeSort: GigsSort = GigsSort.Closest,
    detent: MapListHybridDetent = MapListHybridDetent.Standard,
    showsSearchThisArea: Boolean = false,
    emptyAction: TasksMapEmptyAction = TasksMapEmptyAction.Widen,
    modifier: Modifier = Modifier,
) {
    val count = (state as? TasksMapUiState.Populated)?.items?.size ?: 0
    MapListHybridShellStaticPreview(
        detent = detent,
        topPill = {
            TasksMapTopPill(filterCount = 0, onBack = {}, onFilters = {})
        },
        categoryChips = {
            TasksMapChipsOverlay(
                active = activeCategory,
                onSelect = {},
                showsSearchThisArea = showsSearchThisArea,
                onSearchThisArea = {},
            )
        },
        mapControls = { TasksMapMapControls(onLocate = {}, onLayers = {}, onFocus = {}, onPost = {}) },
        sheetHeader = { TasksMapSheetHeader(count = count, activeSort = activeSort, onSelectSort = {}) },
        sheetBody = {
            TasksMapSheetBody(
                state = state,
                mode = TasksMapSheetMode.mode(detent),
                selectedId = selectedId,
                emptyAction = emptyAction,
                onTap = {},
                onPageSettled = {},
                onPost = {},
                onWiden = {},
                onJump = {},
                onRetry = {},
            )
        },
        modifier = modifier,
    )
}
