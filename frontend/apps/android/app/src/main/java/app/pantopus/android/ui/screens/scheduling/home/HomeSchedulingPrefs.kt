@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.home

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Device-local persistence for Home-scheduling preferences that have no
 * backend endpoint yet (migrations 159–165 gap):
 *  - F8 household-exposure toggles (share free/busy, round-robin, auto-decline)
 *  - F15 "request scheduling access" flag
 *
 * Mirrors the iOS `UserDefaults`-backed approach. Keys are per-home scoped so
 * the same user keeps independent settings across households. Structured so a
 * future server endpoint is a drop-in replacement at the ViewModel layer.
 */
@Singleton
open class HomeSchedulingPrefs
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        open fun getBool(
            key: String,
            default: Boolean,
        ): Boolean = prefs.getBoolean(key, default)

        open fun setBool(
            key: String,
            value: Boolean,
        ) {
            prefs.edit().putBoolean(key, value).apply()
        }

        companion object {
            private const val PREFS_NAME = "home_scheduling_prefs"

            /** F8 exposure keys — `scheduling.household.{homeId}.{field}`. */
            fun shareFreeBusyKey(homeId: String) = "scheduling.household.$homeId.shareFreeBusy"

            fun roundRobinKey(homeId: String) = "scheduling.household.$homeId.roundRobin"

            fun autoDeclineKey(homeId: String) = "scheduling.household.$homeId.autoDecline"

            /** F15 access-request flag — `scheduling.gated.{homeId}.requested`. */
            fun gatedRequestedKey(homeId: String) = "scheduling.gated.$homeId.requested"
        }
    }
