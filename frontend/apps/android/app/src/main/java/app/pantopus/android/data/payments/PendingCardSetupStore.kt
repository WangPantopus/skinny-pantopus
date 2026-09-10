package app.pantopus.android.data.payments

import android.content.SharedPreferences
import app.pantopus.android.data.auth.TokenStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Recovery stores only a non-secret identifier, separately for each signed-in account. */
interface PendingCardSetupStore {
    suspend fun currentAccountId(): String?

    suspend fun read(accountId: String): String?

    /** Must complete durably before PaymentSheet is presented. */
    suspend fun save(
        accountId: String,
        setupIntentId: String,
    ): Boolean

    suspend fun clear(
        accountId: String,
        setupIntentId: String,
    ): Boolean
}

class PersistentPendingCardSetupStore(
    private val preferences: SharedPreferences,
    private val tokens: TokenStorage,
    private val apiOrigin: String,
) : PendingCardSetupStore {
    override suspend fun currentAccountId(): String? = tokens.userId()?.takeIf(String::isNotBlank)

    override suspend fun read(accountId: String): String? =
        withContext(Dispatchers.IO) {
            preferences.getString(key(accountId), null)?.takeIf(::isSetupIntentId)
        }

    override suspend fun save(
        accountId: String,
        setupIntentId: String,
    ): Boolean =
        withContext(Dispatchers.IO) {
            if (accountId.isBlank() || !isSetupIntentId(setupIntentId)) return@withContext false
            synchronized(preferences) { preferences.edit().putString(key(accountId), setupIntentId).commit() }
        }

    override suspend fun clear(
        accountId: String,
        setupIntentId: String,
    ): Boolean =
        withContext(Dispatchers.IO) {
            synchronized(preferences) {
                if (preferences.getString(key(accountId), null) != setupIntentId) return@synchronized true
                preferences.edit().remove(key(accountId)).commit()
            }
        }

    private fun key(accountId: String): String = "pending_card_setup.${apiOrigin.trimEnd('/')}.$accountId"

    private fun isSetupIntentId(value: String): Boolean = value.matches(Regex("seti_[A-Za-z0-9]+"))
}
