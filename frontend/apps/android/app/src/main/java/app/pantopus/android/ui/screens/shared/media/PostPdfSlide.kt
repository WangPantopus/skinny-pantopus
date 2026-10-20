@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.shared.media

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.TimeUnit

private val postPdfClient = OkHttpClient.Builder().callTimeout(30, TimeUnit.SECONDS).build()

/** Every page is rendered locally; no document is sent to a third-party viewer. */
@Composable
internal fun PostPdfSlide(
    url: String,
    localFile: File? = null,
) {
    val context = LocalContext.current
    val file = remember(url, localFile) { localFile ?: File(context.cacheDir, "pulse-pdf-${UUID.randomUUID()}.pdf") }
    var pages by remember(url) { mutableIntStateOf(0) }
    var page by remember(url) { mutableIntStateOf(0) }
    var bitmap by remember(url) { mutableStateOf<Bitmap?>(null) }
    var failed by remember(url) { mutableStateOf(false) }
    var attempt by remember(url) { mutableIntStateOf(0) }
    var scale by remember(page) { mutableStateOf(1f) }
    var offset by remember(page) { mutableStateOf(Offset.Zero) }

    DisposableEffect(file) { onDispose { if (localFile == null) file.delete() } }
    LaunchedEffect(url, attempt) {
        failed = false
        pages = 0
        try {
            pages =
                withContext(Dispatchers.IO) {
                    if (localFile == null) {
                        downloadPdf(url, file)
                    } else {
                        require(file.length() <= 25 * 1024 * 1024)
                        PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)).use {
                            require(it.pageCount > 0)
                            it.pageCount
                        }
                    }
                }
        } catch (cancelled: CancellationException) {
            if (localFile == null) file.delete()
            throw cancelled
        } catch (_: Exception) {
            failed = true
        }
    }
    LaunchedEffect(pages, page) {
        bitmap = null
        if (pages == 0) return@LaunchedEffect
        try {
            bitmap =
                withContext(Dispatchers.IO) {
                    PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)).use { renderer ->
                        renderer.openPage(page).use { pdfPage ->
                            val width = 1400
                            val height = (width.toFloat() * pdfPage.height / pdfPage.width).toInt().coerceIn(1, 4000)
                            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also {
                                it.eraseColor(android.graphics.Color.WHITE)
                                pdfPage.render(it, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                            }
                        }
                    }
                }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            failed = true
        }
    }
    Column(Modifier.fillMaxSize().padding(top = 64.dp, bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.weight(1f).clipToBounds(), contentAlignment = Alignment.Center) {
            when {
                failed ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Couldn't open this PDF.", color = Color.White)
                        Button(onClick = { attempt += 1 }) { Text("Try again") }
                    }
                bitmap != null ->
                    Image(
                        bitmap = checkNotNull(bitmap).asImageBitmap(),
                        contentDescription = "PDF page ${page + 1} of $pages. Pinch to zoom.",
                        modifier =
                            Modifier.fillMaxSize().pointerInput(page) {
                                detectTransformGestures { _, pan, zoom, _ ->
                                    scale = (scale * zoom).coerceIn(1f, 5f)
                                    offset = if (scale == 1f) Offset.Zero else offset + pan
                                }
                            }.graphicsLayer(scaleX = scale, scaleY = scale, translationX = offset.x, translationY = offset.y),
                    )
                else -> CircularProgressIndicator(color = Color.White)
            }
        }
        if (pages > 0 && !failed) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = { page -= 1 }, enabled = page > 0) { Text("Previous") }
                Text("${page + 1} / $pages", color = Color.White)
                Button(onClick = { page += 1 }, enabled = page + 1 < pages) { Text("Next") }
            }
        }
    }
}

private fun downloadPdf(
    url: String,
    file: File,
): Int {
    val request = Request.Builder().url(url).build()
    postPdfClient.newCall(request).execute().use { response ->
        check(response.isSuccessful)
        val body = checkNotNull(response.body)
        require(body.contentLength() <= 25 * 1024 * 1024)
        body.byteStream().use { input ->
            file.outputStream().use { output ->
                copyPdf(input, output)
            }
        }
    }
    return PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)).use {
        require(it.pageCount > 0)
        it.pageCount
    }
}

private fun copyPdf(
    input: InputStream,
    output: OutputStream,
) {
    val buffer = ByteArray(8192)
    var total = 0
    while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        total += count
        require(total <= 25 * 1024 * 1024)
        output.write(buffer, 0, count)
    }
}
