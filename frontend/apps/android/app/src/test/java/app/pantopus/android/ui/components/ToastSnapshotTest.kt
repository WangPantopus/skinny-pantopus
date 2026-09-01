@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for [Toast]. The five kinds are rendered side by
 * side so a palette drift in any one triggers a visual diff.
 */
class ToastSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun toast_gallery() {
        paparazzi.snapshot { ToastGallery() }
    }
}

@Composable
private fun ToastGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text("Success", style = PantopusTextStyle.caption)
        Toast(ToastMessage("Saved", ToastKind.Success))

        Text("Warning", style = PantopusTextStyle.caption)
        Toast(ToastMessage("Heads up — review needed", ToastKind.Warning))

        Text("Error", style = PantopusTextStyle.caption)
        Toast(ToastMessage("Couldn't send. Try again.", ToastKind.Error))

        Text("Info", style = PantopusTextStyle.caption)
        Toast(ToastMessage("New tip available", ToastKind.Info))

        Text("Neutral (iOS contract)", style = PantopusTextStyle.caption)
        Toast(ToastMessage("Draft restored", ToastKind.Neutral))
    }
}
