package app.pantopus.android.ui.theme

import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens._internal.IconGalleryScreen
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshot of the icon gallery. Guards against Material / drawable
 * regressions by pinning the rendered grid to a committed baseline PNG.
 */
class IconGallerySnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    @Test
    fun icon_gallery() {
        paparazzi.snapshot { IconGalleryScreen() }
    }
}
