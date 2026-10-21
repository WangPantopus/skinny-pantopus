package app.pantopus.android.data.ai

import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.IOException

/**
 * What the assistant can read from a PDF (AI assistant phase 2 contract §7.1, `POST /api/upload/ai-media`): up to
 * 10 MB and 20 pages, readable and without a password. A PDF is checked on the phone before it is queued, with the
 * server's own wording, so a refusal comes at once instead of after the upload.
 */
internal object AIPdfCheck {
    const val MAX_BYTES = 10 * 1024 * 1024
    private const val MAX_PAGES = 20

    const val TOO_LARGE = "That PDF is over 10 MB. Try a smaller one, or photos of the pages that matter."
    private const val UNREADABLE = "That PDF can't be read. Try saving it again as a PDF, or send photos of the pages."
    private const val ENCRYPTED = "That PDF is password-protected. Send a copy without a password, or photos of the pages."

    private fun tooManyPages(pages: Int) = "That PDF has $pages pages; the assistant reads up to $MAX_PAGES. Send the pages that matter."

    /** Why the assistant can't take [bytes] (a PDF), or null when it can. [scratch] holds a copy while it is opened. */
    fun problem(
        bytes: ByteArray,
        scratch: File,
    ): String? {
        if (bytes.size > MAX_BYTES) return TOO_LARGE
        // Without room for the copy the phone can't tell; the server checks again.
        val copy = runCatching { File.createTempFile("ai-pdf-check", ".pdf", scratch) }.getOrNull() ?: return null
        return try {
            copy.writeBytes(bytes)
            ParcelFileDescriptor.open(copy, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
                PdfRenderer(descriptor).use { renderer -> renderer.pageCount.takeIf { it > MAX_PAGES }?.let(::tooManyPages) }
            }
        } catch (_: SecurityException) {
            // PdfRenderer refuses a document that needs a password.
            ENCRYPTED
        } catch (_: IOException) {
            UNREADABLE
        } finally {
            copy.delete()
        }
    }
}
