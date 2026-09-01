@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "CyclomaticComplexMethod",
    "LargeClass",
    "MatchingDeclarationName",
)
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.bookings_extra

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTopBarLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

@Composable
fun BookingSearchFilterScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: BookingSearchFilterViewModel = hiltViewModel(),
) {
    val results by viewModel.results.collectAsStateWithLifecycle()
    val search by viewModel.search.collectAsStateWithLifecycle()
    val draft by viewModel.draft.collectAsStateWithLifecycle()
    val applied by viewModel.applied.collectAsStateWithLifecycle()
    val sheetOpen by viewModel.sheetOpen.collectAsStateWithLifecycle()
    val count by viewModel.draftCount.collectAsStateWithLifecycle()
    val eventTypes by viewModel.eventTypes.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.start() }

    Scaffold(
        modifier = Modifier.testTag("scheduling.bookingSearch"),
        containerColor = PantopusColors.appBg,
        topBar = {
            SchedulingTopBar(
                title = "Search bookings",
                leading = SchedulingTopBarLeading.Back,
                onLeading = onBack,
                applyStatusBarInset = true,
                trailing = {
                    IconButton(onClick = viewModel::openFilter) {
                        PantopusIconImage(
                            icon = PantopusIcon.SlidersHorizontal,
                            contentDescription = "Filter",
                            size = 20.dp,
                            tint = if (applied.isActive) PantopusColors.primary600 else PantopusColors.appText,
                        )
                    }
                },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val s = results) {
                is BookingSearchUiState.Loading -> SchedulingLoadingSkeleton(rows = 5)
                is BookingSearchUiState.Error -> ErrorState(message = s.message, onRetry = viewModel::openFilter)
                is BookingSearchUiState.Empty ->
                    EmptyState(
                        icon = PantopusIcon.Search,
                        headline = "No bookings match",
                        subcopy =
                            if (search.isBlank() && !applied.isActive) {
                                "Search by invitee, or filter by status, owner, event type, and date."
                            } else {
                                "Try a different search or clear your filters."
                            },
                        ctaTitle = "Adjust filters",
                        onCta = viewModel::openFilter,
                    )
                is BookingSearchUiState.Loaded ->
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.s4),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        items(s.rows, key = { it.id }) { row ->
                            BookingResultRow(row = row, onClick = { onNavigate(SchedulingRoutes.bookingDetail(row.id)) })
                        }
                    }
            }
        }
    }

    if (sheetOpen) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        BookingFilterSheet(
            draft = draft,
            search = search,
            count = count,
            eventTypes = eventTypes,
            sheetState = sheetState,
            onSearch = viewModel::setSearch,
            onStatus = viewModel::setStatus,
            onScope = viewModel::setScope,
            onEventType = viewModel::setEventType,
            onDateRange = viewModel::setDateRange,
            onCustomFrom = viewModel::setCustomFrom,
            onCustomTo = viewModel::setCustomTo,
            onClearAll = viewModel::clearAll,
            onApply = viewModel::applyFilters,
            onDismiss = viewModel::dismissFilter,
        )
    }
}

@Composable
private fun BookingResultRow(
    row: BookingRowUi,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        InitialsAvatar(name = row.name, diameter = 38.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(text = row.name, style = PantopusTextStyle.body, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            if (row.meta.isNotEmpty()) {
                Text(text = row.meta, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        StatusChip(status = row.status)
    }
}
