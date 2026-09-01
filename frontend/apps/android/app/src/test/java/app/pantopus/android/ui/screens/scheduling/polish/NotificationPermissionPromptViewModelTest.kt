@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.polish

import app.pantopus.android.data.api.models.scheduling.NotificationPrefsResponse
import app.pantopus.android.data.api.models.scheduling.UpdateNotificationPrefsRequest
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.scheduling.SchedulingRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class NotificationPermissionPromptViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val repo: SchedulingRepository = mockk(relaxed = true)
    private val authRepo: AuthRepository = mockk()
    private val ownerRelay = NotificationPromptOwnerRelay()

    private val email = "maria@pantopus.co"

    @Before
    fun setup() {
        Dispatchers.setMain(dispatcher)
        val user = UserDto(id = "u1", email = email, displayName = "Maria", avatarUrl = null)
        every { authRepo.state } returns MutableStateFlow(AuthRepository.State.SignedIn(user))
        // Default prefs round-trip so channel persistence has something to merge into.
        coEvery { repo.getNotificationPreferences() } returns
            NetworkResult.Success(NotificationPrefsResponse(mapOf("notify_me" to mapOf("new_booking" to true))))
        coEvery { repo.updateNotificationPreferences(any()) } returns
            NetworkResult.Success(NotificationPrefsResponse(emptyMap()))
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = NotificationPermissionPromptViewModel(repo, authRepo, ownerRelay)

    @Test
    fun `account email is read from the auth repository`() {
        assertEquals(email, vm().state.value.accountEmail)
    }

    @Test
    fun `useEmailInstead shows the email frame with the account email`() {
        val vm = vm()
        vm.useEmailInstead()
        assertEquals(NotificationPromptFrame.EmailVerify(email), vm.state.value.frame)
    }

    @Test
    fun `verifyEmail is ignored until the code is complete`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.useEmailInstead()
            vm.updateCode("123")
            vm.verifyEmail()
            advanceUntilIdle()
            assertEquals(NotificationPromptFrame.EmailVerify(email), vm.state.value.frame)
        }

    @Test
    fun `verifyEmail connects, reports result, and persists the channel preserving keys`() =
        runTest(dispatcher) {
            val captured = slot<UpdateNotificationPrefsRequest>()
            coEvery { repo.updateNotificationPreferences(capture(captured)) } returns
                NetworkResult.Success(NotificationPrefsResponse(emptyMap()))
            val vm = vm()
            vm.useEmailInstead()
            vm.updateCode("123456")
            assertTrue(vm.state.value.isCodeComplete)
            vm.verifyEmail()
            advanceUntilIdle()
            assertEquals(NotificationPromptFrame.Connected(NotificationChannel.Email), vm.state.value.frame)
            assertEquals(
                NotificationChannelConnectResult.Connected(NotificationChannel.Email),
                vm.state.value.result,
            )
            val sent = captured.captured.prefs
            assertTrue("unknown key preserved", sent.containsKey("notify_me"))
            @Suppress("UNCHECKED_CAST")
            val channels = sent["channels"] as Map<String, Any?>
            assertEquals(true, channels["email"])
        }

    @Test
    fun `verifySms surfaces the coming-soon toast`() {
        val vm = vm()
        vm.verifySms()
        assertTrue(vm.state.value.toast != null)
    }

    @Test
    fun `isSmsReady requires both phone and code`() {
        val vm = vm()
        vm.updatePhone("555123")
        vm.updateCode("123456")
        assertFalse("too few phone digits is not ready", vm.state.value.isSmsReady)
        vm.updatePhone("5551234567")
        assertTrue(vm.state.value.isSmsReady)
    }

    @Test
    fun `onPushResult granted connects push and reports result`() =
        runTest(dispatcher) {
            val vm = vm()
            vm.onPushResult(granted = true)
            advanceUntilIdle()
            assertEquals(NotificationPromptFrame.Connected(NotificationChannel.Push), vm.state.value.frame)
            assertEquals(
                NotificationChannelConnectResult.Connected(NotificationChannel.Push),
                vm.state.value.result,
            )
        }

    @Test
    fun `onPushResult denied shows the denied frame`() {
        val vm = vm()
        vm.onPushResult(granted = false)
        assertEquals(NotificationPromptFrame.Denied, vm.state.value.frame)
        assertEquals(NotificationChannelConnectResult.DeniedPush, vm.state.value.result)
    }

    @Test
    fun `reconcile maps denied status to the denied frame`() {
        val vm = vm()
        vm.reconcile(PushPermissionStatus.Denied)
        assertEquals(NotificationPromptFrame.Denied, vm.state.value.frame)
    }

    @Test
    fun `reconcile only acts while still on the push frame`() {
        val vm = vm()
        vm.useEmailInstead()
        vm.reconcile(PushPermissionStatus.Authorized)
        assertEquals(NotificationPromptFrame.EmailVerify(email), vm.state.value.frame)
    }

    @Test
    fun `done from connected reports the channel and finishes`() {
        val vm = vm()
        vm.reconcile(PushPermissionStatus.Authorized)
        vm.done()
        assertEquals(NotificationChannelConnectResult.Connected(NotificationChannel.Push), vm.state.value.result)
        assertTrue(vm.state.value.isFinished)
    }

    @Test
    fun `dismiss reports dismissed and finishes`() {
        val vm = vm()
        vm.dismiss()
        assertEquals(NotificationChannelConnectResult.Dismissed, vm.state.value.result)
        assertTrue(vm.state.value.isFinished)
    }

    @Test
    fun `updateCode filters non-digits and caps length`() {
        val vm = vm()
        vm.updateCode("12a456")
        assertEquals("12456", vm.state.value.code)
        assertFalse(vm.state.value.isCodeComplete)
        vm.updateCode("1234567")
        assertEquals("123456", vm.state.value.code)
        assertTrue(vm.state.value.isCodeComplete)
    }
}
