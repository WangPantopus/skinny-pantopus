package app.pantopus.android.data.homes

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.IOException
import java.security.GeneralSecurityException
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

interface PendingHomeCreationStore {
    suspend fun read(scope: HomeCreationScope): PendingHomeCreation?

    /** Compare and durably replace; an occupied slot never means permission to overwrite. */
    suspend fun replace(
        scope: HomeCreationScope,
        expected: PendingHomeCreation?,
        next: PendingHomeCreation?,
    )
}

/** Original Home setup and access details use dedicated encrypted storage; there is no plaintext fallback. */
@Singleton
class PersistentPendingHomeCreationStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        moshi: Moshi,
    ) : PendingHomeCreationStore {
        private val adapter = moshi.adapter(PendingHomeCreation::class.java)
        private val codec = HomeCreationCodec(moshi)
        private val lock = Mutex()
        private var preferences: SharedPreferences? = null
        private val uncertainValues = mutableMapOf<String, String?>()

        override suspend fun read(scope: HomeCreationScope): PendingHomeCreation? = locked { read(it, scope) }

        override suspend fun replace(
            scope: HomeCreationScope,
            expected: PendingHomeCreation?,
            next: PendingHomeCreation?,
        ) {
            locked { prefs ->
                check(read(prefs, scope) == expected) { "Another Home request is saved. Reopen the form to recover it." }
                check(next == null || codec.valid(next, scope)) { "The saved Home request could not be verified." }
                val key = key(scope)
                val edit = prefs.edit()
                if (next == null) edit.remove(key) else edit.putString(key, adapter.toJson(next))
                if (!edit.commit()) {
                    // SharedPreferences may change its memory cache even when the disk write fails.
                    uncertainValues[key] = expected?.let(adapter::toJson)
                    error("Home creation recovery could not be saved. Retry before leaving this screen.")
                }
                uncertainValues.remove(key)
            }
        }

        private fun read(
            prefs: SharedPreferences,
            scope: HomeCreationScope,
        ): PendingHomeCreation? {
            check(scope.isValid()) { "Your session changed. Reopen Add Home to recover its request." }
            val key = key(scope)
            val raw = (if (uncertainValues.containsKey(key)) uncertainValues[key] else prefs.getString(key, null)) ?: return null
            val value = adapter.fromJson(raw)
            check(value != null && codec.valid(value, scope)) { "Saved Home creation recovery could not be verified. Contact support." }
            return value
        }

        private suspend fun <T> locked(action: (SharedPreferences) -> T): T =
            withContext(Dispatchers.IO) {
                lock.withLock {
                    try {
                        val prefs = preferences ?: open().also { preferences = it }
                        action(prefs)
                    } catch (error: IOException) {
                        throw IllegalStateException(
                            "Home creation recovery storage is unavailable. Check again before creating a Home.",
                            error,
                        )
                    } catch (error: GeneralSecurityException) {
                        throw IllegalStateException("Private Home creation recovery storage could not be opened.", error)
                    } catch (error: SecurityException) {
                        throw IllegalStateException("Private Home creation recovery storage could not be accessed.", error)
                    } catch (error: JsonDataException) {
                        throw IllegalStateException("Saved Home creation recovery could not be verified. Contact support.", error)
                    }
                }
            }

        private fun open(): SharedPreferences {
            val master = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            return EncryptedSharedPreferences.create(
                context,
                "private_home_creation_v1",
                master,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }

        private fun key(scope: HomeCreationScope): String {
            val identity = "${scope.origin.length}:${scope.origin}:${scope.actorId}"
            return MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
        }
    }
