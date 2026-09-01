@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.list_of_rows.Bidder
import app.pantopus.android.ui.screens.shared.list_of_rows.BidderTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for [BidderStack]. Sized to match the iOS snapshot
 * fixture `BidderStack` preview block in `BidderStack.swift`.
 */
class BidderStackSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun bidderStack_gallery() {
        paparazzi.snapshot { BidderStackGallery() }
    }
}

@Composable
private fun BidderStackGallery() {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("3 bidders + 9 overflow", style = PantopusTextStyle.caption)
        BidderStack(
            bidders =
                listOf(
                    Bidder("1", "AR", BidderTone.Violet),
                    Bidder("2", "MT", BidderTone.Amber),
                    Bidder("3", "JP", BidderTone.Teal),
                ),
            overflow = 9,
        )

        Text("1 bidder", style = PantopusTextStyle.caption)
        BidderStack(bidders = listOf(Bidder("1", "AR", BidderTone.Sky)))

        Text("Empty + overflow only", style = PantopusTextStyle.caption)
        BidderStack(bidders = emptyList(), overflow = 5)

        Text("Each tone", style = PantopusTextStyle.caption)
        BidderStack(
            bidders =
                BidderTone.values().mapIndexed { index, tone ->
                    Bidder("$index", "X${index + 1}", tone)
                },
        )
    }
}
