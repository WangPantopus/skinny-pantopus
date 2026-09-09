package app.pantopus.android.core.network

import java.io.File
import java.io.IOException
import java.util.UUID

/** Keep private previews/exports for this process; background sharing stays valid. */
object HomeDocumentTemporaryFiles {
    private fun root(cacheDirectory: File) = File(cacheDirectory, "home-document-files")

    fun clearPreviousLaunch(cacheDirectory: File) {
        root(cacheDirectory).deleteRecursively()
        // These exact prefixes belonged to the previous Home document renderer.
        cacheDirectory.listFiles()?.filter {
            it.name.matches(Regex("document-export-[0-9a-fA-F-]{36}")) ||
                (it.isFile && it.name.startsWith("doc-preview-") && it.extension == "pdf")
        }?.forEach { it.deleteRecursively() }
    }

    fun makeExportDirectory(cacheDirectory: File): File {
        val directory = File(root(cacheDirectory), UUID.randomUUID().toString())
        if (!directory.mkdirs()) throw IOException("Could not create document directory")
        return directory
    }

    fun makePreview(cacheDirectory: File): File {
        val directory = root(cacheDirectory)
        if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Could not create document directory")
        return File.createTempFile("preview-", ".pdf", directory)
    }
}
