@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDate

@Composable
fun DateOverridesScreen(
    scheduleId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: DateOverridesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showTimeEditor by remember { mutableStateOf(false) }
    var rangeStep by remember { mutableStateOf(0) }
    var rangeStart by remember { mutableStateOf<LocalDate?>(null) }
    var showDiscardDialog by remember { mutableStateOf(false) }

    // Overrides persist only on Done (save()); guard a dirty back-press so
    // edits aren't silently discarded (parity with iOS, which persists each edit).
    val attemptBack = {
        if (viewModel.isDirty()) showDiscardDialog = true else onBack()
    }
    BackHandler(enabled = true) { attemptBack() }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                DateOverridesEvent.Saved -> onBack()
                is DateOverridesEvent.Toast -> Unit
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        AvailabilityTopBar(
            title = "Date overrides",
            onBack = attemptBack,
            trailing = {
                val saving = (state as? DateOverridesUiState.Content)?.form?.saving == true
                TopBarTextAction(label = "Done", enabled = !saving, onClick = viewModel::save)
            },
        )
        when (val s = state) {
            DateOverridesUiState.Loading -> SchedulingLoadingSkeleton(modifier = Modifier.fillMaxWidth().weight(1f), rows = 4)
            is DateOverridesUiState.Error ->
                Box(
                    Modifier.fillMaxWidth().weight(1f),
                ) { ErrorState(message = s.message, onRetry = viewModel::refresh) }
            is DateOverridesUiState.Content ->
                OverridesBody(
                    form = s.form,
                    holidayRows = viewModel.holidayRows(),
                    viewModel = viewModel,
                    onEditCustomHours = { showTimeEditor = true },
                    onStartRange = { rangeStep = 1 },
                )
        }
    }

    if (showTimeEditor) {
        val form = (state as? DateOverridesUiState.Content)?.form
        TimeRangeEditorSheet(
            initialStart = form?.customStart ?: "10:00",
            initialEnd = form?.customEnd ?: "14:00",
            onConfirm = { start, end ->
                viewModel.setCustomHours(start, end)
                showTimeEditor = false
            },
            onDismiss = { showTimeEditor = false },
            title = "Custom hours",
        )
    }
    if (rangeStep == 1) {
        A3DatePickerDialog(
            initial = LocalDate.now(),
            onPick = {
                rangeStart = it
                rangeStep = 2
            },
            onDismiss = { rangeStep = 0 },
        )
    }
    if (rangeStep == 2) {
        A3DatePickerDialog(
            initial = rangeStart ?: LocalDate.now(),
            onPick = { end ->
                rangeStart?.let { viewModel.blockRange(it, end) }
                rangeStep = 0
                rangeStart = null
            },
            onDismiss = {
                rangeStep = 0
                rangeStart = null
            },
        )
    }
    if (showDiscardDialog) {
        AlertDialog(
            onDismissRequest = { showDiscardDialog = false },
            title = { Text("Discard changes?") },
            text = { Text("Your date overrides haven't been saved. Tap Done to keep them.") },
            confirmButton = {
                TextButton(onClick = {
                    showDiscardDialog = false
                    onBack()
                }) { Text("Discard", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { showDiscardDialog = false }) { Text("Keep editing") } },
        )
    }
}

@Composable
private fun OverridesBody(
    form: DateOverridesForm,
    holidayRows: List<Pair<String, String>>,
    viewModel: DateOverridesViewModel,
    onEditCustomHours: () -> Unit,
    onStartRange: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        SectionOverline("Personal · Working hours", modifier = Modifier.padding(start = Spacing.s1, top = Spacing.s1))
        MonthCalendar(
            month = form.displayedMonth,
            selectedDate = form.selectedDate,
            markedDates = form.markedDates,
            onSelect = viewModel::selectDate,
            onPrev = viewModel::prevMonth,
            onNext = viewModel::nextMonth,
        )
        PickerBlock(form = form, onChoice = viewModel::setChoice, onEditCustomHours = onEditCustomHours, onApply = viewModel::applySelected)
        // Design date-overrides-frames.jsx:195 RangeLink glyph is `calendar-range`.
        A3LinkRow(icon = PantopusIcon.CalendarRange, label = "Block a date range", onClick = onStartRange)

        SectionLabel("Overrides")
        OverridesCard {
            if (form.overrides.isEmpty()) {
                EmptyOverrides()
            } else {
                form.overrides.forEachIndexed { index, item ->
                    OverrideRow(item = item, onDelete = { viewModel.removeOverride(item.date) })
                    if (index != form.overrides.lastIndex) RowDivider()
                }
            }
        }

        A3Card(overline = "Holiday sets") {
            A3ToggleRow(
                icon = PantopusIcon.Flag,
                label = "US public holidays",
                sub = if (form.holidaySetOn) "Adds ${holidayRows.size} days off this year" else "Block major US holidays automatically",
                on = form.holidaySetOn,
                onToggle = viewModel::toggleHolidaySet,
            )
        }
        if (form.holidaySetOn) {
            SectionLabel("From US public holidays")
            OverridesCard {
                holidayRows.forEachIndexed { index, (date, name) ->
                    HolidayRow(date = date, name = name)
                    if (index != holidayRows.lastIndex) RowDivider()
                }
            }
            // Design FrameHolidays footnote (date-overrides-frames.jsx:366-368) —
            // explains that the set is all-or-nothing. Mirrors iOS DateOverridesView.
            Text(
                "Holidays are blocked as a set. Turn the set off to remove them all at once.",
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                modifier = Modifier.padding(horizontal = Spacing.s1),
            )
        }
    }
}

@Composable
private fun PickerBlock(
    form: DateOverridesForm,
    onChoice: (OverrideChoice) -> Unit,
    onEditCustomHours: () -> Unit,
    onApply: () -> Unit,
) {
    val custom = form.choice == OverrideChoice.CustomHours
    A3Card {
        SectionOverline(formatFullDate(form.selectedDate))
        A3Segmented(
            options = listOf("Unavailable", "Custom hours"),
            selectedIndex = if (custom) 1 else 0,
            onSelect = { onChoice(if (it == 1) OverrideChoice.CustomHours else OverrideChoice.Unavailable) },
        )
        if (custom) {
            FieldLabel("Hours for this day")
            A3TimeRangeButton(
                text = formatRange12(form.customStart, form.customEnd),
                onClick = onEditCustomHours,
                modifier = Modifier.testTag("scheduling.dateOverrides.customHoursButton"),
            )
        } else {
            Text("People can't book you on this date.", color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        A3PrimaryButton(
            label = if (custom) "Add custom hours for this day" else "Block this date",
            // Design PickerBlock CTA glyph (date-overrides-frames.jsx:181): clock when
            // custom hours, `calendar-off` when blocking the date.
            icon = if (custom) PantopusIcon.Clock else PantopusIcon.CalendarOff,
            onClick = onApply,
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = PantopusColors.appTextMuted,
        fontSize = 9.5.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(start = Spacing.s1, top = Spacing.s1),
    )
}

@Composable
private fun OverridesCard(content: @Composable () -> Unit) {
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
private fun OverrideRow(
    item: OverrideItem,
    onDelete: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (item.isUnavailable) PantopusColors.appSurfaceSunken else PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                // Design OverrideRow glyph (date-overrides-frames.jsx:219).
                icon = if (item.isUnavailable) PantopusIcon.CalendarOff else PantopusIcon.Clock,
                contentDescription = null,
                size = 16.dp,
                tint = if (item.isUnavailable) PantopusColors.appTextSecondary else PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(item.dateLabel(), color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(item.detail(), color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        Box(
            modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.sm)).clickable(onClick = onDelete),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Trash2,
                contentDescription = "Delete override for ${item.dateLabel()}",
                size = 15.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun HolidayRow(
    date: String,
    name: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                // Design HolidayRow glyph (date-overrides-frames.jsx:272).
                icon = PantopusIcon.CalendarOff,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(date, color = PantopusColors.appText, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(name, color = PantopusColors.appTextSecondary, fontSize = 11.5.sp)
        }
        Text(
            "HOLIDAY",
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
            color = PantopusColors.appTextSecondary,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun EmptyOverrides() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(44.dp).clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.CalendarX, contentDescription = null, size = 21.dp, tint = PantopusColors.appTextMuted)
        }
        Text(
            "No date overrides yet. Pick a date to add one.",
            modifier = Modifier.padding(top = Spacing.s2),
            color = PantopusColors.appTextSecondary,
            fontSize = 12.5.sp,
            textAlign = TextAlign.Center,
        )
    }
}
