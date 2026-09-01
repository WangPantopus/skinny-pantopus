@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.owner_dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Ignore
import org.junit.Rule
import org.junit.Test

/**
 * A10.7 — Paparazzi snapshots for the owner dashboard's two frames (owner /
 * edit + preview-as-neighbor) and its loading shimmer. Mirrors iOS.
 *
 * Baselines must be recorded externally (`./gradlew :app:paparazziRecord`,
 * then commit the PNGs under `src/test/snapshots/images/`) — the cloud env
 * has no Android SDK (drift D6). `@Ignore`d until that follow-up lands, the
 * same cadence B3.1 used for the Business Profile snapshots.
 */
@Ignore("Baselines pending external paparazziRecord — B3.2 follow-up (drift D6).")
class BusinessOwnerSnapshotTest {
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
    fun business_owner_owner() {
        paparazzi.snapshot {
            Frame {
                OwnerEditFrame(
                    content = BusinessOwnerSampleData.marlow,
                    onBack = {},
                    onEditPage = {},
                    onOpenInsights = {},
                    onOpenSettings = {},
                    onOpenTeam = {},
                    onPreview = {},
                    onSubmitReply = { _, _ -> },
                )
            }
        }
    }

    @Test
    fun business_owner_preview() {
        paparazzi.snapshot {
            Frame {
                OwnerPreviewFrame(
                    content = BusinessOwnerSampleData.marlow.publicProfile,
                    onExit = {},
                )
            }
        }
    }

    @Test
    fun business_owner_loading() {
        paparazzi.snapshot {
            Frame { OwnerLoadingLayout(onBack = {}) }
        }
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
