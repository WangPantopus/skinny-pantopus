@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.gigs.tasks_map

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
 * A11.1 — Paparazzi baselines for the Tasks map. Two frames mirror the
 * design: POPULATED (40% sheet, nine category pins, rail of task cards)
 * and EMPTY (anchor-only map, in-sheet empty hero with Post-a-task /
 * Widen-search CTAs).
 *
 * Renders [TasksMapStaticPreview] (the chrome over the shell's flat
 * map stand-in) because the real `GoogleMap` doesn't render under
 * Paparazzi. Record baselines with `./gradlew paparazziRecord`.
 */
class TasksMapSnapshotTest {
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
    fun tasks_map_populated() {
        paparazzi.snapshot {
            Frame {
                TasksMapStaticPreview(
                    state = TasksMapUiState.Populated(TasksMapSampleData.items),
                    selectedId = "handyman-1",
                )
            }
        }
    }

    @Test
    fun tasks_map_empty() {
        paparazzi.snapshot {
            Frame {
                TasksMapStaticPreview(state = TasksMapUiState.Empty)
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
