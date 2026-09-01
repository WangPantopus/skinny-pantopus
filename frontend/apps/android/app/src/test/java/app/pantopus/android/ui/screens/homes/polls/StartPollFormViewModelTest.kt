@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.polls

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CreatePollRequest
import app.pantopus.android.data.api.models.homes.HomePollResponse
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.models.homes.PollDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
import app.pantopus.android.data.homes.HomesRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

@OptIn(ExperimentalCoroutinesApi::class)
class StartPollFormViewModelTest {
    private val homesRepo: HomesRepository = mockk()
    private val membersRepo: HomeMembersRepository = mockk()

    // 2026-05-15T12:00:00Z fixed clock.
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00.000Z")
    private val zone: ZoneId = ZoneOffset.UTC

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(kind: StartPollKind = StartPollKind.SingleChoice): StartPollFormViewModel {
        coEvery { membersRepo.listOccupants(any()) } returns
            NetworkResult.Failure(NetworkError.NotFound)
        val vm =
            StartPollFormViewModel(
                homesRepo = homesRepo,
                membersRepo = membersRepo,
                savedStateHandle = SavedStateHandle(mapOf(START_POLL_HOME_ID_KEY to "home-1")),
                clock = { fixedNow },
                zone = { zone },
            )
        vm.setKind(kind)
        return vm
    }

    private fun futureDate(hours: Long): LocalDateTime = LocalDateTime.ofInstant(fixedNow.plusSeconds(hours * 3600), zone)

    // MARK: - Initial pose

    @Test fun choice_kinds_seed_two_empty_options() {
        for (kind in listOf(
            StartPollKind.SingleChoice,
            StartPollKind.MultiChoice,
            StartPollKind.Ranked,
            StartPollKind.Approval,
        )) {
            val vm = makeVm(kind)
            val state = vm.state.value
            assertEquals(kind, state.kind)
            assertEquals(2, state.options.size)
            assertTrue(state.options.all { !it.isLocked })
            assertTrue(state.options.all { it.label.isEmpty() })
        }
    }

    @Test fun yes_no_locks_yes_and_no() {
        val vm = makeVm(StartPollKind.YesNo)
        val state = vm.state.value
        assertEquals(listOf("Yes", "No"), state.options.map { it.label })
        assertTrue(state.options.all { it.isLocked })
    }

    // MARK: - Kind switching

    @Test fun switching_to_yes_no_replaces_options_with_locked_pair() {
        val vm = makeVm(StartPollKind.SingleChoice)
        val ids = vm.state.value.options.map { it.id }
        vm.updateOption(ids[0], "Apple")
        vm.updateOption(ids[1], "Banana")
        vm.setKind(StartPollKind.YesNo)
        val state = vm.state.value
        assertEquals(listOf("Yes", "No"), state.options.map { it.label })
        assertTrue(state.options.all { it.isLocked })
    }

    @Test fun switching_from_yes_no_seeds_fresh_editable_rows() {
        val vm = makeVm(StartPollKind.YesNo)
        vm.setKind(StartPollKind.MultiChoice)
        val state = vm.state.value
        assertEquals(2, state.options.size)
        assertTrue(state.options.all { !it.isLocked })
        assertTrue(state.options.all { it.label.isEmpty() })
    }

    @Test fun switching_between_choice_kinds_preserves_input() {
        val vm = makeVm(StartPollKind.SingleChoice)
        val ids = vm.state.value.options.map { it.id }
        vm.updateOption(ids[0], "Sage")
        vm.updateOption(ids[1], "Navy")
        vm.setKind(StartPollKind.MultiChoice)
        assertEquals(listOf("Sage", "Navy"), vm.state.value.options.map { it.label })
        vm.setKind(StartPollKind.Ranked)
        assertEquals(listOf("Sage", "Navy"), vm.state.value.options.map { it.label })
        vm.setKind(StartPollKind.Approval)
        assertEquals(listOf("Sage", "Navy"), vm.state.value.options.map { it.label })
    }

    // MARK: - Add / remove bounds

    @Test fun add_option_stops_at_max() {
        val vm = makeVm(StartPollKind.MultiChoice)
        repeat(20) { vm.addOption() }
        assertEquals(StartPollBounds.MAX_OPTIONS, vm.state.value.options.size)
    }

    @Test fun remove_option_refuses_below_min() {
        val vm = makeVm(StartPollKind.SingleChoice)
        val firstId = vm.state.value.options[0].id
        vm.removeOption(firstId)
        assertEquals(2, vm.state.value.options.size)
    }

    @Test fun remove_option_works_above_min() {
        val vm = makeVm(StartPollKind.SingleChoice)
        vm.addOption()
        val target = vm.state.value.options[1].id
        vm.removeOption(target)
        assertEquals(2, vm.state.value.options.size)
        assertFalse(vm.state.value.options.any { it.id == target })
    }

    @Test fun yes_no_ignores_add_and_remove() {
        val vm = makeVm(StartPollKind.YesNo)
        vm.addOption()
        val firstId = vm.state.value.options[0].id
        vm.removeOption(firstId)
        assertEquals(2, vm.state.value.options.size)
        assertEquals(listOf("Yes", "No"), vm.state.value.options.map { it.label })
    }

    // MARK: - Validation

    @Test fun question_too_short_fails() {
        val vm = makeVm()
        vm.updateQuestion("Hi")
        vm.closeDateIn(hours = 2)
        assertFalse(vm.isValid())
        assertNotNull(vm.firstValidationError())
    }

    @Test fun question_too_long_fails() {
        val vm = makeVm()
        vm.updateQuestion("a".repeat(201))
        assertNotNull(vm.firstValidationError())
    }

    @Test fun missing_close_date_fails() {
        val vm = makeVm()
        vm.updateQuestion("Paint colour?")
        val ids = vm.state.value.options.map { it.id }
        vm.updateOption(ids[0], "Sage")
        vm.updateOption(ids[1], "Navy")
        assertEquals("Pick a close date.", vm.firstValidationError())
    }

    @Test fun close_date_less_than_hour_ahead_fails() {
        val vm = makeVm()
        vm.updateQuestion("Paint colour?")
        val ids = vm.state.value.options.map { it.id }
        vm.updateOption(ids[0], "Sage")
        vm.updateOption(ids[1], "Navy")
        vm.setCloseDate(LocalDateTime.ofInstant(fixedNow.plusSeconds(60 * 30), zone))
        assertEquals(
            "Close date must be at least 1 hour in the future.",
            vm.firstValidationError(),
        )
    }

    @Test fun duplicate_options_fail_case_insensitive() {
        val vm = makeVm()
        vm.updateQuestion("Paint colour?")
        val ids = vm.state.value.options.map { it.id }
        vm.updateOption(ids[0], "Sage")
        vm.updateOption(ids[1], "sage")
        vm.closeDateIn(hours = 2)
        assertEquals("Each option must be unique.", vm.firstValidationError())
    }

    @Test fun fewer_than_two_options_fails() {
        val vm = makeVm()
        vm.updateQuestion("Paint colour?")
        val ids = vm.state.value.options.map { it.id }
        vm.updateOption(ids[0], "Sage")
        // leave second blank
        vm.closeDateIn(hours = 2)
        assertEquals(
            "Add at least ${StartPollBounds.MIN_OPTIONS} options.",
            vm.firstValidationError(),
        )
    }

    @Test fun valid_form_passes() {
        val vm = makeVm()
        vm.updateQuestion("Paint colour for the living room?")
        val ids = vm.state.value.options.map { it.id }
        vm.updateOption(ids[0], "Sage")
        vm.updateOption(ids[1], "Navy")
        vm.closeDateIn(hours = 2)
        assertNull(vm.firstValidationError())
        assertTrue(vm.isValid())
    }

    @Test fun yes_no_skips_custom_option_validation() {
        val vm = makeVm(StartPollKind.YesNo)
        vm.updateQuestion("Replace the dishwasher?")
        vm.closeDateIn(hours = 2)
        assertNull(vm.firstValidationError())
        assertTrue(vm.isValid())
    }

    // MARK: - Wire mapping

    @Test fun wire_mapping_for_each_kind() {
        val pairs =
            listOf(
                StartPollKind.SingleChoice to "single_choice",
                StartPollKind.MultiChoice to "multiple_choice",
                StartPollKind.Ranked to "ranking",
                StartPollKind.YesNo to "yes_no",
                StartPollKind.Approval to "multiple_choice",
            )
        for ((kind, expected) in pairs) {
            val vm = makeVm(kind)
            vm.updateQuestion("Paint colour question?")
            if (kind.allowsCustomOptions) {
                val ids = vm.state.value.options.map { it.id }
                vm.updateOption(ids[0], "Alpha")
                vm.updateOption(ids[1], "Beta")
            }
            vm.closeDateIn(hours = 2)
            val request = vm.buildRequest()
            assertEquals("Kind ${kind.label}", expected, request.pollType)
            assertTrue(request.options.size >= 2)
            assertNotNull(request.closesAt)
        }
    }

    @Test fun audience_default_is_null_visibility() {
        val vm = validForm()
        assertNull(vm.buildRequest().visibility)
    }

    @Test fun audience_selected_ids_are_sorted() {
        val vm = validForm()
        vm.toggleMember("user-2")
        vm.toggleMember("user-1")
        assertEquals("selected:user-1,user-2", vm.buildRequest().visibility)
    }

    @Test fun anonymous_alone_rides_on_visibility() {
        val vm = validForm()
        vm.setAnonymous(true)
        assertEquals("anonymous", vm.buildRequest().visibility)
    }

    @Test fun anonymous_with_selected_members_combines() {
        val vm = validForm()
        vm.toggleMember("user-1")
        vm.setAnonymous(true)
        assertEquals("selected:user-1;anonymous", vm.buildRequest().visibility)
    }

    // MARK: - Submit path

    @Test fun submit_invalid_form_shakes_and_skips_network() =
        runTest {
            val vm = makeVm()
            val initialShake = vm.state.value.shakeTrigger
            vm.submit()
            assertTrue(vm.state.value.shakeTrigger == initialShake + 1)
            assertNotNull(vm.state.value.toast)
            coVerify(exactly = 0) { homesRepo.createHomePoll(any(), any()) }
        }

    @Test fun submit_happy_path_calls_create_poll_endpoint() =
        runTest {
            val captured = slot<CreatePollRequest>()
            coEvery { homesRepo.createHomePoll("home-1", capture(captured)) } returns
                NetworkResult.Success(HomePollResponse(poll = samplePoll()))
            val vm = validForm()
            vm.submit()
            assertEquals("Paint colour for living room?", captured.captured.title)
            assertEquals("single_choice", captured.captured.pollType)
            assertEquals(2, captured.captured.options.size)
            coVerify(exactly = 1) { homesRepo.createHomePoll("home-1", any()) }
        }

    // MARK: - Dirty tracking

    @Test fun clean_form_is_not_dirty() {
        val vm = makeVm()
        assertFalse(vm.isDirty())
    }

    @Test fun typing_question_marks_dirty() {
        val vm = makeVm()
        vm.updateQuestion("anything")
        assertTrue(vm.isDirty())
    }

    @Test fun toggling_anonymity_marks_dirty() {
        val vm = makeVm()
        vm.setAnonymous(true)
        assertTrue(vm.isDirty())
    }

    // MARK: - Members hydration

    @Test fun load_members_populates_active_occupants() {
        val vm = makeVm()
        coEvery { membersRepo.listOccupants("home-1") } returns
            NetworkResult.Success(
                OccupantsResponse(
                    occupants =
                        listOf(
                            occupant(id = "u-1", name = "Alice"),
                            occupant(id = "u-2", name = "Bob"),
                            occupant(id = "u-3", name = "Inactive", active = false),
                        ),
                ),
            )
        vm.loadMembers()
        val state = vm.state.value
        assertEquals(2, state.members.size)
        assertEquals(listOf("Alice", "Bob"), state.members.map { it.name })
        assertFalse(state.isLoadingMembers)
    }

    // MARK: - Helpers

    private fun validForm(): StartPollFormViewModel {
        val vm = makeVm()
        vm.updateQuestion("Paint colour for living room?")
        val ids = vm.state.value.options.map { it.id }
        vm.updateOption(ids[0], "Sage")
        vm.updateOption(ids[1], "Navy")
        vm.closeDateIn(hours = 2)
        return vm
    }

    private fun StartPollFormViewModel.closeDateIn(hours: Long) {
        setCloseDate(this@StartPollFormViewModelTest.futureDate(hours))
    }

    private fun occupant(
        id: String,
        name: String,
        active: Boolean = true,
    ): OccupantDto =
        OccupantDto(
            id = id,
            userId = id,
            role = "member",
            isActive = active,
            displayName = name,
        )

    private fun samplePoll(): PollDto =
        PollDto(
            id = "new-poll",
            homeId = "home-1",
            title = "Paint colour for living room?",
            pollType = "single_choice",
            options = emptyList(),
            status = "open",
        )
}
