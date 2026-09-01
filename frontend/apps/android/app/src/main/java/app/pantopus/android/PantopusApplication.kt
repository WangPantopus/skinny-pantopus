package app.pantopus.android

import android.app.Application
import app.pantopus.android.core.routing.PendingDeepLinkStore
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.PostHogAnalytics
import app.pantopus.android.data.observability.Observability
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.stripe.android.PaymentConfiguration
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import timber.log.Timber
import java.io.File
import javax.inject.Inject

/**
 * Application class. Initialises Hilt DI, logging, Sentry, and the
 * process-wide Coil image cache (P13 perf budget).
 *
 * Registered in AndroidManifest.xml via `android:name=".PantopusApplication"`.
 */
@HiltAndroidApp
class PantopusApplication :
    Application(),
    ImageLoaderFactory {
    @Inject lateinit var observability: Observability

    override fun onCreate() {
        super.onCreate()

        // Workstream 1.4 — persist pre-auth deep links across process death.
        PendingDeepLinkStore.init(this)

        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }

        // Sentry's Timber integration handles error forwarding in release builds —
        // see Observability.start(). No extra tree needed.
        observability.start(this)
        Analytics.bind(observability)

        // Product analytics (PostHog). No-ops until POSTHOG_API_KEY is set, so
        // dev / CI builds send nothing. Matches iOS's vendor + event names.
        Analytics.bindVendor(
            PostHogAnalytics.create(
                context = this,
                apiKey = BuildConfig.POSTHOG_API_KEY,
                host = BuildConfig.POSTHOG_HOST,
            ),
        )

        // Phase 3 (3A) — configure the Stripe SDK once at launch with the
        // publishable key from BuildConfig (.env → build.gradle.kts). The SDK
        // is already on the classpath (libs.stripe.android); we only init the
        // publishable key. PaymentSheet handles all card entry + SCA.
        val stripeKey = BuildConfig.STRIPE_PUBLISHABLE_KEY
        // Skip the committed pk_test_/pk_live_REPLACE_ME placeholders so a
        // misconfigured build never registers a fake key.
        if (stripeKey.isNotBlank() && !stripeKey.contains("REPLACE_ME")) {
            PaymentConfiguration.init(this, stripeKey)
        }
    }

    /**
     * Coil image-loader factory. Caches:
     *   - 15 % of available app memory (~30–60 MB on a Pixel 6)
     *   - 2 % of available disk under `cacheDir/image_cache` (~100 MB)
     *
     * Sized per the P13 budget (`docs/perf_budgets.md`). One process-wide
     * loader keeps avatar / discovery / mailbox imagery from re-decoding
     * during fast scrolls.
     */
    override fun newImageLoader(): ImageLoader {
        val okHttp =
            EntryPointAccessors
                .fromApplication(this, CoilNetworkEntryPoint::class.java)
                .okHttpClient()
        return ImageLoader
            .Builder(this)
            .okHttpClient(okHttp)
            .memoryCache {
                MemoryCache
                    .Builder(this)
                    .maxSizePercent(IMAGE_CACHE_MEMORY_PERCENT)
                    .build()
            }.diskCache {
                DiskCache
                    .Builder()
                    .directory(File(cacheDir, "image_cache"))
                    .maxSizePercent(IMAGE_CACHE_DISK_PERCENT)
                    .build()
            }.crossfade(true)
            .build()
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface CoilNetworkEntryPoint {
        fun okHttpClient(): OkHttpClient
    }

    private companion object {
        const val IMAGE_CACHE_MEMORY_PERCENT = 0.15
        const val IMAGE_CACHE_DISK_PERCENT = 0.02
    }
}
