@file:Suppress("PackageNaming")

package app.pantopus.android.core.routing

import android.content.Context
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import timber.log.Timber
import java.net.URLDecoder

/**
 * A link tapped before Pantopus was installed opens its web page, and Google Play opens the new app on its
 * first screen. The page's Google Play buttons put the link in the install referrer (web `playStoreUrlCarrying`,
 * `pantopus_link=<path>`). On the first launch after the install the app reads it once, on the device, and
 * opens it as if it had been tapped: a friend's invite opens Create account with its code, and anything else
 * waits for sign-in. iOS has no install referrer: the iPhone app offers the link the page copied back with a
 * Paste button (`InstallLinkPasteCard.swift`).
 */
object InstallReferrerLink {
    private const val PREFS = "pantopus_install_referrer"
    private const val KEY_DONE = "read"
    private const val PARAM = "pantopus_link"
    private const val MAX_PATH_LENGTH = 512

    /**
     * Reads Google Play's referrer once per install; later launches do nothing. A launch from a link marks it
     * read without opening it, so the tapped link wins. In debug builds [debugReferrer] stands in for Google
     * Play's answer, since a build installed from a computer has none.
     */
    fun openOnce(
        context: Context,
        launchedFromLink: Boolean,
        debugReferrer: String? = null,
    ) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_DONE, false)) return
        val markRead = { prefs.edit().putBoolean(KEY_DONE, true).apply() }
        when {
            launchedFromLink -> markRead()
            debugReferrer != null -> {
                markRead()
                open(debugReferrer)
            }
            else -> askGooglePlay(context, markRead)
        }
    }

    private fun askGooglePlay(
        context: Context,
        markRead: () -> Unit,
    ) {
        val client = InstallReferrerClient.newBuilder(context.applicationContext).build()
        val listener =
            object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) {
                    when (responseCode) {
                        InstallReferrerClient.InstallReferrerResponse.OK -> {
                            val referrer = runCatching { client.installReferrer.installReferrer }.getOrNull()
                            markRead()
                            open(referrer)
                        }
                        // Not installed by Google Play, or a Play Store that can't say: nothing will come.
                        InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED,
                        InstallReferrerClient.InstallReferrerResponse.DEVELOPER_ERROR,
                        -> markRead()
                        // Google Play is busy or updating: ask again on the next launch.
                        else -> Timber.i("Install referrer unavailable (%d)", responseCode)
                    }
                    runCatching { client.endConnection() }
                }

                override fun onInstallReferrerServiceDisconnected() = Unit
            }
        runCatching { client.startConnection(listener) }
            .onFailure { Timber.i(it, "Install referrer: no Google Play connection") }
    }

    /** Opens the link a referrer carries, through the same router as a tapped link; anything else is ignored. */
    internal fun open(referrer: String?) {
        val path = linkPath(referrer) ?: return
        DeepLinkRouter.handle(path)
    }

    /**
     * `pantopus_link=%2Fjoin%2Fabc` → `/join/abc`. Only a path on Pantopus's own site is taken (never another
     * host or scheme); an organic install's `utm_source=google-play&utm_medium=organic` carries none.
     */
    internal fun linkPath(referrer: String?): String? {
        if (referrer.isNullOrBlank()) return null
        // Google Play decodes the store address's referrer once; take an undecoded one too.
        val text = if ("$PARAM=" in referrer) referrer else decode(referrer).orEmpty()
        return text
            .split('&')
            .firstNotNullOfOrNull { part -> part.substringBefore('=').takeIf { it == PARAM }?.let { part.substringAfter('=') } }
            ?.let(::decode)
            ?.takeIf { it.startsWith("/") && !it.startsWith("//") && it.length <= MAX_PATH_LENGTH }
    }

    private fun decode(value: String): String? = runCatching { URLDecoder.decode(value, "UTF-8") }.getOrNull()
}
