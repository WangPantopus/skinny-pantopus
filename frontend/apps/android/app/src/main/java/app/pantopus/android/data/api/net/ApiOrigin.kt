package app.pantopus.android.data.api.net

import app.pantopus.android.BuildConfig
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import javax.inject.Inject

/**
 * The Pantopus API's origin (scheme, host and port of `PANTOPUS_API_BASE_URL`).
 *
 * The bearer token and the device headers go only to requests for this origin. The
 * main OkHttp client also loads every Coil image, and image URLs can name any host:
 * a chat link preview's `og:image`, a URL in a message's metadata, a storage URL.
 * Those requests go out without credentials.
 */
class ApiOrigin(private val base: HttpUrl) {
    @Inject
    constructor() : this(BuildConfig.PANTOPUS_API_BASE_URL.toHttpUrl())

    fun matches(url: HttpUrl): Boolean = url.scheme == base.scheme && url.host == base.host && url.port == base.port
}
