@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

class SettingsSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    @Test
    fun settings_automation_group() =
        paparazzi.snapshot {
            Frame {
                Column {
                    SettingsGroup(title = "Automation", helper = "Reminders go out automatically before each booking.") {
                        SettingsRow(label = "Default reminders", sublabel = "1 day · 1 hr")
                        SettingsRow(
                            label = "Workflows & follow-ups",
                            trailing = { SettingsChipChevron("3 active", SettingsChipTone.Success) },
                        )
                        SettingsRow(
                            label = "Message templates",
                            sublabel = "5 templates",
                            showDivider = false,
                        )
                    }
                    SettingsDangerGroup {
                        SettingsDangerRow(label = "Reset booking link", icon = PantopusIcon.RefreshCw, showDivider = true, onClick = {})
                        SettingsDangerRow(label = "Disable scheduling", icon = PantopusIcon.CalendarX, showDivider = false, onClick = {})
                    }
                }
            }
        }

    @Test
    fun notif_notify_me_card() =
        paparazzi.snapshot {
            Frame {
                NotifCategoryCard(
                    label = "Notify me",
                    helper = "Only you see these. Pick the channel for each event.",
                    disabled = false,
                    accent = PantopusColors.primary600,
                    accentBg = PantopusColors.primary50,
                ) {
                    NotifMatrixRow(
                        row = NotifRow("new_booking", "New booking", "We'll tell you the moment someone books.", enabled = true),
                        isAttendee = false,
                        paused = false,
                        pushOff = false,
                        showDivider = true,
                        accent = PantopusColors.primary600,
                        onToggle = {},
                    )
                    NotifMatrixRow(
                        row = NotifRow("no_show", "No-show", "Attendee missed the booking", enabled = false),
                        isAttendee = false,
                        paused = false,
                        pushOff = false,
                        showDivider = true,
                        accent = PantopusColors.primary600,
                        onToggle = {},
                    )
                    ReminderLeadTime(selected = listOf(1440, 60), paused = false, accent = PantopusColors.primary600, onToggle = {})
                }
            }
        }

    @Test
    fun notif_attendees_locked() =
        paparazzi.snapshot {
            Frame {
                NotifCategoryCard(
                    label = "Notify attendees",
                    helper = "Attendees always get a confirmation — you choose the rest.",
                    disabled = false,
                    accent = PantopusColors.primary600,
                    accentBg = PantopusColors.primary50,
                ) {
                    NotifMatrixRow(
                        row = NotifRow("confirmation", "Booking confirmation", "Sent the moment they book", enabled = true, locked = true),
                        isAttendee = true,
                        paused = false,
                        pushOff = false,
                        showDivider = false,
                        accent = PantopusColors.primary600,
                        onToggle = {},
                    )
                }
            }
        }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}
