@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.homes.claim_evidence

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/** Exact authorized bytes stay in-app; no provider URL or external viewer receives them. */
@Composable
fun HomePrivateEvidenceDialog(
    controller: HomePrivateEvidenceController,
    onClose: () -> Unit,
) {
    val state by controller.state.collectAsStateWithLifecycle()
    DisposableEffect(controller) { onDispose { controller.close() } }
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, securePolicy = SecureFlagPolicy.SecureOn),
    ) {
        Surface(modifier = Modifier.fillMaxWidth().fillMaxHeight(0.94f).testTag("claimEvidence_panel"), color = PantopusColors.appSurface) {
            Column(
                Modifier.padding(Spacing.s4).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Private claim documents", color = PantopusColors.appText)
                    TextButton(onClick = onClose) { Text("Close") }
                }
                Text(
                    "Documents remain pending until a reviewer explicitly verifies them. Home access requires a separate claim decision.",
                    color = PantopusColors.appTextSecondary,
                )
                if (state.loading) {
                    Shimmer(modifier = Modifier.fillMaxWidth().height(Spacing.s10))
                } else if (state.documents.isEmpty()) {
                    Text(
                        "No private documents are available for this claim. Legacy uploads require a private re-upload.",
                        color = PantopusColors.appTextSecondary,
                    )
                }
                state.error?.let { Text(it, color = PantopusColors.error, modifier = Modifier.testTag("claimEvidence_error")) }
                state.notice?.let { Text(it, color = PantopusColors.appTextSecondary) }
                if (state.retryVerification && state.preview == null) {
                    TextButton(
                        onClick = controller::verify,
                        enabled = !state.busy,
                        modifier = Modifier.testTag("claimEvidence_retryVerification"),
                    ) { Text("Retry the same verification") }
                }
                if (!state.busy && !state.retryVerification) TextButton(onClick = controller::reload) { Text("Reload documents") }
                state.documents.forEach { document ->
                    PrivateEvidenceRow(document, state, controller)
                }
                state.preview?.let { preview ->
                    Text(preview.document.fileName, color = PantopusColors.appText)
                    PrivateHomeFilePreview(
                        preview.content.bytes, preview.document.mimeType,
                        onDisplayed = { controller.previewDisplayed(preview) },
                    )
                    if (state.canVerify && preview.reviewToken != null) {
                        TextButton(
                            onClick = controller::verify,
                            enabled = !state.busy && state.previewReady,
                            modifier = Modifier.testTag("claimEvidence_verify"),
                        ) {
                            Text(if (state.retryVerification) "Retry the same verification" else "Confirm this document is valid")
                        }
                    }
                    if (!state.retryVerification) TextButton(onClick = controller::closePreview) { Text("Close document") }
                }
            }
        }
    }
}

@Composable
private fun PrivateEvidenceRow(
    document: app.pantopus.android.data.api.models.homes.HomePrivateEvidenceDto,
    state: HomePrivateEvidenceState,
    controller: HomePrivateEvidenceController,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(document.fileName, color = PantopusColors.appText)
        Text(
            if (document.state == "retired") "Removed; retained history" else document.status.replace('_', ' '),
            color = PantopusColors.appTextSecondary,
        )
        Row {
            if (document.available) {
                TextButton(
                    onClick = { controller.open(document) },
                    enabled = !state.busy && !state.retryVerification,
                    modifier = Modifier.testTag("claimEvidence_open_${document.id}"),
                ) { Text("Open document") }
            }
            if (state.canRemove && document.hasPendingRetirement()) {
                TextButton(
                    onClick = { controller.remove(document) },
                    enabled = !state.busy && !state.retryVerification,
                    modifier = Modifier.testTag("claimEvidence_remove_${document.id}"),
                ) { Text(if (document.state == "retired") "Retry cleanup" else "Remove") }
            }
        }
    }
}
