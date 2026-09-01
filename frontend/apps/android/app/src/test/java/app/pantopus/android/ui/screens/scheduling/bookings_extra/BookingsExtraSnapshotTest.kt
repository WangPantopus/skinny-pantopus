@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.bookings_extra

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
import org.junit.Rule
import org.junit.Test

/**
 * Visual-contract snapshots for the in-page A9 content composables. Window-level
 * surfaces (the no-show dialog, double-book dialog, nudge / filter / waitlist-
 * join sheets) are verified on-device, not snapshotted — mirroring the shared
 * kit's `ConflictAlternativesSheet`/`TimezonePickerSheet` exclusion.
 *
 * Golden images are generated with `./gradlew :app:paparazziRecord` in an
 * Android-SDK environment.
 */
class BookingsExtraSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2600, softButtons = false))

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }

    private fun roster(
        filled: Int,
        seatTotal: Int,
        waiting: Int,
    ) = RosterData(
        title = "Roster",
        pillar = SchedulingPillar.Business,
        seatTotal = seatTotal,
        filled = filled,
        confirmed = filled - 1,
        pending = 1,
        waiting = waiting,
        seated =
            listOf(
                RosterPerson("b1", "Theo Kemp", "joined Jun 8", "confirmed"),
                RosterPerson("b2", "Lena Marsh", "joined Jun 9", "confirmed"),
                RosterPerson("b3", "Wes Holt", "joined Jun 10", "pending"),
            ),
        waitlist =
            listOf(
                RosterPerson("w1", "Rosa Calderón", "#1 · joined Jun 11", "waiting"),
                RosterPerson("w2", "Sam Nguyen", "#2 · joined Jun 12", "waiting"),
            ),
        seatsOpen = (seatTotal - filled).coerceAtLeast(0),
        canMarkNoShow = true,
    )

    @Test
    fun roster_underCapacity() {
        paparazzi.snapshot {
            Frame {
                RosterContent(data = roster(filled = 12, seatTotal = 16, waiting = 3), onPromote = {
                }, onAdjustCapacity = {}, onAddAttendee = {}, onRowNoShow = {
                        _,
                        _,
                    ->
                })
            }
        }
    }

    @Test
    fun roster_full() {
        paparazzi.snapshot {
            Frame {
                RosterContent(data = roster(filled = 16, seatTotal = 16, waiting = 3), onPromote = {
                }, onAdjustCapacity = {}, onAddAttendee = {}, onRowNoShow = {
                        _,
                        _,
                    ->
                })
            }
        }
    }

    @Test
    fun waitlist_host() {
        paparazzi.snapshot {
            Frame {
                WaitlistContent(
                    data =
                        WaitlistData(
                            options = listOf(EventTypeOption("et1", "Group class"), EventTypeOption("et2", "Workshop")),
                            selectedId = "et1",
                            pillar = SchedulingPillar.Personal,
                            seatTotal = 10,
                            entries =
                                listOf(
                                    RosterPerson("w1", "Rosa Calderón", "#1 · joined Jun 11", "waiting"),
                                    RosterPerson("w2", "Sam Nguyen", "#2 · joined Jun 12", "waiting"),
                                ),
                        ),
                    onSelect = {},
                    onPromote = {},
                )
            }
        }
    }

    @Test
    fun followup_completed() {
        paparazzi.snapshot {
            Frame {
                FollowUpContent(
                    state =
                        FollowUpUiState(
                            loading = false,
                            inviteeName = "Mara",
                            pillar = SchedulingPillar.Personal,
                            outcome = FollowUpOutcome.Completed,
                            message = FollowUpOutcome.Completed.template,
                            canAppendRebookLink = true,
                        ),
                    onSelectOutcome = {},
                    onMessage = {},
                    onPrivateNote = {},
                    onPush = {},
                    onRebookLink = {},
                )
            }
        }
    }
}
