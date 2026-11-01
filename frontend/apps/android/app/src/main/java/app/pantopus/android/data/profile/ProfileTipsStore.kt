package app.pantopus.android.data.profile

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The tips your own profile shows only to you ("Add a photo", "Write a tagline", …) that you closed on this phone
 * (PRF step 2: dismissible, remembered on the device). Only the tip names are kept, per person.
 */
@Singleton
class ProfileTipsStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        fun dismissed(userId: String): Set<String> = prefs.getStringSet(key(userId), emptySet()).orEmpty().toSet()

        fun dismiss(
            userId: String,
            tip: String,
        ) {
            prefs.edit().putStringSet(key(userId), dismissed(userId) + tip).apply()
        }

        private fun key(userId: String) = "dismissed.$userId"

        private companion object {
            const val PREFS = "pantopus.profile_tips"
        }
    }
