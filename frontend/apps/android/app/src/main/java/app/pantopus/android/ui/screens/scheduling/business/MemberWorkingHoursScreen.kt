@file:Suppress("PackageNaming", "UNUSED_PARAMETER", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")
@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package app.pantopus.android.ui.screens.scheduling.business

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.screens.scheduling._shared.TimezoneOption
import app.pantopus.android.ui.screens.scheduling._shared.TimezonePickerSheet
import app.pantopus.android.ui.screens.scheduling._shared.defaultTimezoneOptions
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.ZoneId

private val DAY_LABEL_W = 30.dp
private val ADD_BTN = 26.dp

private data class EditTarget(val weekday: Int, val index: Int, val range: HoursRange)

@Composable
fun MemberWorkingHoursScreen(
    memberId: String,
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: MemberWorkingHoursViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var toast by remember { mutableStateOf<String?>(null) }

    androidx.compose.runtime.LaunchedEffect(Unit) { viewModel.load() }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                MemberWorkingHoursViewModel.Event.Saved -> onBack()
                is MemberWorkingHoursViewModel.Event.Toast -> toast = event.message
            }
        }
    }

    val title = (state as? MemberWorkingHoursViewModel.UiState.Content)?.form?.title ?: "Booking hours"

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        BizTopBar(title = title, onBack = onBack)
        when (val s = state) {
            MemberWorkingHoursViewModel.UiState.Loading ->
                MemberHoursSkeleton(modifier = Modifier.fillMaxWidth())
            is MemberWorkingHoursViewModel.UiState.Error ->
                ErrorState(message = s.message, modifier = Modifier.fillMaxSize(), onRetry = viewModel::refresh)
            is MemberWorkingHoursViewModel.UiState.Content ->
                MemberHoursBody(form = s.form, viewModel = viewModel, toast = toast, onNavigate = onNavigate)
        }
    }
}

@Composable
private fun MemberHoursBody(
    form: MemberWorkingHoursViewModel.Form,
    viewModel: MemberWorkingHoursViewModel,
    toast: String?,
    onNavigate: (String) -> Unit,
) {
    var editTarget by remember { mutableStateOf<EditTarget?>(null) }
    var showTz by remember { mutableStateOf(false) }
    var tzQuery by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            TzChip(timezone = friendlyTimezone(form.timezoneId), enabled = !form.isReadOnly, onClick = { showTz = true })

            form.upcomingException?.let { DatedExceptionCard(it) }

            if (form.isReadOnly) {
                InheritsNote(
                    memberName = form.memberName,
                    onViewPersonal = { onNavigate(SchedulingRoutes.AVAILABILITY_LIST) },
                )
                Box(modifier = Modifier.alpha(0.6f)) {
                    WeekGrid(days = form.days, readOnly = true, onAdd = {}, onRemoveRange = { _, _ -> }, onEditRange = {})
                }
            } else {
                WeekGrid(
                    days = form.days,
                    readOnly = false,
                    onAdd = viewModel::addRange,
                    onRemoveRange = viewModel::removeRange,
                    onEditRange = { editTarget = it },
                )
                CopyMondayLink(onClick = viewModel::copyMondayToWeekdays)
                BizOverline("Date overrides")
                OverrideRows(
                    onAddOverride = { form.scheduleId?.let { onNavigate(SchedulingRoutes.dateOverrides(it)) } },
                    onBlockOut = { onNavigate(SchedulingRoutes.BLOCK_OFF_TIME) },
                )
                toast?.let { BizNote(text = it, tone = BizNoteTone.Error, icon = PantopusIcon.AlertCircle) }
            }
        }
        if (!form.isReadOnly) {
            Box(
                modifier =
                    Modifier.fillMaxWidth().background(
                        PantopusColors.appSurface,
                    ).padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            ) {
                BizPrimaryButton(text = "Save hours", onClick = viewModel::save, enabled = form.formValid, saving = form.saving)
            }
        }
    }

    editTarget?.let { target ->
        TimeRangeEditDialog(
            range = target.range,
            onConfirm = { start, end ->
                viewModel.updateRange(target.weekday, target.index, start, end)
                editTarget = null
            },
            onDismiss = { editTarget = null },
        )
    }

    if (showTz) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        val options = remember { tzOptions(form.timezoneId) }
        TimezonePickerSheet(
            options = options,
            selectedId = form.timezoneId,
            query = tzQuery,
            onQueryChange = { tzQuery = it },
            onSelect = {
                viewModel.changeTimezone(it.id)
                showTz = false
            },
            onDismiss = { showTz = false },
            sheetState = sheetState,
            detectedId = ZoneId.systemDefault().id,
            accent = bizAccent,
        )
    }
}

/**
 * Loading skeleton matching `memberhours-frames.jsx` FrameLoading geometry:
 * live TzChip is not shimmed (design shows the live chip above the card);
 * then a BizCard with 7 rows, each: 30dp-wide day-label shimmer (h=11) +
 * 60%-width pill shimmer (h=22, r=9999) + 26×26 circle shimmer.
 */
@Composable
private fun MemberHoursSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        // TzChip placeholder shimmer (pill-shaped, matches chip geometry)
        Shimmer(width = 110.dp, height = 28.dp, cornerRadius = 9999.dp)
        BizCard {
            repeat(7) { i ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    // Day-label shimmer (Sk w=30 h=11)
                    Shimmer(width = DAY_LABEL_W, height = 11.dp, cornerRadius = Radii.xs)
                    // Pill-width range shimmer (Sk w~'60%' h=22 r=9999)
                    Shimmer(width = 140.dp, height = 22.dp, cornerRadius = 9999.dp)
                    // Circle add-button shimmer (26×26)
                    Shimmer(width = ADD_BTN, height = ADD_BTN, cornerRadius = 9999.dp)
                }
                if (i != 6) BizRowDivider()
            }
        }
    }
}

@Composable
private fun TzChip(
    timezone: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(bizAccentBg)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Globe, contentDescription = null, size = 13.dp, tint = bizAccent)
        Text(text = timezone, style = PantopusTextStyle.caption, fontWeight = FontWeight.Bold, color = bizAccent)
        if (enabled) {
            PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 13.dp, tint = bizAccent)
        }
    }
}

@Composable
private fun WeekGrid(
    days: List<MemberWorkingHoursViewModel.DayHoursUi>,
    readOnly: Boolean,
    onAdd: (Int) -> Unit,
    onRemoveRange: (Int, Int) -> Unit,
    onEditRange: (EditTarget) -> Unit,
) {
    BizCard {
        days.forEachIndexed { index, day ->
            DayRow(
                day = day,
                readOnly = readOnly,
                showDivider = index != days.lastIndex,
                onAdd = { onAdd(day.weekday) },
                onRemoveRange = { rangeIndex -> onRemoveRange(day.weekday, rangeIndex) },
                onEditRange = { rangeIndex, range -> onEditRange(EditTarget(day.weekday, rangeIndex, range)) },
            )
        }
    }
}

@Composable
private fun DayRow(
    day: MemberWorkingHoursViewModel.DayHoursUi,
    readOnly: Boolean,
    showDivider: Boolean,
    onAdd: () -> Unit,
    onRemoveRange: (Int) -> Unit,
    onEditRange: (Int, HoursRange) -> Unit,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = weekdayShort(day.weekday),
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.Bold,
                color = if (day.ranges.isEmpty()) PantopusColors.appTextMuted else PantopusColors.appTextStrong,
                modifier = Modifier.width(DAY_LABEL_W).padding(top = 5.dp),
            )
            FlowRow(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                if (day.ranges.isEmpty()) {
                    Text(
                        text = "Unavailable",
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.Medium,
                        color = PantopusColors.appTextMuted,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                } else {
                    day.ranges.forEachIndexed { rangeIndex, range ->
                        RangeChip(
                            range = range,
                            readOnly = readOnly,
                            onClick = { onEditRange(rangeIndex, range) },
                            onRemove = { onRemoveRange(rangeIndex) },
                        )
                    }
                }
            }
            if (!readOnly) {
                Box(
                    modifier =
                        Modifier
                            .size(ADD_BTN)
                            .clip(RoundedCornerShape(Radii.pill))
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appSurface)
                            .clickable(onClick = onAdd),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Plus,
                        contentDescription = "Add a range to ${weekdayFull(day.weekday)}",
                        size = 13.dp,
                        tint = bizAccent,
                    )
                }
            }
        }
        if (showDivider) BizRowDivider()
    }
}

@Composable
private fun RangeChip(
    range: HoursRange,
    readOnly: Boolean,
    onClick: () -> Unit,
    onRemove: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (readOnly) PantopusColors.appSurfaceSunken else bizAccentBg)
                .clickable(enabled = !readOnly, onClick = onClick)
                .padding(horizontal = Spacing.s2, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = range.label(),
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Bold,
            color = if (readOnly) PantopusColors.appTextStrong else bizAccent,
        )
        if (!readOnly) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Remove",
                size = 11.dp,
                tint = bizAccent,
                strokeWidth = 2.6f,
                modifier = Modifier.clickable(onClick = onRemove),
            )
        }
    }
}

@Composable
private fun CopyMondayLink(onClick: () -> Unit) {
    Row(
        modifier = Modifier.clickable(onClick = onClick).padding(horizontal = Spacing.s1, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.Copy, contentDescription = null, size = 13.dp, tint = PantopusColors.primary600)
        Text(
            text = "Copy Monday to weekdays",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary600,
        )
    }
}

@Composable
private fun OverrideRows(
    onAddOverride: () -> Unit,
    onBlockOut: () -> Unit,
) {
    BizCard {
        OverrideRow(icon = PantopusIcon.CalendarPlus, label = "Add a date override", showDivider = true, onClick = onAddOverride)
        OverrideRow(icon = PantopusIcon.Ban, label = "Block out time", showDivider = false, onClick = onBlockOut)
    }
}

@Composable
private fun OverrideRow(
    icon: PantopusIcon,
    label: String,
    showDivider: Boolean,
    onClick: () -> Unit,
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Box(
                modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextStrong)
            }
            Text(
                text = label,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            BizChevron()
        }
        if (showDivider) BizRowDivider()
    }
}

@Composable
private fun InheritsNote(
    memberName: String,
    onViewPersonal: () -> Unit,
) {
    Row(
        modifier =
            Modifier.fillMaxWidth().clip(
                RoundedCornerShape(Radii.lg),
            ).background(bizAccentBg).padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Link, contentDescription = null, size = 16.dp, tint = bizAccent)
        Text(
            text = "These hours come from $memberName's personal availability.",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "View personal",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary600,
            modifier = Modifier.clickable(onClick = onViewPersonal),
        )
    }
}

@Composable
private fun DatedExceptionCard(exception: MemberWorkingHoursViewModel.DatedException) {
    val isError = exception.isBlocked
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(if (isError) PantopusColors.errorBg else PantopusColors.appSurface)
                .border(
                    1.dp,
                    if (isError) PantopusColors.errorLight else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.xl),
                )
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier.size(
                    34.dp,
                ).clip(RoundedCornerShape(Radii.md)).background(if (isError) PantopusColors.appSurface else bizAccentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = if (isError) PantopusIcon.Ban else PantopusIcon.CalendarClock,
                contentDescription = null,
                size = 16.dp,
                tint = if (isError) PantopusColors.error else bizAccent,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = exception.title,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.Bold,
                color = if (isError) PantopusColors.error else PantopusColors.appText,
            )
            Text(
                text = exception.sub,
                style = PantopusTextStyle.caption,
                color = if (isError) PantopusColors.error else PantopusColors.appTextSecondary,
            )
        }
        BizChevron()
    }
}

@Composable
private fun TimeRangeEditDialog(
    range: HoursRange,
    onConfirm: (String, String) -> Unit,
    onDismiss: () -> Unit,
) {
    val (sh, sm) = parseHhMm(range.start)
    val (eh, em) = parseHhMm(range.end)
    val startState = rememberTimePickerState(initialHour = sh, initialMinute = sm, is24Hour = false)
    val endState = rememberTimePickerState(initialHour = eh, initialMinute = em, is24Hour = false)
    var editingEnd by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (editingEnd) "End time" else "Start time") },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                TimePicker(state = if (editingEnd) endState else startState)
            }
        },
        confirmButton = {
            if (editingEnd) {
                TextButton(onClick = {
                    onConfirm(hhmm(startState.hour, startState.minute), hhmm(endState.hour, endState.minute))
                }) { Text("Save", color = bizAccent) }
            } else {
                TextButton(onClick = { editingEnd = true }) { Text("Next", color = bizAccent) }
            }
        },
        dismissButton = {
            if (editingEnd) {
                TextButton(onClick = { editingEnd = false }) { Text("Back") }
            } else {
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        },
    )
}

private fun tzOptions(currentId: String): List<TimezoneOption> {
    val base = defaultTimezoneOptions()
    if (base.any { it.id == currentId }) return base
    val name = currentId.substringAfterLast('/').replace('_', ' ')
    return (base + TimezoneOption(id = currentId, name = name, offset = "", localTime = "")).sortedBy { it.name }
}
