@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.saved_places

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
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
import kotlinx.coroutines.delay

/** Test tag on the Saved-places root container. */
const val SAVED_PLACES_TAG = "savedPlaces.screen"

private const val TOAST_DISMISS_DELAY_MS = 2_500L
private const val UNDO_DISMISS_DELAY_MS = 4_000L
private const val DIVIDER_INSET_DP = 70

/**
 * BLOCK 2E — "Saved places" (places you bookmark from Explore). A pushed
 * sub-route modelled on the Following screen: back chevron, centred title +
 * count line, an optional All · Home · Work · Saved filter-chip row, and the
 * list of saved-place rows. Each row taps through to the place on the map and
 * exposes an overflow action sheet (Open on map / Share place / Remove).
 * Removal is optimistic and offers an Undo snackbar.
 */
@Composable
fun SavedPlacesScreen(
    onBack: () -> Unit,
    onExplore: () -> Unit = {},
    onOpenMap: (latitude: Double, longitude: Double, label: String) -> Unit = { _, _, _ -> },
    viewModel: SavedPlacesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedFilter by viewModel.selectedFilter.collectAsStateWithLifecycle()
    val actionTarget by viewModel.actionTarget.collectAsStateWithLifecycle()
    val undo by viewModel.undo.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(TOAST_DISMISS_DELAY_MS)
            viewModel.dismissToast()
        }
    }
    LaunchedEffect(undo) {
        if (undo != null) {
            delay(UNDO_DISMISS_DELAY_MS)
            viewModel.dismissUndo()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurfaceMuted)
                .testTag(SAVED_PLACES_TAG),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            SavedPlacesTopBar(state = state, onBack = onBack)
            when (val s = state) {
                is SavedPlacesUiState.Loading -> SavedPlacesLoadingList()
                is SavedPlacesUiState.Loaded -> {
                    if (s.filters.size > 2) {
                        SavedPlacesFilterChips(s.filters, selectedFilter, viewModel::selectFilter)
                    }
                    SavedPlacesLoadedList(
                        rows = s.rows,
                        onOpenMap = { row -> onOpenMap(row.latitude, row.longitude, row.label) },
                        onOverflow = viewModel::openActions,
                    )
                }
                is SavedPlacesUiState.Empty -> SavedPlacesEmpty(onExplore)
                is SavedPlacesUiState.Error -> SavedPlacesError(s.message, viewModel::refresh)
            }
        }
        undo?.let { SavedPlacesUndoSnackbar(it, onUndo = viewModel::undoRemove) }
        toast?.let { SavedPlacesToastOverlay(it) }
    }

    actionTarget?.let { target ->
        SavedPlacesActionSheet(
            target = target,
            onOpenMap = {
                viewModel.closeActions()
                onOpenMap(target.latitude, target.longitude, target.label)
            },
            onShare = {
                viewModel.closeActions()
                val text = "${target.label} — https://maps.google.com/?q=${target.latitude},${target.longitude}"
                val intent =
                    Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, text)
                    }
                context.startActivity(Intent.createChooser(intent, "Share place"))
            },
            onRemove = { viewModel.remove(target) },
            onDismiss = viewModel::closeActions,
        )
    }
}

// region Chrome

@Composable
private fun SavedPlacesTopBar(
    state: SavedPlacesUiState,
    onBack: () -> Unit,
) {
    Column {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .background(PantopusColors.appSurfaceMuted),
        ) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .padding(start = Spacing.s1)
                        .size(40.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("savedPlaces.back"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 25.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appText,
                )
            }
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("Saved places", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                countLine(state)?.let {
                    Text(it, fontSize = 11.5.sp, color = PantopusColors.appTextSecondary)
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

private fun countLine(state: SavedPlacesUiState): String? =
    when (state) {
        is SavedPlacesUiState.Loaded -> "${state.total} place${if (state.total == 1) "" else "s"}"
        else -> null
    }

@Composable
private fun SavedPlacesFilterChips(
    filters: List<SavedPlaceFilter>,
    selected: SavedPlaceFilter,
    onSelect: (SavedPlaceFilter) -> Unit,
) {
    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurfaceMuted)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag("savedPlaces.filterChips"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            filters.forEach { filter ->
                val active = filter == selected
                Box(
                    modifier =
                        Modifier
                            .height(32.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (active) PantopusColors.primary600 else PantopusColors.appSurface)
                            .border(
                                width = 1.dp,
                                color = if (active) Color.Transparent else PantopusColors.appBorder,
                                shape = RoundedCornerShape(Radii.pill),
                            )
                            .clickable { onSelect(filter) }
                            .padding(horizontal = Spacing.s4)
                            .testTag(filter.testTag),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = filter.label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                    )
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

// endregion

// region Loaded list

@Composable
private fun SavedPlacesLoadedList(
    rows: List<SavedPlaceRow>,
    onOpenMap: (SavedPlaceRow) -> Unit,
    onOverflow: (SavedPlaceRow) -> Unit,
) {
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        item(key = "group") {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
            ) {
                rows.forEachIndexed { index, row ->
                    if (index > 0) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .padding(start = DIVIDER_INSET_DP.dp)
                                .background(PantopusColors.appBorderSubtle),
                        )
                    }
                    SavedPlaceRowItem(row, onOpenMap, onOverflow)
                }
            }
        }
        item { Spacer(Modifier.height(Spacing.s5)) }
    }
}

@Composable
private fun SavedPlaceRowItem(
    row: SavedPlaceRow,
    onOpenMap: (SavedPlaceRow) -> Unit,
    onOverflow: (SavedPlaceRow) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 14.dp, end = Spacing.s3, top = 11.dp, bottom = 11.dp)
                .testTag("savedPlaces.row.${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f).clickable { onOpenMap(row) },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            SavedPlaceTile(row.type)
            SavedPlaceRowText(row, modifier = Modifier.weight(1f))
        }
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .clickable { onOverflow(row) }
                    .testTag("savedPlaces.row.overflow"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = "More",
                size = 18.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun SavedPlaceTile(type: SavedPlaceType) {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(type.tileBackground),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = type.icon,
            contentDescription = null,
            size = 20.dp,
            tint = type.tileForeground,
        )
    }
}

@Composable
private fun SavedPlaceRowText(
    row: SavedPlaceRow,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(
            text = row.label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Row(
            modifier = Modifier.padding(top = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = row.subtitle,
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            row.type.pillLabel?.let { SavedPlaceTypePill(it, row.type) }
        }
        Text(
            text = row.savedCaption,
            fontSize = 11.sp,
            color = PantopusColors.appTextMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 1.dp),
        )
    }
}

@Composable
private fun SavedPlaceTypePill(
    label: String,
    type: SavedPlaceType,
) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(type.tileBackground)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = type.tileForeground)
    }
}

// endregion

// region Loading / Empty / Error

@Composable
private fun SavedPlacesLoadingList() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(Spacing.s3)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3)
                .testTag("savedPlaces.loading"),
    ) {
        repeat(6) { index ->
            if (index > 0) Spacer(Modifier.height(Spacing.s3))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurfaceSunken))
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.weight(1f)) {
                    Shimmer(width = 140.dp, height = 12.dp)
                    Shimmer(width = 90.dp, height = 10.dp, cornerRadius = Radii.xs)
                    Shimmer(width = 110.dp, height = 10.dp, cornerRadius = Radii.xs)
                }
            }
        }
    }
}

@Composable
private fun SavedPlacesEmpty(onExplore: () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurfaceMuted)
                .padding(horizontal = Spacing.s6)
                .testTag("savedPlaces.empty"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(76.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Bookmark,
                contentDescription = null,
                size = 32.dp,
                strokeWidth = 1.7f,
                tint = PantopusColors.primary600,
            )
        }
        Spacer(Modifier.height(Spacing.s3))
        Text(
            text = "No saved places yet",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        Spacer(Modifier.height(Spacing.s2))
        Text(
            text = "Save spots you visit often from Explore — your home, your go-to coffee shop, the park down the block.",
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s2),
        )
        Spacer(Modifier.height(Spacing.s4))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onExplore)
                    .padding(horizontal = Spacing.s6, vertical = 12.dp)
                    .testTag("savedPlaces.exploreNearbyBtn"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Compass,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.appTextInverse,
            )
            Text("Explore nearby", fontSize = 14.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
        }
    }
}

@Composable
private fun SavedPlacesError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurfaceMuted)
                .padding(Spacing.s5)
                .testTag("savedPlaces.error"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 34.dp,
            tint = PantopusColors.appTextMuted,
        )
        Spacer(Modifier.height(Spacing.s3))
        Text("Couldn't load your saved places", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Spacer(Modifier.height(Spacing.s2))
        Text(message, fontSize = 13.5.sp, color = PantopusColors.appTextSecondary)
        Spacer(Modifier.height(Spacing.s3))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = Spacing.s5, vertical = 12.dp)
                    .testTag("savedPlaces.error.retry"),
            contentAlignment = Alignment.Center,
        ) {
            Text("Retry", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextInverse)
        }
    }
}

@Composable
private fun SavedPlacesUndoSnackbar(
    undo: SavedPlaceUndo,
    onUndo: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Row(
            modifier =
                Modifier
                    .padding(bottom = Spacing.s10, start = Spacing.s4, end = Spacing.s4)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appText.copy(alpha = 0.95f))
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag("savedPlaces.undoSnackbar"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(
                text = "Removed “${undo.dto.label}”",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextInverse,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "Undo",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary300,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onUndo)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                        .testTag("savedPlaces.undoSnackbar.undo"),
            )
        }
    }
}

@Composable
private fun SavedPlacesToastOverlay(toast: SavedPlacesToast) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Box(
            modifier =
                Modifier
                    .padding(bottom = Spacing.s16, start = Spacing.s4, end = Spacing.s4)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(if (toast.isError) PantopusColors.error else PantopusColors.success)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                    .testTag("savedPlaces.toast"),
        ) {
            Text(text = toast.text, fontSize = 14.sp, color = PantopusColors.appTextInverse)
        }
    }
}

// endregion
