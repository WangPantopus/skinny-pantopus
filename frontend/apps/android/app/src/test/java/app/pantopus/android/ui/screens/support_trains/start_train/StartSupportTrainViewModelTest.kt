@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.support_trains.start_train

import app.pantopus.android.data.api.models.mail_compose.MailComposeRecipientsResponse
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.support_trains.CreateSupportTrainResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mail_compose.MailComposeRepository
import app.pantopus.android.data.support_trains.SupportTrainsRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
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
import java.util.Calendar

@OptIn(ExperimentalCoroutinesApi::class)
class StartSupportTrainViewModelTest {
    private val supportTrains: SupportTrainsRepository = mockk()
    private val mailCompose: MailComposeRepository = mockk()
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun fakeRecipient(): MailRecipientDto =
        MailRecipientDto(
            userId = "u_chen",
            name = "Maya Chen",
            username = "mayac",
            homeId = "home_demo",
            homeAddress = "412 Elm St, Portland",
            isVerified = true,
            homeMediaUrl = null,
            isOnPantopus = true,
        )

    private fun stubBeneficiarySearch() {
        coEvery { mailCompose.recipients(any(), any()) } returns
            NetworkResult.Success(MailComposeRecipientsResponse(recipients = listOf(fakeRecipient())))
    }

    private fun stubLaunchHappyPath() {
        coEvery { supportTrains.create(any()) } returns
            NetworkResult.Success(CreateSupportTrainResponse(id = "train_demo"))
        coEvery { supportTrains.addSlot(any(), any()) } returns NetworkResult.Success(Unit)
        coEvery { supportTrains.publish(any()) } returns NetworkResult.Success(Unit)
    }

    // ─── Step gating ────────────────────────────────────────────────

    @Test fun initial_state_is_who_and_why_and_cta_disabled() =
        runTest(dispatcher) {
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            assertEquals(StartSupportTrainStep.WhoAndWhy, vm.form.value.step)
            assertFalse(vm.chrome.primaryCtaEnabled)
            assertEquals("Continue", vm.chrome.primaryCtaLabel)
        }

    @Test fun filling_beneficiary_and_reason_enables_continue() =
        runTest(dispatcher) {
            stubBeneficiarySearch()
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            vm.updateBeneficiaryQuery("Chen family")
            vm.updateReason("Welcoming a new baby — meals would be wonderful.")
            assertTrue(vm.chrome.primaryCtaEnabled)
            assertTrue(vm.canAdvanceFromWhoAndWhy())
        }

    @Test fun invite_recipient_branch_updates_cta_and_search_again() =
        runTest(dispatcher) {
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            vm.updateBeneficiaryQuery(StartSupportTrainSampleData.INVITE_QUERY)
            vm.selectReason(StartSupportTrainReason.Baby)
            assertTrue(vm.isInviteRecipientBranch())
            assertEquals("Send invite & continue", vm.chrome.primaryCtaLabel)
            assertEquals("Search again", vm.chrome.secondaryCta?.label)
            assertEquals(StartSupportTrainSampleData.INVITE_QUERY, vm.inviteCandidate()?.typedName)
            vm.onSecondary()
            assertEquals("", vm.form.value.beneficiaryQuery)
            assertEquals(null, vm.inviteCandidate())
        }

    @Test fun reason_clamps_at_char_limit() =
        runTest(dispatcher) {
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            val overflow = "a".repeat(600)
            vm.updateReason(overflow)
            assertEquals(StartSupportTrainFormState.REASON_CHAR_LIMIT, vm.form.value.reason.length)
        }

    // ─── Slot generation ────────────────────────────────────────────

    @Test fun slot_generation_one_per_day() {
        val cal = Calendar.getInstance()
        cal.set(2026, Calendar.MAY, 19, 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val start = cal.timeInMillis
        cal.add(Calendar.DAY_OF_YEAR, 2)
        val end = cal.timeInMillis
        val slots =
            StartSupportTrainSlotGenerator.generate(
                startMillis = start,
                endMillis = end,
                durationMinutes = 60,
                startHour = 17,
            )
        assertEquals(3, slots.size)
        assertEquals("17:00", slots.first().startTime)
        assertEquals("18:00", slots.first().endTime)
    }

    @Test fun editing_dates_in_step_two_updates_preview() =
        runTest(dispatcher) {
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            val initial = vm.generatedSlots().size
            assertTrue(initial >= 1)
            val cal = Calendar.getInstance()
            cal.timeInMillis = vm.form.value.endDateMillis
            cal.add(Calendar.DAY_OF_YEAR, -3)
            vm.setEndDate(cal.timeInMillis)
            assertEquals(initial - 3, vm.generatedSlots().size)
        }

    @Test fun slot_generation_clamps_at_90_days() {
        val cal = Calendar.getInstance()
        cal.set(2026, Calendar.JANUARY, 1, 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val start = cal.timeInMillis
        cal.add(Calendar.DAY_OF_YEAR, 200)
        val end = cal.timeInMillis
        val slots =
            StartSupportTrainSlotGenerator.generate(
                startMillis = start,
                endMillis = end,
                durationMinutes = 60,
                startHour = 17,
            )
        assertEquals(90, slots.size)
    }

    @Test fun end_before_start_collapses_end_into_start() =
        runTest(dispatcher) {
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            val cal = Calendar.getInstance()
            cal.timeInMillis = vm.form.value.startDateMillis
            cal.add(Calendar.DAY_OF_YEAR, -3)
            vm.setEndDate(cal.timeInMillis)
            assertEquals(vm.form.value.startDateMillis, vm.form.value.endDateMillis)
            assertEquals(1, vm.generatedSlots().size)
        }

    // ─── Wizard transitions ─────────────────────────────────────────

    @Test fun primary_advances_through_three_steps() =
        runTest(dispatcher) {
            stubBeneficiarySearch()
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            vm.updateBeneficiaryQuery("Chen family")
            vm.updateReason("Welcoming a new baby.")
            vm.onPrimary()
            assertEquals(StartSupportTrainStep.WhatAndWhen, vm.form.value.step)
            vm.onPrimary()
            assertEquals(StartSupportTrainStep.ReviewAndLaunch, vm.form.value.step)
            assertEquals("Launch train", vm.chrome.primaryCtaLabel)
        }

    @Test fun leading_back_returns_to_previous_step() =
        runTest(dispatcher) {
            stubBeneficiarySearch()
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            vm.updateBeneficiaryQuery("Chen")
            vm.updateReason("Reason.")
            vm.onPrimary()
            assertEquals(StartSupportTrainStep.WhatAndWhen, vm.form.value.step)
            vm.onLeading()
            assertEquals(StartSupportTrainStep.WhoAndWhy, vm.form.value.step)
        }

    @Test fun close_from_first_step_dismisses() =
        runTest(dispatcher) {
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            vm.onLeading()
            assertEquals(StartSupportTrainEvent.Dismiss, vm.pendingEvent.value)
        }

    // ─── Launch happy path ──────────────────────────────────────────

    @Test fun launch_creates_train_adds_slots_publishes_and_emits_open() =
        runTest(dispatcher) {
            stubBeneficiarySearch()
            stubLaunchHappyPath()
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            vm.updateBeneficiaryQuery("Chen family")
            vm.updateReason("Welcoming a new baby.")
            vm.onPrimary()
            vm.onPrimary()
            vm.onPrimary() // launch
            advanceUntilIdle()
            assertEquals(StartSupportTrainStep.Success, vm.form.value.step)
            assertEquals("train_demo", vm.publishedTrainId.value)
            assertNull(vm.launchError.value)
            vm.onPrimary()
            assertEquals(StartSupportTrainEvent.OpenTrain("train_demo"), vm.pendingEvent.value)
        }

    @Test fun launch_create_failure_surfaces_error_and_stays_on_review() =
        runTest(dispatcher) {
            stubBeneficiarySearch()
            coEvery { supportTrains.create(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = StartSupportTrainViewModel(supportTrains, mailCompose)
            vm.updateBeneficiaryQuery("Chen family")
            vm.updateReason("Reason.")
            vm.onPrimary()
            vm.onPrimary()
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(StartSupportTrainStep.ReviewAndLaunch, vm.form.value.step)
            assertNotNull(vm.launchError.value)
        }
}
