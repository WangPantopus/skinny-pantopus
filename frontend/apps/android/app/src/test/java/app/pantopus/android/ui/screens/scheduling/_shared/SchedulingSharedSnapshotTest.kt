@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Visual-contract snapshots for the A0 design components feature streams
 * consume. Sheet components ([ConflictAlternativesSheet], [TimezonePickerSheet])
 * are window-level and verified on-device instead.
 */
class SchedulingSharedSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false),
        )

    private val sampleSlots =
        listOf(
            SlotDto(start = "2026-06-17T16:00:00Z", end = "2026-06-17T16:30:00Z", startLocal = "2026-06-17T09:00:00"),
            SlotDto(start = "2026-06-17T16:30:00Z", end = "2026-06-17T17:00:00Z", startLocal = "2026-06-17T09:30:00"),
            SlotDto(start = "2026-06-17T18:00:00Z", end = "2026-06-17T18:30:00Z", startLocal = "2026-06-17T11:00:00"),
            SlotDto(start = "2026-06-17T20:00:00Z", end = "2026-06-17T20:30:00Z", startLocal = "2026-06-17T13:00:00"),
        )

    @Test
    fun paused_terminal_state() {
        paparazzi.snapshot {
            Frame {
                PausedExpiredUnavailableState(
                    state = SchedulingTerminalState.Paused,
                    pillar = SchedulingPillar.Personal,
                    primaryAction = TerminalAction(label = "Get the app", onClick = {}),
                    secondaryAction = TerminalAction(label = "Notify me when it reopens", onClick = {}),
                )
            }
        }
    }

    @Test
    fun expired_terminal_state() {
        paparazzi.snapshot {
            Frame {
                PausedExpiredUnavailableState(state = SchedulingTerminalState.Expired)
            }
        }
    }

    @Test
    fun slot_time_list_with_selection() {
        paparazzi.snapshot {
            Frame {
                Column(modifier = Modifier.padding(16.dp)) {
                    SlotTimeList(
                        slots = sampleSlots,
                        selectedStart = "2026-06-17T16:30:00Z",
                        onSelect = {},
                        hostHintFor = { if (it.start == "2026-06-17T16:30:00Z") "12:30 PM for Maria" else null },
                    )
                }
            }
        }
    }

    @Test
    fun month_calendar() {
        paparazzi.snapshot {
            Frame {
                Column(modifier = Modifier.padding(16.dp)) {
                    MonthCalendar(
                        monthLabel = "June 2026",
                        daysInMonth = 30,
                        firstWeekdayIndex = 1,
                        availableDays = setOf(15, 16, 17, 18, 19, 22, 23, 24),
                        selectedDay = 17,
                        onSelectDay = {},
                        today = 13,
                    )
                }
            }
        }
    }

    // ── SchedulingTopBar (56dp canonical bar) ────────────────────────────────

    @Test
    fun top_bar_back_and_overflow() {
        paparazzi.snapshot {
            Frame {
                Column {
                    SchedulingTopBar(
                        title = "Booking detail",
                        leading = SchedulingTopBarLeading.Back,
                        onLeading = {},
                        trailingIcon = PantopusIcon.MoreHorizontal,
                        onTrailing = {},
                    )
                }
            }
        }
    }

    @Test
    fun top_bar_close_and_save_action() {
        paparazzi.snapshot {
            Frame {
                Column {
                    SchedulingTopBar(
                        title = "Edit resource",
                        leading = SchedulingTopBarLeading.Close,
                        onLeading = {},
                        trailing = {
                            Text(
                                text = "Save",
                                color = PantopusColors.home,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(end = 4.dp),
                            )
                        },
                    )
                }
            }
        }
    }

    @Test
    fun top_bar_with_status_bar_inset() {
        paparazzi.snapshot {
            Frame {
                Column {
                    SchedulingTopBar(
                        title = "Schedule a visit",
                        leading = SchedulingTopBarLeading.Close,
                        onLeading = {},
                        applyStatusBarInset = true,
                    )
                }
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}
