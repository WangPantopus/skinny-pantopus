@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.documents

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * T6.4b — Per-MIME-type visual tokens for the DocumentsScreen row's
 * leading tile. Lifted from `docs-frames.jsx:54-62`. Documented
 * exception to the no-hex rule (palette file, per Android `CLAUDE.md`).
 *
 * Inferred client-side from `HomeDocument.mime_type` because the
 * backend stores the raw MIME string with no normalised file-type
 * column — mirrors the Bills `UtilityCategory.from(payee:)` pattern.
 */
enum class DocumentFileType(
    val id: String,
    val stamp: String,
    val icon: PantopusIcon,
    val background: Color,
    val foreground: Color,
) {
    Pdf(
        id = "pdf",
        stamp = "PDF",
        icon = PantopusIcon.FileText,
        background = Color(0xFFFEE2E2),
        foreground = Color(0xFFB91C1C),
    ),
    Image(
        id = "image",
        stamp = "JPG",
        icon = PantopusIcon.Image,
        background = Color(0xFFDBEAFE),
        foreground = Color(0xFF1D4ED8),
    ),
    Doc(
        id = "doc",
        stamp = "DOC",
        icon = PantopusIcon.FileType,
        background = Color(0xFFE0E7FF),
        foreground = Color(0xFF4338CA),
    ),
    Sheet(
        id = "sheet",
        stamp = "XLS",
        icon = PantopusIcon.FileSpreadsheet,
        background = Color(0xFFDCFCE7),
        foreground = Color(0xFF15803D),
    ),
    Archive(
        id = "archive",
        stamp = "ZIP",
        icon = PantopusIcon.Archive,
        background = Color(0xFFE2E8F0),
        foreground = Color(0xFF334155),
    ),
    Scan(
        id = "scan",
        stamp = "PDF",
        icon = PantopusIcon.ScanLine,
        background = Color(0xFFEDE9FE),
        foreground = Color(0xFF6D28D9),
    ),
    ;

    companion object {
        /**
         * Infer the file-type bucket from a backend `mime_type` string,
         * falling back to the filename extension when the MIME is empty
         * or generic (e.g. `application/octet-stream`). Defaults to
         * [Pdf] for unknown inputs because PDFs dominate the populated
         * design and red is the most legible fallback.
         */
        fun fromMime(
            mimeType: String?,
            filename: String? = null,
        ): DocumentFileType =
            bucketForMime(mimeType?.lowercase().orEmpty())
                ?: bucketForExtension(filename)

        private fun bucketForMime(mime: String): DocumentFileType? =
            when {
                mime.isEmpty() || mime == "application/octet-stream" -> null
                mime == "application/pdf" -> Pdf
                mime.startsWith("image/") -> Image
                isDocumentMime(mime) -> Doc
                isSheetMime(mime) -> Sheet
                isArchiveMime(mime) -> Archive
                else -> null
            }

        private fun bucketForExtension(filename: String?): DocumentFileType =
            when ((filename ?: "").lowercase().substringAfterLast('.', "")) {
                "pdf" -> Pdf
                "jpg", "jpeg", "png", "gif", "heic", "webp", "tiff" -> Image
                "doc", "docx", "odt", "rtf", "txt" -> Doc
                "xls", "xlsx", "csv", "ods", "numbers" -> Sheet
                "zip", "tar", "gz", "rar", "7z" -> Archive
                else -> Pdf
            }

        private fun isDocumentMime(mime: String): Boolean =
            mime in documentMimes ||
                mime.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml")

        private fun isSheetMime(mime: String): Boolean =
            mime in sheetMimes ||
                mime.startsWith("application/vnd.openxmlformats-officedocument.spreadsheetml")

        private fun isArchiveMime(mime: String): Boolean = mime in archiveMimes

        private val documentMimes =
            setOf(
                "application/msword",
                "application/vnd.oasis.opendocument.text",
            )

        private val sheetMimes =
            setOf(
                "application/vnd.ms-excel",
                "text/csv",
                "application/vnd.oasis.opendocument.spreadsheet",
            )

        private val archiveMimes =
            setOf(
                "application/zip",
                "application/x-zip-compressed",
                "application/x-tar",
                "application/x-gzip",
            )
    }
}
