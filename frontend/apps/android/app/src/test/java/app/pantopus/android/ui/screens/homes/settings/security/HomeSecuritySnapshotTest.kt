@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.security

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.SavedStateHandle
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import io.mockk.mockk
import org.junit.Rule
import org.junit.Test

/**
 * P5.1 / A14.2 — Paparazzi baselines for the per-home Security
 * toggles. Two frames:
 *   - balanced  5 of 9 toggles on, helpers read calm.
 *   - strict    all 9 on, helpers shift to consequence language.
 */
class HomeSecuritySnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun home_security_balanced() {
        paparazzi.snapshot {
            Frame { renderFrame(HomeSecurityViewModel.Variant.Balanced) }
        }
    }

    @Test
    fun home_security_strict() {
        paparazzi.snapshot {
            Frame { renderFrame(HomeSecurityViewModel.Variant.Strict) }
        }
    }

    @Composable
    private fun renderFrame(variant: HomeSecurityViewModel.Variant) {
        val vm =
            HomeSecurityViewModel(
                // setVariant drives the seed synchronously; the repo is unused here.
                repository = mockk(relaxed = true),
                savedStateHandle = SavedStateHandle(mapOf(HOME_SECURITY_HOME_ID_KEY to "home-1")),
            )
        vm.setVariant(variant)
        val state = vm.state.value as GroupedListUiState.Loaded
        GroupedListScreen(
            title = vm.title,
            state = state,
            footerCaption = vm.footerCaption,
            callbacks = GroupedListCallbacks(onBack = {}),
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
