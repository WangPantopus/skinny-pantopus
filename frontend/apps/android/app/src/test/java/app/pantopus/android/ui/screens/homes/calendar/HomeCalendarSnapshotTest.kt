@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the T6.4c Home calendar. Locks the visual
 * contract for:
 *  - the default agenda view (today highlighted, full list of sections),
 *  - the **day-selected filter state** — the key acceptance from the
 *    P18 brief: tapping a day pins the home-green pill on that day and
 *    collapses the agenda to a single "ON <DATE>" section.
 *
 * The snapshots exercise [MonthStripHeader] directly so the
 * baseline is bound to the feature-local component rather than the
 * full ListOfRows shell scaffold.
 */
class HomeCalendarSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 600,
                    softButtons = false,
                ),
        )

    private val week =
        listOf(
            MonthStripState.Day(id = "2025-10-12", dayOfWeek = "Sun", date = 12, eventCount = 3),
            MonthStripState.Day(id = "2025-10-13", dayOfWeek = "Mon", date = 13, eventCount = 1),
            MonthStripState.Day(id = "2025-10-14", dayOfWeek = "Tue", date = 14, eventCount = 2),
            MonthStripState.Day(id = "2025-10-15", dayOfWeek = "Wed", date = 15, eventCount = 1),
            MonthStripState.Day(id = "2025-10-16", dayOfWeek = "Thu", date = 16, eventCount = 0),
            MonthStripState.Day(id = "2025-10-17", dayOfWeek = "Fri", date = 17, eventCount = 1),
            MonthStripState.Day(id = "2025-10-18", dayOfWeek = "Sat", date = 18, eventCount = 2),
        )

    @Test
    fun month_strip_default_today_pill() {
        paparazzi.snapshot {
            Frame {
                MonthStripHeader(
                    state =
                        MonthStripState(
                            monthLabel = "October 2025",
                            days = week,
                            selectedIsoDate = null,
                            todayIsoDate = "2025-10-12",
                        ),
                    onSelectDay = {},
                    onPrevMonth = {},
                    onNextMonth = {},
                )
            }
        }
    }

    /**
     * Acceptance snapshot: the user has tapped Tuesday Oct 14 and the
     * pill moves off today onto the selected day. This is the
     * "day-selected filter state" baseline called out in the P18 brief.
     */
    @Test
    fun month_strip_day_selected_filter_state() {
        paparazzi.snapshot {
            Frame {
                MonthStripHeader(
                    state =
                        MonthStripState(
                            monthLabel = "October 2025",
                            days = week,
                            selectedIsoDate = "2025-10-14",
                            todayIsoDate = "2025-10-12",
                        ),
                    onSelectDay = {},
                    onPrevMonth = {},
                    onNextMonth = {},
                )
            }
        }
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
