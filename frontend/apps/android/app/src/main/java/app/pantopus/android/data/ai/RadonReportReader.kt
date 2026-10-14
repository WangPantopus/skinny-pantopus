package app.pantopus.android.data.ai

import android.content.Context
import android.net.Uri
import app.pantopus.android.data.api.models.ai.AIRadonReportResultDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.compose.listing.ListingPhotoProcessor
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.InputStream
import javax.inject.Inject
import javax.inject.Singleton

/** What reading a radon lab report found, for the radon sheet to fill in. */
sealed interface RadonReportReading {
    data class Read(
        val result: AIRadonReportResultDto,
        val note: String?,
    ) : RadonReportReading

    /** [message] is for the person: the server's own sentence when it gave one. */
    data class Failed(
        val message: String,
    ) : RadonReportReading
}

/**
 * "Read a lab report" in the Today radon sheet. A PDF goes as it is and a photo as a JPEG without its
 * EXIF, to `POST /api/ai/draft/radon-result`, which reads it in memory and keeps nothing. Nothing is
 * saved here; the sheet's Save records the answer. Mirrors iOS `RadonTodayState.readReport`.
 */
@Singleton
class RadonReportReader
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val uploads: UploadRepository,
    ) {
        suspend fun read(report: Uri): RadonReportReading {
            val file =
                withContext(Dispatchers.IO) { reportFile(report) }
                    ?: return RadonReportReading.Failed("Couldn't open that file. Choose a photo, or a PDF of 10 MB or less.")
            return when (val result = uploads.readRadonReport(file)) {
                is NetworkResult.Success -> RadonReportReading.Read(result.data.result, result.data.note)
                is NetworkResult.Failure -> RadonReportReading.Failed(result.error.readerMessage())
            }
        }

        private fun reportFile(report: Uri): UploadFile? {
            val bytes =
                runCatching { context.contentResolver.openInputStream(report)?.use { it.readAtMost(MAX_READ_BYTES) } }
                    .getOrNull() ?: return null
            val pdf = bytes.size >= PDF_MAGIC.size && bytes.copyOfRange(0, PDF_MAGIC.size).contentEquals(PDF_MAGIC)
            return when {
                pdf && bytes.size <= MAX_PDF_BYTES -> UploadFile("radon-report.pdf", "application/pdf", bytes)
                pdf -> null
                else -> ListingPhotoProcessor.uploadData(bytes)?.let { UploadFile("radon-report.jpg", "image/jpeg", it) }
            }
        }

        private companion object {
            val PDF_MAGIC = "%PDF-".toByteArray(Charsets.US_ASCII)

            /** The reader takes PDFs of up to 10 MB (`radonReport.MAX_REPORT_BYTES`). */
            const val MAX_PDF_BYTES = 10 * 1024 * 1024

            /** A phone photo is a few MB; anything past this isn't read whole. */
            const val MAX_READ_BYTES = 25 * 1024 * 1024
        }
    }

/** The stream's bytes, or null when there are more than [limit]. */
private fun InputStream.readAtMost(limit: Int): ByteArray? {
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    var count = read(buffer)
    while (count >= 0 && out.size() <= limit) {
        out.write(buffer, 0, count)
        count = read(buffer)
    }
    return out.toByteArray().takeIf { it.size <= limit }
}
