@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.map_list_hybrid

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
 * T6.6a (P24) — Paparazzi baselines for the shared `MapListHybridShell`.
 *
 * One snapshot per detent (`.collapsed` / `.standard` / `.expanded`).
 * Uses [MapListHybridShellStaticPreview] so the underlying Google
 * Maps composable is swapped for a flat pale-blue tile — the real
 * `GoogleMap` doesn't render under Paparazzi.
 */
class MapListHybridShellSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1700,
                    softButtons = false,
                ),
        )

    @Test
    fun map_list_hybrid_shell_collapsed_detent() {
        paparazzi.snapshot {
            Frame { MapListHybridPreviewChrome(detent = MapListHybridDetent.Collapsed) }
        }
    }

    @Test
    fun map_list_hybrid_shell_standard_detent() {
        paparazzi.snapshot {
            Frame { MapListHybridPreviewChrome(detent = MapListHybridDetent.Standard) }
        }
    }

    @Test
    fun map_list_hybrid_shell_expanded_detent() {
        paparazzi.snapshot {
            Frame { MapListHybridPreviewChrome(detent = MapListHybridDetent.Expanded) }
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
