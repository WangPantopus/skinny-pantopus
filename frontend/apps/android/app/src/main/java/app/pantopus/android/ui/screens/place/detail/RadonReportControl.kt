package app.pantopus.android.ui.screens.place.detail

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * "Read a lab report" in the radon sheet: a photo or PDF of the lab's report, taken now or chosen, fills in
 * the result and test date for the person to check and save. [onLeave] runs before the camera or a picker
 * opens, [onCancel] when it comes back with nothing, and [onReport] gets the file and what to do once it is
 * read. Mirrors iOS `RadonReportControl`.
 */
@Composable
internal fun RadonReportControl(
    reading: Boolean,
    message: String?,
    failed: Boolean,
    enabled: Boolean,
    onLeave: () -> Unit,
    onCancel: () -> Unit,
    onReport: (Uri, () -> Unit) -> Unit,
) {
    var choosing by remember { mutableStateOf(false) }
    val sources = rememberReadingSources("radon-report", onLeave = onLeave, onCancel = onCancel, read = onReport)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Box {
            GhostButton(
                "Read a lab report",
                onClick = { choosing = true },
                modifier = Modifier.fillMaxWidth().testTag("radonSheetReadReport"),
                isLoading = reading,
                isEnabled = enabled && !reading,
            )
            DropdownMenu(expanded = choosing, onDismissRequest = { choosing = false }) {
                if (sources.hasCamera) {
                    DropdownMenuItem(text = { Text("Take a photo") }, onClick = {
                        choosing = false
                        sources.takePhoto()
                    })
                }
                DropdownMenuItem(text = { Text("Choose a photo") }, onClick = {
                    choosing = false
                    sources.choosePhoto()
                })
                DropdownMenuItem(text = { Text("Choose a PDF") }, onClick = {
                    choosing = false
                    sources.choosePdf()
                })
            }
        }
        val shown = if (reading) "Reading the report…" else message
        if (shown != null) {
            Text(
                shown,
                fontSize = 12.sp,
                color =
                    when {
                        reading -> PantopusColors.appTextSecondary
                        failed -> PantopusColors.error
                        else -> PantopusColors.appText
                    },
                modifier = Modifier.testTag("radonSheetReportMessage").semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
    }
}
