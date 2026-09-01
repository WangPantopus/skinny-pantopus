@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.bookingpage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingStatusPill
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

class BookingPageSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    @Test
    fun booking_link_cards() =
        paparazzi.snapshot {
            Frame {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    BLCard(pillar = SchedulingPillar.Personal, overline = "Status") {
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                            SchedulingStatusPill(PageStatus.Live.toPillStatus())
                            SchedulingStatusPill(PageStatus.Paused.toPillStatus())
                            SchedulingStatusPill(PageStatus.Draft.toPillStatus())
                        }
                    }
                    BLCard(pillar = SchedulingPillar.Personal, overline = "Services people can book") {
                        WarningNote("Turn on at least one service so people can book")
                        BLToggleRow(label = "Intro call", sub = "30 min", icon = PantopusIcon.Video, on = true, onToggle = {})
                        BLToggleRow(
                            label = "Coffee chat",
                            sub = "15 min",
                            icon = PantopusIcon.Phone,
                            on = false,
                            onToggle = {},
                            last = true,
                        )
                    }
                    BLCard(pillar = SchedulingPillar.Personal, overline = "Visibility") {
                        BLSegmented(listOf("Listed", "Link-only"), 0, {}, SchedulingPillar.Personal.accent)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                        BLAvatar(initials = "MK", pillar = SchedulingPillar.Personal)
                        BLAvatar(initials = "NS", pillar = SchedulingPillar.Business)
                    }
                }
            }
        }

    @Test
    fun share_targets_and_qr() =
        paparazzi.snapshot {
            Frame {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    ContextLabel(SchedulingPillar.Personal)
                    MonoUrlText("pantopus.com/book/maria-k")
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        ShareTargetButton(PantopusIcon.Share, "Share", Modifier.weight(1f)) {}
                        ShareTargetButton(PantopusIcon.Grid3x3, "QR code", Modifier.weight(1f)) {}
                        ShareTargetButton(PantopusIcon.Mail, "Email", Modifier.weight(1f)) {}
                    }
                    Box(modifier = Modifier.size(120.dp).background(PantopusColors.appSurface)) {
                        // QrCanvas now encodes a real URL (the old decorative noise grid was
                        // the fake-qr-code finding), so the snapshot pins a fixed link to
                        // keep the rendered matrix deterministic.
                        QrCanvas(url = "https://pantopus.com/book/maria-k", modifier = Modifier.fillMaxSize())
                    }
                    BLSavedToast("Link copied")
                }
            }
        }

    @Test
    fun save_bar_states() =
        paparazzi.snapshot {
            Frame {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                    BLSaveBar(saving = false, enabled = true, label = "Save changes", onSave = {})
                    BLSaveBar(saving = true, enabled = true, label = "Save changes", onSave = {})
                    BLSaveBar(saving = false, enabled = false, label = "Save changes", onSave = {})
                }
            }
        }

    @Test
    fun zero_state() =
        paparazzi.snapshot {
            Frame {
                BookingPageZeroState(kind = SchedulingZeroKind.BookingLink, onCta = {}, pillar = SchedulingPillar.Personal)
            }
        }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}
