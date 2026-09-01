@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.TimezoneOption
import app.pantopus.android.ui.screens.scheduling._shared.TimezonePickerSheet
import app.pantopus.android.ui.screens.scheduling._shared.defaultTimezoneOptions
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

private data class EditingBlock(
    val weekday: Int,
    val index: Int,
    val start: String,
    val end: String,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeeklyHoursEditorScreen(
    scheduleId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: WeeklyHoursEditorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var editing by remember { mutableStateOf<EditingBlock?>(null) }
    var copyFrom by remember { mutableStateOf<Int?>(null) }
    var showTz by remember { mutableStateOf(false) }
    var tzQuery by remember { mutableStateOf("") }
    val tzOptions = remember { defaultTimezoneOptions() }
    val tzSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                WeeklyHoursEvent.Saved -> onBack()
                is WeeklyHoursEvent.Toast -> Unit
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        // Design: title is "Set hours" when isUnset (Frame 4), "Edit schedule" otherwise.
        val topBarTitle =
            when (val s = state) {
                is WeeklyHoursUiState.Content -> if (s.form.isUnset) "Set hours" else "Edit schedule"
                else -> "Edit schedule"
            }
        // Design event-editor-shell.jsx TopBar carries a trailing Save / Saving text
        // action on every editor frame (weekly-hours-frames.jsx:281-362).
        AvailabilityTopBar(
            title = topBarTitle,
            onBack = onBack,
            trailing = {
                val form = (state as? WeeklyHoursUiState.Content)?.form
                if (form?.saving == true) {
                    Text("Saving", color = PantopusColors.appTextMuted, fontSize = 15.sp)
                } else {
                    TopBarTextAction(
                        label = "Save",
                        enabled = form != null && form.isValid,
                        onClick = viewModel::save,
                    )
                }
            },
        )
        when (val s = state) {
            WeeklyHoursUiState.Loading ->
                SchedulingLoadingSkeleton(modifier = Modifier.fillMaxWidth().weight(1f), rows = 4)
            is WeeklyHoursUiState.Error ->
                Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                    ErrorState(message = s.message, onRetry = viewModel::refresh)
                }
            is WeeklyHoursUiState.Content -> {
                val form = s.form
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    PersonalHeaderPill()
                    if (form.isUnset) {
                        // Design Frame 4: empty/unset hero — CompositionGapCard then EmptyHero.
                        A3InfoCard(
                            title = "Start with your hours",
                            body = "Your family and business pages build on these hours, so set them first.",
                            icon = PantopusIcon.Layers,
                        )
                        UnsetEmptyHero(onQuickDefault = viewModel::useQuickDefault)
                        LinksCard(
                            onOverrides = { onNavigate(viewModel.overridesRoute()) },
                            onLimits = { onNavigate(viewModel.bookingLimitsRoute()) },
                        )
                    } else {
                        if (form.allDaysOff) {
                            A3WarningCard(
                                title = "No hours set",
                                body = "People can't book you until you add at least one block.",
                                action = {
                                    A3SecondaryButton(
                                        label = "Use 9–5, Mon–Fri",
                                        icon = PantopusIcon.WandSparkles,
                                        onClick = viewModel::useQuickDefault,
                                    )
                                },
                            )
                        }
                        NameCard(name = form.name, enabled = !form.saving, onNameChange = viewModel::setName)
                        TimezoneCard(
                            label = form.timezoneDisplay,
                            locked = form.lockTimezone,
                            enabled = !form.saving,
                            onPick = { showTz = true },
                            onToggleLock = viewModel::toggleLockTimezone,
                        )
                        WeekGridCard(
                            days = form.days,
                            enabled = !form.saving,
                            onToggleDay = viewModel::toggleDay,
                            onEditBlock = { weekday, index, block -> editing = EditingBlock(weekday, index, block.start, block.end) },
                            onRemoveBlock = viewModel::removeBlock,
                            onAddBlock = viewModel::addBlock,
                            onCopy = { copyFrom = it },
                        )
                        LinksCard(
                            onOverrides = { onNavigate(viewModel.overridesRoute()) },
                            onLimits = { onNavigate(viewModel.bookingLimitsRoute()) },
                        )
                    }
                }
                A3SaveBar(
                    label = "Save schedule",
                    saving = form.saving,
                    enabled = form.isValid,
                    onSave = viewModel::save,
                )
            }
        }
    }

    editing?.let { block ->
        TimeRangeEditorSheet(
            initialStart = block.start,
            initialEnd = block.end,
            onConfirm = { start, end ->
                viewModel.updateBlock(block.weekday, block.index, start, end)
                editing = null
            },
            onDismiss = { editing = null },
        )
    }
    copyFrom?.let { source ->
        CopyToDaysSheet(
            sourceWeekday = source,
            onConfirm = { targets ->
                viewModel.copyToDays(source, targets)
                copyFrom = null
            },
            onDismiss = { copyFrom = null },
        )
    }
    if (showTz) {
        TimezonePickerSheet(
            options = tzOptions,
            selectedId = null,
            query = tzQuery,
            onQueryChange = { tzQuery = it },
            onSelect = { option: TimezoneOption ->
                viewModel.setTimezone(option.id, option.name)
                showTz = false
            },
            onDismiss = { showTz = false },
            sheetState = tzSheetState,
            accent = PantopusColors.primary600,
        )
    }
}

@Composable
private fun NameCard(
    name: String,
    enabled: Boolean,
    onNameChange: (String) -> Unit,
) {
    A3Card(overline = "Schedule") {
        FieldLabel("Name")
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            enabled = enabled,
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun TimezoneCard(
    label: String,
    locked: Boolean,
    enabled: Boolean,
    onPick: () -> Unit,
    onToggleLock: (Boolean) -> Unit,
) {
    A3Card(overline = "Timezone") {
        FieldLabel("Time zone")
        // Design TimezoneCard (weekly-hours-frames.jsx:44): the globe is fg3 grey,
        // not the sky the generic field button tints its glyph.
        A3FieldButton(
            icon = PantopusIcon.Globe,
            value = label,
            enabled = enabled,
            onClick = onPick,
            iconTint = PantopusColors.appTextSecondary,
        )
        A3ToggleRow(
            icon = PantopusIcon.Lock,
            label = "Lock to my timezone",
            sub = "Keep these hours even when you travel",
            on = locked,
            enabled = enabled,
            onToggle = onToggleLock,
        )
    }
}

@Composable
private fun WeekGridCard(
    days: List<DayHoursUi>,
    enabled: Boolean,
    onToggleDay: (Int, Boolean) -> Unit,
    onEditBlock: (Int, Int, TimeRange) -> Unit,
    onRemoveBlock: (Int, Int) -> Unit,
    onAddBlock: (Int) -> Unit,
    onCopy: (Int) -> Unit,
) {
    A3Card(overline = "Weekly hours") {
        days.forEachIndexed { index, day ->
            DayRow(
                day = day,
                enabled = enabled,
                onToggle = { onToggleDay(day.weekday, it) },
                onEditBlock = { i, block -> onEditBlock(day.weekday, i, block) },
                onRemoveBlock = { i -> onRemoveBlock(day.weekday, i) },
                onAddBlock = { onAddBlock(day.weekday) },
                onCopy = { onCopy(day.weekday) },
            )
            if (index != days.lastIndex) RowDivider()
        }
    }
}

@Composable
private fun DayRow(
    day: DayHoursUi,
    enabled: Boolean,
    onToggle: (Boolean) -> Unit,
    onEditBlock: (Int, TimeRange) -> Unit,
    onRemoveBlock: (Int) -> Unit,
    onAddBlock: () -> Unit,
    onCopy: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            A3Toggle(on = day.enabled, onToggle = onToggle, enabled = enabled)
            Text(
                day.label,
                modifier = Modifier.weight(1f),
                color = if (day.enabled) PantopusColors.appText else PantopusColors.appTextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            if (day.enabled) {
                Box(
                    modifier = Modifier.size(30.dp).clip(CircleShape).clickable(enabled = enabled, onClick = onCopy),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Copy,
                        contentDescription = "Copy ${day.label} hours to other days",
                        size = 15.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            } else {
                Text("Unavailable", color = PantopusColors.appTextMuted, fontSize = 11.5.sp, fontWeight = FontWeight.Medium)
            }
        }
        if (day.enabled) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(start = 47.dp, top = Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                day.blocks.forEachIndexed { i, block ->
                    A3TimeRangeButton(
                        text = block.label(),
                        enabled = enabled,
                        removable = day.blocks.size > 1,
                        onClick = { onEditBlock(i, block) },
                        onRemove = { onRemoveBlock(i) },
                    )
                }
                A3InlineAddButton(label = "Add a block", enabled = enabled, onClick = onAddBlock)
            }
        }
    }
}

@Composable
private fun LinksCard(
    onOverrides: () -> Unit,
    onLimits: () -> Unit,
) {
    // Design: exactly two link rows — "Date overrides & holidays" (value "None set")
    // and "Booking limits & notice rules" (value "Defaults"). No "Block off time" row.
    A3Card {
        A3LinkRow(
            icon = PantopusIcon.CalendarX,
            label = "Date overrides & holidays",
            value = "None set",
            onClick = onOverrides,
            showDivider = true,
        )
        A3LinkRow(
            icon = PantopusIcon.SlidersHorizontal,
            label = "Booking limits & notice rules",
            value = "Defaults",
            onClick = onLimits,
        )
    }
}

/**
 * Design Frame 4 — empty-hero card: calendar-clock icon, "Set your hours" headline,
 * subcopy, and the "Use 9–5, Mon–Fri" quick-default button.
 */
@Composable
private fun UnsetEmptyHero(onQuickDefault: () -> Unit) {
    A3Card {
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(54.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(PantopusColors.primary50),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.CalendarClock,
                    contentDescription = null,
                    size = 26.dp,
                    tint = PantopusColors.primary600,
                )
            }
            Spacer(Modifier.height(14.dp))
            Text(
                "Set your hours",
                color = PantopusColors.appText,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Tell people the days and times you're open to bookings. You can fine-tune any day after.",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.5.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = Spacing.s2),
            )
            Spacer(Modifier.height(16.dp))
            A3SecondaryButton(
                label = "Use 9–5, Mon–Fri",
                icon = PantopusIcon.WandSparkles,
                onClick = onQuickDefault,
            )
        }
    }
}
