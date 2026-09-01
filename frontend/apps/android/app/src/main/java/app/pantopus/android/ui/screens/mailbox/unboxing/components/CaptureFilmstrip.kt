@file:Suppress("PackageNaming", "FunctionNaming", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.unboxing.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.components.CameraScanner
import app.pantopus.android.ui.components.CameraScannerShot
import app.pantopus.android.ui.components.CapturedFilmstrip
import app.pantopus.android.ui.screens.mailbox.unboxing.UnboxingShot
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.14 capture region — the `CameraScanner` viewfinder (live preview +
 * framing guide + shutter, falling back to a static placeholder under
 * Compose inspection / when camera access is off) stacked over the
 * `CapturedFilmstrip` of labeled thumbnails (B1.2 primitives). The shutter
 * and the trailing "Add" tile both append a labeled shot to the strip.
 *
 * @param cameraPreviewEnabled Pass `false` for deterministic previews /
 *   Paparazzi snapshots that must not bind CameraX.
 */
@Composable
fun CaptureFilmstrip(
    accent: Color,
    shots: List<UnboxingShot>,
    onCapture: () -> Unit,
    onAddShot: () -> Unit,
    modifier: Modifier = Modifier,
    cameraPreviewEnabled: Boolean = true,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        CameraScanner(
            accent = accent,
            onCapture = { onCapture() },
            modifier = Modifier.fillMaxWidth().testTag("unboxing_viewfinder"),
            cameraPreviewEnabled = cameraPreviewEnabled,
        )
        CapturedFilmstrip(
            accent = accent,
            shots = shots.map { CameraScannerShot(tag = it.tag, label = it.label, isMain = it.isMain) },
            modifier = Modifier.fillMaxWidth().testTag("unboxing_filmstrip"),
            onAdd = onAddShot,
        )
    }
}
