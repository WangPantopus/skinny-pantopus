package app.pantopus.android.ui.theme

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens._internal.TokenGalleryScreen
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshot of the full design-token gallery. The committed
 * baseline PNG is the visual contract — PRs that shift any token will
 * fail `verifyPaparazziDebug`.
 */
class TokenGallerySnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 4000,
                    softButtons = false,
                ),
        )

    @Test
    fun token_gallery() {
        paparazzi.snapshot { TokenGalleryScreen() }
    }
}
