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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

const val BOOKING_FILTER_TAG = "scheduling.bookingFilter"

@Composable
internal fun bookingScopeAccent(scope: BookingScopeFilter): Color =
    when (scope) {
        BookingScopeFilter.All, BookingScopeFilter.Personal -> PantopusColors.primary600
        BookingScopeFilter.Home -> PantopusColors.home
        BookingScopeFilter.Business -> PantopusColors.business
    }

@Composable
internal fun BookingFilterSheet(
    draft: BookingFilters,
    search: String,
    count: Int?,
    eventTypes: List<EventTypeOption>,
    sheetState: SheetState,
    onSearch: (String) -> Unit,
    onStatus: (BookingStatusFilter?) -> Unit,
    onScope: (BookingScopeFilter) -> Unit,
    onEventType: (String?) -> Unit,
    onDateRange: (BookingDateRange) -> Unit,
    onCustomFrom: (String) -> Unit,
    onCustomTo: (String) -> Unit,
    onClearAll: () -> Unit,
    onApply: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag(BOOKING_FILTER_TAG),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4)) {
            Row(modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
                Text(text = "Filter bookings", style = ExtrasType.header, color = PantopusColors.appText, modifier = Modifier.weight(1f))
                Text(
                    text = "Clear all",
                    style = ExtrasType.rowName,
                    color = if (draft.isActive) PantopusColors.primary600 else PantopusColors.appTextMuted,
                    modifier = Modifier.clickable(enabled = draft.isActive, onClick = onClearAll),
                )
            }

            FilterSheetContent(
                draft = draft,
                search = search,
                count = count,
                eventTypes = eventTypes,
                onSearch = onSearch,
                onStatus = onStatus,
                onScope = onScope,
                onEventType = onEventType,
                onDateRange = onDateRange,
                onCustomFrom = onCustomFrom,
                onCustomTo = onCustomTo,
                onClearAll = onClearAll,
            )

            // Sticky CTA footer with a top hairline over the surface (design).
            Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
                HorizontalDivider(color = PantopusColors.appBorder)
                PrimaryButton(
                    title = ctaLabel(count, draft, search),
                    onClick = onApply,
                    modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2, bottom = Spacing.s4),
                    isEnabled = count == null || count > 0,
                )
            }
        }
    }
}

/**
 * The scrollable filter body, split out of [BookingFilterSheet] so neither
 * generated `@Composable` method exceeds the JVM 64KB method-size limit.
 */
@Composable
private fun FilterSheetContent(
    draft: BookingFilters,
    search: String,
    count: Int?,
    eventTypes: List<EventTypeOption>,
    onSearch: (String) -> Unit,
    onStatus: (BookingStatusFilter?) -> Unit,
    onScope: (BookingScopeFilter) -> Unit,
    onEventType: (String?) -> Unit,
    onDateRange: (BookingDateRange) -> Unit,
    onCustomFrom: (String) -> Unit,
    onCustomTo: (String) -> Unit,
    onClearAll: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        // Search + active-filters summary stay visible above the
        // no-results block (design FrameNoResults keeps them).
        ExtrasInputField(
            value = search,
            onValueChange = onSearch,
            placeholder = "Search invitee or intake text",
            leadingIcon = PantopusIcon.Search,
        )

        if (draft.isActive) {
            ActiveFiltersSummary(
                draft = draft,
                eventTypes = eventTypes,
                onStatus = onStatus,
                onScope = onScope,
                onEventType = onEventType,
                onDateRange = onDateRange,
            )
        }

        if (count == 0) {
            NoResultsBlock(showClearAll = draft.isActive, onClearAll = onClearAll)
            return
        }

        FilterSection(title = "Status") {
            BookingStatusFilter.entries.forEach { status ->
                ExtrasPillChip(
                    label = status.label,
                    selected = draft.status == status,
                    onClick = { onStatus(status) },
                    accent = statusAccent(status),
                    showDot = true,
                )
            }
        }

        FilterSection(title = "Owner context") {
            BookingScopeFilter.entries.forEach { scope ->
                ExtrasPillChip(
                    label = scope.label,
                    selected = draft.scope == scope,
                    onClick = { onScope(scope) },
                    accent = bookingScopeAccent(scope),
                    showDot = true,
                )
            }
        }

        if (eventTypes.isNotEmpty()) {
            FilterSection(title = "Event type") {
                eventTypes.forEach { option ->
                    ExtrasPillChip(
                        label = option.name,
                        selected = draft.eventTypeId == option.id,
                        onClick = { onEventType(option.id) },
                        accent = PantopusColors.primary600,
                    )
                }
            }
        }

        FilterSection(title = "Date range") {
            BookingDateRange.entries.forEach { range ->
                ExtrasPillChip(
                    label = range.label,
                    selected = draft.dateRange == range,
                    onClick = { onDateRange(range) },
                    accent = PantopusColors.info,
                )
            }
        }
        if (draft.dateRange == BookingDateRange.Custom) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                ExtrasInputField(
                    value = draft.customFrom.orEmpty(),
                    onValueChange = onCustomFrom,
                    placeholder = "From (YYYY-MM-DD)",
                    leadingIcon = PantopusIcon.Calendar,
                    modifier = Modifier.weight(1f),
                    keyboardType = KeyboardType.Number,
                )
                ExtrasInputField(
                    value = draft.customTo.orEmpty(),
                    onValueChange = onCustomTo,
                    placeholder = "To (YYYY-MM-DD)",
                    leadingIcon = PantopusIcon.Calendar,
                    modifier = Modifier.weight(1f),
                    keyboardType = KeyboardType.Number,
                )
            }
        }
    }
}

/** The removable "Active filters" chip summary (design keeps it above results). */
@Composable
private fun ActiveFiltersSummary(
    draft: BookingFilters,
    eventTypes: List<EventTypeOption>,
    onStatus: (BookingStatusFilter?) -> Unit,
    onScope: (BookingScopeFilter) -> Unit,
    onEventType: (String?) -> Unit,
    onDateRange: (BookingDateRange) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ExtrasOverline("Active filters")
        ExtrasChipFlow {
            draft.status?.let { ExtrasRemovableChip(label = it.label, accent = statusAccent(it), onRemove = { onStatus(null) }) }
            if (draft.scope != BookingScopeFilter.All) {
                ExtrasRemovableChip(
                    label = draft.scope.label,
                    accent = bookingScopeAccent(draft.scope),
                    onRemove = { onScope(BookingScopeFilter.All) },
                )
            }
            draft.eventTypeId?.let { id ->
                val name = eventTypes.firstOrNull { it.id == id }?.name ?: "Event type"
                ExtrasRemovableChip(label = name, accent = PantopusColors.primary600, onRemove = { onEventType(null) })
            }
            if (draft.dateRange != BookingDateRange.Anytime) {
                ExtrasRemovableChip(
                    label = draft.dateRange.label,
                    accent = PantopusColors.info,
                    onRemove = { onDateRange(BookingDateRange.Anytime) },
                )
            }
        }
    }
}

/**
 * Design FrameNoResults inline block: a 60dp sunken disc with a 26dp search-x,
 * a 14/700 headline (no subcopy), and a Clear-all link — rendered below the
 * still-visible search + active-summary, not a full-screen empty state.
 */
@Composable
private fun NoResultsBlock(
    showClearAll: Boolean,
    onClearAll: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.SearchX, contentDescription = null, size = 26.dp, tint = PantopusColors.appTextSecondary)
        }
        Text(
            text = "No bookings match these filters",
            style = ExtrasType.body14Bold,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        if (showClearAll) {
            Text(
                text = "Clear all",
                style = ExtrasType.body125.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.primary600,
                modifier = Modifier.clickable(onClick = onClearAll),
            )
        }
    }
}

@Composable
private fun FilterSection(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ExtrasOverline(title)
        ExtrasChipFlow { content() }
    }
}

@Composable
private fun statusAccent(status: BookingStatusFilter): Color =
    when (status) {
        BookingStatusFilter.Upcoming -> PantopusColors.primary600
        BookingStatusFilter.Pending -> PantopusColors.warning
        BookingStatusFilter.Past -> PantopusColors.appTextSecondary
        BookingStatusFilter.Cancelled -> PantopusColors.appTextSecondary
        BookingStatusFilter.NoShow -> PantopusColors.error
    }

private fun ctaLabel(
    count: Int?,
    draft: BookingFilters,
    search: String,
): String =
    when {
        count == 0 -> "No matches"
        count == null -> "Show bookings"
        !draft.isActive && search.isBlank() -> "Show all bookings"
        else -> "Show $count ${if (count == 1) "booking" else "bookings"}"
    }
