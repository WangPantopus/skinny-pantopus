@file:Suppress("MagicNumber", "LongMethod", "PackageNaming")

package app.pantopus.android.ui.screens.settings.payments

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * P5.2 / A14.6 Paparazzi baselines for [PaymentsScreen] in both
 * populated and empty states. Mirrors iOS
 * `PaymentsSnapshotTests.swift`.
 *
 * Record new baselines: `./gradlew :app:recordPaparazziDebug --tests
 * "*PaymentsScreenSnapshotTest*"`.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PaymentsScreenSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun payments_populated() {
        // Render the pure content surface so the harness needs no Activity
        // (PaymentSheet) — the visual contract is identical to the live
        // wrapper for a given Loaded state.
        paparazzi.snapshot {
            Frame {
                PaymentsScreenContent(
                    state = PaymentsUiState.Loaded(PaymentsSampleData.populated),
                    actions = noOpActions(),
                )
            }
        }
    }

    @Test
    fun payments_empty() {
        paparazzi.snapshot {
            Frame {
                PaymentsScreenContent(
                    state = PaymentsUiState.Loaded(PaymentsSampleData.empty),
                    actions = noOpActions(),
                )
            }
        }
    }

    private fun noOpActions(): PaymentsScreenActions =
        PaymentsScreenActions(
            onBack = {},
            onAddMethod = {},
            onSetDefault = {},
            onRemove = {},
            onTapRow = {},
            onCloseAccount = {},
            onRetry = {},
        )

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
