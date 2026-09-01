@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.CommunityBody
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/** A17.4 - Paparazzi snapshots for Community mail poll and event subtypes. */
class CommunityBodySnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 3000,
                    softButtons = false,
                ),
        )

    @Test fun community_event_body() {
        paparazzi.snapshot {
            Root {
                CommunityBody(
                    community = MailItemSampleData.communityEvent,
                    authorName = "Aliyah W.",
                    authorInitials = "AW",
                )
            }
        }
    }

    @Test fun community_poll_body() {
        paparazzi.snapshot {
            Root {
                CommunityBody(
                    community = MailItemSampleData.communityPoll,
                    authorName = "Aliyah W.",
                    authorInitials = "AW",
                )
            }
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .padding(vertical = Spacing.s4),
        ) {
            content()
        }
    }
}
