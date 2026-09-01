@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.customer

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Visual contract for the A7 My Bookings + Recurring screens. Paparazzi
 * baselines can't be generated in the current sandbox (no Android SDK / Google
 * Maven blocked) and CI runs `test` + `paparazziVerify`, so this is @Ignore'd to
 * keep CI green. Record with `./gradlew :app:recordPaparazziDebug`, commit the
 * goldens, then remove this @Ignore.
 */
@Ignore("Paparazzi baselines not yet recorded — run :app:recordPaparazziDebug, commit goldens, then remove this @Ignore.")
class InviteeCustomerSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }

    private fun row(
        id: String,
        title: String,
        subtitle: String,
        pillar: SchedulingPillar,
        pill: BookingPillKind,
        dimmed: Boolean = false,
    ) = MyBookingRow(id = id, title = title, subtitle = subtitle, pillar = pillar, pill = pill, dimmed = dimmed)

    private val upcomingGroups =
        listOf(
            MyBookingGroup(
                overline = "Needs attention",
                attention = true,
                rows = listOf(row("b1", "Mon, Jun 23", "3:00 PM", SchedulingPillar.Personal, BookingPillKind.Pending)),
            ),
            MyBookingGroup(
                overline = "This week",
                rows =
                    listOf(
                        row("b2", "Thu, Jun 18", "2:00 PM", SchedulingPillar.Personal, BookingPillKind.Confirmed),
                        row("b3", "Fri, Jun 19", "10:00 AM", SchedulingPillar.Business, BookingPillKind.Confirmed),
                    ),
            ),
        )

    private val occurrences =
        (0 until 6).map {
            RecurrenceOccurrence(
                startUtc = "2026-06-${16 + it * 7}T21:00:00Z",
                dateLabel = "Tue, ${if (it < 3) "Jun ${16 + it * 7}" else "Jul ${it * 7 - 14}"}",
                timeLabel = "2:00 PM",
            )
        }

    @Test
    fun my_bookings_populated() =
        paparazzi.snapshot {
            Frame {
                MyBookingsContent(
                    state = MyBookingsUiState.Loaded(MyBookingsTab.Upcoming, upcomingGroups),
                    tab = MyBookingsTab.Upcoming,
                    onTab = {},
                    onRow = {},
                    onRetry = {},
                )
            }
        }

    @Test
    fun my_bookings_empty() =
        paparazzi.snapshot {
            Frame {
                MyBookingsContent(
                    state = MyBookingsUiState.Empty,
                    tab = MyBookingsTab.Upcoming,
                    onTab = {},
                    onRow = {},
                    onRetry = {},
                )
            }
        }

    @Test
    fun recurring_default() =
        paparazzi.snapshot {
            Frame {
                RecurringBody(
                    config = RecurringConfig(),
                    occurrences = occurrences,
                    submit = RecurringSubmitState.Idle,
                    rangeLabel = "Tue, Jun 16 – Tue, Jul 21",
                    weekdayShort = "Tue",
                    timeLabel = "2:00 PM",
                    onRepeat = {},
                    onWeekday = {},
                    onStepTime = {},
                    onSetCount = {},
                    onStepCount = {},
                    onReview = {},
                    onRemoveOccurrence = {},
                    onBackFromReview = {},
                    onConfirm = {},
                    onDone = {},
                    onRetry = {},
                )
            }
        }

    @Test
    fun recurring_partial_result() =
        paparazzi.snapshot {
            Frame {
                val withFailures =
                    occurrences.mapIndexed { i, o -> if (i == 3 || i == 5) o.copy(status = OccurrenceStatus.Failed) else o }
                RecurringBody(
                    config = RecurringConfig(),
                    occurrences = withFailures,
                    submit =
                        RecurringSubmitState.Result(
                            created = 4,
                            requested = 6,
                            failed = withFailures.filter { it.status == OccurrenceStatus.Failed },
                        ),
                    rangeLabel = "Tue, Jun 16 – Tue, Jul 21",
                    weekdayShort = "Tue",
                    timeLabel = "2:00 PM",
                    onRepeat = {},
                    onWeekday = {},
                    onStepTime = {},
                    onSetCount = {},
                    onStepCount = {},
                    onReview = {},
                    onRemoveOccurrence = {},
                    onBackFromReview = {},
                    onConfirm = {},
                    onDone = {},
                    onRetry = {},
                )
            }
        }
}
