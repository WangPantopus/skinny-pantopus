@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for [PerforatedStamp] (+ [Postmark], [ForeverArt]) —
 * the postage primitives A17.11 Stamps consumes. Mirrors iOS
 * `PerforatedStampSnapshotTests`. The perforated edge is a static even-odd
 * draw, so the snapshots capture the final visual (no animation).
 *
 * Baselines live under `app/src/test/snapshots/images/`; regenerate via
 * `./gradlew paparazziRecord`.
 */
class PerforatedStampSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun perforated_stamp_ink_variants() {
        paparazzi.snapshot { InkVariantsGallery() }
    }

    @Test
    fun perforated_stamp_used_and_unused() {
        paparazzi.snapshot { UsedGallery() }
    }

    @Test
    fun perforated_stamp_forever_art_scales() {
        paparazzi.snapshot { ArtworkGallery() }
    }
}

@Composable
private fun InkVariantsGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("PerforatedStamp ink variants", style = PantopusTextStyle.caption)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            PerforatedStamp(ink = PantopusColors.categoryStamps, width = 64.dp, height = 84.dp)
            PerforatedStamp(ink = PantopusColors.rose, width = 64.dp, height = 84.dp)
            PerforatedStamp(ink = PantopusColors.magic, width = 64.dp, height = 84.dp)
            PerforatedStamp(ink = PantopusColors.home, width = 64.dp, height = 84.dp)
            PerforatedStamp(ink = PantopusColors.warmAmber, width = 64.dp, height = 84.dp)
        }
    }
}

@Composable
private fun UsedGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("Featured unused · used", style = PantopusTextStyle.caption)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            PerforatedStamp(ink = PantopusColors.categoryStamps, width = 104.dp, height = 132.dp)
            PerforatedStamp(ink = PantopusColors.categoryStamps, width = 104.dp, height = 132.dp, used = true)
        }
    }
}

@Composable
private fun ArtworkGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("ForeverArt full · compact · postmark", style = PantopusTextStyle.caption)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            PerforatedStamp(ink = PantopusColors.categoryStamps, width = 104.dp, height = 132.dp)
            PerforatedStamp(
                ink = PantopusColors.categoryStamps,
                width = 68.dp,
                height = 68.dp,
                toothRadius = 3.dp,
                toothGap = 9.dp,
            )
            PerforatedStamp(ink = PantopusColors.rose, width = 68.dp, height = 84.dp, used = true)
        }
    }
}
