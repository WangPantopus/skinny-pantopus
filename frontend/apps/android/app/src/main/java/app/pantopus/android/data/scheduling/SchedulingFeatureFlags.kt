package app.pantopus.android.data.scheduling

import app.pantopus.android.BuildConfig
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Feature gates for Calendarly paid surfaces. There is no flavor/remote-config
 * infrastructure in the app, so we drive these from `BuildConfig.PANTOPUS_ENV`
 * (`local`/`staging`/`production`): paid scheduling + Stripe **test mode** are
 * ON for hosted-dev (anything that isn't production) and OFF in production
 * until payout settlement ships.
 *
 * Priced event types, packages, invoices, payouts, and the Stripe checkout
 * gate on [paidSchedulingEnabled]; payout settlement is deferred server-side —
 * surface processing/pending regardless.
 *
 * [environment] is overridable for unit tests.
 */
@Singleton
class SchedulingFeatureFlags
    @Inject
    constructor() {
        /** Defaults to the build's environment; settable in tests. */
        var environment: String = BuildConfig.PANTOPUS_ENV

        /** Priced surfaces are enabled outside production. */
        val paidSchedulingEnabled: Boolean
            get() = environment != ENV_PRODUCTION

        /** Stripe runs in test mode wherever paid scheduling is enabled. */
        val stripeTestModeEnabled: Boolean
            get() = paidSchedulingEnabled

        private companion object {
            const val ENV_PRODUCTION = "production"
        }
    }
