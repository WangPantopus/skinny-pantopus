@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.hub.NotificationPreferences
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.hub.NotificationPreferencesRepository
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * A14.5 — Paparazzi render spec for the notification & briefing
 * preferences cards, driven by a stubbed
 * `GET /api/hub/preferences` payload. Mirror of the iOS
 * `NotificationSettingsSnapshotTests` baseline gate.
 *
 * `@Ignore`d while baselines are pending: this container has no Android
 * SDK, so the golden PNGs can't be recorded here. Record + commit them
 * (and drop the `@Ignore`) in a follow-up via:
 *
 *   ./gradlew paparazziRecord --tests "*NotificationSettingsSnapshotTest*"
 *
 * Keeping it ignored means `paparazziVerify` stays green until the
 * goldens land — the same "baseline pending follow-up" posture as iOS.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@Ignore("A14.5 baselines pending — record via ./gradlew paparazziRecord (needs Android SDK).")
class NotificationSettingsSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2600,
                    softButtons = false,
                ),
        )

    private val repository: NotificationPreferencesRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun notifications_both_briefings_on() {
        paparazzi.snapshot { Frame { NotificationFrame(viewModel(preferences())) } }
    }

    @Test
    fun notifications_quiet_hours_on_evening_off() {
        paparazzi.snapshot {
            Frame {
                NotificationFrame(
                    viewModel(
                        preferences(
                            eveningEnabled = false,
                            quietStart = "22:00",
                            quietEnd = "07:00",
                            locationMode = NotificationPreferences.MODE_DEVICE_LOCATION,
                        ),
                    ),
                )
            }
        }
    }

    private fun viewModel(prefs: NotificationPreferences): NotificationSettingsViewModel {
        coEvery { repository.preferences() } returns NetworkResult.Success(prefs)
        return NotificationSettingsViewModel(repository).apply { load() }
    }

    private fun preferences(
        dailyEnabled: Boolean = true,
        eveningEnabled: Boolean = true,
        quietStart: String? = null,
        quietEnd: String? = null,
        locationMode: String = NotificationPreferences.MODE_PRIMARY_HOME,
    ) = NotificationPreferences(
        dailyBriefingEnabled = dailyEnabled,
        dailyBriefingTimeLocal = "07:30",
        dailyBriefingTimezone = "America/Los_Angeles",
        eveningBriefingEnabled = eveningEnabled,
        eveningBriefingTimeLocal = "18:00",
        weatherAlertsEnabled = true,
        aqiAlertsEnabled = true,
        mailSummaryEnabled = false,
        gigUpdatesEnabled = true,
        homeRemindersEnabled = true,
        quietHoursStartLocal = quietStart,
        quietHoursEndLocal = quietEnd,
        locationMode = locationMode,
    )

    @Composable
    private fun NotificationFrame(viewModel: NotificationSettingsViewModel) {
        GroupedListScreen(
            title = viewModel.title,
            state = viewModel.state.value,
            footerCaption = viewModel.footerCaption.value,
        )
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
