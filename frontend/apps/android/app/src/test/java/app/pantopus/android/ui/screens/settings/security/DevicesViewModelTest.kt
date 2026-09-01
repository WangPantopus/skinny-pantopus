@file:Suppress("MagicNumber", "LargeClass")

package app.pantopus.android.ui.screens.settings.security

import androidx.fragment.app.FragmentActivity
import app.pantopus.android.core.security.StepUpCoordinator
import app.pantopus.android.data.api.models.auth.AuthDeviceDto
import app.pantopus.android.data.api.models.auth.AuthSessionDto
import app.pantopus.android.data.api.models.auth.DevicesResponse
import app.pantopus.android.data.api.models.auth.SecurityEventDto
import app.pantopus.android.data.api.models.auth.SecurityPrefsDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.DevicesRepository
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Persistent login — Settings → Security → Devices. Covers the GroupedList
 * projection (current device pinned, trust badges, web sessions, prefs,
 * actions, events), the confirm → step-up → mutation flows, and the
 * optimistic security-pref toggles.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DevicesViewModelTest {
    private val devices: DevicesRepository = mockk()
    private val auth: AuthRepository = mockk(relaxed = true)
    private val stepUp: StepUpCoordinator = mockk()
    private val activity: FragmentActivity = mockk(relaxed = true)

    private val now = 1_700_000_000_000L
    private val current =
        AuthDeviceDto(
            id = "row-current",
            deviceId = "dev-1",
            platform = "android",
            name = "Ying's Pixel",
            model = "Pixel 9",
            osVersion = "15",
            appVersion = "1.4.0 (312)",
            isCurrent = true,
            trustLevel = "trusted",
            trustedAt = null,
            lastSeenAt = iso(now - 30_000),
            createdAt = null,
        )
    private val other =
        AuthDeviceDto(
            id = "row-other",
            deviceId = "dev-2",
            platform = "ios",
            name = "Ying's iPhone",
            model = "iPhone16,2",
            osVersion = "18.5",
            appVersion = "1.4.0 (312)",
            isCurrent = false,
            trustLevel = "unverified",
            trustedAt = null,
            lastSeenAt = iso(now - 3 * 3_600_000),
            createdAt = null,
        )
    private val suspect =
        other.copy(
            id = "row-suspect",
            deviceId = "dev-3",
            name = "Unknown tablet",
            trustLevel = "suspect",
            lastSeenAt = iso(now - 2L * 86_400_000),
        )
    private val webSession =
        AuthSessionDto(
            id = "sess-web",
            platform = "web",
            userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
            isCurrent = false,
            lastSeenAt = iso(now - 10 * 60_000),
            issuedAt = null,
        )
    private val events =
        listOf(
            SecurityEventDto(id = 1, type = "login", createdAt = iso(now - 60_000)),
            SecurityEventDto(id = 2, type = "refresh_reuse", createdAt = iso(now - 8L * 86_400_000)),
        )

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { devices.devices() } returns
            NetworkResult.Success(
                DevicesResponse(
                    devices = listOf(other, current, suspect),
                    sessions = listOf(webSession),
                    events = events,
                ),
            )
        coEvery { devices.securityPrefs() } returns
            NetworkResult.Success(SecurityPrefsDto(allowRestoreGrants = true, newDeviceEmail = true))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun vm(): DevicesViewModel =
        DevicesViewModel(devices, auth, stepUp).apply {
            nowMillis = { now }
        }

    private fun loaded(vm: DevicesViewModel): List<GroupedListGroup> = (vm.state.value as GroupedListUiState.Loaded).groups

    private fun List<GroupedListGroup>.group(id: String) = first { it.id == id }

    // ---- Projection ----

    @Test fun groups_are_in_design_order_with_current_device_pinned_first() {
        val vm = vm().apply { load() }
        val groups = loaded(vm)
        assertEquals(
            listOf("thisDevice", "otherDevices", "webSessions", "security", "actions", "activity"),
            groups.map { it.id },
        )
        val thisDevice = groups.group("thisDevice").rows.single()
        assertEquals("device.row-current", thisDevice.id)
        assertEquals("Ying's Pixel", thisDevice.label)
        assertEquals("Pixel 9 · Android 15 · Active just now", thisDevice.subtext)
        val chip = thisDevice.control as RowControl.ChipStatus
        assertEquals("Trusted", chip.label)
        assertEquals(RowControl.ChipTone.Success, chip.tone)
        assertFalse("current device is not navigable", chip.includesChevron)
        assertEquals("settings.devices.device.row-current", thisDevice.testTag)
    }

    @Test fun other_devices_carry_trust_badges_and_are_sorted_by_last_seen() {
        val rows = loaded(vm().apply { load() }).group("otherDevices").rows
        assertEquals(listOf("device.row-other", "device.row-suspect"), rows.map { it.id })
        val iphone = rows[0].control as RowControl.ChipStatus
        assertEquals("Unverified", iphone.label)
        assertEquals(RowControl.ChipTone.Neutral, iphone.tone)
        assertTrue(iphone.includesChevron)
        assertEquals("iPhone16,2 · iOS 18.5 · Active 3 h ago", rows[0].subtext)
        val tablet = rows[1].control as RowControl.ChipStatus
        assertEquals("Needs attention", tablet.label)
        assertEquals(RowControl.ChipTone.Warning, tablet.tone)
        assertEquals("iPhone16,2 · iOS 18.5 · Active 2 d ago", rows[1].subtext)
    }

    @Test fun web_sessions_prefs_actions_and_events_project() {
        val groups = loaded(vm().apply { load() })
        val web = groups.group("webSessions").rows.single()
        assertEquals("Chrome on Mac", web.label)
        assertEquals("Web · Active 10 min ago", web.subtext)

        val prefs = groups.group("security").rows
        assertEquals(listOf("pref.allowRestoreGrants", "pref.newDeviceEmail"), prefs.map { it.id })
        prefs.forEach { assertTrue((it.control as RowControl.Toggle).isOn) }

        val actions = groups.group("actions").rows
        assertEquals(listOf("signOutOthers", "lockdown"), actions.map { it.id })
        assertTrue(actions[1].destructive)
        assertFalse(actions[0].destructive)

        val activity = groups.group("activity").rows
        assertEquals(listOf("event.1", "event.2"), activity.map { it.id })
        assertEquals("Signed in", activity[0].label)
        assertEquals("1 min ago", activity[0].subtext)
        assertEquals("Refresh token reuse detected", activity[1].label)
        assertEquals("1 w ago", activity[1].subtext)
        assertEquals(RowControl.ChipTone.Warning, (activity[1].control as RowControl.ChipStatus).tone)
    }

    @Test fun empty_registry_renders_explanatory_rows_instead_of_dropping_groups() {
        coEvery { devices.devices() } returns NetworkResult.Success(DevicesResponse())
        val groups = loaded(vm().apply { load() })
        assertEquals(listOf("thisDevice", "otherDevices", "security", "actions", "activity"), groups.map { it.id })
        assertEquals("thisDevice.unbound", groups.group("thisDevice").rows.single().id)
        assertEquals("otherDevices.empty", groups.group("otherDevices").rows.single().id)
        assertEquals("activity.empty", groups.group("activity").rows.single().id)
    }

    @Test fun devices_failure_is_the_error_state_with_retry() {
        coEvery { devices.devices() } returns NetworkResult.Failure(NetworkError.Server(503, null))
        val vm = vm().apply { load() }
        assertTrue(vm.state.value is GroupedListUiState.Error)
    }

    @Test fun prefs_failure_keeps_the_screen_and_freezes_the_toggles() {
        coEvery { devices.securityPrefs() } returns NetworkResult.Failure(NetworkError.NotFound)
        val vm = vm().apply { load() }
        val security = loaded(vm).group("security")
        assertEquals("Security settings could not load. Retry before changing them.", security.helper)
        vm.onToggle("pref.newDeviceEmail", false, activity)
        coVerify(exactly = 0) { stepUp.obtainToken(any(), any(), any(), any()) }
    }

    // ---- Remove device ----

    @Test fun tapping_another_device_asks_for_confirmation_but_the_current_one_does_not() {
        val vm = vm().apply { load() }
        vm.onTapRow("device.row-current")
        assertNull(vm.confirmation.value)
        vm.onTapRow("device.row-other")
        assertEquals(DevicesViewModel.Confirmation.RemoveDevice(other), vm.confirmation.value)
        vm.dismissConfirmation()
        assertNull(vm.confirmation.value)
    }

    @Test fun confirmed_remove_runs_step_up_then_delete_then_reloads() {
        coEvery { stepUp.obtainToken(StepUpCoordinator.PURPOSE_REVOKE_DEVICE, any(), activity, any()) } returns
            StepUpCoordinator.Outcome.Token("tok-rd", "device_key")
        coEvery { auth.revokeDevice("row-other", "tok-rd") } returns Unit
        val vm = vm().apply { load() }
        vm.onTapRow("device.row-other")
        vm.confirmPending(activity)

        coVerify(exactly = 1) { auth.revokeDevice("row-other", "tok-rd") }
        coVerify(exactly = 2) { devices.devices() }
        assertNull(vm.confirmation.value)
        assertFalse(vm.busy.value)
        assertEquals(ToastKind.Success, vm.toast.value?.kind)
        assertEquals("Removed Ying's iPhone.", vm.toast.value?.text)
    }

    @Test fun cancelled_step_up_closes_the_dialog_silently_and_deletes_nothing() {
        coEvery { stepUp.obtainToken(any(), any(), activity, any()) } returns StepUpCoordinator.Outcome.Cancelled
        val vm = vm().apply { load() }
        vm.onTapRow("device.row-other")
        vm.confirmPending(activity)
        coVerify(exactly = 0) { auth.revokeDevice(any(), any()) }
        assertNull(vm.confirmation.value)
        assertNull(vm.toast.value)
    }

    @Test fun step_up_failure_and_auth_errors_toast() {
        coEvery { stepUp.obtainToken(any(), any(), activity, any()) } returns
            StepUpCoordinator.Outcome.Failed("Verification isn't available.")
        val vm = vm().apply { load() }
        vm.onTapRow("device.row-other")
        vm.confirmPending(activity)
        assertEquals("Verification isn't available.", vm.toast.value?.text)
        assertEquals(ToastKind.Error, vm.toast.value?.kind)

        vm.consumeToast()
        coEvery { stepUp.obtainToken(any(), any(), activity, any()) } returns
            StepUpCoordinator.Outcome.Token("tok", "password")
        coEvery { auth.revokeDevice("row-other", "tok") } throws AuthError.NetworkError
        vm.onTapRow("device.row-other")
        vm.confirmPending(activity)
        assertEquals(AuthError.NetworkError.message, vm.toast.value?.text)
        assertFalse(vm.busy.value)
    }

    // ---- Sign out others / Lockdown ----

    @Test fun sign_out_others_uses_revoke_sessions_purpose_and_reports_the_count() {
        coEvery { stepUp.obtainToken(StepUpCoordinator.PURPOSE_REVOKE_SESSIONS, any(), activity, any()) } returns
            StepUpCoordinator.Outcome.Token("tok-ro", "password")
        coEvery { auth.revokeOtherSessions("tok-ro") } returns 3
        val vm = vm().apply { load() }
        vm.onTapRow("signOutOthers")
        assertEquals(DevicesViewModel.Confirmation.SignOutOthers, vm.confirmation.value)
        vm.confirmPending(activity)
        coVerify(exactly = 1) { auth.revokeOtherSessions("tok-ro") }
        assertEquals("Signed out of 3 other sessions.", vm.toast.value?.text)
        coVerify(exactly = 2) { devices.devices() }
    }

    @Test fun lockdown_revokes_all_and_leaves_the_sign_out_to_the_repository() {
        coEvery { stepUp.obtainToken(StepUpCoordinator.PURPOSE_REVOKE_SESSIONS, any(), activity, any()) } returns
            StepUpCoordinator.Outcome.Token("tok-all", "password")
        coEvery { auth.revokeAllSessions("tok-all") } returns Unit
        val vm = vm().apply { load() }
        vm.onTapRow("lockdown")
        assertEquals(DevicesViewModel.Confirmation.Lockdown, vm.confirmation.value)
        vm.confirmPending(activity)
        coVerify(exactly = 1) { auth.revokeAllSessions("tok-all") }
        assertNull(vm.confirmation.value)
        assertNull(vm.toast.value)
    }

    // ---- Security prefs ----

    @Test fun pref_toggle_is_optimistic_and_patches_with_a_change_security_prefs_step_up() {
        coEvery { stepUp.obtainToken(StepUpCoordinator.PURPOSE_CHANGE_SECURITY_PREFS, any(), activity, any()) } returns
            StepUpCoordinator.Outcome.Token("tok-p", "device_key")
        coEvery { devices.updateSecurityPrefs(SecurityPrefsDto(newDeviceEmail = false), "tok-p") } returns
            NetworkResult.Success(SecurityPrefsDto(allowRestoreGrants = true, newDeviceEmail = false))
        val vm = vm().apply { load() }
        vm.onToggle("pref.newDeviceEmail", false, activity)

        val toggle = loaded(vm).group("security").rows.first { it.id == "pref.newDeviceEmail" }.control as RowControl.Toggle
        assertFalse(toggle.isOn)
        val other = loaded(vm).group("security").rows.first { it.id == "pref.allowRestoreGrants" }.control as RowControl.Toggle
        assertTrue(other.isOn)
        assertEquals("Security settings updated.", vm.toast.value?.text)
    }

    @Test fun pref_toggle_rolls_back_on_cancel_and_on_failure() {
        coEvery { stepUp.obtainToken(any(), any(), activity, any()) } returns StepUpCoordinator.Outcome.Cancelled
        val vm = vm().apply { load() }
        vm.onToggle("pref.allowRestoreGrants", false, activity)
        val afterCancel = loaded(vm).group("security").rows.first { it.id == "pref.allowRestoreGrants" }.control as RowControl.Toggle
        assertTrue(afterCancel.isOn)
        assertNull(vm.toast.value)

        coEvery { stepUp.obtainToken(any(), any(), activity, any()) } returns StepUpCoordinator.Outcome.Token("tok", "password")
        coEvery { devices.updateSecurityPrefs(any(), "tok") } returns NetworkResult.Failure(NetworkError.Server(500, null))
        vm.onToggle("pref.allowRestoreGrants", false, activity)
        val afterFailure = loaded(vm).group("security").rows.first { it.id == "pref.allowRestoreGrants" }.control as RowControl.Toggle
        assertTrue(afterFailure.isOn)
        assertEquals(ToastKind.Error, vm.toast.value?.kind)
    }

    // ---- Helpers ----

    @Test fun relative_time_and_labels() {
        assertEquals("just now", DevicesViewModel.relativeTime(iso(now - 5_000), now))
        assertEquals("5 min ago", DevicesViewModel.relativeTime(iso(now - 5 * 60_000), now))
        assertEquals("2 h ago", DevicesViewModel.relativeTime(iso(now - 2 * 3_600_000), now))
        assertEquals("3 d ago", DevicesViewModel.relativeTime(iso(now - 3L * 86_400_000), now))
        assertEquals("2 w ago", DevicesViewModel.relativeTime(iso(now - 15L * 86_400_000), now))
        assertEquals("2 mo ago", DevicesViewModel.relativeTime(iso(now - 65L * 86_400_000), now))
        assertEquals("recently", DevicesViewModel.relativeTime("not-a-date", now))
        assertEquals("Firefox on Windows", DevicesViewModel.browserLabel("Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/128.0"))
        assertEquals("Browser", DevicesViewModel.browserLabel(null))
        assertEquals("Some new thing", DevicesViewModel.eventLabel("some_new_thing"))
        // CONTRACT conformance: every security-event type the backend writes
        // must have copy, or the activity list shows raw snake_case. Source =
        // the `recordSecurityEvent` call sites in backend/services/*.js +
        // backend/routes/{authDevices,users}.js. Mirrored by the iOS and web
        // label maps.
        BACKEND_EVENT_TYPES.forEach { type ->
            val label = DevicesViewModel.eventLabel(type)
            assertTrue("no copy for security event `$type`", !label.contains('_') && label != type)
        }
        val bare =
            AuthDeviceDto(
                id = "x",
                deviceId = null,
                platform = null,
                name = null,
                model = null,
                osVersion = null,
                appVersion = null,
                isCurrent = null,
                trustLevel = null,
                trustedAt = null,
                lastSeenAt = null,
                lastIp = null,
                createdAt = null,
            )
        assertEquals("Device", DevicesViewModel.deviceTitle(bare))
    }

    private fun iso(millis: Long): String = java.time.Instant.ofEpochMilli(millis).toString()

    private companion object {
        /** Complete `AuthSecurityEvent.type` vocabulary emitted by the backend. */
        val BACKEND_EVENT_TYPES =
            listOf(
                "login",
                "logout",
                "resume",
                "refresh_reuse",
                "device_mismatch",
                "device_revoked",
                "session_revoked",
                "inactivity_expired",
                "step_up",
                "step_up_key_enrolled",
                "security_prefs_changed",
                "revoke_others",
                "lockdown",
                "password_changed",
                "password_reset",
                "account_deleted",
                "new_device_email_sent",
                "device_removed_email_sent",
                "password_changed_email_sent",
                "security_signout_email_sent",
                "lockdown_email_sent",
            )
    }
}
