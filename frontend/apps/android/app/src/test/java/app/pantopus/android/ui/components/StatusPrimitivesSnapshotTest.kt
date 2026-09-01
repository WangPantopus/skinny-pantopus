@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for [HaloCircle] and [BeaconBanner] — the
 * ceremonial primitives that A18.1/.2/.3 status frames and A21.1/.2
 * public-profile banners consume. The pulsing variant renders the static
 * (frame-zero) layout; runtime animation isn't exercised by Paparazzi.
 *
 * Baselines live under `app/src/test/snapshots/images/`; regenerate via
 * `./gradlew paparazziRecord`.
 */
class StatusPrimitivesSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun halo_circle_tones() {
        paparazzi.snapshot { HaloTonesGallery() }
    }

    @Test
    fun halo_circle_pulsing_static() {
        paparazzi.snapshot { HaloPulsingGallery() }
    }

    @Test
    fun beacon_banner_identities() {
        paparazzi.snapshot { BeaconIdentityGallery() }
    }
}

@Composable
private fun HaloTonesGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("HaloCircle tones", style = PantopusTextStyle.caption)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            HaloCircle(tone = HaloCircleTone.Success)
            HaloCircle(tone = HaloCircleTone.Info)
            HaloCircle(tone = HaloCircleTone.Warning)
            HaloCircle(tone = HaloCircleTone.Celebration)
        }
    }
}

@Composable
private fun HaloPulsingGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("HaloCircle pulsing (frame zero)", style = PantopusTextStyle.caption)
        HaloCircle(tone = HaloCircleTone.Info, isPulsing = true)
    }
}

@Composable
private fun BeaconIdentityGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        BeaconBanner(identity = BeaconIdentity.Personal) { VerifiedChipPreview() }
        BeaconBanner(identity = BeaconIdentity.Home) {}
        BeaconBanner(identity = BeaconIdentity.Business, showStripes = false) {}
    }
}

@Composable
private fun VerifiedChipPreview() {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(Color.Black.copy(alpha = 0.25f))
                .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ShieldCheck,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = "Verified",
            color = PantopusColors.appTextInverse,
            fontSize = 11.sp,
        )
    }
}
