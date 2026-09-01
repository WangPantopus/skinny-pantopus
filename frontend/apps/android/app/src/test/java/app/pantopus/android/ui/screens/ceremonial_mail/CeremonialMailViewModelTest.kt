@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.ceremonial_mail

import app.pantopus.android.data.api.models.mail_compose.MailComposeRecipientsResponse
import app.pantopus.android.data.api.models.mail_compose.MailHomeContextResponse
import app.pantopus.android.data.api.models.mail_compose.MailRecipientDto
import app.pantopus.android.data.api.models.mail_compose.SendMailBody
import app.pantopus.android.data.api.models.mail_compose.SendMailResponse
import app.pantopus.android.data.api.models.mail_compose.SentMailDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mail_compose.MailComposeRepository
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CeremonialMailViewModelTest {
    private val repository: MailComposeRepository = mockk()
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun fakeRecipient(): MailRecipientDto =
        MailRecipientDto(
            userId = "u_maya",
            name = "Maya K.",
            username = "mayak",
            homeId = "home_demo",
            homeAddress = "412 Elm St, Portland",
            isVerified = true,
            homeMediaUrl = null,
            isOnPantopus = true,
        )

    private fun stubRecipients() {
        coEvery { repository.recipients(any(), any()) } returns
            NetworkResult.Success(MailComposeRecipientsResponse(recipients = listOf(fakeRecipient())))
    }

    private fun stubHomeContext() {
        coEvery { repository.homeContext(any()) } returns
            NetworkResult.Success(
                MailHomeContextResponse(
                    homeId = "home_demo",
                    addressDisplay = "412 Elm St, Portland",
                    memberCount = 2,
                    privateDeliveryAvailable = true,
                    members = emptyList(),
                ),
            )
    }

    // MARK: - Step validation

    @Test fun initial_state_decide_step_with_disabled_cta() =
        runTest(dispatcher) {
            stubRecipients()
            val vm = CeremonialMailViewModel(repository)
            assertEquals(CeremonialMailStep.Decide, vm.form.value.step)
            assertTrue(!vm.chrome.primaryCtaEnabled)
        }

    @Test fun recipient_selection_enables_continue_on_decide() =
        runTest(dispatcher) {
            stubRecipients()
            val vm = CeremonialMailViewModel(repository)
            vm.updateRecipientQuery("maya")
            advanceUntilIdle()
            assertTrue(vm.recipientResults.value.isNotEmpty())
            vm.selectRecipient(vm.recipientResults.value[0])
            assertTrue(vm.chrome.primaryCtaEnabled)
        }

    @Test fun continue_from_decide_advances_to_verify_and_loads_home_context() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            val vm = CeremonialMailViewModel(repository)
            vm.updateRecipientQuery("maya")
            advanceUntilIdle()
            vm.selectRecipient(vm.recipientResults.value[0])
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(CeremonialMailStep.Verify, vm.form.value.step)
            assertEquals("home_demo", vm.homeContext.value?.homeId)
        }

    @Test fun verify_continue_requires_address_confirmation() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            val vm = atVerifyStep()
            assertTrue(!vm.chrome.primaryCtaEnabled)
            vm.toggleAddressConfirmed(true)
            assertTrue(vm.chrome.primaryCtaEnabled)
            vm.onPrimary()
            assertEquals(CeremonialMailStep.Compose, vm.form.value.step)
        }

    @Test fun compose_continue_requires_non_empty_body() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            val vm = atComposeStep()
            assertTrue(!vm.chrome.primaryCtaEnabled)
            vm.updateBody("Hello!")
            assertTrue(vm.chrome.primaryCtaEnabled)
            vm.onPrimary()
            assertEquals(CeremonialMailStep.Commit, vm.form.value.step)
        }

    // MARK: - Submit

    @Test fun submit_fires_send_and_transitions_to_success_with_event() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            val captured = slot<SendMailBody>()
            coEvery { repository.send(capture(captured)) } returns
                NetworkResult.Success(SendMailResponse(message = "ok", mail = SentMailDto(id = "mail_demo")))
            val vm = atCommitStep()
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(CeremonialMailStep.Success, vm.form.value.step)
            assertEquals(CeremonialMailEvent.OpenMail("mail_demo"), vm.pendingEvent.value)
            assertEquals("u_maya", captured.captured.recipientUserId)
            assertEquals("home_demo", captured.captured.recipientHomeId)
            assertEquals("midnight_blue", captured.captured.`object`.payload.stationeryTheme)
            assertEquals("Hello!", captured.captured.content)
        }

    @Test fun submit_failure_surfaces_error_and_stays_on_commit() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            coEvery { repository.send(any()) } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = atCommitStep()
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(CeremonialMailStep.Commit, vm.form.value.step)
            assertNotNull(vm.submitError.value)
        }

    @Test fun submit_forwards_voice_postscript_when_uploaded() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            val captured = slot<SendMailBody>()
            coEvery { repository.send(capture(captured)) } returns
                NetworkResult.Success(SendMailResponse(mail = SentMailDto(id = "m1")))
            val vm = atCommitStep()
            vm.voicePostscriptDidStartRecording()
            vm.voicePostscriptDidCapture("file:///tmp/recording.m4a")
            vm.voicePostscriptDidUpload("https://uploads.test/v1.m4a")
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(
                "https://uploads.test/v1.m4a",
                captured.captured.`object`.payload.voicePostscriptUri,
            )
        }

    // MARK: - Drafts / state

    @Test fun editing_recipient_field_clears_selection() =
        runTest(dispatcher) {
            stubRecipients()
            val vm = CeremonialMailViewModel(repository)
            vm.updateRecipientQuery("maya")
            advanceUntilIdle()
            vm.selectRecipient(vm.recipientResults.value[0])
            assertNotNull(vm.selectedRecipient.value)
            vm.updateRecipientQuery("zzz")
            assertNull(vm.selectedRecipient.value)
        }

    @Test fun back_from_compose_returns_to_verify() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            val vm = atComposeStep()
            vm.onLeading()
            assertEquals(CeremonialMailStep.Verify, vm.form.value.step)
        }

    @Test fun leading_from_decide_fires_dismiss_event() =
        runTest(dispatcher) {
            val vm = CeremonialMailViewModel(repository)
            vm.onLeading()
            assertEquals(CeremonialMailEvent.Dismiss, vm.pendingEvent.value)
        }

    @Test fun stationery_ink_seal_selection_flows_through() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            val vm = atComposeStep()
            vm.selectStationery(CeremonialMailStationery.Botanical)
            vm.selectInk(CeremonialMailInk.Forest)
            vm.selectSeal(CeremonialMailSeal.WaxBlack)
            assertEquals(CeremonialMailStationery.Botanical, vm.form.value.stationery)
            assertEquals(CeremonialMailInk.Forest, vm.form.value.ink)
            assertEquals(CeremonialMailSeal.WaxBlack, vm.form.value.seal)
        }

    @Test fun send_timing_defaults_to_now_and_can_be_changed() =
        runTest(dispatcher) {
            val vm = CeremonialMailViewModel(repository)
            assertEquals(CeremonialMailSendTiming.Now, vm.form.value.sendTiming)
            vm.selectSendTiming(CeremonialMailSendTiming.Morning)
            assertEquals(CeremonialMailSendTiming.Morning, vm.form.value.sendTiming)
        }

    @Test fun chrome_progress_advances_per_step() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            val vm = CeremonialMailViewModel(repository)
            val initial = vm.chrome.progressFraction ?: 0f
            vm.updateRecipientQuery("maya")
            advanceUntilIdle()
            vm.selectRecipient(vm.recipientResults.value[0])
            vm.onPrimary()
            advanceUntilIdle()
            val verifyFraction = vm.chrome.progressFraction ?: 0f
            assertTrue(verifyFraction > initial)
        }

    @Test fun success_step_hides_progress_bar() =
        runTest(dispatcher) {
            stubRecipients()
            stubHomeContext()
            coEvery { repository.send(any()) } returns
                NetworkResult.Success(SendMailResponse(mail = SentMailDto(id = "m1")))
            val vm = atCommitStep()
            vm.onPrimary()
            advanceUntilIdle()
            assertEquals(CeremonialMailStep.Success, vm.form.value.step)
            assertTrue(!vm.chrome.showsProgressBar)
        }

    // MARK: - Helpers

    private fun atVerifyStep(): CeremonialMailViewModel = atStep(CeremonialMailStep.Verify)

    private fun atComposeStep(): CeremonialMailViewModel = atStep(CeremonialMailStep.Compose)

    private fun atCommitStep(): CeremonialMailViewModel {
        val vm = atStep(CeremonialMailStep.Commit)
        vm.updateBody("Hello!")
        vm.selectStationery(CeremonialMailStationery.MidnightBlue)
        vm.selectInk(CeremonialMailInk.Navy)
        vm.selectSeal(CeremonialMailSeal.WaxRed)
        return vm
    }

    private fun atStep(target: CeremonialMailStep): CeremonialMailViewModel {
        val vm = CeremonialMailViewModel(repository)
        vm.selectRecipient(fakeRecipient())
        vm.onPrimary() // → verify (home-context load fires async; the
        //                test advances the dispatcher itself when it cares)
        if (target == CeremonialMailStep.Verify) return vm
        vm.toggleAddressConfirmed(true)
        vm.onPrimary() // → compose
        if (target == CeremonialMailStep.Compose) return vm
        vm.updateBody("Hi")
        vm.onPrimary() // → commit
        if (target == CeremonialMailStep.Commit) return vm
        return vm
    }
}
