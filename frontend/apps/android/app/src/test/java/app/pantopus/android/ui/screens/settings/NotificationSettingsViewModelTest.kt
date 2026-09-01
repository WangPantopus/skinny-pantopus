@file:Suppress("LongMethod", "LongParameterList", "MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.settings

import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.models.hub.NotificationPreferencesPatch
import app.pantopus.android.data.api.models.hub.QuietHoursPatch
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.hub.NotificationPreferencesRepository
import app.pantopus.android.ui.screens.settings.NotificationSettingsViewModel.GroupId
import app.pantopus.android.ui.screens.settings.NotificationSettingsViewModel.RowId
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import io.mockk.coEvery
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A14.5 — notification & briefing preferences backed by
 * `GET/PUT /api/hub/preferences`. Covers the four-card projection, the
 * conditional time-chip rows, the wire names + `HH:mm` format the
 * backend's Joi schema demands, the merged debounced patch, and the
 * re-fetch rollback after a failed save. Mirrored on iOS.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class NotificationSettingsViewModelTest {
    private val repository: NotificationPreferencesRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { repository.preferences() } returns NetworkResult.Success(prefs())
        coEvery { repository.updatePreferences(any()) } returns NetworkResult.Success(prefs())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    /** A long debounce keeps the timer from racing the assertions. */
    private fun makeVm() =
        NotificationSettingsViewModel(repository).apply {
            saveDebounceMillis = LONG_DEBOUNCE_MS
        }

    private fun prefs(
        dailyEnabled: Boolean = true,
        dailyTime: String = "07:30",
        eveningEnabled: Boolean = true,
        eveningTime: String = "18:00",
        weather: Boolean = true,
        aqi: Boolean = true,
        mail: Boolean = true,
        gigs: Boolean = true,
        homeReminders: Boolean = true,
        quietStart: String? = null,
        quietEnd: String? = null,
        locationMode: String = NotificationPreferences.MODE_PRIMARY_HOME,
        timezone: String? = "America/Los_Angeles",
    ) = NotificationPreferences(
        dailyBriefingEnabled = dailyEnabled,
        dailyBriefingTimeLocal = dailyTime,
        dailyBriefingTimezone = timezone,
        eveningBriefingEnabled = eveningEnabled,
        eveningBriefingTimeLocal = eveningTime,
        weatherAlertsEnabled = weather,
        aqiAlertsEnabled = aqi,
        mailSummaryEnabled = mail,
        gigUpdatesEnabled = gigs,
        homeRemindersEnabled = homeReminders,
        quietHoursStartLocal = quietStart,
        quietHoursEndLocal = quietEnd,
        locationMode = locationMode,
    )

    // MARK: - Loading

    @Test fun load_projects_four_cards_from_server_truth() {
        val vm = makeVm()
        vm.load()
        assertEquals(
            listOf(GroupId.BRIEFINGS, GroupId.ALERTS, GroupId.QUIET_HOURS, GroupId.BRIEFING_LOCATION),
            vm.groups().map { it.id },
        )
        assertEquals(
            listOf("Briefings", "Alert preferences", "Quiet hours", "Briefing location"),
            vm.groups().map { it.overline },
        )
    }

    @Test fun alert_switches_mirror_server_values() {
        coEvery { repository.preferences() } returns
            NetworkResult.Success(prefs(weather = false, aqi = true, mail = false, gigs = true, homeReminders = false))
        val vm = makeVm()
        vm.load()
        val groups = vm.groups()
        assertEquals(RowControl.Toggle(false), groups.row(RowId.WEATHER_ALERTS)?.control)
        assertEquals(RowControl.Toggle(true), groups.row(RowId.AQI_ALERTS)?.control)
        assertEquals(RowControl.Toggle(false), groups.row(RowId.MAIL_SUMMARY)?.control)
        assertEquals(RowControl.Toggle(true), groups.row(RowId.GIG_UPDATES)?.control)
        assertEquals(RowControl.Toggle(false), groups.row(RowId.HOME_REMINDERS)?.control)
    }

    @Test fun time_chips_only_render_when_the_briefing_is_on() {
        coEvery { repository.preferences() } returns
            NetworkResult.Success(prefs(dailyEnabled = true, dailyTime = "08:30", eveningEnabled = false))
        val vm = makeVm()
        vm.load()
        assertEquals(
            RowControl.Chips(NotificationSettingsViewModel.MORNING_TIME_OPTIONS, "08:30"),
            vm.groups().row(RowId.MORNING_TIME)?.control,
        )
        assertNull("Evening chips hide while the evening briefing is off", vm.groups().row(RowId.EVENING_TIME))
    }

    @Test fun quiet_hours_bounds_only_render_when_start_is_set() {
        val vm = makeVm()
        vm.load()
        assertEquals(RowControl.Toggle(false), vm.groups().row(RowId.QUIET_HOURS)?.control)
        assertNull(vm.groups().row(RowId.QUIET_HOURS_START))

        coEvery { repository.preferences() } returns
            NetworkResult.Success(prefs(quietStart = "23:00", quietEnd = "06:00"))
        vm.refresh()
        assertEquals(RowControl.Toggle(true), vm.groups().row(RowId.QUIET_HOURS)?.control)
        assertEquals(
            RowControl.Chips(NotificationSettingsViewModel.QUIET_START_OPTIONS, "23:00"),
            vm.groups().row(RowId.QUIET_HOURS_START)?.control,
        )
        assertEquals(
            RowControl.Chips(NotificationSettingsViewModel.QUIET_END_OPTIONS, "06:00"),
            vm.groups().row(RowId.QUIET_HOURS_END)?.control,
        )
    }

    @Test fun location_radios_reflect_stored_mode() {
        coEvery { repository.preferences() } returns
            NetworkResult.Success(prefs(locationMode = NotificationPreferences.MODE_DEVICE_LOCATION))
        val vm = makeVm()
        vm.load()
        assertEquals(RowControl.Radio(false), vm.groups().row(RowId.LOCATION_PRIMARY_HOME)?.control)
        assertEquals(RowControl.Radio(false), vm.groups().row(RowId.LOCATION_VIEWING)?.control)
        assertEquals(RowControl.Radio(true), vm.groups().row(RowId.LOCATION_DEVICE)?.control)
    }

    @Test fun footer_caption_names_the_briefing_timezone() {
        coEvery { repository.preferences() } returns NetworkResult.Success(prefs(timezone = "America/New_York"))
        val vm = makeVm()
        vm.load()
        assertEquals("Briefing times use America/New_York", vm.footerCaption.value)
    }

    @Test fun load_failure_produces_error_state() {
        coEvery { repository.preferences() } returns NetworkResult.Failure(NetworkError.Server(500, null))
        val vm = makeVm()
        vm.load()
        assertTrue(vm.state.value is GroupedListUiState.Error)
    }

    // MARK: - Saving

    @Test fun toggle_sends_the_backend_wire_name_on_a_put() =
        runTest {
            val patch = slot<NotificationPreferencesPatch>()
            coEvery { repository.updatePreferences(capture(patch)) } returns
                NetworkResult.Success(prefs(weather = false))
            val vm = makeVm()
            vm.load()
            vm.onToggle(RowId.WEATHER_ALERTS, isOn = false)
            // Optimistic before the flush.
            assertEquals(RowControl.Toggle(false), vm.groups().row(RowId.WEATHER_ALERTS)?.control)

            vm.flushPendingSaveNow()
            assertEquals(false, patch.captured.weatherAlertsEnabled)
            assertNull("Untouched keys stay out of the body", patch.captured.aqiAlertsEnabled)
            assertEquals("Saved", vm.toast.value?.text)
        }

    @Test fun time_chip_sends_raw_hhmm_not_a_locale_string() =
        runTest {
            val patch = slot<NotificationPreferencesPatch>()
            coEvery { repository.updatePreferences(capture(patch)) } returns
                NetworkResult.Success(prefs(dailyTime = "09:30"))
            val vm = makeVm()
            vm.load()
            vm.onSelectChip(RowId.MORNING_TIME, "09:30")
            vm.flushPendingSaveNow()
            assertEquals("09:30", patch.captured.dailyBriefingTimeLocal)
        }

    @Test fun quiet_hours_toggle_seeds_then_clears_both_bounds() =
        runTest {
            val patch = slot<NotificationPreferencesPatch>()
            coEvery { repository.updatePreferences(capture(patch)) } returns
                NetworkResult.Success(prefs(quietStart = "22:00", quietEnd = "07:00"))
            val vm = makeVm()
            vm.load()

            vm.onToggle(RowId.QUIET_HOURS, isOn = true)
            vm.flushPendingSaveNow()
            assertEquals(QuietHoursPatch("22:00", "07:00"), patch.captured.quietHours)

            coEvery { repository.updatePreferences(capture(patch)) } returns NetworkResult.Success(prefs())
            vm.onToggle(RowId.QUIET_HOURS, isOn = false)
            vm.flushPendingSaveNow()
            // Both null → the adapter writes explicit JSON nulls, which
            // is how the columns get cleared.
            assertEquals(QuietHoursPatch(null, null), patch.captured.quietHours)
        }

    @Test fun location_radio_sends_the_mode_enum() =
        runTest {
            val patch = slot<NotificationPreferencesPatch>()
            coEvery { repository.updatePreferences(capture(patch)) } returns
                NetworkResult.Success(prefs(locationMode = NotificationPreferences.MODE_VIEWING_LOCATION))
            val vm = makeVm()
            vm.load()
            vm.onSelectRadio(RowId.LOCATION_VIEWING)
            vm.flushPendingSaveNow()
            assertEquals("viewing_location", patch.captured.locationMode)
        }

    @Test fun debounce_merges_every_pending_key_into_one_put() =
        runTest {
            val patches = mutableListOf<NotificationPreferencesPatch>()
            coEvery { repository.updatePreferences(capture(patches)) } returns
                NetworkResult.Success(prefs(aqi = false, gigs = false))
            val vm = makeVm()
            vm.load()
            vm.onToggle(RowId.AQI_ALERTS, isOn = false)
            vm.onToggle(RowId.GIG_UPDATES, isOn = false)
            vm.flushPendingSaveNow()

            assertEquals("The debounce collapses the burst into one write", 1, patches.size)
            assertEquals(false, patches[0].aqiAlertsEnabled)
            assertEquals(false, patches[0].gigUpdatesEnabled)
        }

    @Test fun failed_save_toasts_and_rolls_back_to_server_truth() =
        runTest {
            coEvery { repository.preferences() } returns NetworkResult.Success(prefs(mail = true))
            coEvery { repository.updatePreferences(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            vm.onToggle(RowId.MAIL_SUMMARY, isOn = false)
            assertEquals(RowControl.Toggle(false), vm.groups().row(RowId.MAIL_SUMMARY)?.control)

            vm.flushPendingSaveNow()
            assertEquals("Failed to save", vm.toast.value?.text)
            assertEquals(
                "The re-fetch restores the server value",
                RowControl.Toggle(true),
                vm.groups().row(RowId.MAIL_SUMMARY)?.control,
            )
        }

    @Test fun refresh_failure_keeps_content_and_toasts() {
        val vm = makeVm()
        vm.load()
        coEvery { repository.preferences() } returns NetworkResult.Failure(NetworkError.Server(500, null))
        vm.refresh()
        assertEquals("Failed to load preferences", vm.toast.value?.text)
        assertFalse(vm.groups().isEmpty())
    }

    // MARK: - Helpers

    private fun NotificationSettingsViewModel.groups(): List<GroupedListGroup> = (state.value as GroupedListUiState.Loaded).groups

    private fun List<GroupedListGroup>.row(id: String): GroupedListRow? = flatMap { it.rows }.firstOrNull { it.id == id }

    private companion object {
        const val LONG_DEBOUNCE_MS = 60_000L
    }
}
