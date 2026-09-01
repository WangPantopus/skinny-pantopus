@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.compose.gig

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.ai.AiTranscriptionRepository
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import io.mockk.mockk
import org.junit.Rule
import org.junit.Test

/**
 * B.3 (A12.8) — Paparazzi snapshots for the Magic Task step-1 design
 * frames: AI-parsed describe (populated) and the manual category picker.
 */
class GigComposeMagicSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2600, softButtons = false),
        )

    // VM is only used for the step composables' callbacks — never invoked
    // during a static snapshot, so relaxed mocks suffice and no
    // Dispatchers.Main is required (viewModelScope is lazy).
    private val vm =
        GigComposeViewModel(
            mockk<GigsRepository>(relaxed = true),
            SavedStateHandle(),
            mockk<NetworkMonitor>(relaxed = true),
            mockk<FilesRepository>(relaxed = true),
            mockk<AiTranscriptionRepository>(relaxed = true),
            mockk<app.pantopus.android.data.gigs.GigDraftQueue>(relaxed = true),
            mockk<app.pantopus.android.data.businesses.BusinessesRepository>(relaxed = true),
        )

    @Test
    fun magic_describe_parsed() {
        paparazzi.snapshot {
            Frame { MagicDescribeStep(GigComposeUiState(form = GigComposeMagicSampleData.parsedForm), vm) }
        }
    }

    @Test
    fun manual_category_picker() {
        paparazzi.snapshot {
            Frame { ManualPickerStep(GigComposeUiState(form = GigComposeMagicSampleData.manualForm), vm) }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg)
                        .padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) { content() }
        }
    }
}
