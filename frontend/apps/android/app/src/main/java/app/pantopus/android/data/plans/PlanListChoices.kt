package app.pantopus.android.data.plans

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * What the person chose on the Plans list and keeps from one visit to the next: the All / Neighbors / Businesses filter
 * (Plans with businesses, board G2: "the app remembers the choice"). Kept per account on the phone; nothing private.
 */
@Singleton
class PlanListChoices
    @Inject
    constructor(
        @ApplicationContext context: Context,
        private val feature: PlansFeature,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        /** The filter last chosen ("All" until one is). */
        var host: PlanHostFilter
            get() = PlanHostFilter.from(prefs.getString(key(), null))
            set(value) = prefs.edit().putString(key(), value.wire).apply()

        private fun key(): String = "$KEY_HOST:${feature.viewerId.orEmpty()}"

        private companion object {
            const val PREFS = "pantopus.plans.list"
            const val KEY_HOST = "host_filter"
        }
    }
