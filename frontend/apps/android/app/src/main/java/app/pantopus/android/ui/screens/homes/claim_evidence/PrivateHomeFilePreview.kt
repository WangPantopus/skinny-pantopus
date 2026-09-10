@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_evidence

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import app.pantopus.android.data.homes.readPrivateHomeMedia
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.CancellationException
import java.io.File
import kotlin.math.max

private data class PrivateFilePage(val bitmap: Bitmap?, val text: String?, val pageCount: Int)

private const val TEXT_PAGE_LENGTH = 15_000
private const val PREVIEW_IMAGE_EDGE = 1600

@Composable
fun PrivateHomeFilePreview(
    bytes: ByteArray,
    mimeType: String,
    onDisplayed: () -> Unit = {},
) {
    val context = LocalContext.current
    var page by remember(bytes, mimeType) { mutableStateOf(0) }
    var rendered by remember(bytes, mimeType) { mutableStateOf<PrivateFilePage?>(null) }
    var error by remember(bytes, mimeType) { mutableStateOf<String?>(null) }
    LaunchedEffect(bytes, mimeType, page) {
        // Compose may still draw the previous frame; release our reference without recycling its bitmap.
        rendered = null
        error = null
        try {
            rendered =
                readPrivateHomeMedia(erase = { result: PrivateFilePage -> result.bitmap?.recycle() }) {
                    renderEvidence(context, bytes, mimeType, page)
                }
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
    bytes: ByteArray,
    mimeType: String,
    index: Int,
): PrivateFilePage {
    if (mimeType == "text/plain") {
        val text = bytes.toString(Charsets.UTF_8)
        val pages = max(1, (text.length + TEXT_PAGE_LENGTH - 1) / TEXT_PAGE_LENGTH)
        return PrivateFilePage(null, text.substring(index * TEXT_PAGE_LENGTH, minOf(text.length, (index + 1) * TEXT_PAGE_LENGTH)), pages)
    }
    if (mimeType == "application/pdf") return renderPdfEvidence(context, bytes, index)
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    require(options.outWidth > 0 && options.outHeight > 0)
    var sample = 1
    while (max(options.outWidth, options.outHeight) / sample > PREVIEW_IMAGE_EDGE) sample *= 2
    options.inJustDecodeBounds = false
    options.inSampleSize = sample
    return PrivateFilePage(requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)), null, 1)
}

private fun renderPdfEvidence(
    context: Context,
    bytes: ByteArray,
    index: Int,
): PrivateFilePage {
    val temporary = File.createTempFile("private-claim-", ".pdf", context.cacheDir)
    try {
        ParcelFileDescriptor.open(temporary, ParcelFileDescriptor.MODE_READ_WRITE).use { descriptor ->
            // Unlink the empty file before writing private data. The descriptor
            // remains seekable for PdfRenderer and is reclaimed on process death.
            check(temporary.delete()) { "Could not protect the temporary document preview." }
            ParcelFileDescriptor.AutoCloseOutputStream(ParcelFileDescriptor.dup(descriptor.fileDescriptor)).use {
                it.write(bytes)
            }
            return renderPdfDescriptor(descriptor, index)
        }
    } finally {
        check(temporary.delete() || !temporary.exists()) { "Could not clear the temporary document preview." }
    }
}

private fun renderPdfDescriptor(
    descriptor: ParcelFileDescriptor,
    index: Int,
): PrivateFilePage =
    PdfRenderer(descriptor).use { pdf ->
        require(index < pdf.pageCount)
        val bitmap = pdf.openPage(index).use { renderPdfPage(it) }
        PrivateFilePage(bitmap, null, pdf.pageCount)
    }

private fun renderPdfPage(page: PdfRenderer.Page): Bitmap {
    val scale = minOf(1f, PREVIEW_IMAGE_EDGE.toFloat() / max(page.width, page.height))
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
