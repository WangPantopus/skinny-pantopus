@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Paparazzi snapshots for the A10 Add / Edit Event form. Locks the design poses:
 * empty (Save disabled), all-day, with-attendees (+ request-RSVP), recurring.
 * Renders the stateless [AddEventFormBody] against fixture state (the screen-level
 * composable depends on Hilt).
 */
class AddEventFormSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2800,
                    softButtons = false,
                ),
        )

    private val zone: ZoneId = ZoneId.of("UTC")
    private val anchor = LocalDateTime.of(2025, 10, 12, 16, 0).atZone(zone)

    @Test
    fun add_event_empty_pose() {
        snapshot(baselineState(title = ""))
    }

    @Test
    fun add_event_all_day_pose() {
        snapshot(
            baselineState(
                title = "Mom turns 62",
                category = CalendarEventCategory.Birthday,
                allDay = true,
                start = anchor.toLocalDate().atStartOfDay(zone),
                end = null,
                recurrence = AddEventRecurrence.Monthly,
                isDirty = true,
            ),
        )
    }

    @Test
    fun add_event_with_attendees_pose() {
        snapshot(
            baselineState(
                title = "Family dinner",
                category = CalendarEventCategory.Meal,
                start = anchor,
                end = anchor.plusHours(1),
                attendees =
                    listOf(
                        AddEventAttendee(id = "u1", displayName = "Maria Patel", initials = "MP"),
                        AddEventAttendee(id = "u2", displayName = "John Patel", initials = "JP"),
                        AddEventAttendee(id = "u3", displayName = "Ava Patel", initials = "AP"),
                    ),
                selectedAttendees = setOf("u1", "u3"),
                reminderOffsets = setOf(AddEventReminderOffset.OneHour),
                requestRsvp = true,
                isDirty = true,
            ),
        )
    }

    @Test
    fun add_event_recurring_pose() {
        snapshot(
            baselineState(
                title = "Trash & recycling out",
                category = CalendarEventCategory.Chore,
                start = anchor,
                end = anchor.plusMinutes(15),
                recurrence = AddEventRecurrence.Weekly,
                reminderOffsets = setOf(AddEventReminderOffset.AtTime, AddEventReminderOffset.TenMin),
                isDirty = true,
            ),
        )
    }

    private fun snapshot(state: AddEventUiState) {
        paparazzi.snapshot {
            Frame {
                AddEventFormBody(
                    state = state,
                    offline = false,
                    onClose = {},
                    onCommit = {},
                    onUpdateField = { _, _ -> },
                    onSelectCategory = {},
                    onAllDay = {},
                    onSetStart = {},
                    onSetEnd = {},
                    onSetRecurrence = {},
                    onToggleReminder = {},
                    onToggleAttendee = {},
                    onSetRequestRsvp = {},
                )
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }

    private fun baselineState(
        title: String,
        location: String = "",
        notes: String = "",
        category: CalendarEventCategory = CalendarEventCategory.Generic,
        allDay: Boolean = false,
        start: java.time.ZonedDateTime = anchor,
        end: java.time.ZonedDateTime? = anchor.plusHours(1),
        recurrence: AddEventRecurrence = AddEventRecurrence.None,
        reminderOffsets: Set<AddEventReminderOffset> = setOf(AddEventReminderOffset.TenMin),
        requestRsvp: Boolean = false,
        attendees: List<AddEventAttendee> = emptyList(),
        selectedAttendees: Set<String> = emptySet(),
        isDirty: Boolean = false,
    ): AddEventUiState {
        val titleField =
            FormFieldState(
                id = AddEventField.Title.key,
                value = title,
                originalValue = if (isDirty) "" else title,
                touched = isDirty,
                error = null,
            )
        val locationField = FormFieldState(id = AddEventField.Location.key, value = location, originalValue = location)
        val notesField = FormFieldState(id = AddEventField.Notes.key, value = notes, originalValue = notes)
        return AddEventUiState(
            fields =
                mapOf(
                    AddEventField.Title to titleField,
                    AddEventField.Location to locationField,
                    AddEventField.Notes to notesField,
                ),
            category = category,
            allDay = allDay,
            startDate = start,
            endDate = end,
            recurrence = recurrence,
            reminderOffsets = reminderOffsets,
            requestRsvp = requestRsvp,
            attendees = attendees,
            selectedAttendeeIds = selectedAttendees,
            isEditing = false,
            isLoadingMembers = false,
            isSaving = false,
            toast = null,
            commit = null,
            baseline =
                AddEventBaseline(
                    category = CalendarEventCategory.Generic,
                    allDay = false,
                    start = start,
                    end = null,
                    recurrence = AddEventRecurrence.None,
                    reminderOffsets = setOf(AddEventReminderOffset.TenMin),
                    requestRsvp = false,
                    attendees = emptySet(),
                ),
        )
    }
}
