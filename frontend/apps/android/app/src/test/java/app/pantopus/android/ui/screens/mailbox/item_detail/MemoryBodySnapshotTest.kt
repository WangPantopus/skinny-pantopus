@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.MemoryBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.MemorySampleData
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * A.12 (A17.7) — Paparazzi snapshots for the Memory mail body across both
 * designed states: fresh arrival (facts grid) and saved-to-vault (saved
 * banner + vault-location card). Tall device so the full keepsake column
 * lands in one baseline.
 */
class MemoryBodySnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 3600,
                    softButtons = false,
                ),
        )

    @Test fun memory_fresh_body() {
        paparazzi.snapshot {
            Root {
                MemoryBody(
                    memory = MemorySampleData.memory,
                    isSaved = false,
                    onOpenThread = {},
                )
            }
        }
    }

    @Test fun memory_saved_body() {
        paparazzi.snapshot {
            Root {
                MemoryBody(
                    memory = MemorySampleData.savedMemory,
                    isSaved = true,
                    onOpenVault = {},
                )
            }
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .padding(vertical = Spacing.s4),
        ) {
            content()
        }
    }
}
