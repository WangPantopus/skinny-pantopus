@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.business_profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * A10.6 — Paparazzi snapshots for the reshaped single-scroll Business
 * Profile. Four frames mirror iOS: the populated open profile, the
 * newly-claimed + closed secondary frame (EmptyBlocks + Call dock), the
 * loading shimmer, and the not-found terminal state.
 *
 * Baselines must be regenerated after the B3.1 single-scroll reshape (it
 * changed the layout + frame names): `./gradlew :app:paparazziRecord`,
 * then commit the four PNGs under `src/test/snapshots/images/`.
 */
class BusinessProfileSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2600,
                    softButtons = false,
                ),
        )

    @Test
    fun business_profile_populated() {
        paparazzi.snapshot {
            Frame { LoadedFrame(BusinessProfileSampleData.populated) }
        }
    }

    @Test
    fun business_profile_newly_claimed() {
        paparazzi.snapshot {
            Frame { LoadedFrame(BusinessProfileSampleData.newlyClaimed) }
        }
    }

    @Test
    fun business_profile_loading() {
        paparazzi.snapshot {
            Frame { LoadingLayout(onBack = {}) }
        }
    }

    @Test
    fun business_profile_not_found() {
        paparazzi.snapshot {
            Frame { NotFoundLayout(onBack = {}, onRetry = {}) }
        }
    }

    @Composable
    private fun LoadedFrame(content: BusinessProfileContent) {
        BusinessProfileLoadedFrame(
            content = content,
            isSaved = false,
            onBack = {},
            onShare = {},
            onMore = {},
            onToggleSavedPlace = {},
            onContact = {},
            onBook = {},
            onCall = {},
        )
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
