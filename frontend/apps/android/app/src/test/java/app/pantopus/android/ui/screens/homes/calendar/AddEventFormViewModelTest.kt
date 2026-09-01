@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "MaxLineLength",
    "ktlint:standard:max-line-length",
)

package app.pantopus.android.ui.screens.homes.calendar

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.CreateHomeEventRequest
import app.pantopus.android.data.api.models.homes.HomeEventDetailResponse
import app.pantopus.android.data.api.models.homes.HomeEventResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeEventRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

/**
 * Covers the F3 Add / Edit Event form VM (A10): defaults, validation,
 * multi-select reminders, request-RSVP, create/edit commit (incl. the
 * `reminders` + `request_rsvp` wire fields), and edit hydration via the
 * `GET /:eventId` detail endpoint.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AddEventFormViewModelTest {
    private val repo: HomesRepository = mockk(relaxed = true)
    private val membersRepo: HomeMembersRepository = mockk()
    private val networkMonitor: NetworkMonitor = mockk()

    private val fixedNow: Instant = Instant.parse("2025-10-12T12:00:00Z")
    private val zone: ZoneId = ZoneId.of("UTC")

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { networkMonitor.isOnline } returns MutableStateFlow(true)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(eventId: String? = null): AddEventFormViewModel {
        val handle =
            SavedStateHandle(
                buildMap {
                    put(ADD_EVENT_HOME_ID_KEY, "home-1")
                    if (eventId != null) put(ADD_EVENT_EVENT_ID_KEY, eventId)
                },
            )
        return AddEventFormViewModel(
            repo = repo,
            membersRepo = membersRepo,
            networkMonitor = networkMonitor,
            savedStateHandle = handle,
            clock = { fixedNow },
            zone = zone,
        )
    }

    private fun stubOccupants(occupants: List<OccupantDto> = emptyList()) {
        coEvery { membersRepo.listOccupants("home-1") } returns
            NetworkResult.Success(OccupantsResponse(occupants = occupants, pendingInvites = emptyList()))
    }

    private fun stubEditSource(event: CalendarEventDto) {
        coEvery { repo.getHomeEvent("home-1", event.id) } returns
            NetworkResult.Success(HomeEventDetailResponse(event = event, attendees = emptyList()))
    }

    private fun occupant(
        userId: String,
        name: String,
    ): OccupantDto = OccupantDto(id = "o-$userId", userId = userId, isActive = true, displayName = name, username = name.lowercase())

    @Test fun initial_state_defaults() =
        runTest {
            stubOccupants()
            val vm = makeVm()
            val state = vm.state.value
            assertFalse(state.isDirty)
            assertFalse(state.isValid)
            assertEquals(CalendarEventCategory.Generic, state.category)
            assertFalse(state.allDay)
            assertNotNull(state.endDate)
            assertEquals(setOf(AddEventReminderOffset.TenMin), state.reminderOffsets)
            assertFalse(state.requestRsvp)
            assertEquals("New event", state.title)
            assertEquals("Save", state.commitLabel)
        }

    @Test fun title_required_gates_submit() {
        val vm = makeVm()
        assertFalse(vm.state.value.isValid)
        vm.updateField(AddEventField.Title, "   ")
        assertFalse(vm.state.value.isValid)
        vm.updateField(AddEventField.Title, "Family dinner")
        assertTrue(vm.state.value.isValid)
    }

    @Test fun end_before_start_flags_inline_error() {
        val vm = makeVm()
        vm.updateField(AddEventField.Title, "Family dinner")
        val start = vm.state.value.startDate
        vm.setEndDate(start.minusHours(1))
        val state = vm.state.value
        assertEquals("End time is before the start time", state.endError)
        assertFalse(state.isValid)
    }

    @Test fun all_day_clears_end_and_reseeds_on_disable() {
        val vm = makeVm()
        vm.updateField(AddEventField.Title, "Mom's birthday")
        vm.setAllDay(true)
        assertNull(vm.state.value.endDate)
        assertEquals(0, vm.state.value.startDate.hour)
        vm.setAllDay(false)
        assertEquals(9, vm.state.value.startDate.hour)
        assertNotNull(vm.state.value.endDate)
    }

    @Test fun toggle_reminder_and_request_rsvp() {
        val vm = makeVm()
        vm.toggleReminder(AddEventReminderOffset.OneHour)
        assertEquals(setOf(AddEventReminderOffset.TenMin, AddEventReminderOffset.OneHour), vm.state.value.reminderOffsets)
        vm.toggleReminder(AddEventReminderOffset.TenMin)
        assertEquals(setOf(AddEventReminderOffset.OneHour), vm.state.value.reminderOffsets)
        vm.setRequestRsvp(true)
        assertTrue(vm.state.value.requestRsvp)
    }

    @Test fun recurrence_round_trips_from_rrule() {
        assertEquals("FREQ=WEEKLY", AddEventRecurrence.Weekly.rrule)
        assertEquals(AddEventRecurrence.Weekly, AddEventRecurrence.from("FREQ=WEEKLY;BYDAY=SU"))
        assertEquals(AddEventRecurrence.None, AddEventRecurrence.from(null))
        assertEquals(4, AddEventRecurrence.pickerOptions.size)
    }

    @Test fun load_populates_attendees_from_roster() =
        runTest {
            stubOccupants(listOf(occupant("u1", "Maria Patel"), occupant("u2", "John Patel")))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertEquals(2, state.attendees.size)
            assertEquals("Maria Patel", state.attendees[0].displayName)
            assertEquals("MP", state.attendees[0].initials)
            assertFalse(state.isLoadingMembers)
        }

    @Test fun create_submit_posts_reminders_and_request_rsvp() =
        runTest {
            stubOccupants()
            val captured = slot<CreateHomeEventRequest>()
            coEvery { repo.createHomeEvent("home-1", capture(captured)) } returns
                NetworkResult.Success(
                    HomeEventResponse(
                        event = CalendarEventDto(id = "e1", homeId = "home-1", eventType = "meal", title = "Family dinner", startAt = "2025-10-12T16:00:00Z"),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.updateField(AddEventField.Title, "Family dinner")
            vm.selectCategory(CalendarEventCategory.Meal)
            vm.setRecurrence(AddEventRecurrence.Weekly)
            vm.toggleReminder(AddEventReminderOffset.OneHour)
            vm.setRequestRsvp(true)
            vm.submit()
            val commit = vm.state.value.commit
            assertTrue(commit is AddEventCommit.Created)
            assertEquals("e1", (commit as AddEventCommit.Created).eventId)
            assertEquals("meal", captured.captured.eventType)
            assertEquals("FREQ=WEEKLY", captured.captured.recurrenceRule)
            assertEquals(listOf(10, 60), captured.captured.reminders)
            assertEquals(true, captured.captured.requestRsvp)
            assertEquals(true, captured.captured.alertsEnabled)
            assertEquals("Event added.", vm.state.value.toast?.text)
        }

    @Test fun create_submit_blocks_when_title_invalid() =
        runTest {
            stubOccupants()
            val vm = makeVm()
            vm.load()
            vm.submit()
            assertTrue(vm.state.value.toast?.isError == true)
            coVerify(exactly = 0) { repo.createHomeEvent(any(), any()) }
        }

    @Test fun create_submit_blocks_when_offline() =
        runTest {
            stubOccupants()
            every { networkMonitor.isOnline } returns MutableStateFlow(false)
            val vm = makeVm()
            vm.load()
            vm.updateField(AddEventField.Title, "Family dinner")
            vm.submit()
            assertTrue(vm.state.value.toast?.isError == true)
            coVerify(exactly = 0) { repo.createHomeEvent(any(), any()) }
        }

    @Test fun editing_hydrates_from_detail_endpoint() =
        runTest {
            stubOccupants()
            stubEditSource(
                CalendarEventDto(
                    id = "e1",
                    homeId = "home-1",
                    eventType = "meal",
                    title = "Family dinner",
                    description = "Gran is bringing dessert.",
                    startAt = "2025-10-12T18:30:00Z",
                    endAt = "2025-10-12T19:30:00Z",
                    recurrenceRule = "FREQ=WEEKLY",
                    assignedTo = listOf("u1", "u3"),
                    alertsEnabled = true,
                    requestRsvp = true,
                    reminders = listOf(10, 60),
                ),
            )
            val vm = makeVm(eventId = "e1")
            vm.load()
            val state = vm.state.value
            assertTrue(state.isEditing)
            assertEquals("Edit event", state.title)
            assertEquals("Family dinner", state.fields[AddEventField.Title]?.value)
            assertEquals(CalendarEventCategory.Meal, state.category)
            assertEquals(AddEventRecurrence.Weekly, state.recurrence)
            assertEquals(setOf(AddEventReminderOffset.TenMin, AddEventReminderOffset.OneHour), state.reminderOffsets)
            assertTrue(state.requestRsvp)
            assertEquals(setOf("u1", "u3"), state.selectedAttendeeIds)
            assertFalse(state.isDirty)
            assertTrue(state.isValid)
        }

    @Test fun editing_all_day_event_hydrates_all_day_pose() =
        runTest {
            stubOccupants()
            stubEditSource(
                CalendarEventDto(
                    id = "e2",
                    homeId = "home-1",
                    eventType = "birthday",
                    title = "Mom turns 62",
                    startAt = "2025-10-14T00:00:00Z",
                    endAt = null,
                    recurrenceRule = "FREQ=YEARLY",
                    alertsEnabled = false,
                ),
            )
            val vm = makeVm(eventId = "e2")
            vm.load()
            val state = vm.state.value
            assertTrue(state.allDay)
            assertNull(state.endDate)
            assertEquals(AddEventRecurrence.Yearly, state.recurrence)
            assertTrue(state.reminderOffsets.isEmpty())
        }

    @Test fun edit_submit_puts_request_and_yields_updated_commit() =
        runTest {
            stubOccupants()
            stubEditSource(
                CalendarEventDto(
                    id = "e1",
                    homeId = "home-1",
                    eventType = "social",
                    title = "Soccer game",
                    startAt = "2025-10-12T16:00:00Z",
                ),
            )
            val captured = slot<UpdateHomeEventRequest>()
            coEvery { repo.updateHomeEvent("home-1", "e1", capture(captured)) } returns
                NetworkResult.Success(
                    HomeEventResponse(
                        event = CalendarEventDto(id = "e1", homeId = "home-1", eventType = "social", title = "Soccer game · Ava", startAt = "2025-10-12T16:00:00Z"),
                    ),
                )
            val vm = makeVm(eventId = "e1")
            vm.load()
            vm.updateField(AddEventField.Title, "Soccer game · Ava")
            vm.submit()
            val commit = vm.state.value.commit
            assertTrue(commit is AddEventCommit.Updated)
            assertEquals("Soccer game · Ava", captured.captured.title)
        }
}
