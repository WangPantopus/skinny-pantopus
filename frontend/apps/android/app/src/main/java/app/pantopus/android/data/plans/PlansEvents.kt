package app.pantopus.android.data.plans

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One-time Plans moments that cross screens: a plan just posted (the map drops its pin and shows H8), and which
 * plans have already played their reveal (J7) on this phone, so "You're in" animates once.
 */
@Singleton
class PlansEvents
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        private val _posted = MutableStateFlow<String?>(null)

        /** The plan the person just posted, until the map has shown it. */
        val posted: StateFlow<String?> = _posted.asStateFlow()

        fun posted(planId: String) {
            _posted.value = planId
        }

        fun consumePosted(planId: String) {
            if (_posted.value == planId) _posted.value = null
        }

        /** The plan whose page is on screen (set while it's resumed), for push suppression. */
        @Volatile
        var viewedPlanId: String? = null

        /**
         * True when a push of [type] about [planId] needs no system notification: that plan's page is on screen
         * and updates itself. Pushes with buttons (a request, a reminder, a change) still post.
         */
        fun isShowingQuietly(
            type: String,
            planId: String?,
        ): Boolean = planId != null && planId == viewedPlanId && type in QUIET_WHEN_VIEWING

        /** True the first time this phone shows [planId] with the viewer in it; false afterwards. */
        fun shouldReveal(planId: String): Boolean {
            val seen = prefs.getStringSet(KEY_REVEALED, emptySet()).orEmpty()
            return planId !in seen
        }

        fun revealed(planId: String) {
            val seen = prefs.getStringSet(KEY_REVEALED, emptySet()).orEmpty()
            if (planId in seen) return
            val next = (seen + planId).toList().takeLast(MAX_REMEMBERED).toSet()
            prefs.edit().putStringSet(KEY_REVEALED, next).apply()
        }

        private companion object {
            val QUIET_WHEN_VIEWING = setOf("plan_accepted", "plan_declined", "plan_spot_opened", "plan_cancelled")
            const val PREFS = "pantopus.plans.events"
            const val KEY_REVEALED = "revealed"
            const val MAX_REMEMBERED = 200
        }
    }
