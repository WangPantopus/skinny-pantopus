@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.availability

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate
import java.time.YearMonth

/**
 * Paparazzi snapshots for the A3 Availability component surfaces. Baselines must
 * be recorded once in a toolchain-capable environment:
 *   `./gradlew :app:recordPaparazziDebug` → commit the goldens → remove `@Ignore`.
 * Ignored for now so CI's `test` / `paparazziVerify` stay green until the
 * baseline PNGs are committed.
 */
@Ignore("Paparazzi baselines not yet recorded — run :app:recordPaparazziDebug, commit goldens, then remove this @Ignore.")
class AvailabilitySnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    @Test
    fun availability_weekly_hours_card() =
        paparazzi.snapshot {
            Frame {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    PersonalHeaderPill()
                    A3Card(overline = "Weekly hours") {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                            A3Toggle(on = true, onToggle = {})
                            Text(
                                "Monday",
                                modifier = Modifier.weight(1f),
                                color = PantopusColors.appText,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        A3TimeRangeButton(text = "9:00 AM – 5:00 PM", onClick = {})
                        A3InlineAddButton(label = "Add a block", onClick = {})
                        RowDivider()
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                            A3Toggle(on = false, onToggle = {})
                            Text(
                                "Sunday",
                                modifier = Modifier.weight(1f),
                                color = PantopusColors.appTextSecondary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text("Unavailable", color = PantopusColors.appTextMuted, fontSize = 11.5.sp)
                        }
                    }
                }
            }
        }

    @Test
    fun availability_booking_limits() =
        paparazzi.snapshot {
            Frame {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    A3Card {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                            Text(
                                "Minimum notice",
                                modifier = Modifier.weight(1f),
                                color = PantopusColors.appText,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            A3Stepper(value = "4", unit = "hours", onMinus = {}, onPlus = {})
                        }
                        Text("Can't be booked inside this window.", color = PantopusColors.appTextSecondary, fontSize = 11.sp)
                    }
                    A3Card {
                        Text("Start times", color = PantopusColors.appText, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
                        A3Segmented(
                            options = listOf(":00 only", ":00 & :30", "every 15 min"),
                            selectedIndex = 0,
                            onSelect = {},
                            small = true,
                        )
                    }
                }
            }
        }

    @Test
    fun availability_month_calendar() =
        paparazzi.snapshot {
            Frame {
                MonthCalendar(
                    month = YearMonth.of(2026, 7),
                    selectedDate = LocalDate.of(2026, 7, 4),
                    markedDates = setOf(LocalDate.of(2026, 7, 4), LocalDate.of(2026, 7, 24)),
                    onSelect = {},
                    onPrev = {},
                    onNext = {},
                )
            }
        }

    @Test
    fun availability_state_cards() =
        paparazzi.snapshot {
            Frame {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    A3WarningCard(
                        title = "No hours set",
                        body = "People can't book you until you add at least one block.",
                        action = { A3SecondaryButton(label = "Use 9–5, Mon–Fri", icon = PantopusIcon.WandSparkles, onClick = {}) },
                    )
                    A3InfoCard(
                        title = "Start with your hours",
                        body = "Your family and business pages build on these hours, so set them first.",
                    )
                    A3ConflictCard(message = "This overlaps a confirmed 2:30 PM booking. Blocking won't cancel it.", onViewBooking = {})
                }
            }
        }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg).padding(Spacing.s3)) { content() }
        }
    }
}
