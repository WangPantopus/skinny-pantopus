package app.pantopus.android.ui.screens.homes.tasks

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import app.pantopus.android.data.homes.HOME_EVIDENCE_MIMES
import app.pantopus.android.data.homes.readHomeEvidenceBytes
import app.pantopus.android.data.homes.readPrivateHomeMedia

internal data class HomeTaskMediaPicker(val name: String, val mimeType: String, val bytes: ByteArray)

internal suspend fun readTaskMediaSelection(
    context: Context,
    uri: Uri,
): HomeTaskMediaPicker =
    readPrivateHomeMedia(
        erase = { content: HomeTaskMediaPicker -> content.bytes.fill(0) },
    ) {
        val resolver = context.contentResolver
        val mime = resolver.getType(uri).orEmpty()
        require(mime in HOME_EVIDENCE_MIMES) { "Choose a PDF, text file or supported image." }
        val name =
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }?.takeIf(String::isNotBlank) ?: "Attachment"
        val bytes = requireNotNull(resolver.openInputStream(uri)).use(::readHomeEvidenceBytes)
        require(bytes.isNotEmpty()) { "Choose a file with content." }
        HomeTaskMediaPicker(name, mime, bytes)
    }
