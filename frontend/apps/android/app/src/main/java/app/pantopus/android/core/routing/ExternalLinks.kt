package app.pantopus.android.core.routing

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import timber.log.Timber

/**
 * Addresses other people or outside sources set — a Beacon link, a carrier's tracking page, certified-mail terms, a
 * representative's website — open only as web pages. A VIEW intent for any other scheme launches whatever handles it:
 * the dialer for `tel:`, another app for its scheme, or one of this app's own `pantopus://` routes. One that nothing
 * handles threw [ActivityNotFoundException], which crashed the package card.
 */
object ExternalLinks {
    /** [raw] as an http(s) address with a host, else null. */
    fun webUri(raw: String?): Uri? {
        val uri = raw?.trim()?.takeIf { it.isNotEmpty() }?.let { Uri.parse(it).normalizeScheme() } ?: return null
        return uri.takeIf { (it.scheme == "https" || it.scheme == "http") && !it.host.isNullOrEmpty() }
    }

    /** Whether [raw] is an http(s) address with a host. */
    fun isWeb(raw: String?): Boolean = webUri(raw) != null

    /** Opens [raw] in the browser when it is a web address, and does nothing otherwise. */
    fun open(
        context: Context,
        raw: String?,
    ) {
        val uri = webUri(raw) ?: return
        val intent =
            Intent(Intent.ACTION_VIEW, uri)
                .addCategory(Intent.CATEGORY_BROWSABLE)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            Timber.w(e, "No app could open a web link")
        }
    }
}
