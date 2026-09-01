@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList", "CyclomaticComplexMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.insights

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

const val INSIGHTS_FILTER_SHEET_TAG = "scheduling.insights.filterSheet"

/**
 * H13 Insights Period & Filter Sheet (A17). The shared bottom sheet that drives
 * the date window (presets + custom range, ≤ 365 days) and optional
 * event-type / team-member multi-selects for every insights screen. Presented
 * locally from each screen's period chip — it has no route. Mirrors the iOS
 * `InsightsPeriodFilterSheet.swift`.
 */
@Composable
fun InsightsFilterSheet(
    initial: InsightsFilter,
    eventTypeOptions: List<InsightsFilterOption>,
    memberOptions: List<InsightsFilterOption>,
    accent: Color,
    onApply: (InsightsFilter) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var working by remember { mutableStateOf(initial) }
    var pickerTarget by remember { mutableStateOf<CustomDateField?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag(INSIGHTS_FILTER_SHEET_TAG),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Reset",
                color = if (working == InsightsFilter.Default) PantopusColors.appTextMuted else PantopusColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clickable { working = InsightsFilter.Default }
                        .testTag("$INSIGHTS_FILTER_SHEET_TAG.reset"),
            )
            Text(
                "Filter insights",
                color = PantopusColors.appText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            Box(
                modifier = Modifier.clickable(onClickLabel = "Close", onClick = onDismiss).padding(Spacing.s1),
            ) {
                PantopusIconImage(PantopusIcon.X, contentDescription = "Close", size = 18.dp, tint = PantopusColors.appTextSecondary)
            }
        }
        InsightsHairline()

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            DateRangeCard(
                working = working,
                accent = accent,
                onPeriod = { period ->
                    working =
                        if (period == InsightsPeriod.Custom) {
                            working.copy(
                                period = period,
                                customStart = working.customStart ?: LocalDate.now().minusDays(30),
                                customEnd = working.customEnd ?: LocalDate.now(),
                            )
                        } else {
                            working.copy(period = period)
                        }
                },
                onPickStart = { pickerTarget = CustomDateField.Start },
                onPickEnd = { pickerTarget = CustomDateField.End },
            )

            if (eventTypeOptions.isNotEmpty()) {
                MultiSelectCard(
                    title = "Event type",
                    allLabel = "All event types",
                    options = eventTypeOptions,
                    selection = working.eventTypeIds,
                    accent = accent,
                    onAll = { working = working.copy(eventTypeIds = emptySet()) },
                    onToggle = { id -> working = working.copy(eventTypeIds = working.eventTypeIds.toggled(id)) },
                )
            }

            if (memberOptions.isNotEmpty()) {
                MultiSelectCard(
                    title = "Team member",
                    allLabel = "Everyone",
                    options = memberOptions,
                    selection = working.memberIds,
                    accent = accent,
                    onAll = { working = working.copy(memberIds = emptySet()) },
                    onToggle = { id -> working = working.copy(memberIds = working.memberIds.toggled(id)) },
                )
            }
        }

        // Apply bar
        InsightsHairline()
        Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).padding(Spacing.s3)) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 50.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(accent)
                        .clickable {
                            onApply(working)
                            onDismiss()
                        }.testTag("$INSIGHTS_FILTER_SHEET_TAG.apply")
                        .padding(vertical = Spacing.s3),
                contentAlignment = Alignment.Center,
            ) {
                Text(applyLabel(working), color = PantopusColors.appTextInverse, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
    }

    pickerTarget?.let { target ->
        val current =
            when (target) {
                CustomDateField.Start -> working.customStart ?: LocalDate.now().minusDays(30)
                CustomDateField.End -> working.customEnd ?: LocalDate.now()
            }
        InsightsDatePickerDialog(
            initial = current,
            onPick = { picked ->
                working =
                    when (target) {
                        CustomDateField.Start -> working.copy(customStart = picked)
                        CustomDateField.End -> working.copy(customEnd = picked)
                    }
            },
            onDismiss = { pickerTarget = null },
        )
    }
}

private enum class CustomDateField { Start, End }

private fun Set<String>.toggled(id: String): Set<String> = if (contains(id)) this - id else this + id

private fun applyLabel(filter: InsightsFilter): String {
    val count = filter.activeFilterCount
    return if (count > 0) "Apply ($count ${if (count == 1) "filter" else "filters"})" else "Apply"
}

// ─── Date range ─────────────────────────────────────────────────────────────

@Composable
private fun DateRangeCard(
    working: InsightsFilter,
    accent: Color,
    onPeriod: (InsightsPeriod) -> Unit,
    onPickStart: () -> Unit,
    onPickEnd: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        InsightsOverline("Date range")
        GroupedCard {
            InsightsPeriod.entries.forEachIndexed { index, period ->
                RadioRow(label = period.title, selected = working.period == period, accent = accent) { onPeriod(period) }
                if (index < InsightsPeriod.entries.lastIndex) InsightsHairline()
            }
            if (working.period == InsightsPeriod.Custom) {
                InsightsHairline()
                CustomRange(working = working, onPickStart = onPickStart, onPickEnd = onPickEnd)
            }
        }
    }
}

@Composable
private fun RadioRow(
    label: String,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).heightIn(min = 44.dp).padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = PantopusColors.appText, fontSize = 13.5.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        InsightsRadioDot(selected = selected, accent = accent)
    }
}

@Composable
private fun CustomRange(
    working: InsightsFilter,
    onPickStart: () -> Unit,
    onPickEnd: () -> Unit,
) {
    val start = working.customStart ?: LocalDate.now().minusDays(30)
    val end = working.customEnd ?: LocalDate.now()
    Column(modifier = Modifier.padding(vertical = Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        DateField(label = "Start", value = InsightsFormat.shortDay(minOf(start, end)), onClick = onPickStart)
        DateField(label = "End", value = InsightsFormat.shortDay(maxOf(start, end)), onClick = onPickEnd)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            PantopusIconImage(PantopusIcon.Calendar, contentDescription = null, size = 13.dp, tint = PantopusColors.appTextMuted)
            Text(
                "${InsightsFormat.shortDay(minOf(start, end))} – ${InsightsFormat.shortDay(maxOf(start, end))}",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun DateField(
    label: String,
    value: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .heightIn(min = 44.dp)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            color = PantopusColors.appTextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
        Text(value, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

// ─── Multi-select ───────────────────────────────────────────────────────────

@Composable
private fun MultiSelectCard(
    title: String,
    allLabel: String,
    options: List<InsightsFilterOption>,
    selection: Set<String>,
    accent: Color,
    onAll: () -> Unit,
    onToggle: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        InsightsOverline(title)
        GroupedCard {
            SelectRow(label = allLabel, selected = selection.isEmpty(), accent = accent, onClick = onAll)
            options.forEach { option ->
                InsightsHairline()
                SelectRow(label = option.name, selected = selection.contains(option.id), accent = accent) { onToggle(option.id) }
            }
        }
    }
}

@Composable
private fun SelectRow(
    label: String,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).heightIn(min = 44.dp).padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            color = PantopusColors.appText,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            PantopusIconImage(PantopusIcon.Check, contentDescription = "Selected", size = 16.dp, strokeWidth = 2.6f, tint = accent)
        }
    }
}

@Composable
private fun GroupedCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = Spacing.s3),
    ) {
        content()
    }
}

@Composable
private fun InsightsDatePickerDialog(
    initial: LocalDate,
    onPick: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val pickerState =
        rememberDatePickerState(
            initialSelectedDateMillis = initial.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                pickerState.selectedDateMillis?.let { millis ->
                    onPick(Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate())
                }
                onDismiss()
            }) { Text("OK") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        DatePicker(state = pickerState)
    }
}
