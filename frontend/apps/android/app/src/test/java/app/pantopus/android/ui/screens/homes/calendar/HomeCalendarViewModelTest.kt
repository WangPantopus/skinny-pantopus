@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.calendar

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.CalendarEventDto
import app.pantopus.android.data.api.models.homes.GetHomeBillsResponse
import app.pantopus.android.data.api.models.homes.GetHomeEventsResponse
import app.pantopus.android.data.api.models.homes.GetHomePackagesResponse
import app.pantopus.android.data.api.models.homes.GetHomeTasksResponse
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.PackageDto
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.ui.screens.scheduling.bookings.BookingsOwnerRelay
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
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
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.math.BigDecimal
import java.time.Instant
import java.time.ZoneId

/**
 * Covers the F1 Home calendar VM (A10):
 *  - four states (loading → loaded / empty / error),
 *  - the booking **union** mapping (`source:'booking'` rows are read-only,
 *    expose `bookingId`, and route to the Booking Detail route),
 *  - the derived task / bill / package due-dates plotted alongside the
 *    events (read-only, dotted on the strip, exempt from the member
 *    filter, painted from their own kind, date-only values anchored in
 *    the display zone),
 *  - row mapping (category palette + clock label + location + members),
 *  - the member filter, day filter, month strip, and week shift.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class HomeCalendarViewModelTest {
    private val repo: HomesRepository = mockk()
    private val membersRepo: HomeMembersRepository = mockk()
    private val authRepository: AuthRepository = mockk()
    private val networkMonitor: NetworkMonitor = mockk()
    private val bookingsOwnerRelay = BookingsOwnerRelay()

    /** Sunday 2025-10-12 12:00 UTC. */
    private val fixedNow: Instant = Instant.parse("2025-10-12T12:00:00Z")
    private val zone: ZoneId = ZoneId.of("UTC")

    /** "This member can't see that feed" — the default for the side-reads. */
    private val forbidden = NetworkResult.Failure(NetworkError.Forbidden)

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { authRepository.state } returns MutableStateFlow<AuthRepository.State>(AuthRepository.State.SignedOut)
        every { networkMonitor.isOnline } returns MutableStateFlow(true)
        coEvery { membersRepo.listOccupants(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
        // The calendar also plots task / bill / package due dates alongside
        // events. They are best-effort side-reads, so the default here is
        // "unavailable" — every test that does not stub them therefore also
        // proves a derived feed failing never fails the calendar.
        stubDerived()
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    /** [displayZone] defaults to UTC; the date-only regression pins UTC-7. */
    private fun makeVm(displayZone: ZoneId = zone): HomeCalendarViewModel =
        HomeCalendarViewModel(
            repo = repo,
            membersRepo = membersRepo,
            authRepository = authRepository,
            networkMonitor = networkMonitor,
            bookingsOwnerRelay = bookingsOwnerRelay,
            savedStateHandle = SavedStateHandle(mapOf(HOME_CALENDAR_HOME_ID_KEY to "home-1")),
            clock = { fixedNow },
            zone = displayZone,
        )

    private fun event(
        id: String = "e",
        type: String = "general",
        title: String = "Untitled",
        start: String,
        end: String? = null,
        location: String? = null,
        rrule: String? = null,
        attendees: List<String>? = null,
        source: String? = null,
        bookingId: String? = null,
        bookingStatus: String? = null,
    ) = CalendarEventDto(
        id = id,
        homeId = "home-1",
        eventType = type,
        title = title,
        startAt = start,
        endAt = end,
        locationNotes = location,
        recurrenceRule = rrule,
        assignedTo = attendees,
        source = source,
        bookingId = bookingId,
        bookingStatus = bookingStatus,
    )

    private fun task(
        id: String = "t1",
        title: String = "Change the filter",
        due: String? = null,
        status: String = "open",
    ) = HomeTaskDto(id = id, homeId = "home-1", taskType = "chore", title = title, dueAt = due, status = status)

    private fun bill(
        id: String = "b1",
        provider: String = "Electric",
        amount: String = "120.00",
        due: String? = null,
    ) = BillDto(
        id = id,
        homeId = "home-1",
        billType = "utility",
        providerName = provider,
        amount = BigDecimal(amount),
        currency = "USD",
        dueDate = due,
    )

    private fun parcel(
        id: String = "p1",
        description: String = "Winter coat",
        expected: String? = null,
        status: String = "expected",
    ) = PackageDto(id = id, homeId = "home-1", description = description, status = status, expectedAt = expected)

    private fun stubEvents(vararg events: CalendarEventDto) {
        coEvery { repo.getHomeEvents(any(), any(), any()) } returns
            NetworkResult.Success(GetHomeEventsResponse(events = events.toList()))
    }

    private fun occupant(
        userId: String,
        name: String,
    ) = OccupantDto(id = "occ-$userId", userId = userId, displayName = name)

    /** The occupant roster the member chips + row avatars project from. */
    private fun stubMembers(vararg occupants: OccupantDto) {
        coEvery { membersRepo.listOccupants(any()) } returns
            NetworkResult.Success(OccupantsResponse(occupants = occupants.toList()))
    }

    /** Give the VM a signed-in identity so `MemberFilter.Mine` resolves. */
    private fun signIn(userId: String) {
        every { authRepository.state } returns
            MutableStateFlow<AuthRepository.State>(
                AuthRepository.State.SignedIn(
                    UserDto(id = userId, email = "$userId@example.com", displayName = "Alex Kim", avatarUrl = null),
                ),
            )
    }

    private fun rowIds(vm: HomeCalendarViewModel): List<String> =
        (vm.state.value as HomeCalendarUiState.Loaded).sections.flatMap { it.items }.map { it.id }

    private fun rowsById(vm: HomeCalendarViewModel): Map<String, HomeAgendaItem> =
        (vm.state.value as HomeCalendarUiState.Loaded).sections.flatMap { it.items }.associateBy { it.id }

    /**
     * The three side-reads. Arity matches the real repository signatures:
     * `getHomeTasks(homeId)`, `getHomeBills(homeId, status)` and
     * `getHomePackages(homeId, status)` — the VM omits the defaulted
     * `status`, so the mock still sees the two-argument call.
     */
    private fun stubDerived(
        tasks: List<HomeTaskDto>? = null,
        bills: List<BillDto>? = null,
        packages: List<PackageDto>? = null,
    ) {
        val tasksResult: NetworkResult<GetHomeTasksResponse> =
            if (tasks == null) forbidden else NetworkResult.Success(GetHomeTasksResponse(tasks = tasks))
        val billsResult: NetworkResult<GetHomeBillsResponse> =
            if (bills == null) forbidden else NetworkResult.Success(GetHomeBillsResponse(bills = bills))
        val packagesResult: NetworkResult<GetHomePackagesResponse> =
            if (packages == null) forbidden else NetworkResult.Success(GetHomePackagesResponse(packages = packages))
        coEvery { repo.getHomeTasks(any()) } returns tasksResult
        coEvery { repo.getHomeBills(any(), any()) } returns billsResult
        coEvery { repo.getHomePackages(any(), any()) } returns packagesResult
    }

    @Test fun empty_response_renders_first_run_empty() =
        runTest {
            stubEvents()
            val vm = makeVm()
            vm.load()
            val state = vm.state.value as HomeCalendarUiState.Loaded
            assertEquals(AgendaEmpty.FirstRun, state.empty)
        }

    @Test fun failure_renders_error_state() =
        runTest {
            coEvery { repo.getHomeEvents(any(), any(), any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            val error = vm.state.value as HomeCalendarUiState.Error
            // `displayMessage` prefers the typed error's own copy over the fallback.
            assertEquals(NetworkError.Server(500, null).message, error.message)
        }

    @Test fun loaded_buckets_today_section() =
        runTest {
            stubEvents(event(id = "e1", type = "trash", title = "Trash out", start = "2025-10-12T09:00:00Z"))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeCalendarUiState.Loaded
            assertNull(loaded.empty)
            assertEquals(1, loaded.sections.size)
            assertEquals("Today · Sun Oct 12", loaded.sections[0].header)
            assertEquals("Trash out", loaded.sections[0].items[0].title)
            assertEquals(CalendarEventCategory.Trash, loaded.sections[0].items[0].category)
        }

    @Test fun agenda_groups_events_across_the_visible_range() =
        runTest {
            stubEvents(
                event(id = "today1", type = "trash", start = "2025-10-12T09:00:00Z"),
                event(id = "tom1", type = "maintenance", start = "2025-10-13T10:00:00Z"),
                event(id = "tue1", type = "birthday", start = "2025-10-14T00:00:00Z"),
                event(id = "fri1", type = "school", start = "2025-10-17T16:00:00Z"),
                event(id = "nw1", type = "social", start = "2025-10-20T18:00:00Z"),
                event(id = "lt1", type = "delivery", start = "2025-11-02T12:00:00Z"),
            )
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeCalendarUiState.Loaded
            val headers = loaded.sections.map { it.header }
            assertEquals(
                listOf("2025-10-12", "2025-10-13", "2025-10-14", "2025-10-17", "2025-10-20", "2025-11-02"),
                loaded.sections.map { it.id },
            )
            assertEquals("Today · Sun Oct 12", headers[0])
            assertEquals("Tomorrow · Mon Oct 13", headers[1])
            assertEquals("Tue Oct 14", headers[2])
            assertEquals("Sun Nov 2", headers.last())
        }

    @Test fun booking_union_row_is_read_only_and_routes_to_booking_detail() =
        runTest {
            stubEvents(
                event(id = "ev1", type = "chore", title = "Trash out", start = "2025-10-12T08:00:00Z"),
                event(
                    id = "bk1",
                    type = "appointment",
                    title = "Plumber",
                    start = "2025-10-12T17:00:00Z",
                    source = "booking",
                    bookingId = "booking-77",
                    bookingStatus = "pending",
                ),
            )
            val vm = makeVm()
            var navigated: String? = null
            vm.configureNavigation(onNavigate = { navigated = it })
            vm.load()
            val loaded = vm.state.value as HomeCalendarUiState.Loaded
            val booking = loaded.sections.flatMap { it.items }.first { it.isBooking }
            assertEquals("booking-77", booking.bookingId)
            assertEquals("pending", booking.bookingStatus)
            assertNull("booking rows never expose an event id", booking.eventId)
            vm.openAgendaItem(booking)
            assertEquals("scheduling/bookings/booking-77", navigated)
            // The home owner context rides along for the arg-less detail route.
            assertEquals(SchedulingOwner.Home("home-1"), bookingsOwnerRelay.consume())
        }

    @Test fun event_row_opens_event_detail() =
        runTest {
            stubEvents(event(id = "ev1", type = "chore", title = "Trash out", start = "2025-10-12T08:00:00Z"))
            val vm = makeVm()
            var openedEventId: String? = null
            vm.configureNavigation(onOpenEvent = { openedEventId = it })
            vm.load()
            val item = (vm.state.value as HomeCalendarUiState.Loaded).sections.first().items.first()
            vm.openAgendaItem(item)
            assertEquals("ev1", openedEventId)
        }

    // ─── Derived task / bill / package due dates ───────────────

    @Test fun derived_due_dates_join_the_agenda_and_the_month_strip() =
        runTest {
            stubEvents(event(id = "ev1", type = "trash", title = "Trash out", start = "2025-10-12T09:00:00Z"))
            stubDerived(
                tasks = listOf(task(id = "t1", title = "Change the filter", due = "2025-10-13T09:00:00Z", status = "in_progress")),
                bills = listOf(bill(id = "b1", provider = "Electric", amount = "120.00", due = "2025-10-14")),
                packages = listOf(parcel(id = "p1", description = "Winter coat", expected = "2025-10-13T15:00:00Z")),
            )
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeCalendarUiState.Loaded
            val byDay = loaded.sections.associateBy { it.id }

            // Monday holds the task + the parcel, Tuesday the bill.
            val monday = byDay.getValue("2025-10-13").items
            assertEquals(listOf("task-t1", "package-p1"), monday.map { it.id })
            assertEquals("Change the filter", monday[0].title)
            assertEquals("In progress", monday[0].subtitle)
            assertEquals(HomeCalendarDerivedKind.Task, monday[0].derived)
            assertEquals("Winter coat", monday[1].title)
            assertEquals("Expected", monday[1].subtitle)
            assertEquals(HomeCalendarDerivedKind.Package, monday[1].derived)

            val tuesday = byDay.getValue("2025-10-14").items.single()
            assertEquals("bill-b1", tuesday.id)
            assertEquals("Electric bill due", tuesday.title)
            assertEquals("\$120.00", tuesday.subtitle)
            assertEquals(HomeCalendarDerivedKind.Bill, tuesday.derived)
            // A bare `yyyy-MM-dd` due date is date-only → all-day.
            assertEquals("All day", tuesday.time)

            // Dots count derived rows alongside events.
            val strip = vm.monthStrip.value!!
            assertEquals(1, strip.days[0].eventCount)
            assertEquals(2, strip.days[1].eventCount)
            assertEquals(1, strip.days[2].eventCount)
        }

    @Test fun derived_rows_are_read_only_with_no_tap_affordance() =
        runTest {
            stubEvents()
            stubDerived(bills = listOf(bill(id = "b1", due = "2025-10-14")))
            val vm = makeVm()
            var navigated: String? = null
            var openedEventId: String? = null
            vm.configureNavigation(onOpenEvent = { openedEventId = it }, onNavigate = { navigated = it })
            vm.load()
            val loaded = vm.state.value as HomeCalendarUiState.Loaded
            // A home with no events but a bill due is NOT first-run empty.
            assertNull(loaded.empty)
            val row = loaded.sections.single().items.single()
            assertTrue(vm.isDerived(row))
            assertFalse("derived rows are never booking-union rows", row.isBooking)
            // `derived != null` is the marker HomeCalendarScreen threads into
            // `HomeAgendaRowCard(enabled = false)`: the row takes no click and
            // no ripple, rather than lighting up for a no-op tap handler.
            assertNotNull("the row carries the disabled marker", row.derived)
            assertNull("a derived row exposes no event id to route with", row.eventId)
            assertNull("nor a booking id", row.bookingId)
            vm.openAgendaItem(row)
            assertNull("tapping a derived row opens nothing", openedEventId)
            assertNull("tapping a derived row routes nowhere", navigated)
        }

    @Test fun derived_rows_survive_every_member_filter() =
        runTest {
            signIn("u1")
            stubMembers(occupant("u1", "Alex Kim"), occupant("u2", "Sam Oh"))
            stubEvents(
                event(id = "mine", type = "chore", title = "Dishes", start = "2025-10-12T09:00:00Z", attendees = listOf("u1")),
            )
            stubDerived(tasks = listOf(task(id = "t1", title = "Change the filter", due = "2025-10-12T15:00:00Z")))
            val vm = makeVm()
            vm.load()
            assertEquals(listOf("mine", "task-t1"), rowIds(vm))

            // A due date carries no household owner, so it is EXEMPT from the
            // member predicate rather than filtered out by it. Hiding it is the
            // empty-looking month the derived feed exists to prevent — and the
            // month strip counts its dot with no filter either way, so dropping
            // it from the section would leave a dotted day with an empty agenda.
            vm.selectFilter(MemberFilter.Mine)
            assertEquals(listOf("mine", "task-t1"), rowIds(vm))

            vm.selectFilter(MemberFilter.Member("u1", "Alex Kim"))
            assertEquals(listOf("mine", "task-t1"), rowIds(vm))

            vm.selectFilter(MemberFilter.Member("u2", "Sam Oh"))
            assertEquals(listOf("task-t1"), rowIds(vm))
            assertNull(
                "the day still holds the due-date row, so this is not a filtered-empty",
                (vm.state.value as HomeCalendarUiState.Loaded).empty,
            )

            vm.clearMemberFilter()
            assertEquals(listOf("mine", "task-t1"), rowIds(vm))
        }

    @Test fun derived_row_identity_comes_from_its_kind_not_the_category_palette() =
        runTest {
            stubEvents()
            stubDerived(
                tasks = listOf(task(id = "t1", title = "Change the filter", due = "2025-10-13T09:00:00Z")),
                bills = listOf(bill(id = "b1", provider = "Electric", due = "2025-10-14")),
                packages = listOf(parcel(id = "p1", description = "Winter coat", expected = "2025-10-15T15:00:00Z")),
            )
            val vm = makeVm()
            vm.load()
            val byId = rowsById(vm)

            val billRow = byId.getValue("bill-b1")
            assertEquals(HomeCalendarDerivedKind.Bill, billRow.derived)
            assertEquals("Bill", billRow.derived?.label)
            assertEquals(PantopusIcon.Receipt, billRow.derived?.icon)
            // The Home pillar's own unpaid-bill red — NOT the event-category
            // palette, whose Bill swatch is the paid/ok green. Routing the kind
            // through CalendarEventCategory is exactly the regression this pins.
            assertEquals(PantopusColors.error, billRow.derived?.foreground)
            assertEquals(PantopusColors.errorBg, billRow.derived?.background)
            assertNotEquals(CalendarEventCategory.Bill.foreground, billRow.derived?.foreground)
            // No event category is invented for a derived row, and none is rendered.
            assertEquals(CalendarEventCategory.Generic, billRow.category)

            val taskRow = byId.getValue("task-t1")
            assertEquals(HomeCalendarDerivedKind.Task, taskRow.derived)
            assertEquals(PantopusColors.warning, taskRow.derived?.foreground)
            assertEquals(PantopusIcon.ListChecks, taskRow.derived?.icon)

            val parcelRow = byId.getValue("package-p1")
            assertEquals(HomeCalendarDerivedKind.Package, parcelRow.derived)
            assertEquals("Delivery", parcelRow.derived?.label)
            assertEquals(PantopusColors.business, parcelRow.derived?.foreground)
        }

    @Test fun derived_detail_rides_the_subtitle_and_falls_back_to_the_kind_label() =
        runTest {
            stubEvents()
            stubDerived(
                tasks = listOf(task(id = "t1", title = "Change the filter", due = "2025-10-13T09:00:00Z", status = "")),
                bills = listOf(bill(id = "b1", provider = "Electric", amount = "120.00", due = "2025-10-14")),
            )
            val vm = makeVm()
            vm.load()
            val byId = rowsById(vm)

            // Folding the detail into the title loses it: the title renders at
            // maxLines = 1, so an appended " · $120.00" ellipsises away first.
            val billRow = byId.getValue("bill-b1")
            assertEquals("Electric bill due", billRow.title)
            assertEquals("\$120.00", billRow.subtitle)

            // Master's documented fallback — "Null for empty statuses so the row
            // falls back to its type label".
            val taskRow = byId.getValue("task-t1")
            assertEquals("Change the filter", taskRow.title)
            assertEquals("Task", taskRow.subtitle)
        }

    @Test fun a_bare_due_date_anchors_to_midnight_in_the_display_zone() =
        runTest {
            stubEvents()
            stubDerived(
                bills =
                    listOf(
                        bill(id = "today", provider = "Electric", due = "2025-10-12"),
                        bill(id = "tomorrow", provider = "Water", due = "2025-10-13"),
                    ),
            )
            // A bill's `due_date` is a bare Postgres `date` — no time, no zone.
            // Los Angeles is UTC-7 on this date, so resolving it at midnight UTC
            // would file both bills one day early AND drop today's out of the
            // "not before todayStart" window entirely.
            val vm = makeVm(displayZone = ZoneId.of("America/Los_Angeles"))
            vm.load()
            val loaded = vm.state.value as HomeCalendarUiState.Loaded
            assertEquals(listOf("2025-10-12", "2025-10-13"), loaded.sections.map { it.id })
            assertEquals("Today · Sun Oct 12", loaded.sections[0].header)

            val todayRow = loaded.sections[0].items.single()
            assertEquals("bill-today", todayRow.id)
            // Date-only rows stay explicitly all-day: the timestamped heuristic
            // is UTC-pinned, and local midnight west of UTC is not 00:00Z, so
            // without the explicit flag this row would read "12:00 AM".
            assertEquals("All day", todayRow.time)
            assertEquals("", todayRow.ampm)
            assertEquals("bill-tomorrow", loaded.sections[1].items.single().id)

            // The strip agrees with the sections, day for day.
            val strip = vm.monthStrip.value!!
            assertEquals("2025-10-12", strip.days[0].id)
            assertEquals("2025-10-12", strip.todayIsoDate)
            assertEquals(1, strip.days[0].eventCount)
            assertEquals(1, strip.days[1].eventCount)
        }

    @Test fun derived_feed_failure_leaves_the_calendar_loaded() =
        runTest {
            stubEvents(event(id = "e1", type = "trash", title = "Trash out", start = "2025-10-12T09:00:00Z"))
            // stubDerived() from @Before answers Forbidden on all three feeds.
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeCalendarUiState.Loaded
            assertEquals(1, loaded.sections.sumOf { it.items.size })
            assertEquals(1, vm.monthStrip.value?.days?.get(0)?.eventCount)
        }

    // ─── Filters, day selection, month strip ──────────────────

    @Test fun member_filter_scopes_agenda_to_one_member() =
        runTest {
            stubEvents(
                event(id = "mine", type = "chore", title = "Dishes", start = "2025-10-12T09:00:00Z", attendees = listOf("u1")),
                event(id = "theirs", type = "chore", title = "Mow lawn", start = "2025-10-12T10:00:00Z", attendees = listOf("u2")),
            )
            val vm = makeVm()
            vm.load()
            vm.selectFilter(MemberFilter.Member("u1", "Alex"))
            val filtered = vm.state.value as HomeCalendarUiState.Loaded
            assertEquals(1, filtered.sections.sumOf { it.items.size })
            assertEquals("Dishes", filtered.sections.first().items.first().title)

            vm.selectFilter(MemberFilter.Member("nobody", "Nobody"))
            val empty = vm.state.value as HomeCalendarUiState.Loaded
            assertEquals(AgendaEmpty.FilteredMember("Nobody"), empty.empty)

            vm.clearMemberFilter()
            val all = vm.state.value as HomeCalendarUiState.Loaded
            assertEquals(2, all.sections.sumOf { it.items.size })
        }

    @Test fun select_day_filters_then_clears() =
        runTest {
            stubEvents(
                event(id = "e1", type = "trash", title = "Trash", start = "2025-10-12T09:00:00Z"),
                event(id = "e2", type = "birthday", title = "Mom's birthday", start = "2025-10-14T00:00:00Z"),
            )
            val vm = makeVm()
            vm.load()
            vm.selectDay("2025-10-14")
            val filtered = vm.state.value as HomeCalendarUiState.Loaded
            assertEquals(1, filtered.sections.sumOf { it.items.size })
            assertEquals("e2", filtered.sections.first().items.first().id)
            assertEquals("2025-10-14", vm.monthStrip.value?.selectedIsoDate)

            vm.selectDay("2025-10-14")
            val cleared = vm.state.value as HomeCalendarUiState.Loaded
            assertEquals(2, cleared.sections.sumOf { it.items.size })
            assertNull(vm.monthStrip.value?.selectedIsoDate)
        }

    @Test fun selecting_a_day_with_nothing_on_it_renders_the_filtered_day_empty() =
        runTest {
            stubEvents(event(id = "e1", type = "trash", title = "Trash", start = "2025-10-12T09:00:00Z"))
            val vm = makeVm()
            vm.load()
            // Thursday — nothing scheduled.
            vm.selectDay("2025-10-16")
            assertEquals(AgendaEmpty.FilteredDay, (vm.state.value as HomeCalendarUiState.Loaded).empty)
        }

    @Test fun selected_day_keeps_a_derived_row_that_lands_on_it() =
        runTest {
            stubEvents(event(id = "e1", type = "trash", title = "Trash", start = "2025-10-12T09:00:00Z"))
            stubDerived(bills = listOf(bill(id = "b1", due = "2025-10-16")))
            val vm = makeVm()
            vm.load()
            vm.selectDay("2025-10-16")
            val pinned = vm.state.value as HomeCalendarUiState.Loaded
            assertNull(pinned.empty)
            assertEquals("bill-b1", pinned.sections.single().items.single().id)
        }

    @Test fun jump_to_today_clears_selection() =
        runTest {
            stubEvents(event(id = "e1", type = "trash", title = "Trash", start = "2025-10-12T09:00:00Z"))
            val vm = makeVm()
            vm.load()
            vm.selectDay("2025-10-14")
            assertEquals("2025-10-14", vm.monthStrip.value?.selectedIsoDate)
            vm.jumpToToday()
            assertNull(vm.monthStrip.value?.selectedIsoDate)
            assertEquals("2025-10-12", vm.monthStrip.value?.todayIsoDate)
        }

    @Test fun month_strip_dot_counts_and_week_shift() =
        runTest {
            stubEvents(
                event(id = "e1", type = "trash", start = "2025-10-12T09:00:00Z"),
                event(id = "e2", type = "family", start = "2025-10-12T16:00:00Z"),
                event(id = "e3", type = "maintenance", start = "2025-10-13T10:00:00Z"),
            )
            val vm = makeVm()
            vm.load()
            val strip = vm.monthStrip.value!!
            assertEquals("October 2025", strip.monthLabel)
            assertEquals(7, strip.days.size)
            assertEquals("2025-10-12", strip.days[0].id)
            assertEquals(2, strip.days[0].eventCount)
            assertEquals(1, strip.days[1].eventCount)
            assertEquals("2025-10-12", strip.todayIsoDate)

            vm.shiftWeek(HomeCalendarViewModel.WeekShift.Next)
            assertEquals("2025-10-19", vm.monthStrip.value?.days?.first()?.id)
            vm.shiftWeek(HomeCalendarViewModel.WeekShift.Previous)
            vm.shiftWeek(HomeCalendarViewModel.WeekShift.Previous)
            assertEquals("2025-10-05", vm.monthStrip.value?.days?.first()?.id)
        }

    // ─── Row mapping ──────────────────────────────────────────

    @Test fun row_mapping_uses_category_palette() =
        runTest {
            stubMembers(occupant("m1", "Ava Chen"), occupant("m2", "Ben Diaz"), occupant("m3", "Cleo Ruiz"))
            stubEvents(
                event(
                    id = "soccer",
                    type = "family",
                    title = "Soccer game · Ava",
                    start = "2025-10-12T16:00:00Z",
                    end = "2025-10-12T17:30:00Z",
                    location = "Riverside Field 3",
                    rrule = "FREQ=WEEKLY",
                    attendees = listOf("m1", "m2", "m3"),
                ),
            )
            val vm = makeVm()
            vm.load()
            val row = (vm.state.value as HomeCalendarUiState.Loaded).sections[0].items[0]
            assertEquals("Soccer game · Ava", row.title)
            // A wire event DOES take its swatch from the category palette —
            // that inference is untouched; only derived rows opt out of it.
            assertEquals(CalendarEventCategory.Family, row.category)
            assertEquals(PantopusIcon.UsersRound, row.category.icon)
            // Timed event → clock label, not "All day".
            assertEquals("4:00", row.time)
            assertEquals("PM", row.ampm)
            assertEquals("Riverside Field 3", row.location)
            assertEquals(listOf("Ava Chen", "Ben Diaz", "Cleo Ruiz"), row.members.map { it.name })
            assertNull("a wire event is never a derived row", row.derived)
            assertNull("…and carries no derived subtitle", row.subtitle)
            assertEquals("soccer", row.eventId)
        }

    // ─── Category inference helper ────────────────────────────

    @Test fun category_inference_falls_back_to_generic_for_unknown_type() {
        assertEquals(CalendarEventCategory.Generic, CalendarEventCategory.from("qq_unknown"))
        assertEquals(CalendarEventCategory.Generic, CalendarEventCategory.from(null))
        assertEquals(CalendarEventCategory.Pet, CalendarEventCategory.from("vet_visit"))
        assertEquals(CalendarEventCategory.Trash, CalendarEventCategory.from("trash_day"))
        assertEquals(CalendarEventCategory.Meal, CalendarEventCategory.from("family_dinner"))
        assertEquals(CalendarEventCategory.Birthday, CalendarEventCategory.from("birthday_party"))
        assertEquals(CalendarEventCategory.Delivery, CalendarEventCategory.from("delivery"))
        assertEquals(CalendarEventCategory.Generic, CalendarEventCategory.from("general"))
    }

    @Test fun derived_item_projection_drops_undated_rows() {
        val items =
            HomeCalendarDerivedItem.build(
                tasks = listOf(task(id = "t1", due = null), task(id = "t2", due = "2025-10-13T09:00:00Z")),
                bills = listOf(bill(id = "b1", due = null)),
                packages = listOf(parcel(id = "p1", expected = null)),
            )
        assertEquals(listOf("task-t2"), items.map { it.id })
        assertEquals(HomeCalendarDerivedKind.Task, items.single().kind)
    }
}
