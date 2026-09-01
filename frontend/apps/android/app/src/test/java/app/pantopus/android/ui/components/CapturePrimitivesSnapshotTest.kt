@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming", "FunctionNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the B1.2 capture primitives — [OcrFactsList]
 * (editable + locked), [CapturedFilmstrip], and [CameraScanner] (the static
 * fallback state Paparazzi renders, since the live CameraX preview is skipped
 * under inspection / when CAMERA permission is not granted).
 *
 * Baselines live under `app/src/test/snapshots/images/`; regenerate via
 * `./gradlew paparazziRecord`.
 */
class CapturePrimitivesSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun ocr_facts_list_states() {
        paparazzi.snapshot { OcrFactsGallery() }
    }

    @Test
    fun captured_filmstrip() {
        paparazzi.snapshot { FilmstripGallery() }
    }

    @Test
    fun camera_scanner_fallback() {
        paparazzi.snapshot { CameraScannerGallery() }
    }
}

@Composable
private fun OcrFactsGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("OcrFactsList", style = PantopusTextStyle.caption)
        OcrFactsList(
            title = "Read from your scans",
            status = OcrFactsStatus(PantopusIcon.ScanLine, "Tap to edit", OcrFactsTone.Neutral),
            facts = sampleOcrFacts,
        )
        OcrFactsList(
            title = "Read from your scans",
            status = OcrFactsStatus(PantopusIcon.Lock, "Saved", OcrFactsTone.Success),
            facts = sampleOcrFacts,
        )
    }
}

@Composable
private fun FilmstripGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("CapturedFilmstrip", style = PantopusTextStyle.caption)
        CapturedFilmstrip(
            accent = PantopusColors.success,
            shots =
                listOf(
                    CameraScannerShot("UNIT", "The machine", isMain = true),
                    CameraScannerShot("BOX", "Box + barcode"),
                    CameraScannerShot("RECEIPT", "Store receipt"),
                    CameraScannerShot("LABEL", "Serial label"),
                ),
            onAdd = {},
        )
    }
}

@Composable
private fun CameraScannerGallery() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text("CameraScanner (fallback)", style = PantopusTextStyle.caption)
        CameraScanner(accent = PantopusColors.success, onCapture = {}, cameraPreviewEnabled = false)
    }
}
