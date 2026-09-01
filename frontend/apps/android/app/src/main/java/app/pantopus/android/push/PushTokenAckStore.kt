@file:Suppress("PackageNaming")

package app.pantopus.android.push

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tracks the FCM token most recently ACK'd by the backend. The syncer
 * compares the current FCM token against this and retries registration
 * on app open if they differ (or if nothing has ever been ACK'd).
 *
 * Lives in its own non-encrypted SharedPreferences file — the token
 * itself isn't sensitive (the device already holds it in clear via
 * Firebase) and isolating the file keeps it out of the encrypted
 * auth-token store's migration path.
 */
@Singleton
class PushTokenAckStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs: SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun lastAckedToken(): String? = prefs.getString(KEY_LAST_ACK, null)

        fun markAcked(token: String) {
            prefs.edit { putString(KEY_LAST_ACK, token) }
        }

        fun clear() {
            prefs.edit { remove(KEY_LAST_ACK) }
        }

        private companion object {
            const val PREFS_NAME = "pantopus.push_token_ack"
            const val KEY_LAST_ACK = "last_acked_token"
        }
    }
