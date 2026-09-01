@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.scheduling.resources

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

const val RESOURCE_LIST_TAG = "scheduling.resourceList"

// ─── Template seeds shown in the Empty frame ───────────────────────────────

private data class ResourceTemplate(
    val icon: PantopusIcon,
    val label: String,
)

private val RESOURCE_TEMPLATES =
    listOf(
        // bed-double has no PantopusIcon equivalent; DoorOpen matches ResourceKind.Room
        ResourceTemplate(PantopusIcon.DoorOpen, "Guest room"),
        ResourceTemplate(PantopusIcon.Car, "Driveway"),
        ResourceTemplate(PantopusIcon.Zap, "EV charger"),
        ResourceTemplate(PantopusIcon.Wrench, "Tools"),
        ResourceTemplate(PantopusIcon.Plus, "Other"),
    )

/**
 * F9 Bookable Home Resources · List. The view-model owns the data + status
 * projection; this screen renders the design's bespoke frames (Home-green
 * identity) and owns navigation to the editor / detail.
 *
 * Bespoke states (rendered with a local Scaffold, not ListOfRows):
 *  - Empty  → explainer card + TEMPLATES overline + 5 tappable template rows
 *  - Error  → cloud-off in errorBg circle, "Couldn't load resources", "Retry"
 *  - Loaded → the design `ResourceRow` (40dp Home tile · 13.5sp/700 name ·
 *    sunken capsule type badge · 7dp dot + coloured status label) — the shared
 *    ListOfRows row chrome can't express it, mirroring iOS `ResourceRow`.
 *    Offline: amber banner + 0.55 row dim + hidden FAB, driven live from
 *    the view-model's connectivity flow.
 *
 * Delegated to ListOfRows shell:
 *  - Loading → standard shimmer skeleton
 */
@Composable
fun ResourceListScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: ResourceListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.state.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()
    val offline = !online
    LaunchedEffect(Unit) { viewModel.start() }

    val openEditor = { onNavigate(viewModel.newEditorRoute()) }

    when (val state = uiState) {
        ResourceListUiState.Loading -> {
            // Delegate to ListOfRows shell so the standard shimmer skeleton renders.
            ListOfRowsScreen(
                title = "Resources",
                state = ListOfRowsUiState.Loading,
                onRefresh = viewModel::refresh,
                onEndReached = {},
                onBack = onBack,
                topBarAction = resourceAddAction(openEditor),
            )
        }

        ResourceListUiState.Empty -> {
            // Bespoke empty frame: same top-bar chrome + explainer card + TEMPLATES.
            // FAB hides offline, mirroring iOS `showsFAB`.
            ResourceScaffold(
                onBack = onBack,
                onAdd = openEditor,
                fab =
                    if (!offline) {
                        FabAction(
                            icon = PantopusIcon.Plus,
                            contentDescription = "Add a resource",
                            variant = FabVariant.SecondaryCreate,
                            tint = FabTint.Home,
                            onClick = openEditor,
                        )
                    } else {
                        null
                    },
            ) { innerPadding ->
                ResourceEmptyBody(
                    modifier = Modifier.padding(innerPadding),
                    onTemplate = openEditor,
                )
            }
        }

        is ResourceListUiState.Error -> {
            // Bespoke error frame: cloud-off in errorBg circle, the state's
            // message (iOS parity — e.g. the no-home explainer), + Retry.
            ResourceScaffold(
                onBack = onBack,
                onAdd = openEditor,
                fab = null,
            ) { innerPadding ->
                ResourceErrorBody(
                    message = state.message,
                    modifier = Modifier.padding(innerPadding),
                    onRetry = viewModel::refresh,
                )
            }
        }

        is ResourceListUiState.Loaded -> {
            // Bespoke loaded frame — design `ResourceRow`s (iOS parity).
            ResourceScaffold(
                onBack = onBack,
                onAdd = openEditor,
                fab =
                    if (!offline) {
                        FabAction(
                            icon = PantopusIcon.Plus,
                            contentDescription = "Add a resource",
                            variant = FabVariant.SecondaryCreate,
                            tint = FabTint.Home,
                            onClick = openEditor,
                        )
                    } else {
                        null
                    },
            ) { innerPadding ->
                OfflineBannerHost(
                    isOffline = offline,
                    modifier = Modifier.padding(innerPadding),
                ) {
                    ResourceLoadedBody(
                        rows = state.rows,
                        dimmed = offline,
                        isRefreshing = false,
                        onRefresh = viewModel::refresh,
                        onOpenDetail = { onNavigate(viewModel.detailRoute(it)) },
                    )
                }
            }
        }
    }
}

// ─── Shared top-bar trailing "Add" action ──────────────────────────────────

private fun resourceAddAction(onClick: () -> Unit) =
    TopBarAction(
        icon = PantopusIcon.Plus,
        contentDescription = "Add a resource",
        onClick = onClick,
        label = "Add",
    )

// ─── Reusable Scaffold for the bespoke frames ──────────────────────────────

/**
 * Minimal Scaffold for the bespoke Empty, Error, and Loaded frames. Provides
 * the same chrome structure as [ListOfRowsScreen] (CenterAlignedTopAppBar +
 * optional FAB + appBg container) without binding to a list-of-rows state
 * machine.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ResourceScaffold(
    onBack: (() -> Unit)?,
    onAdd: () -> Unit,
    fab: FabAction?,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        modifier = Modifier.testTag(RESOURCE_LIST_TAG),
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = "Resources",
                        style = PantopusTextStyle.h3,
                        color = PantopusColors.appText,
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            PantopusIconImage(
                                icon = PantopusIcon.ChevronLeft,
                                contentDescription = "Back",
                                tint = PantopusColors.appText,
                            )
                        }
                    }
                },
                actions = {
                    // Matches ListOfRowsScreen's TopBarActionButton text-label
                    // render, tinted with the Home pillar accent (iOS parity).
                    Box(
                        modifier =
                            Modifier
                                .clickable(onClick = onAdd)
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                    ) {
                        Text(
                            text = "Add",
                            style = PantopusTextStyle.body,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.home,
                        )
                    }
                },
                colors =
                    TopAppBarDefaults.centerAlignedTopAppBarColors(
                        containerColor = PantopusColors.appSurface,
                    ),
            )
        },
        floatingActionButton = {
            if (fab != null) {
                // SecondaryCreate FAB — 52dp Home-green circle, mirrors FabVariant.SecondaryCreate.
                Box(
                    modifier =
                        Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.home)
                            .clickable(onClick = fab.onClick)
                            .semantics { contentDescription = fab.contentDescription },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = fab.icon,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                }
            }
        },
        containerColor = PantopusColors.appBg,
        content = content,
    )
}

// ─── Empty frame body ──────────────────────────────────────────────────────

/**
 * Bespoke empty body (design: resources-list-frames.jsx FrameEmpty).
 * Renders the explainer card + TEMPLATES overline + 5 tappable template rows.
 */
@Composable
private fun ResourceEmptyBody(
    modifier: Modifier = Modifier,
    onTemplate: () -> Unit,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding =
            PaddingValues(
                start = Spacing.s3,
                end = Spacing.s3,
                top = Spacing.s3,
                bottom = 92.dp,
            ),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        // Explainer card (package-open icon, headline, subcopy)
        item(key = "explainer") {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .padding(horizontal = Spacing.s4, vertical = 18.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(50.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(PantopusColors.homeBg),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.PackageOpen,
                        contentDescription = null,
                        size = 24.dp,
                        tint = PantopusColors.home,
                    )
                }
                Spacer(Modifier.height(Spacing.s3))
                Text(
                    text = "Add what your household shares",
                    style = PantopusTextStyle.h3,
                    color = PantopusColors.appText,
                )
                Spacer(Modifier.height(Spacing.s1))
                Text(
                    text = "Anything members book — rooms, the driveway, tools. Start from a template.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }

        // "TEMPLATES" overline
        item(key = "templates-header") {
            Text(
                text = "Templates",
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(horizontal = 2.dp, vertical = Spacing.s1),
            )
        }

        // 5 tappable template rows
        items(RESOURCE_TEMPLATES, key = { it.label }) { template ->
            val isOther = template.label == "Other"
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .clickable(onClick = onTemplate)
                        .padding(horizontal = Spacing.s3, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(11.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (isOther) PantopusColors.appSurfaceSunken else PantopusColors.homeBg,
                            ),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = template.icon,
                        contentDescription = null,
                        size = 18.dp,
                        tint = if (isOther) PantopusColors.appTextSecondary else PantopusColors.home,
                    )
                }
                Text(
                    text = template.label,
                    style = PantopusTextStyle.body,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

// ─── Error frame body ──────────────────────────────────────────────────────

/**
 * Bespoke error body (design: resources-list-frames.jsx FrameError).
 * 56dp errorBg circle + cloud-off icon, "Couldn't load resources", the
 * state's message (iOS parity — surfaces the no-home explainer), "Retry"
 * pill (Home green, mirroring iOS `HomePrimaryButton`) with rotate-cw icon.
 */
@Composable
private fun ResourceErrorBody(
    message: String,
    modifier: Modifier = Modifier,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp, vertical = Spacing.s6),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.errorBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CloudOff,
                contentDescription = null,
                size = 26.dp,
                tint = PantopusColors.error,
            )
        }
        Spacer(Modifier.height(Spacing.s3))
        Text(
            text = "Couldn't load resources",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
        )
        Spacer(Modifier.height(Spacing.s1))
        Text(
            text = message.ifBlank { "Check your connection and try again." },
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Spacing.s4))
        // Retry pill: Home green (pillar identity), leading rotate-cw icon.
        Row(
            modifier =
                Modifier
                    .sizeIn(maxWidth = 160.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.home)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s4, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.RefreshCw,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Retry",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

// ─── Loaded frame (bespoke ResourceRow list) ───────────────────────────────

/**
 * Pull-to-refresh list of design `ResourceRow`s. Mirrors iOS's loaded frame
 * (ScrollView + `.refreshable` + `ResourceRow(dim: isOffline)`).
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
private fun ResourceLoadedBody(
    rows: List<ResourceRowUi>,
    dimmed: Boolean,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    onOpenDetail: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val pullState = rememberPullRefreshState(refreshing = isRefreshing, onRefresh = onRefresh)
    Box(modifier = modifier.fillMaxSize().pullRefresh(pullState)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding =
                PaddingValues(
                    start = Spacing.s3,
                    end = Spacing.s3,
                    top = Spacing.s3,
                    bottom = 92.dp,
                ),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            items(rows, key = { it.id }) { row ->
                ResourceLoadedRow(row = row, dimmed = dimmed, onTap = { onOpenDetail(row.id) })
            }
        }
        PullRefreshIndicator(
            refreshing = isRefreshing,
            state = pullState,
            modifier = Modifier.align(Alignment.TopCenter),
            contentColor = PantopusColors.home,
        )
    }
}

/**
 * Design `ResourceRow` (resources-list-frames.jsx:8-22), mirroring iOS
 * `ResourceRow`: 40dp Home tile (radius 11) · 13.5sp/700 name · sunken
 * capsule type badge · trailing 7dp dot + coloured "Free now"/"Booked
 * until …" label. Dimmed to 0.55 when offline.
 */
@Composable
private fun ResourceLoadedRow(
    row: ResourceRowUi,
    dimmed: Boolean,
    onTap: () -> Unit,
) {
    val rowLabel = "${row.name}, ${row.kind.label}, ${row.statusLabel}"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .clickable(onClick = onTap)
                .padding(horizontal = 12.dp, vertical = 11.dp)
                .alpha(if (dimmed) 0.55f else 1f)
                .testTag("scheduling.resourceList.row.${row.id}")
                .semantics { contentDescription = rowLabel },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(11.dp))
                    .background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = row.kind.icon,
                contentDescription = null,
                size = 20.dp,
                tint = PantopusColors.home,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(
                text = row.name,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                text = row.kind.label,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(percent = 50))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s2, vertical = 2.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(if (row.isFree) PantopusColors.success else PantopusColors.appTextMuted),
            )
            Text(
                text = row.statusLabel,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (row.isFree) PantopusColors.success else PantopusColors.appTextSecondary,
                maxLines = 1,
            )
        }
    }
}
