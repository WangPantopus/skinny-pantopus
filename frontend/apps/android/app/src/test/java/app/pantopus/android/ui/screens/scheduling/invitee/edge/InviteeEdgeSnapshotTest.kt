@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingTerminalState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * Visual contract for the A7 invitee/customer edge screens. The Paparazzi
 * baselines (golden PNGs) can't be generated in the current sandbox (no Android
 * SDK / Google Maven blocked) and CI runs `test` + `paparazziVerify`, so this is
 * @Ignore'd to keep CI green. Record with `./gradlew :app:recordPaparazziDebug`,
 * commit the goldens, then remove this @Ignore.
 */
@Ignore("Paparazzi baselines not yet recorded — run :app:recordPaparazziDebug, commit goldens, then remove this @Ignore.")
class InviteeEdgeSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    private fun slot(
        start: String,
        local: String,
        end: String,
    ) = SlotDto(start = start, end = end, startLocal = local)

    private val alternatives =
        listOf(
            slot("2026-06-17T18:30:00Z", "2026-06-17T11:30:00", "2026-06-17T19:00:00Z"),
            slot("2026-06-17T20:30:00Z", "2026-06-17T13:30:00", "2026-06-17T21:00:00Z"),
            slot("2026-06-18T16:00:00Z", "2026-06-18T09:00:00", "2026-06-18T16:30:00Z"),
        )

    private fun manageView(
        canReschedule: Boolean = true,
        canCancel: Boolean = true,
        refundLabel: String? = null,
        refundPartial: Boolean = false,
        hasPayment: Boolean = false,
    ) = ManageView(
        eventName = "Intro call",
        hostLabel = "Maria Kessler",
        pillar = SchedulingPillar.Personal,
        whenLabel = "Wed, Jun 17 · 9:30–10:00 AM",
        tzLabel = "PDT",
        status = "confirmed",
        canReschedule = canReschedule,
        canCancel = canCancel,
        rescheduleDeadlineLabel = "Jun 16",
        freeCancelUntilLabel = "Jun 16",
        refundEstimateLabel = refundLabel,
        refundIsFull = false,
        refundIsPartial = refundPartial,
        hasPayment = hasPayment,
        startUtc = "2026-06-17T16:30:00Z",
        endUtc = "2026-06-17T17:00:00Z",
        location = null,
        timezone = "America/Los_Angeles",
        proposedWhenLabel = null,
    )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }

    @Test
    fun slot_taken_alternatives() =
        paparazzi.snapshot {
            Frame { SlotTakenScreen(alternatives = alternatives, onPick = {}, onPickAnotherTime = {}, onBack = {}) }
        }

    @Test
    fun slot_taken_fully_booked() =
        paparazzi.snapshot {
            Frame { SlotTakenScreen(alternatives = emptyList(), onPick = {}, onPickAnotherTime = {}, onBack = {}, onJoinWaitlist = {}) }
        }

    @Test
    fun slot_taken_refreshing() =
        paparazzi.snapshot {
            Frame { SlotTakenScreen(alternatives = emptyList(), onPick = {}, onPickAnotherTime = {}, onBack = {}, refreshing = true) }
        }

    @Test
    fun terminal_paused() =
        paparazzi.snapshot {
            Frame {
                UnavailableExpiredScreen(
                    state = SchedulingTerminalState.Paused,
                    onBack = {},
                    hostName = "Maria",
                    pausedNote = "Out of office for a bit — back to taking bookings soon.",
                    reopensLabel = "Reopens Jun 20",
                    onNotifyMe = {},
                )
            }
        }

    @Test
    fun terminal_secret_with_code() =
        paparazzi.snapshot {
            Frame { UnavailableExpiredScreen(state = SchedulingTerminalState.Secret, onBack = {}, onSubmitAccessCode = {}) }
        }

    @Test
    fun terminal_expired() =
        paparazzi.snapshot {
            Frame { UnavailableExpiredScreen(state = SchedulingTerminalState.Expired, onBack = {}, onRequestNewLink = {}) }
        }

    @Test
    fun manage_free_to_change() =
        paparazzi.snapshot {
            Frame {
                ManageContent(
                    view = manageView(),
                    mode = ManagePolicyMode.FreeToChange,
                    onReschedule = {},
                    onCancel = {},
                    onAddToCalendar = {},
                    onAccept = {},
                    onDecline = {},
                    onKeep = {},
                )
            }
        }

    @Test
    fun manage_reschedule_closed() =
        paparazzi.snapshot {
            Frame {
                ManageContent(
                    view = manageView(canReschedule = false),
                    mode = ManagePolicyMode.RescheduleClosed,
                    onReschedule = {},
                    onCancel = {},
                    onAddToCalendar = {},
                    onAccept = {},
                    onDecline = {},
                    onKeep = {},
                )
            }
        }

    @Test
    fun manage_partial_refund() =
        paparazzi.snapshot {
            Frame {
                ManageContent(
                    view = manageView(canReschedule = false, refundLabel = "$24.00", refundPartial = true, hasPayment = true),
                    mode = ManagePolicyMode.PartialRefund,
                    onReschedule = {},
                    onCancel = {},
                    onAddToCalendar = {},
                    onAccept = {},
                    onDecline = {},
                    onKeep = {},
                )
            }
        }

    @Test
    fun open_in_app_resolved() =
        paparazzi.snapshot {
            Frame {
                OpenInAppContent(
                    state =
                        OpenInAppViewModel.OpenInAppUiState.Resolved(
                            title = "Consultation",
                            subtitle = "30 min · with Dr. Lee",
                            targetRoute = "book/dr-lee",
                            webUrl = "https://pantopus.com/book/dr-lee",
                        ),
                    onContinueInApp = {},
                    onStayOnWeb = {},
                    onBack = {},
                )
            }
        }

    @Test
    fun open_in_app_failed() =
        paparazzi.snapshot {
            Frame {
                OpenInAppContent(
                    state = OpenInAppViewModel.OpenInAppUiState.Failed(webUrl = "https://pantopus.com/book/dr-lee"),
                    onContinueInApp = {},
                    onStayOnWeb = {},
                    onBack = {},
                )
            }
        }
}
