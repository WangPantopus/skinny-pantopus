package app.pantopus.android.core.network

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class HomeDocumentTemporaryFilesTest {
    @Test
    fun restartRemovesOwnedAndLegacyCopiesWithoutTouchingUnrelatedCache() {
        val cache = Files.createTempDirectory("home-document-test").toFile()
        try {
            val bytes = "private document".toByteArray()
            val export = File(HomeDocumentTemporaryFiles.makeExportDirectory(cache), "document.pdf").apply { writeBytes(bytes) }
            val preview = HomeDocumentTemporaryFiles.makePreview(cache).apply { writeBytes(bytes) }
            val unrelated = File(cache, "unrelated-cache").apply { writeBytes(bytes) }
            val legacy = File(cache, "document-export-dddddddd-dddd-4ddd-8ddd-dddddddddddd").apply { mkdir() }
            File(legacy, "old.pdf").writeBytes(bytes)
            val oldPreview = File(cache, "doc-preview-123.pdf").apply { writeBytes(bytes) }
            HomeDocumentTemporaryFiles.makeExportDirectory(cache)
            assertArrayEquals(bytes, export.readBytes())
            HomeDocumentTemporaryFiles.clearPreviousLaunch(cache)
            assertFalse(export.exists())
            assertFalse(preview.exists())
            assertFalse(legacy.exists())
            assertFalse(oldPreview.exists())
            assertArrayEquals(bytes, unrelated.readBytes())
            HomeDocumentTemporaryFiles.clearPreviousLaunch(cache)
            assertTrue(HomeDocumentTemporaryFiles.makeExportDirectory(cache).isDirectory)
        } finally {
            cache.deleteRecursively()
        }
    }
}
