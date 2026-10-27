package app.pantopus.android.data.mailbox

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * A mail enclosure opened on this phone (SRV-4): fetched from its five-minute signed link into a folder of its own in
 * the cache, which the viewer app reads through the FileProvider (`mail-enclosures/`). Removed at sign-out.
 */
object MailEnclosureFiles {
    private const val FOLDER = "mail-enclosures"
    private const val TIMEOUT_SECONDS = 60L

    /** The link is signed: no Pantopus session goes with it, so a plain client fetches it. */
    private val client by lazy { OkHttpClient.Builder().callTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS).build() }

    /** What fetching a link came to. */
    sealed interface Fetch {
        data class Saved(val file: File) : Fetch

        /** Storage refused the link (it expired): ask the server for a new one. */
        data object Expired : Fetch

        data object Failed : Fetch
    }

    fun folder(cacheDir: File) = File(cacheDir, FOLDER)

    /** Saves the enclosure behind [url] as [name] in a fresh folder. */
    suspend fun fetch(
        cacheDir: File,
        url: String,
        name: String,
    ): Fetch =
        withContext(Dispatchers.IO) {
            try {
                client.newCall(Request.Builder().url(url).build()).execute().use { response ->
                    when {
                        response.code == HTTP_BAD_REQUEST || response.code == HTTP_FORBIDDEN -> Fetch.Expired
                        !response.isSuccessful -> Fetch.Failed
                        else -> {
                            val dir = File(folder(cacheDir), UUID.randomUUID().toString()).apply { mkdirs() }
                            val file = File(dir, safeName(name))
                            val body = response.body ?: return@use Fetch.Failed
                            body.byteStream().use { input -> file.outputStream().use { input.copyTo(it) } }
                            Fetch.Saved(file)
                        }
                    }
                }
            } catch (_: IOException) {
                Fetch.Failed
            } catch (_: IllegalArgumentException) {
                Fetch.Failed
            }
        }

    /** At sign-out: every enclosure this account opened. */
    fun remove(cacheDir: File) {
        folder(cacheDir).deleteRecursively()
    }

    private fun safeName(name: String): String =
        File(name).name.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(MAX_NAME).ifBlank { "enclosure" }

    private const val MAX_NAME = 100

    /** What storage answers for a signed link that expired. */
    private const val HTTP_BAD_REQUEST = 400
    private const val HTTP_FORBIDDEN = 403
}
