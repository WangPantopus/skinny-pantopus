@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.scheduling.packages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.scheduling.PackageDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tags for the G8 Packages list. */
object PackagesListTags {
    const val ROOT = "scheduling.packages.list"
    const val CREATE = "packagesCreate"
    const val FILTER_PREFIX = "packagesFilter_"
    const val ROW_PREFIX = "packageRow_"
}

@Composable
fun PackagesListScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: PackagesListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val lifecycleOwner = LocalLifecycleOwner.current

    // start() on first resume (load), refresh on subsequent resumes — so a
    // package created/edited on the pushed editor reflects on return.
    DisposableEffect(lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_RESUME) viewModel.start() }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column(
        modifier =
            Modifier.fillMaxSize().background(
                PantopusColors.appBg,
            ).testTag(PackagesListTags.ROOT),
    ) {
        PkgTopBar(title = "Packages", onBack = onBack) {
            if (state !is PackagesListUiState.ComingSoon) {
                PkgTopBarIconButton(
                    icon = PantopusIcon.Plus,
                    contentDescription = "Create a package",
                    onClick = { onNavigate(viewModel.createRoute()) },
                    modifier = Modifier.testTag(PackagesListTags.CREATE),
                )
            }
        }
        PackagesListContent(
            state = state,
            filter = filter,
            onSelectFilter = viewModel::selectFilter,
            onCreate = { onNavigate(viewModel.createRoute()) },
            onOpen = { onNavigate(viewModel.editorRoute(it)) },
            onArchive = viewModel::archive,
            onRestore = viewModel::restore,
            onConnect = { onNavigate(viewModel.connectRoute()) },
            onRetry = viewModel::load,
        )
    }
}

@Composable
internal fun PackagesListContent(
    state: PackagesListUiState,
    filter: PackageFilter,
    onSelectFilter: (PackageFilter) -> Unit,
    onCreate: () -> Unit,
    onOpen: (String) -> Unit,
    onArchive: (String) -> Unit,
    onRestore: (String) -> Unit,
    onConnect: () -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is PackagesListUiState.Loading -> PackagesLoadingBody()
        is PackagesListUiState.ComingSoon -> PkgComingSoon(title = "Packages")
        is PackagesListUiState.Error -> ErrorState(message = state.message, onRetry = onRetry)
        is PackagesListUiState.Loaded ->
            PackagesLoadedBody(
                state = state,
                filter = filter,
                onSelectFilter = onSelectFilter,
                onCreate = onCreate,
                onOpen = onOpen,
                onArchive = onArchive,
                onRestore = onRestore,
                onConnect = onConnect,
            )
    }
}

@Composable
private fun PackagesLoadedBody(
    state: PackagesListUiState.Loaded,
    filter: PackageFilter,
    onSelectFilter: (PackageFilter) -> Unit,
    onCreate: () -> Unit,
    onOpen: (String) -> Unit,
    onArchive: (String) -> Unit,
    onRestore: (String) -> Unit,
    onConnect: () -> Unit,
) {
    val visible = if (filter == PackageFilter.Active) state.active else state.archived
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PkgSegmented(
            options = listOf("Active", "Archived"),
            selectedIndex = filter.ordinal,
            onSelect = { onSelectFilter(PackageFilter.entries[it]) },
            accent = state.pillar.accent,
            modifier = Modifier.testTag(PackagesListTags.FILTER_PREFIX + filter.name),
        )
        if (filter == PackageFilter.Active && visible.isNotEmpty()) {
            Text(
                text = "Sell a bundle of sessions at a better rate. Buyers keep their price if you change it later.",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                modifier = Modifier.padding(horizontal = Spacing.s1),
            )
        }
        when {
            visible.isNotEmpty() ->
                PackagesCard(
                    visible,
                    state.pillar,
                    onOpen,
                    onArchive,
                    onRestore,
                )
            filter == PackageFilter.Active && state.showsPayoutsGate ->
                PayoutsGate(
                    state.pillar,
                    onConnect,
                )
            filter == PackageFilter.Active -> EmptyActive(state.pillar, onCreate)
            else -> EmptyArchived()
        }
        Box(modifier = Modifier.height(Spacing.s8))
    }
}

@Composable
private fun PackagesCard(
    packages: List<PackageDto>,
    pillar: SchedulingPillar,
    onOpen: (String) -> Unit,
    onArchive: (String) -> Unit,
    onRestore: (String) -> Unit,
) {
    PkgRowCard {
        packages.forEachIndexed { index, pkg ->
            PackageRow(
                pkg = pkg,
                accent = pillar.accent,
                accentBg = pillar.accentBg,
                onTap = { onOpen(pkg.id) },
                onArchive = { onArchive(pkg.id) },
                onRestore = { onRestore(pkg.id) },
            )
            if (index < packages.lastIndex) {
                HorizontalDivider(color = PantopusColors.appBorder)
            }
        }
    }
}

@Composable
private fun PackageRow(
    pkg: PackageDto,
    accent: Color,
    accentBg: Color,
    onTap: () -> Unit,
    onArchive: () -> Unit,
    onRestore: () -> Unit,
) {
    val archived = pkg.isActive == false
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = !archived, onClick = onTap)
                .padding(vertical = Spacing.s3)
                .alpha(if (archived) 0.6f else 1f)
                .testTag(PackagesListTags.ROW_PREFIX + pkg.id),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(11.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (archived) PantopusColors.appSurfaceSunken else accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Layers,
                contentDescription = null,
                size = 19.dp,
                tint = if (archived) PantopusColors.appTextSecondary else accent,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = pkg.name,
                color = PantopusColors.appText,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = packageSubtitle(pkg.sessionsCount, pkg.priceCents, pkg.currency),
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
            Row(
                modifier = Modifier.padding(top = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                PkgChip(
                    text = if (archived) "Archived" else "Active",
                    tone = if (archived) PkgChipTone.Neutral else PkgChipTone.Success,
                    uppercased = true,
                )
                packageSoldLabel(pkg.soldCount)?.let {
                    Text(
                        text = it,
                        color = PantopusColors.appTextMuted,
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
        if (archived) {
            Text(
                text = "Restore",
                color = PantopusColors.appTextStrong,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                        .clickable(onClickLabel = "Restore ${pkg.name}", onClick = onRestore)
                        .padding(horizontal = Spacing.s3, vertical = 6.dp),
            )
        } else {
            PackageRowMenu(name = pkg.name, onEdit = onTap, onArchive = onArchive)
        }
    }
}

@Composable
private fun PackageRowMenu(
    name: String,
    onEdit: () -> Unit,
    onArchive: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Box(
            modifier =
                Modifier.size(32.dp).clickable(onClickLabel = "More actions for $name") {
                    expanded = true
                },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MoreVertical,
                contentDescription = "More actions for $name",
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Edit") },
                onClick = {
                    expanded = false
                    onEdit()
                },
                leadingIcon = {
                    PantopusIconImage(
                        icon = PantopusIcon.Pencil,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appText,
                    )
                },
            )
            DropdownMenuItem(
                text = { Text("Archive", color = PantopusColors.error) },
                onClick = {
                    expanded = false
                    onArchive()
                },
                leadingIcon = {
                    PantopusIconImage(
                        icon = PantopusIcon.Archive,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.error,
                    )
                },
            )
        }
    }
}

// ─── Empty / gate ────────────────────────────────────────────────────────────

@Composable
private fun EmptyActive(
    pillar: SchedulingPillar,
    onCreate: () -> Unit,
) {
    EmptyState(
        icon = PantopusIcon.Layers,
        headline = "Sell a package of sessions",
        subcopy = "Bundle sessions so regulars can prepay and rebook fast.",
        ctaTitle = "Create a package",
        onCta = onCreate,
        tint = pillar.accentBg,
        accent = pillar.accent,
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s10),
    )
}

@Composable
private fun EmptyArchived() {
    EmptyState(
        icon = PantopusIcon.Archive,
        headline = "No archived packages",
        subcopy = "Packages you archive will appear here.",
        tint = PantopusColors.appSurfaceSunken,
        accent = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s10),
    )
}

@Composable
private fun PayoutsGate(
    pillar: SchedulingPillar,
    onConnect: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s8),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Box(
            modifier =
                Modifier.size(
                    72.dp,
                ).clip(RoundedCornerShape(Radii.pill)).background(pillar.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Layers,
                contentDescription = null,
                size = 32.dp,
                tint = pillar.accent,
            )
        }
        Text(
            text = "Sell a package of sessions",
            color = PantopusColors.appText,
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = "Bundle sessions so regulars can prepay and rebook fast.",
            color = PantopusColors.appTextSecondary,
            fontSize = 14.sp,
            lineHeight = 19.sp,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        Column(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.warningBg)
                    .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.xl))
                    .padding(horizontal = 14.dp, vertical = 13.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                PantopusIconImage(
                    icon = PantopusIcon.Lock,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.warning,
                )
                Text(
                    text = "Set up payouts to sell packages.",
                    color = PantopusColors.warning,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    lineHeight = 16.sp,
                )
            }
            PkgPrimaryButton(
                label = "Connect payments",
                icon = PantopusIcon.ExternalLink,
                onClick = onConnect,
                modifier = Modifier.height(38.dp),
            )
        }
    }
}

// ─── Loading ──────────────────────────────────────────────────────────────────

@Composable
private fun PackagesLoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4)
                .padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 36.dp, cornerRadius = Radii.md)
        PkgRowCard {
            repeat(3) { i ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                ) {
                    Shimmer(width = 38.dp, height = 38.dp, cornerRadius = Radii.lg)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Shimmer(width = 150.dp, height = 12.dp)
                        Shimmer(width = 190.dp, height = 9.dp)
                        Shimmer(width = 64.dp, height = 15.dp, cornerRadius = Radii.pill)
                    }
                }
                if (i < 2) HorizontalDivider(color = PantopusColors.appBorder)
            }
        }
    }
}
