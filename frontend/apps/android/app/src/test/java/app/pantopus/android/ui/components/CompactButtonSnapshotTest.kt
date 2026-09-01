@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for [CompactButton]. Mirrors the iOS preview
 * fixtures in `CompactButton.swift` — footer row + inline action row.
 */
class CompactButtonSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun compactButton_gallery() {
        paparazzi.snapshot { CompactButtonGallery() }
    }
}

@Composable
private fun CompactButtonGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("Footer (34dp)", style = PantopusTextStyle.caption)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CompactButton(
                title = "Withdraw",
                variant = CompactButtonVariant.Destructive,
                size = CompactButtonSize.Footer,
                onClick = {},
                icon = PantopusIcon.X,
                modifier = Modifier.weight(1f),
            )
            CompactButton(
                title = "Edit bid",
                variant = CompactButtonVariant.Primary,
                size = CompactButtonSize.Footer,
                onClick = {},
                icon = PantopusIcon.Check,
                modifier = Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CompactButton(
                title = "Message",
                variant = CompactButtonVariant.Ghost,
                size = CompactButtonSize.Footer,
                onClick = {},
                modifier = Modifier.weight(1f),
            )
            CompactButton(
                title = "Mark complete",
                variant = CompactButtonVariant.Primary,
                size = CompactButtonSize.Footer,
                onClick = {},
                modifier = Modifier.weight(1f),
            )
        }

        Text("Inline action (30/28dp)", style = PantopusTextStyle.caption)
        Box(modifier = Modifier.width(120.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                CompactButton(
                    title = "Accept",
                    variant = CompactButtonVariant.Primary,
                    size = CompactButtonSize.InlineAction,
                    onClick = {},
                    modifier = Modifier.fillMaxWidth(),
                )
                CompactButton(
                    title = "Ignore",
                    variant = CompactButtonVariant.Ghost,
                    size = CompactButtonSize.InlineAction,
                    onClick = {},
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
