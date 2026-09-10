@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.homes.claim_evidence

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.SecureFlagPolicy
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.max

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
                    PrivateDocumentPreview(preview, onDisplayed = { controller.previewDisplayed(preview) })
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

private data class EvidencePage(val bitmap: Bitmap?, val text: String?, val pageCount: Int)

@Composable
private fun PrivateDocumentPreview(
    preview: HomeEvidencePreview,
    onDisplayed: () -> Unit,
) {
    val context = LocalContext.current
    var page by remember(preview) { mutableStateOf(0) }
    var rendered by remember(preview) { mutableStateOf<EvidencePage?>(null) }
    var error by remember(preview) { mutableStateOf<String?>(null) }
    LaunchedEffect(preview, page) {
        // Compose may still draw the previous frame; release our reference without recycling its bitmap.
        rendered = null
        error = null
        try {
            rendered = withContext(Dispatchers.IO) { renderEvidence(context, preview, page) }
            onDisplayed()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            error = "Could not display this document. Close it and retry."
        }
    }
    error?.let { Text(it, color = PantopusColors.error) }
    rendered?.let { value ->
        value.bitmap?.let {
            Image(
                it.asImageBitmap(),
                contentDescription = "Private document page ${page + 1}",
                modifier = Modifier.fillMaxWidth(),
                contentScale = ContentScale.FillWidth,
            )
        }
        value.text?.let { Text(it, color = PantopusColors.appText, modifier = Modifier.testTag("claimEvidence_text")) }
        if (value.pageCount > 1) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                TextButton(onClick = { page -= 1 }, enabled = page > 0) { Text("Previous") }
                Text("${page + 1} / ${value.pageCount}", color = PantopusColors.appTextSecondary)
                TextButton(onClick = { page += 1 }, enabled = page + 1 < value.pageCount) { Text("Next") }
            }
        }
    }
}

private fun renderEvidence(
    context: Context,
    preview: HomeEvidencePreview,
    index: Int,
): EvidencePage {
    val bytes = preview.content.bytes
    if (preview.document.mimeType == "text/plain") {
        val text = bytes.toString(Charsets.UTF_8)
        val pages = max(1, (text.length + 14999) / 15000)
        return EvidencePage(null, text.substring(index * 15000, minOf(text.length, (index + 1) * 15000)), pages)
    }
    if (preview.document.mimeType == "application/pdf") return renderPdfEvidence(context, bytes, index)
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    require(options.outWidth > 0 && options.outHeight > 0)
    var sample = 1
    while (max(options.outWidth, options.outHeight) / sample > 1600) sample *= 2
    options.inJustDecodeBounds = false
    options.inSampleSize = sample
    return EvidencePage(requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)), null, 1)
}

private fun renderPdfEvidence(
    context: Context,
    bytes: ByteArray,
    index: Int,
): EvidencePage {
    val temporary = File.createTempFile("private-claim-", ".pdf", context.cacheDir)
    try {
        temporary.writeBytes(bytes)
        ParcelFileDescriptor.open(temporary, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
            return renderPdfDescriptor(descriptor, index)
        }
    } finally {
        check(temporary.delete() || !temporary.exists()) { "Could not clear the temporary document preview." }
    }
}

private fun renderPdfDescriptor(
    descriptor: ParcelFileDescriptor,
    index: Int,
): EvidencePage =
    PdfRenderer(descriptor).use { pdf ->
        require(index < pdf.pageCount)
        val bitmap = pdf.openPage(index).use { renderPdfPage(it) }
        EvidencePage(bitmap, null, pdf.pageCount)
    }

private fun renderPdfPage(page: PdfRenderer.Page): Bitmap {
    val scale = minOf(1f, 1600f / max(page.width, page.height))
    val bitmap =
        Bitmap.createBitmap(
            max(1, (page.width * scale).toInt()),
            max(1, (page.height * scale).toInt()),
            Bitmap.Config.ARGB_8888,
        )
    var rendered = false
    try {
        bitmap.eraseColor(android.graphics.Color.WHITE)
        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
        rendered = true
        return bitmap
    } finally {
        // Only this failed, unpublished bitmap is safe to recycle.
        if (!rendered) bitmap.recycle()
    }
}
