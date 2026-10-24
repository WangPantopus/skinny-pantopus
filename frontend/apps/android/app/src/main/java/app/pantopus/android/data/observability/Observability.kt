package app.pantopus.android.data.observability

import android.content.Context
import android.os.Build
import app.pantopus.android.BuildConfig
import io.sentry.Breadcrumb
import io.sentry.Sentry
import io.sentry.SentryEvent
import io.sentry.SentryLevel
import io.sentry.SentryOptions
import io.sentry.android.core.SentryAndroid
import io.sentry.android.okhttp.SentryOkHttpInterceptor
import io.sentry.android.timber.SentryTimberIntegration
import io.sentry.protocol.User
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single entry point for crash reporting, error capture, and analytics.
 *
 * Call [start] from [app.pantopus.android.PantopusApplication.onCreate]; every other
 * piece of the app goes through this class so the underlying backend (Sentry, Firebase, …)
 * can be swapped without touching call sites.
 *
 * DSN comes from `BuildConfig.SENTRY_DSN` — if empty, Sentry is not initialised and
 * everything no-ops (useful for local dev and CI).
 */
@Singleton
class Observability
    @Inject
    constructor() {
        private var started = false

        fun start(context: Context) {
            if (started) return
            started = true

            val dsn = BuildConfig.SENTRY_DSN
            if (dsn.isBlank()) {
                Timber.i("Sentry DSN not set — crash reporting disabled")
                return
            }

            SentryAndroid.init(context) { options ->
                options.dsn = dsn
                options.environment = BuildConfig.PANTOPUS_ENV
                options.release = "app.pantopus.android@${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}"
                options.isEnableAutoSessionTracking = true
                options.tracesSampleRate = if (BuildConfig.PANTOPUS_ENV == "production") 0.1 else 1.0
                options.isAttachScreenshot = false
                options.isAttachViewHierarchy = false
                options.isSendDefaultPii = false
                // The OkHttp interceptor adds sentry-trace and baggage (trace id, release, environment, Sentry key)
                // to every request whose URL matches a target, and the default target matches all of them: Coil's
                // images from any host too. Only the API gets them.
                options.setTracePropagationTargets(tracePropagationTargets(BuildConfig.PANTOPUS_API_BASE_URL))

                // P15: scrub PII from every event + breadcrumb before send.
                options.beforeSend =
                    SentryOptions.BeforeSendCallback { event, _ ->
                        // A link the server couldn't preview answers 502, which is routine.
                        if (isLinkPreview(event.request?.url)) return@BeforeSendCallback null
                        scrubPII(event)
                        event
                    }
                options.beforeBreadcrumb =
                    SentryOptions.BeforeBreadcrumbCallback { breadcrumb, _ ->
                        scrubPII(breadcrumb)
                        breadcrumb
                    }
                options.beforeSendTransaction =
                    SentryOptions.BeforeSendTransactionCallback { transaction, _ ->
                        transaction.spans.forEach { span -> span.data = span.data?.filterKeys { it !in URL_QUERY_KEYS } }
                        transaction.breadcrumbs?.forEach { scrubPII(it) }
                        transaction
                    }

                // Route Timber.e/w into Sentry breadcrumbs + events automatically.
                options.addIntegration(
                    SentryTimberIntegration(
                        minEventLevel = SentryLevel.ERROR,
                        minBreadcrumbLevel = SentryLevel.INFO,
                    ),
                )
            }

            // P15: tag every event with platform context so Sentry's
            // search/grouping understands which build hit the failure.
            Sentry.configureScope { scope ->
                scope.setTag("app_version", BuildConfig.VERSION_NAME)
                scope.setTag("os_version", "Android ${Build.VERSION.RELEASE}")
                scope.setTag("device_model", "${Build.MANUFACTURER} ${Build.MODEL}")
            }

            Timber.i("Sentry started (env=${BuildConfig.PANTOPUS_ENV})")
        }

        // MARK: - PII scrubbing

        private val piiKeys =
            setOf(
                "email",
                "emailaddress",
                "email_address",
                "phone",
                "phonenumber",
                "phone_number",
                "telephone",
                "address",
                "street",
                "streetaddress",
                "street_address",
                "city",
                "state",
                "zip",
                "zipcode",
                "zip_code",
                "postalcode",
                "postal_code",
                "fullname",
                "name",
                "firstname",
                "first_name",
                "lastname",
                "last_name",
                "password",
                "token",
                "authorization",
                "auth",
                "secret",
            )
        private val redacted = "[redacted]"
        private val emailRegex = Regex("""[\w.+-]+@[\w-]+\.[\w.-]+""")
        private val phoneRegex = Regex("""\+?\d[\d\s().-]{7,}""")

        private fun scrubPII(event: SentryEvent) {
            // A failed-request event keeps the method, path and status.
            event.request?.apply {
                url = url?.let(::redactBearerPaths)
                queryString = null
                fragment = null
            }
            // The app's own reports and error logs can name a request too.
            event.message?.apply {
                formatted = formatted?.let(::redactBearerPaths)
                message = message?.let(::redactBearerPaths)
            }
            val extras = event.extras
            if (extras != null) {
                val mutable = extras.toMutableMap()
                scrubInPlace(mutable)
                mutable.forEach { (k, v) -> event.setExtra(k, v) }
            }
            event.breadcrumbs?.forEach { scrubPII(it) }
        }

        /** `GET /api/link-preview?url=` answers 502 for a link that won't load. */
        private fun isLinkPreview(url: String?): Boolean = url?.substringBefore('?')?.endsWith("/api/link-preview") == true

        private fun scrubPII(breadcrumb: Breadcrumb) {
            URL_QUERY_KEYS.forEach { breadcrumb.removeData(it) }
            (breadcrumb.data["url"] as? String)?.let { breadcrumb.setData("url", redactBearerPaths(it)) }
            breadcrumb.data
                .toMutableMap()
                .also { scrubInPlace(it) }
                .forEach { (k, v) -> breadcrumb.setData(k, v) }
            breadcrumb.message?.let { breadcrumb.message = redact(redactBearerPaths(it)) }
        }

        @Suppress("UNCHECKED_CAST")
        private fun scrubInPlace(dict: MutableMap<String, Any?>) {
            for (key in dict.keys.toList()) {
                val lower = key.lowercase()
                val value = dict[key]
                when {
                    piiKeys.contains(lower) -> dict[key] = redacted
                    value is Map<*, *> -> {
                        val nested = (value as Map<String, Any?>).toMutableMap()
                        scrubInPlace(nested)
                        dict[key] = nested
                    }
                    value is String -> dict[key] = redact(value)
                }
            }
        }

        private fun redact(value: String): String =
            value
                .replace(emailRegex, redacted)
                .replace(phoneRegex, redacted)

        fun capture(throwable: Throwable) {
            Timber.e(throwable)
            if (started) Sentry.captureException(throwable)
        }

        fun capture(
            message: String,
            level: SentryLevel = SentryLevel.WARNING,
        ) {
            Timber.log(level.toTimberPriority(), message)
            if (started) Sentry.captureMessage(message, level)
        }

        fun identify(
            userId: String?,
            email: String? = null,
        ) {
            if (!started) return
            if (userId == null) {
                Sentry.setUser(null)
            } else {
                Sentry.setUser(
                    User().apply {
                        this.id = userId
                        this.email = email
                    },
                )
            }
        }

        /** Lightweight analytics — structured log + Sentry breadcrumb. */
        fun track(
            name: String,
            properties: Map<String, String> = emptyMap(),
        ) {
            Timber.i("analytics event=$name props=$properties")
            if (!started) return
            val crumb =
                Breadcrumb().apply {
                    category = "analytics"
                    message = name
                    level = SentryLevel.INFO
                    properties.forEach { (k, v) -> setData(k, v) }
                }
            Sentry.addBreadcrumb(crumb)
        }
    }

/**
 * Sentry's keys for a request URL's query string and fragment (HTTP breadcrumbs and spans). Queries carry
 * typed addresses, coordinates, search terms and signed-URL tokens, so only the path leaves the device.
 */
private val URL_QUERY_KEYS = setOf("http.query", "http.fragment")

/**
 * The API's origin (scheme, host and port) as Sentry's only trace propagation target. The SDK matches a target as a
 * substring of the URL or as a regex for all of it, so a plain origin would also match another host's URL carrying
 * the API's address. This regex matches only a URL that starts with the origin and its `/`. No target, so no headers,
 * if the base URL won't parse.
 */
private fun tracePropagationTargets(apiBaseUrl: String): List<String> =
    listOfNotNull(apiBaseUrl.toHttpUrlOrNull()?.resolve("/")?.let { Regex.escape(it.toString()) + ".*" })

private fun SentryLevel.toTimberPriority(): Int =
    when (this) {
        SentryLevel.DEBUG -> android.util.Log.DEBUG
        SentryLevel.INFO -> android.util.Log.INFO
        SentryLevel.WARNING -> android.util.Log.WARN
        SentryLevel.ERROR, SentryLevel.FATAL -> android.util.Log.ERROR
    }

/**
 * Routes whose last segment is the credential itself: a home invite, a guest pass, a booking's one-off or manage
 * link (which can cancel or reschedule it), and the public residency, fridge-card and opt-out codes. Their URLs
 * leave the device with that segment redacted, as the backend's request log does (`BEARER_CODE_PATH`,
 * backend/app.js).
 */
private val BEARER_PATH =
    Regex(
        "(/api/(?:homes/invitations/token|homes/guest|homes/shared|public/book/o|public/booking|" +
            "public/residency-letters|public/residency-claims|public/fridge-cards|public/block-invites/opt-out))" +
            "/[^/?#\\s]+",
        RegexOption.IGNORE_CASE,
    )

/** [value] (a URL, or a span's "GET <url>") with every bearer credential in its path replaced by `[redacted]`. */
private fun redactBearerPaths(value: String): String = value.replace(BEARER_PATH, "$1/[redacted]")

/**
 * Hands [SentryOkHttpInterceptor] spans their request with the bearer credential redacted. A span names its request
 * in its description, which a finished span (and so `beforeSendTransaction`) can no longer change.
 */
internal val scrubbedHttpSpan =
    SentryOkHttpInterceptor.BeforeSpanCallback { span, _, _ ->
        span.description = span.description?.let(::redactBearerPaths)
        span
    }
