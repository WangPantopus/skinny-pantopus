package app.pantopus.android.core.routing

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import androidx.browser.customtabs.CustomTabsIntent
import timber.log.Timber

/**
 * pantopus.com links the app has no screen for open in the browser.
 *
 * The manifest's App Links filter claims every path on pantopus.com (and on the pantopus.app
 * hosts whose links are still in circulation), but the web also serves pages the app doesn't
 * have: a letter's claim page (`/open/<id>`), guest passes, the postcard opt-out
 * (`/no-mail/<code>`), fridge cards, and the status and verification pages. [DeepLinkRouter]
 * resolves those to [DeepLinkRouter.Destination.Unknown] and discards them, so a tap opened the
 * app and left the person where they were. iOS needs no counterpart: its
 * apple-app-site-association lists only the paths the app opens.
 */
object WebLinkFallback {
    /** The https hosts of the manifest's App Links filters. */
    private val HOSTS = setOf("pantopus.com", "www.pantopus.com", "pantopus.app", "www.pantopus.app")

    /** Arrivals of one link this close together ([SystemClock.elapsedRealtime]) count as one run. */
    private const val RUN_WINDOW_MS = 3_000L

    /**
     * How often one link is handed off in a run. A second tap during a slow start makes a run of two and still
     * opens; past this, the arrival is a browser passing the link straight back, and it is dropped.
     */
    private const val MAX_RUN = 3

    private class Handoff(val link: String, val at: Long, val run: Int)

    @Volatile
    private var lastHandoff: Handoff? = null

    /** True when [uri] is a link on those hosts that [DeepLinkRouter] has no destination for. */
    fun isWebOnly(uri: Uri): Boolean =
        uri.scheme.equals("https", ignoreCase = true) &&
            uri.host?.lowercase() in HOSTS &&
            DeepLinkRouter.resolve(uri) is DeepLinkRouter.Destination.Unknown

    /**
     * Shows [uri] in a Custom Tab of the person's browser.
     *
     * The app handles these hosts, so a plain VIEW intent for the link would resolve straight back
     * to MainActivity. The selector, an https address with no host (the probe Android itself uses
     * to find browsers), matches browsers only, so the system picks the default browser, and the
     * tab keeps the link instead of sending it on to the app that handles it. Should a browser
     * keep passing it back anyway, [MAX_RUN] stops the loop.
     */
    fun open(
        context: Context,
        uri: Uri,
    ) {
        val link = uri.toString()
        val now = SystemClock.elapsedRealtime()
        val run = lastHandoff?.takeIf { it.link == link && now - it.at < RUN_WINDOW_MS }?.run ?: 0
        if (run >= MAX_RUN) {
            Timber.w("A web-only link keeps coming back from the browser; not opening it again")
            return
        }
        lastHandoff = Handoff(link, now, run + 1)
        val tab =
            CustomTabsIntent.Builder()
                .setShowTitle(true)
                .setSendToExternalDefaultHandlerEnabled(false)
                .build()
        tab.intent.selector =
            Intent(Intent.ACTION_VIEW, Uri.fromParts("https", "", null)).addCategory(Intent.CATEGORY_BROWSABLE)
        runCatching { tab.launchUrl(context, uri) }
            .onFailure { Timber.w(it, "No browser could open a web-only link") }
    }
}
