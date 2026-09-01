@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.businesses.page_editor

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
 * P4.2 — A13.10 Edit Business Page. Paparazzi snapshots for both
 * frames: `published_dirty` (Roost Café · 3 unsaved tweaks · dirty bar)
 * and `setup` (Patch & Paw · 3 of 7 sections · completion strip ·
 * "Publish · 4 to go" bar).
 */
class EditBusinessPageSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 3000,
                    softButtons = false,
                ),
        )

    @Test
    fun edit_business_page_published_dirty() {
        paparazzi.snapshot {
            Frame {
                EditBusinessPageLoadedFrame(
                    content = EditBusinessPageSampleData.publishedRoostCafe,
                    onBack = {},
                    onPreview = {},
                    onDiscard = {},
                    onSave = {},
                    onSaveDraft = {},
                    onPublish = {},
                )
            }
        }
    }

    @Test
    fun edit_business_page_setup() {
        paparazzi.snapshot {
            Frame {
                EditBusinessPageLoadedFrame(
                    content = EditBusinessPageSampleData.setupPatchAndPaw,
                    onBack = {},
                    onPreview = {},
                    onDiscard = {},
                    onSave = {},
                    onSaveDraft = {},
                    onPublish = {},
                )
            }
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
