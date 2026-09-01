@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
)
@file:OptIn(
    androidx.compose.material3.ExperimentalMaterial3Api::class,
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
)

package app.pantopus.android.ui.screens.homes.calendar

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Test tag on the screen root. */
const val ADD_EVENT_SCREEN_TAG = "addEventForm"

/**
 * Material3's `DatePickerState` represents the selected day as UTC-midnight
 * epoch millis, so the LocalDate ↔ millis codec below is pinned to UTC.
 * This is picker-internal only — the FORM's semantic zone is the device's
 * local zone (the view-model's `ZonedDateTime`s carry it), matching iOS's
 * un-overridden SwiftUI DatePicker.
 */
private val PICKER_UTC_ZONE: ZoneId = ZoneId.of("UTC")

/** Categories surfaced in the picker (matches design + iOS): Health, Chores, Meals, Family, School. */
private val DESIGNED_CATEGORIES =
    listOf(
        CalendarEventCategory.Medical,
        CalendarEventCategory.Chore,
        CalendarEventCategory.Meal,
        CalendarEventCategory.Family,
        CalendarEventCategory.School,
    )

/**
 * F3 — Add / Edit calendar event form. Mirrors iOS `AddEventFormView`.
 * Reuses the shared [FormShell] (discard-confirm + saving overlay).
 */
@Composable
fun AddEventFormScreen(
    onClose: () -> Unit,
    onCommit: (AddEventCommit) -> Unit,
    viewModel: AddEventFormViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(state.toast) {
        if (state.toast != null) {
            delay(2_500)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(state.commit) {
        state.commit?.let { commit ->
            viewModel.acknowledgeCommit()
            onCommit(commit)
        }
    }

    AddEventFormBody(
        state = state,
        offline = !online,
        onClose = onClose,
        onCommit = { viewModel.submit() },
        onUpdateField = viewModel::updateField,
        onSelectCategory = viewModel::selectCategory,
        onAllDay = viewModel::setAllDay,
        onSetStart = viewModel::setStartDate,
        onSetEnd = viewModel::setEndDate,
        onSetRecurrence = viewModel::setRecurrence,
        onToggleReminder = viewModel::toggleReminder,
        onToggleAttendee = viewModel::toggleAttendee,
        onSetRequestRsvp = viewModel::setRequestRsvp,
    )
}

/** Stateless body — exposed so Paparazzi can render fixture state without the VM. */
@Composable
fun AddEventFormBody(
    state: AddEventUiState,
    offline: Boolean,
    onClose: () -> Unit,
    onCommit: () -> Unit,
    onUpdateField: (AddEventField, String) -> Unit,
    onSelectCategory: (CalendarEventCategory) -> Unit,
    onAllDay: (Boolean) -> Unit,
    onSetStart: (java.time.ZonedDateTime) -> Unit,
    onSetEnd: (java.time.ZonedDateTime) -> Unit,
    onSetRecurrence: (AddEventRecurrence) -> Unit,
    onToggleReminder: (AddEventReminderOffset) -> Unit,
    onToggleAttendee: (String) -> Unit,
    onSetRequestRsvp: (Boolean) -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().testTag(ADD_EVENT_SCREEN_TAG)) {
        FormShell(
            title = state.title,
            rightActionLabel = state.commitLabel,
            isValid = state.isValid,
            isDirty = state.isDirty,
            isSaving = state.isSaving,
            onClose = onClose,
            onCommit = onCommit,
        ) {
            if (offline) OfflineFormBanner()
            TitleGroup(state = state, onUpdate = onUpdateField)
            CategoryGroup(state = state, onSelect = onSelectCategory)
            ScheduleGroup(state = state, onAllDay = onAllDay, onSetStart = onSetStart, onSetEnd = onSetEnd)
            RecurrenceGroup(state = state, onSelect = onSetRecurrence)
            AttendeesGroup(state = state, onToggle = onToggleAttendee)
            ReminderGroup(state = state, onToggle = onToggleReminder)
            RequestRsvpGroup(state = state, onToggle = onSetRequestRsvp)
            NotesGroup(state = state, onUpdate = onUpdateField)
            Box(modifier = Modifier.height(Spacing.s5))
        }

        // FrameSaving (add-event-frames.jsx:111-131): content dims to 0.45 opacity;
        // a floating white card (90% opaque) with a spinner + "Saving event" label
        // is centered over the dimmed content. Mirrors iOS `SavingOverlay`.
        if (state.isSaving) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg.copy(alpha = 0.55f)),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    modifier =
                        Modifier
                            .shadow(elevation = 8.dp, shape = RoundedCornerShape(Radii.xl), clip = false)
                            .clip(RoundedCornerShape(Radii.xl))
                            .background(PantopusColors.appSurface.copy(alpha = 0.9f))
                            .padding(horizontal = Spacing.s6, vertical = 18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    CircularProgressIndicator(
                        color = PantopusColors.home,
                        strokeWidth = 2.5.dp,
                        modifier = Modifier.size(26.dp),
                    )
                    Text(
                        text = "Saving event",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextStrong,
                    )
                }
            }
        }

        state.toast?.let { toast ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s8)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (toast.isError) PantopusColors.error else PantopusColors.success)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(text = toast.text, style = PantopusTextStyle.small, color = PantopusColors.appTextInverse)
            }
        }
    }
}

@Composable
private fun OfflineFormBanner() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.warningBg)
                .padding(horizontal = 11.dp, vertical = 9.dp)
                .testTag("addEvent_offlineBanner"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.WifiOff, contentDescription = null, size = 15.dp, tint = PantopusColors.warning)
        Column {
            Text(text = "You're offline", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PantopusColors.warning)
            Text(text = "This event saves when you reconnect.", fontSize = 11.5.sp, color = PantopusColors.appTextStrong)
        }
    }
}

// MARK: - Section (green-overline card)

/**
 * Bespoke section card matching the design's `Section`
 * (add-event-frames.jsx:11) and iOS `EventSection` — a white card with a
 * Home-green (`homeDark`) uppercase overline, 1px appBorder, [Radii.xl]
 * radius and a subtle shadow. The shared `FormFieldGroup` hardcodes a neutral
 * grey overline + 12dp/no-border card, so the F3 sheet renders its own to
 * carry the Home pillar accent and the design card geometry.
 *
 * @param overline Optional uppercase header in Home-green; `null` for the
 *     overline-less RSVP section (add-event-frames.jsx:88).
 */
@Composable
private fun EventSection(
    overline: String? = null,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (overline != null) {
            Text(
                text = overline.uppercase(Locale.ROOT),
                style = PantopusTextStyle.overline,
                color = PantopusColors.homeDark,
                modifier = Modifier.semantics { heading() },
            )
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .shadow(1.dp, RoundedCornerShape(Radii.xl), clip = false)
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                    .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            content()
        }
    }
}

/** Inline "label left · control right" row matching the design's `ValueRow`. */
@Composable
private fun ValueRow(
    label: String,
    isError: Boolean = false,
    trailing: @Composable () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp),
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isError) PantopusColors.error else PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        trailing()
    }
}

/** Static sunken value pill — the design's `ValueRow` trailing value chip. */
@Composable
private fun ValuePill(
    label: String,
    isError: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.md))
                .background(if (isError) PantopusColors.errorBg else PantopusColors.appSurfaceSunken)
                .then(
                    if (isError) {
                        Modifier.border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.md))
                    } else {
                        Modifier
                    },
                ).clickable(onClick = onClick)
                .padding(horizontal = 10.dp, vertical = 7.dp),
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (isError) PantopusColors.error else PantopusColors.appText,
        )
    }
}

// MARK: - Title

@Composable
private fun TitleGroup(
    state: AddEventUiState,
    onUpdate: (AddEventField, String) -> Unit,
) {
    EventSection {
        val snapshot = state.fields[AddEventField.Title]
        val fieldState =
            when {
                snapshot == null || !snapshot.touched -> PantopusFieldState.Default
                snapshot.error != null -> PantopusFieldState.Error(snapshot.error)
                snapshot.value.trim().isEmpty() -> PantopusFieldState.Default
                else -> PantopusFieldState.Valid
            }
        PantopusTextField(
            label = "Title",
            value = snapshot?.value.orEmpty(),
            onValueChange = { onUpdate(AddEventField.Title, it) },
            placeholder = "Add a title",
            state = fieldState,
            fieldTestTag = "addEvent_titleField",
        )
    }
}

// MARK: - Category

@Composable
private fun CategoryGroup(
    state: AddEventUiState,
    onSelect: (CalendarEventCategory) -> Unit,
) {
    EventSection(overline = "Category") {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            DESIGNED_CATEGORIES.forEach { category ->
                CategoryChip(category = category, isSelected = state.category == category, onClick = { onSelect(category) })
            }
        }
    }
}

@Composable
private fun CategoryChip(
    category: CalendarEventCategory,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    // JSX `CatPick` (add-event-frames.jsx) is a full pill (borderRadius 9999);
    // iOS uses a Capsule. Clip with [Radii.pill] to match.
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier =
            Modifier
                .heightIn(min = 36.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (isSelected) PantopusColors.homeBg else PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = if (isSelected) PantopusColors.homeBg else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.pill),
                ).clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = 7.dp)
                .testTag("addEvent_category_${category.rawValue}")
                .semantics { contentDescription = category.pickerLabel },
    ) {
        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(category.dotColor))
        Text(
            text = category.pickerLabel,
            fontSize = 12.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
            color = if (isSelected) PantopusColors.homeDark else PantopusColors.appText,
        )
    }
}

// MARK: - Schedule

@Composable
private fun ScheduleGroup(
    state: AddEventUiState,
    onAllDay: (Boolean) -> Unit,
    onSetStart: (java.time.ZonedDateTime) -> Unit,
    onSetEnd: (java.time.ZonedDateTime) -> Unit,
) {
    EventSection(overline = "When") {
        // JSX `ScheduleGroup` (add-event-frames.jsx:32): a stack of `ValueRow`s —
        // label left, control/value pill right inline. All-day toggle, then a
        // single combined "date · time" value pill per Starts / Ends.
        ValueRow(label = "All-day") {
            Switch(
                checked = state.allDay,
                onCheckedChange = onAllDay,
                colors =
                    SwitchDefaults.colors(
                        checkedTrackColor = PantopusColors.home,
                        uncheckedTrackColor = PantopusColors.appBorderStrong,
                    ),
                modifier = Modifier.testTag("addEvent_allDayToggle"),
            )
        }
        HorizontalDivider(color = PantopusColors.appBorder, thickness = 1.dp)
        DateTimeValueRow(
            label = "Starts",
            value = state.startDate,
            allDay = state.allDay,
            testTagPrefix = "addEvent_startDate",
            isError = false,
            onChange = onSetStart,
        )
        if (!state.allDay && state.endDate != null) {
            HorizontalDivider(color = PantopusColors.appBorder, thickness = 1.dp)
            DateTimeValueRow(
                label = "Ends",
                value = state.endDate,
                allDay = false,
                testTagPrefix = "addEvent_endDate",
                isError = state.endError != null,
                onChange = onSetEnd,
            )
            state.endError?.let { error ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    modifier = Modifier.testTag("addEvent_endError"),
                ) {
                    PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 11.dp, tint = PantopusColors.error)
                    Text(text = error, style = PantopusTextStyle.caption, color = PantopusColors.error)
                }
            }
        }
    }
}

@Composable
private fun DateTimeValueRow(
    label: String,
    value: java.time.ZonedDateTime,
    allDay: Boolean,
    testTagPrefix: String,
    isError: Boolean,
    onChange: (java.time.ZonedDateTime) -> Unit,
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    val dateFmt = remember { DateTimeFormatter.ofPattern("EEE MMM d", Locale.US) }
    val timeFmt = remember { DateTimeFormatter.ofPattern("h:mm a", Locale.US) }

    // The design renders one combined "Mon Jun 16 · 6:30 PM" value pill. Tapping
    // the pill opens the date picker; on a timed event a second tap target keeps
    // the time editable. We expose two stacked pills sharing the row's right
    // edge so both pieces stay tappable while reading as a single inline value.
    ValueRow(label = label, isError = isError) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), verticalAlignment = Alignment.CenterVertically) {
            ValuePill(
                label = dateFmt.format(value),
                isError = isError,
                onClick = { showDatePicker = true },
                modifier = Modifier.testTag("${testTagPrefix}_date"),
            )
            if (!allDay) {
                ValuePill(
                    label = timeFmt.format(value),
                    isError = isError,
                    onClick = { showTimePicker = true },
                    modifier = Modifier.testTag("${testTagPrefix}_time"),
                )
            }
        }
    }

    if (showDatePicker) {
        SimpleDatePickerDialog(
            initial = value.toLocalDate(),
            onDismiss = { showDatePicker = false },
            onSelect = { picked ->
                showDatePicker = false
                onChange(value.with(picked))
            },
        )
    }
    if (showTimePicker) {
        SimpleTimePickerDialog(
            initial = value.toLocalTime(),
            onDismiss = { showTimePicker = false },
            onSelect = { picked ->
                showTimePicker = false
                onChange(LocalDateTime.of(value.toLocalDate(), picked).atZone(value.zone))
            },
        )
    }
}

// MARK: - Recurrence

@Composable
private fun RecurrenceGroup(
    state: AddEventUiState,
    onSelect: (AddEventRecurrence) -> Unit,
) {
    EventSection(overline = "Repeats") {
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken).padding(3.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            AddEventRecurrence.pickerOptions.forEach { option ->
                val active = state.recurrence == option
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .heightIn(min = 34.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(if (active) PantopusColors.home else Color.Transparent)
                            .clickable { onSelect(option) }
                            .testTag("addEvent_recurrence_${option.rawValue}"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = option.segmentedLabel,
                        fontSize = 12.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                        color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

// MARK: - Attendees

@Composable
private fun AttendeesGroup(
    state: AddEventUiState,
    onToggle: (String) -> Unit,
) {
    EventSection(overline = "Assign to") {
        // The "Assign to" label lives on the section overline above — this row
        // just carries the selected-count, right-aligned.
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.End,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = "${state.selectedAttendeeIds.size} selected",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.homeDark,
                modifier = Modifier.testTag("addEvent_assignedCount"),
            )
        }
        if (state.attendees.isEmpty()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.UsersRound,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = if (state.isLoadingMembers) "Loading household members…" else "No household members loaded yet.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
        } else {
            Column {
                state.attendees.forEachIndexed { index, attendee ->
                    AttendeeRow(
                        attendee = attendee,
                        isSelected = attendee.id in state.selectedAttendeeIds,
                        onClick = { onToggle(attendee.id) },
                    )
                    if (index != state.attendees.lastIndex) {
                        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun AttendeeRow(
    attendee: AddEventAttendee,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clickable(onClick = onClick)
                .padding(vertical = Spacing.s2)
                .testTag("addEvent_attendee_${attendee.id}")
                .semantics { contentDescription = attendee.displayName },
    ) {
        HomeMemberAvatar(member = HomeMember(id = attendee.id, name = attendee.displayName, initials = attendee.initials), size = 32.dp)
        Text(text = attendee.displayName, style = PantopusTextStyle.body, color = PantopusColors.appText, modifier = Modifier.weight(1f))
        CheckMark(isSelected = isSelected)
    }
}

@Composable
private fun CheckMark(isSelected: Boolean) {
    // JSX `Check` (home-shell.jsx:402) is a round 20px circle — green fill +
    // white tick when on, grey ring when off. iOS `RoundCheck` matches.
    Box(
        modifier =
            Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(if (isSelected) PantopusColors.home else PantopusColors.appSurface)
                .border(
                    width = 1.5.dp,
                    color = if (isSelected) PantopusColors.home else PantopusColors.appBorderStrong,
                    shape = CircleShape,
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 12.dp, tint = PantopusColors.appTextInverse)
        }
    }
}

// MARK: - Reminder (multi-select)

@Composable
private fun ReminderGroup(
    state: AddEventUiState,
    onToggle: (AddEventReminderOffset) -> Unit,
) {
    EventSection(overline = "Reminder") {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            AddEventReminderOffset.entries.forEach { offset ->
                val on = offset in state.reminderOffsets
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    modifier =
                        Modifier
                            .heightIn(min = 34.dp)
                            .clip(RoundedCornerShape(percent = 50))
                            .background(if (on) PantopusColors.homeBg else PantopusColors.appSurface)
                            .border(1.dp, if (on) PantopusColors.homeBg else PantopusColors.appBorder, RoundedCornerShape(percent = 50))
                            .clickable { onToggle(offset) }
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                            .testTag("addEvent_reminder_${offset.label}"),
                ) {
                    if (on) {
                        PantopusIconImage(
                            icon = PantopusIcon.Check,
                            contentDescription = null,
                            size = 12.dp,
                            tint = PantopusColors.homeDark,
                        )
                    }
                    Text(
                        text = offset.label,
                        fontSize = 12.sp,
                        fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                        color = if (on) PantopusColors.homeDark else PantopusColors.appTextStrong,
                    )
                }
            }
        }
    }
}

// MARK: - Request RSVP

@Composable
private fun RequestRsvpGroup(
    state: AddEventUiState,
    onToggle: (Boolean) -> Unit,
) {
    // JSX RSVP `Section` (add-event-frames.jsx:88) has no overline — render the
    // toggle in a borderless, overline-less section.
    EventSection {
        ValueRow(label = "Request RSVP from attendees") {
            Switch(
                checked = state.requestRsvp,
                onCheckedChange = onToggle,
                colors =
                    SwitchDefaults.colors(
                        checkedTrackColor = PantopusColors.home,
                        uncheckedTrackColor = PantopusColors.appBorderStrong,
                    ),
                modifier = Modifier.testTag("addEvent_requestRsvpToggle"),
            )
        }
        Text(
            text = "Members get a Going / Maybe / Can't prompt",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Notes

@Composable
private fun NotesGroup(
    state: AddEventUiState,
    onUpdate: (AddEventField, String) -> Unit,
) {
    EventSection(overline = "Notes") {
        val snapshot = state.fields[AddEventField.Notes]
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 88.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(
                            width = 1.dp,
                            color = if (snapshot?.error == null) PantopusColors.appBorder else PantopusColors.error,
                            shape = RoundedCornerShape(Radii.md),
                        ).padding(Spacing.s3),
            ) {
                BasicTextField(
                    value = snapshot?.value.orEmpty(),
                    onValueChange = { onUpdate(AddEventField.Notes, it) },
                    textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    modifier = Modifier.fillMaxWidth().testTag("addEvent_notesField"),
                    decorationBox = { inner ->
                        if ((snapshot?.value ?: "").isEmpty()) {
                            Text(text = "Add a note (optional)", style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
                        }
                        inner()
                    },
                )
            }
            snapshot?.error?.let { error ->
                Text(text = error, style = PantopusTextStyle.caption, color = PantopusColors.error)
            }
        }
    }
}

// MARK: - Pickers

@Composable
private fun SimpleDatePickerDialog(
    initial: LocalDate,
    onSelect: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val initialMillis = initial.atStartOfDay(PICKER_UTC_ZONE).toInstant().toEpochMilli()
    val state = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                val picked = state.selectedDateMillis
                if (picked != null) {
                    onSelect(Instant.ofEpochMilli(picked).atZone(PICKER_UTC_ZONE).toLocalDate())
                } else {
                    onDismiss()
                }
            }) { Text("Done") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        DatePicker(state = state)
    }
}

@Composable
private fun SimpleTimePickerDialog(
    initial: LocalTime,
    onSelect: (LocalTime) -> Unit,
    onDismiss: () -> Unit,
) {
    val state = rememberTimePickerState(initialHour = initial.hour, initialMinute = initial.minute, is24Hour = false)
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = { onSelect(LocalTime.of(state.hour, state.minute)) }) { Text("Done") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    ) {
        Box(modifier = Modifier.padding(Spacing.s4)) { TimePicker(state = state) }
    }
}
