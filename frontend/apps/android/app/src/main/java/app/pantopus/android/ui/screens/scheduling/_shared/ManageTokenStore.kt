@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling._shared

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private const val MANAGE_TOKEN_STORE_NAME = "calendarly_manage_tokens"

// One file-private DataStore delegate (mirrors the TokenStorage pattern).
private val Context.calendarlyManageTokenDataStore by preferencesDataStore(name = MANAGE_TOKEN_STORE_NAME)

/**
 * Persists the one-time `manageToken` returned by a public booking create,
 * keyed by booking id. It is the invitee's only handle for
 * manage/reschedule/cancel/.ics, so A6 saves it the moment a booking is
 * confirmed and A7/A6 read it back on the manage surfaces.
 *
 * DataStore-backed (mirrors `data/auth/TokenStorage`): `@Singleton` +
 * `@Inject(@ApplicationContext Context)`, no Hilt module needed.
 */
@Singleton
class ManageTokenStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        /** Observe the stored manage token for [bookingId] (null if none). */
        fun manageToken(bookingId: String): Flow<String?> = context.calendarlyManageTokenDataStore.data.map { it[key(bookingId)] }

        /** Persist the one-time manage token for [bookingId]. */
        suspend fun save(
            bookingId: String,
            token: String,
        ) {
            context.calendarlyManageTokenDataStore.edit { it[key(bookingId)] = token }
        }

        /** Forget the token for [bookingId] (e.g. after a cancel). */
        suspend fun clear(bookingId: String) {
            context.calendarlyManageTokenDataStore.edit { it.remove(key(bookingId)) }
        }

        private fun key(bookingId: String) = stringPreferencesKey("manage_token.$bookingId")
    }
