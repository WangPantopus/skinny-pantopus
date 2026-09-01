package app.pantopus.android.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.annotation.VisibleForTesting
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

// Legacy v1 store — kept only so we can drain it on first launch and then
// clear it. New writes never touch this DataStore.
private val Context.legacyTokenDataStore by preferencesDataStore(name = LEGACY_DATA_STORE_NAME)
private const val LEGACY_DATA_STORE_NAME = "auth_tokens"
private const val SECURE_PREFS_FILE = "secure_auth_tokens"

/**
 * Persists access + refresh tokens in `EncryptedSharedPreferences`,
 * wrapped by a `MasterKey` (`KeyScheme.AES256_GCM`) that the Android
 * Keystore provisions on first launch. On hardware-backed devices the
 * master key never leaves the secure element — at-rest parity with the
 * iOS Keychain pinned to `.afterFirstUnlockThisDeviceOnly` +
 * `.synchronizable(false)`.
 *
 * Storage geometry:
 *  - Values are encrypted with `AES256_GCM` and keys with `AES256_SIV`
 *    (so the same plaintext key always hashes to the same ciphertext,
 *    which is what `SharedPreferences` needs to look entries up).
 *  - The prefs file lives at `shared_prefs/secure_auth_tokens.xml`. It
 *    is excluded from Auto Backup + Device-to-Device transfer via
 *    `res/xml/backup_rules.xml` and `res/xml/data_extraction_rules.xml`.
 *
 * Migration from v1 (plain DataStore):
 *  - On the first call after upgrade, if `v2_migrated` is unset, the
 *    legacy `datastore/auth_tokens.preferences_pb` file is drained into
 *    the encrypted prefs, then cleared, then the flag is set so we
 *    never re-run.
 *
 * Concurrency:
 *  - All public methods hop to `Dispatchers.IO` before touching prefs.
 *    `EncryptedSharedPreferences.create(...)` performs JNI work on first
 *    access, and decrypt-on-read costs a few microseconds per call —
 *    fine off the main thread, painful on it.
 *  - The `OkHttp` `AuthInterceptor` calls `accessToken()` from a
 *    `runBlocking` block on a dispatcher thread, which remains safe.
 */
@Singleton
class TokenStorage
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        private object Keys {
            const val ACCESS = "access_token"
            const val REFRESH = "refresh_token"
            const val USER_ID = "user_id"
            const val USER_JSON = "user_json"
            const val V2_MIGRATED = "v2_migrated"
        }

        private object LegacyKeys {
            val ACCESS = stringPreferencesKey("access_token")
            val REFRESH = stringPreferencesKey("refresh_token")
            val USER_ID = stringPreferencesKey("user_id")
        }

        @VisibleForTesting
        internal var prefsOverride: SharedPreferences? = null

        @Volatile
        private var cachedPrefs: SharedPreferences? = null

        @Volatile
        @VisibleForTesting
        internal var migrationCompleted: Boolean = false

        private val migrationMutex = Mutex()

        private val _accessTokenFlow = MutableStateFlow<String?>(null)
        val accessTokenFlow: Flow<String?> = _accessTokenFlow.asStateFlow()

        private suspend fun <T> withPrefs(block: (SharedPreferences) -> T): T =
            withContext(Dispatchers.IO) {
                val prefs = prefsOverride ?: cachedPrefs ?: openEncryptedPrefs().also { cachedPrefs = it }
                maybeMigrateLegacy(prefs)
                block(prefs)
            }

        private fun openEncryptedPrefs(): SharedPreferences {
            val masterKey =
                MasterKey
                    .Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
            return EncryptedSharedPreferences.create(
                context,
                SECURE_PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }

        private suspend fun maybeMigrateLegacy(prefs: SharedPreferences) {
            if (migrationCompleted) return
            migrationMutex.withLock {
                if (migrationCompleted) return@withLock
                if (prefs.getBoolean(Keys.V2_MIGRATED, false)) {
                    _accessTokenFlow.value = prefs.getString(Keys.ACCESS, null)
                    migrationCompleted = true
                    return@withLock
                }
                runCatching {
                    val legacy = context.legacyTokenDataStore.data.first()
                    val legacyAccess = legacy[LegacyKeys.ACCESS]
                    val legacyRefresh = legacy[LegacyKeys.REFRESH]
                    val legacyUserId = legacy[LegacyKeys.USER_ID]
                    prefs
                        .edit()
                        .apply {
                            if (legacyAccess != null) putString(Keys.ACCESS, legacyAccess)
                            if (legacyRefresh != null) putString(Keys.REFRESH, legacyRefresh)
                            if (legacyUserId != null) putString(Keys.USER_ID, legacyUserId)
                            putBoolean(Keys.V2_MIGRATED, true)
                        }.commit()
                    context.legacyTokenDataStore.edit { it.clear() }
                }.onFailure {
                    // If the legacy store can't be read (corrupt, deleted,
                    // never existed), still mark the v2 flag so we don't
                    // retry on every call. There's nothing to recover.
                    prefs.edit().putBoolean(Keys.V2_MIGRATED, true).commit()
                }
                _accessTokenFlow.value = prefs.getString(Keys.ACCESS, null)
                migrationCompleted = true
            }
        }

        suspend fun accessToken(): String? = withPrefs { it.getString(Keys.ACCESS, null) }

        suspend fun refreshToken(): String? = withPrefs { it.getString(Keys.REFRESH, null) }

        /**
         * JSON snapshot of the last-known session user. Lets a cold launch
         * render the signed-in shell when the network is unreachable instead
         * of bouncing to login (offline-first parity with YouTube / Gmail).
         */
        suspend fun userJson(): String? = withPrefs { it.getString(Keys.USER_JSON, null) }

        suspend fun saveUserJson(json: String) {
            withPrefs { prefs ->
                prefs.edit().putString(Keys.USER_JSON, json).commit()
            }
        }

        suspend fun save(
            accessToken: String,
            refreshToken: String?,
            userId: String,
        ) {
            withPrefs { prefs ->
                prefs
                    .edit()
                    .apply {
                        putString(Keys.ACCESS, accessToken)
                        if (refreshToken != null) putString(Keys.REFRESH, refreshToken)
                        putString(Keys.USER_ID, userId)
                    }.commit()
            }
            _accessTokenFlow.value = accessToken
        }

        /**
         * Refresh-only update — overwrites the access (and optionally
         * refresh) token without touching the stored userId. Used by
         * `AuthRepository.refreshSession` to mirror iOS, which never
         * rewrites the user identity on a token rotation.
         */
        suspend fun updateTokens(
            accessToken: String,
            refreshToken: String?,
        ) {
            withPrefs { prefs ->
                prefs
                    .edit()
                    .apply {
                        putString(Keys.ACCESS, accessToken)
                        if (refreshToken != null) putString(Keys.REFRESH, refreshToken)
                    }.commit()
            }
            _accessTokenFlow.value = accessToken
        }

        suspend fun clear() {
            withPrefs { prefs ->
                // Drop the tokens + userId but preserve `v2_migrated` so
                // we don't re-run the legacy drain on the next signed-out
                // call.
                prefs
                    .edit()
                    .apply {
                        remove(Keys.ACCESS)
                        remove(Keys.REFRESH)
                        remove(Keys.USER_ID)
                        remove(Keys.USER_JSON)
                    }.commit()
            }
            _accessTokenFlow.value = null
        }
    }
