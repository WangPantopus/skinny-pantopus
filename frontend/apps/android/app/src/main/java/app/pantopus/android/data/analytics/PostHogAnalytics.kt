package app.pantopus.android.data.analytics

import android.content.Context
import com.posthog.PersonProfiles
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import timber.log.Timber

/**
 * Vendor seam so [Analytics] (and tests) never import the PostHog SDK
 * directly. The single concrete implementation is [PostHogAnalytics].
 */
interface AnalyticsVendor {
    fun capture(
        name: String,
        properties: Map<String, String>,
    )

    fun identify(userId: String)

    fun reset()
}

/**
 * PostHog-backed [AnalyticsVendor]. This is the Android half of the
 * cross-platform pair — the iOS counterpart is
 * `Core/Analytics/PostHogAnalytics.swift`. Both send the SAME event names
 * (the closed [AnalyticsEvent] taxonomy) to the SAME vendor.
 *
 * Gating: [create] returns `null` when `POSTHOG_API_KEY` is blank, so
 * analytics no-ops in dev / CI exactly like [app.pantopus.android.data.observability.Observability]
 * does without a Sentry DSN. Beta / prod flip it on with no code change.
 *
 * Privacy: autocapture is OFF (manual events only), no advertising id is
 * collected (so no ATT-equivalent is needed), and event properties are
 * PII-scrubbed before send.
 */
class PostHogAnalytics private constructor() : AnalyticsVendor {
    override fun capture(
        name: String,
        properties: Map<String, String>,
    ) {
        PostHog.capture(event = name, properties = scrubPII(properties))
    }

    override fun identify(userId: String) {
        PostHog.identify(distinctId = userId)
    }

    override fun reset() {
        PostHog.reset()
    }

    companion object {
        private const val DEFAULT_HOST = "https://eu.i.posthog.com"

        /**
         * Initialise PostHog and return a vendor, or `null` when [apiKey] is
         * blank (analytics stays disabled). Call once from
         * `PantopusApplication.onCreate`.
         */
        fun create(
            context: Context,
            apiKey: String,
            host: String,
        ): AnalyticsVendor? {
            if (apiKey.isBlank()) {
                Timber.i("PostHog API key not set — product analytics disabled")
                return null
            }
            val resolvedHost = host.ifBlank { DEFAULT_HOST }
            val config =
                PostHogAndroidConfig(apiKey = apiKey, host = resolvedHost).apply {
                    // Manual, explicit events ONLY — no autocapture. The closed
                    // taxonomy in AnalyticsEvent is the single source of names.
                    captureScreenViews = false
                    captureDeepLinks = false
                    captureApplicationLifecycleEvents = false
                    // Anonymous events don't mint person profiles; a person is
                    // only created on identify() with the app user id (no PII).
                    personProfiles = PersonProfiles.IDENTIFIED_ONLY
                }
            PostHogAndroid.setup(context, config)
            Timber.i("PostHog started (host=$resolvedHost)")
            return PostHogAnalytics()
        }

        /**
         * Defense-in-depth: the closed taxonomy already carries no PII, but we
         * still redact any property whose key looks personal and any value that
         * matches an email / phone pattern. Mirrors the iOS vendor + Sentry
         * scrubbing in Observability.
         */
        private val piiKeys =
            setOf(
                "email", "emailaddress", "email_address",
                "phone", "phonenumber", "phone_number", "telephone",
                "address", "street", "streetaddress", "street_address",
                "city", "state", "zip", "zipcode", "zip_code", "postalcode", "postal_code",
                "fullname", "name", "firstname", "first_name", "lastname", "last_name",
                "password", "token", "authorization", "auth", "secret",
            )
        private const val REDACTED = "[redacted]"
        private val emailRegex = Regex("""[\w.+-]+@[\w-]+\.[\w.-]+""")
        private val phoneRegex = Regex("""\+?\d[\d\s().-]{7,}""")

        private fun scrubPII(properties: Map<String, String>): Map<String, String> =
            properties.mapValues { (key, value) ->
                if (piiKeys.contains(key.lowercase())) {
                    REDACTED
                } else {
                    value.replace(emailRegex, REDACTED).replace(phoneRegex, REDACTED)
                }
            }
    }
}
