@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_task

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.mailbox.MailboxRepository
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A17.12 — exercises the Mail-task view-model's seeded (preview/test)
 * path: load seeds the right frame, subtask taps persist + drive
 * progress, mark-done / reopen flip the frame, and the source / next-up
 * taps resolve the right mail id. The live fetch path is covered by CI
 * integration; here the repository is a relaxed mock the seeded path
 * never touches. Mirrors iOS `MailTaskViewModelTests`. Pure JVM.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailTaskViewModelTest {
    // WS4.2 wired snooze / mark-done to real repository calls, so the
    // view-model now launches on `viewModelScope` (Main). Without a test
    // dispatcher the launch throws "Module with the Main dispatcher had
    // failed to initialize", and the escaping exception also poisons the
    // next test in the JVM.
    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(seed: MailTaskSeed): MailTaskViewModel =
        MailTaskViewModel(
            repository = mockk<MailboxRepository>(relaxed = true),
            savedStateHandle = SavedStateHandle(mapOf(MAIL_TASK_TASK_ID_KEY to "t_1")),
        ).also { it.configureSeed(seed) }

    private fun loaded(vm: MailTaskViewModel): MailTaskContent {
        vm.load()
        return (vm.state.value as MailTaskUiState.Loaded).content
    }

    @Test
    fun load_activeSeed_isNotDone() {
        val vm = makeVm(MailTaskSeed.Active)
        val content = loaded(vm)
        assertFalse(content.isDone)
        assertEquals(1, content.finishedSteps)
        assertEquals(3, content.totalSteps)
    }

    @Test
    fun load_doneSeed_isDone_andFullProgress() {
        val vm = makeVm(MailTaskSeed.Done)
        val content = loaded(vm)
        assertTrue(content.isDone)
        assertEquals(content.totalSteps, content.finishedSteps)
        assertEquals(1f, content.progress, 0.0001f)
    }

    @Test
    fun toggleSubtask_persistsAndUpdatesProgress() {
        val vm = makeVm(MailTaskSeed.Active)
        loaded(vm)
        vm.toggleSubtask("photos")
        val content = (vm.state.value as MailTaskUiState.Loaded).content
        assertEquals(2, content.finishedSteps)
        assertTrue(content.subtasks.first { it.id == "photos" }.isDone)
    }

    @Test
    fun toggleSubtask_isReversible() {
        val vm = makeVm(MailTaskSeed.Active)
        loaded(vm)
        vm.toggleSubtask("draft") // was done → now undone
        val content = (vm.state.value as MailTaskUiState.Loaded).content
        assertEquals(0, content.finishedSteps)
    }

    @Test
    fun markDone_flipsFrameAndToasts() {
        val vm = makeVm(MailTaskSeed.Active)
        loaded(vm)
        vm.markDone()
        assertTrue(vm.isDone)
        assertEquals("Marked done", vm.toast.value)
    }

    @Test
    fun reopen_returnsToOpenFrame() {
        val vm = makeVm(MailTaskSeed.Done)
        loaded(vm)
        vm.reopen()
        assertFalse(vm.isDone)
        assertEquals("Task reopened", vm.toast.value)
    }

    @Test
    fun toggleSubtask_noopWhenDone() {
        val vm = makeVm(MailTaskSeed.Done)
        loaded(vm)
        vm.toggleSubtask("photos")
        val content = (vm.state.value as MailTaskUiState.Loaded).content
        assertEquals(content.totalSteps, content.finishedSteps)
    }

    @Test
    fun openSourceMail_resolvesSourceId() {
        var opened: String? = null
        val vm = makeVm(MailTaskSeed.Active)
        vm.configureNavigation(onOpenMail = { opened = it })
        loaded(vm)
        vm.openSourceMail()
        assertEquals("mail_412elm_hearing", opened)
    }

    @Test
    fun openNextUp_resolvesNextUpId() {
        var opened: String? = null
        val vm = makeVm(MailTaskSeed.Done)
        vm.configureNavigation(onOpenMail = { opened = it })
        loaded(vm)
        vm.openNextUp()
        assertEquals("mail_riverside_linen", opened)
    }

    @Test
    fun delegate_opensSheet() {
        val vm = makeVm(MailTaskSeed.Active)
        loaded(vm)
        vm.delegate()
        assertTrue(vm.showsDelegateSheet.value)
    }

    @Test
    fun snooze_toasts() {
        val vm = makeVm(MailTaskSeed.Active)
        loaded(vm)
        vm.snooze("evening")
        assertEquals("Snoozed · This evening", vm.toast.value)
    }

    @Test
    fun configureSeed_doneReseedsLoadedFrame() {
        val vm = makeVm(MailTaskSeed.Active)
        loaded(vm)
        vm.configureSeed(MailTaskSeed.Done)
        assertTrue((vm.state.value as MailTaskUiState.Loaded).content.isDone)
    }
}
