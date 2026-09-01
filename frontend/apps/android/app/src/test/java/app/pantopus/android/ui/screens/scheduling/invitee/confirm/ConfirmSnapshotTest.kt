@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.confirm

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.scheduling.PublicEventTypeView
import app.pantopus.android.data.api.models.scheduling.PublicPageView
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

class ConfirmSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    private val pillar = SchedulingPillar.Personal

    private fun eventType(
        priceCents: Int = 0,
        depositCents: Int = 0,
        requiresApproval: Boolean = false,
    ) = PublicEventTypeView(
        id = "et1",
        name = "Intro call",
        slug = "intro-call",
        defaultDuration = 30,
        locationMode = "video",
        priceCents = priceCents,
        currency = "USD",
        depositCents = depositCents,
        requiresApproval = requiresApproval,
    )

    private fun args(
        priceCents: Int = 0,
        depositCents: Int = 0,
        requiresApproval: Boolean = false,
    ) = InviteeConfirmArgs(
        slug = "maria",
        eventTypeSlug = "intro-call",
        eventType = eventType(priceCents, depositCents, requiresApproval),
        page = PublicPageView(slug = "maria", title = "Maria Kessler", ownerType = "user"),
        hostName = "Maria Kessler",
        ownerType = "user",
        startAtUtc = "2026-06-17T16:30:00Z",
        endAtUtc = "2026-06-17T17:00:00Z",
        tz = "America/Los_Angeles",
    )

    private fun filledState() =
        ConfirmFlowState(
            slotStartUtc = "2026-06-17T16:30:00Z",
            slotEndUtc = "2026-06-17T17:00:00Z",
            tz = "America/Los_Angeles",
            values = IntakeValues(firstName = "Maya", lastName = "Chen", email = "maya.chen@example.com"),
        )

    @Test
    fun intake_default() =
        paparazzi.snapshot {
            Frame {
                IntakeFormBody(
                    state =
                        ConfirmFlowState(
                            slotStartUtc = "2026-06-17T16:30:00Z",
                            slotEndUtc = "2026-06-17T17:00:00Z",
                            tz = "America/Los_Angeles",
                        ),
                    args = args(),
                    pillar = pillar,
                    questions = emptyList(),
                    onPatch = {},
                    onAnswer = { _, _ -> },
                    onEditSlot = {},
                    onChangeTz = {},
                )
            }
        }

    @Test
    fun review_free() =
        paparazzi.snapshot {
            Frame {
                ReviewConfirmBody(
                    state = filledState(),
                    args = args(),
                    pillar = pillar,
                    paidEnabled = false,
                    questions = emptyList(),
                    answersExpanded = false,
                    onToggleAnswers = {},
                )
            }
        }

    @Test
    fun review_paid() =
        paparazzi.snapshot {
            Frame {
                ReviewConfirmBody(
                    state = filledState(),
                    args = args(priceCents = 4800),
                    pillar = pillar,
                    paidEnabled = true,
                    questions = emptyList(),
                    answersExpanded = false,
                    onToggleAnswers = {},
                )
            }
        }

    @Test
    fun confirmed_free() =
        paparazzi.snapshot {
            Frame {
                ConfirmedBody(
                    confirmed =
                        ConfirmedData(
                            bookingId = "b1",
                            manageToken = "mt1",
                            sentToEmail = "maya.chen@example.com",
                            requiresApproval = false,
                            confirmationMessage = null,
                        ),
                    args = args(),
                    pillar = pillar,
                    whenLabel = "Wed, Jun 17 · 9:30–10:00 AM",
                    tzLabel = "Pacific Time (PDT)",
                    onAddToCalendar = {},
                    onDownloadIcs = {},
                    onManage = {},
                )
            }
        }

    @Test
    fun confirmed_paid_receipt() =
        paparazzi.snapshot {
            Frame {
                ConfirmedBody(
                    confirmed =
                        ConfirmedData(
                            bookingId = "b1",
                            manageToken = "mt1",
                            sentToEmail = "maya.chen@example.com",
                            requiresApproval = false,
                            confirmationMessage = null,
                            paid = PaidConfirmInfo(mode = PriceMode.Full, amountPaidCents = 4800, balanceCents = 0, currency = "USD"),
                        ),
                    args = args(priceCents = 4800),
                    pillar = pillar,
                    whenLabel = "Wed, Jun 17 · 9:30–10:00 AM",
                    tzLabel = "Pacific Time (PDT)",
                    onAddToCalendar = {},
                    onDownloadIcs = {},
                    onManage = {},
                )
            }
        }

    @Test
    fun confirmed_pending_approval() =
        paparazzi.snapshot {
            Frame {
                ConfirmedBody(
                    confirmed =
                        ConfirmedData(
                            bookingId = "b1",
                            manageToken = "mt1",
                            sentToEmail = "maya.chen@example.com",
                            requiresApproval = true,
                            confirmationMessage = null,
                        ),
                    args = args(requiresApproval = true),
                    pillar = pillar,
                    whenLabel = "Wed, Jun 17 · 9:30–10:00 AM",
                    tzLabel = "Pacific Time (PDT)",
                    onAddToCalendar = {},
                    onDownloadIcs = {},
                    onManage = {},
                )
            }
        }

    @Test
    fun manage_confirmed() =
        paparazzi.snapshot {
            Frame {
                ManageBookingContent(
                    data = manageData(ManageStatus.Confirmed, canReschedule = true, canCancel = true),
                    onReschedule = {},
                    onCancel = {},
                    onAddToCalendar = {},
                    onBookAgain = {},
                )
            }
        }

    @Test
    fun manage_cancelled() =
        paparazzi.snapshot {
            Frame {
                ManageBookingContent(
                    data = manageData(ManageStatus.Cancelled, canReschedule = false, canCancel = false, cancelledOn = "Jun 9"),
                    onReschedule = {},
                    onCancel = {},
                    onAddToCalendar = {},
                    onBookAgain = {},
                )
            }
        }

    private fun manageData(
        status: ManageStatus,
        canReschedule: Boolean,
        canCancel: Boolean,
        cancelledOn: String? = null,
    ) = ManageBookingData(
        token = "mt1",
        status = status,
        eventName = "Intro call",
        hostName = "Maria Kessler",
        ownerType = "user",
        startUtc = "2026-06-17T16:30:00Z",
        endUtc = "2026-06-17T17:00:00Z",
        whenLabel = "Wed, Jun 17 · 9:30–10:00 AM",
        tzLabel = "Pacific Time (PDT)",
        locationLabel = "Pantopus video",
        locationSub = "Join link is in your email and calendar invite.",
        inviteeName = "Maya Chen",
        cancelledOnLabel = cancelledOn,
        cancellationPolicy = "You can reschedule or cancel up to 24 hours before the start time.",
        pageSlug = "maria",
        canReschedule = canReschedule,
        canCancel = canCancel,
        windowClosed = false,
        refundEstimateCents = null,
        currency = "USD",
    )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) {
                Column(Modifier.padding(Spacing.s3)) { content() }
            }
        }
    }
}
