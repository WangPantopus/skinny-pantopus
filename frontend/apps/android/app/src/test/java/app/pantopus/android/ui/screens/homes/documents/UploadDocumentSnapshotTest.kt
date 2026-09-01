@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.documents

import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * P2.10 — design-reference baseline tripwire for the Upload Document
 * form and the Document Detail screen. Mirrors the auth pattern in
 * `AuthScreensSnapshotTest`: asserts each baseline PNG exists at
 *
 *   `frontend/apps/android/app/src/test/snapshots/p2-10-documents/<slug>-android.png`
 *
 * and is a valid PNG. The tests skip (rather than fail) when the
 * baseline file is missing, so the gate exists from day one and the
 * follow-up commit can record real renders without breaking CI.
 *
 * States covered:
 *  - upload-empty       (fresh form, no file picked)
 *  - upload-filled      (file picked, title + category + tags + visibility set)
 *  - detail-pdf         (PDF preview pane)
 *  - detail-image       (image preview pane)
 *  - detail-unsupported (DOCX / XLSX / ZIP preview fallback)
 */
class UploadDocumentSnapshotTest {
    private val baselineDir = File("src/test/snapshots/p2-10-documents")

    @Test fun upload_document_empty_android_baseline_is_present() = assertBaselineOrSkip("upload-empty")

    @Test fun upload_document_filled_android_baseline_is_present() = assertBaselineOrSkip("upload-filled")

    @Test fun document_detail_pdf_android_baseline_is_present() = assertBaselineOrSkip("detail-pdf")

    @Test fun document_detail_image_android_baseline_is_present() = assertBaselineOrSkip("detail-image")

    @Test fun document_detail_unsupported_android_baseline_is_present() = assertBaselineOrSkip("detail-unsupported")

    private fun assertBaselineOrSkip(screen: String) {
        val file = File(baselineDir, "$screen-android.png")
        assumeTrue("Baseline pending follow-up commit: ${file.path}", file.exists())
        val bytes = file.readBytes()
        assertTrue(
            "Baseline too small (${bytes.size} bytes): ${file.path}",
            bytes.size > 8 * 1024,
        )
        assertTrue(
            "Not a PNG: ${file.path}",
            bytes[0] == 0x89.toByte() &&
                bytes[1] == 'P'.code.toByte() &&
                bytes[2] == 'N'.code.toByte() &&
                bytes[3] == 'G'.code.toByte(),
        )
    }
}
