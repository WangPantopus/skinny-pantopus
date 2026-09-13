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

interface PendingHomeMemberRemovalStore {
    suspend fun read(scope: HomeCreationScope): PendingHomeMemberRemoval?

    suspend fun replace(
        scope: HomeCreationScope,
        expected: PendingHomeMemberRemoval?,
        next: PendingHomeMemberRemoval?,
        requireCurrent: suspend () -> Unit,
    )
}

/** One encrypted original per account/origin. No plaintext or empty-on-error fallback. */
@Singleton
class PersistentPendingHomeMemberRemovalStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        moshi: Moshi,
    ) : PendingHomeMemberRemovalStore {
        private val adapter = moshi.adapter(PendingHomeMemberRemoval::class.java).failOnUnknown().serializeNulls()
        private val codec = HomeMemberRemovalCodec(moshi)
        private val lock = Mutex()
        private var preferences: SharedPreferences? = null
        private val uncertainValues = mutableMapOf<String, String?>()

        override suspend fun read(scope: HomeCreationScope): PendingHomeMemberRemoval? = locked { read(it, scope) }

        override suspend fun replace(
            scope: HomeCreationScope,
            expected: PendingHomeMemberRemoval?,
            next: PendingHomeMemberRemoval?,
            requireCurrent: suspend () -> Unit,
        ) {
            locked { prefs ->
                check(read(prefs, scope) == expected) { "Another member removal is saved. Reopen removal recovery to recover it." }
                check(next == null || codec.valid(next, scope)) { "The original member removal could not be verified." }
                val key = key(scope)
                val edit = prefs.edit()
                if (next == null) edit.remove(key) else edit.putString(key, adapter.toJson(next))
                // IO may have waited for another scene's CAS. Check the visible
                // account/lifetime inside this lock, immediately before writing.
                requireCurrent()
                if (!edit.commit()) {
                    // A failed disk commit may still replace SharedPreferences' memory cache.
                    uncertainValues[key] = expected?.let(adapter::toJson)
                    error("Member removal recovery could not be saved. Retry before starting another request.")
                }
                uncertainValues.remove(key)
            }
        }

        private fun read(
            prefs: SharedPreferences,
            scope: HomeCreationScope,
        ): PendingHomeMemberRemoval? {
            check(scope.isValid()) { "Your session changed. Reopen removal recovery to recover the original request." }
            val key = key(scope)
            val raw = (if (uncertainValues.containsKey(key)) uncertainValues[key] else prefs.getString(key, null)) ?: return null
            val value = adapter.fromJson(raw)
            check(
                value != null && codec.valid(value, scope),
            ) { "The saved member removal could not be read. Keep it and retry recovery." }
            return value
        }

        private suspend fun <T> locked(action: suspend (SharedPreferences) -> T): T =
            withContext(Dispatchers.IO) {
                lock.withLock {
                    try {
                        val prefs = preferences ?: open().also { preferences = it }
                        action(prefs)
                    } catch (error: IOException) {
                        throw IllegalStateException(
                            "Member removal recovery storage is unavailable. Keep the original and retry.",
                            error,
                        )
                    } catch (error: GeneralSecurityException) {
                        throw IllegalStateException("Private member removal recovery storage could not be opened.", error)
                    } catch (error: SecurityException) {
                        throw IllegalStateException("Private member removal recovery storage could not be accessed.", error)
                    } catch (error: JsonDataException) {
                        throw IllegalStateException("The saved member removal could not be read. Keep it and retry recovery.", error)
                    }
                }
            }

        private fun open(): SharedPreferences {
            val master = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            return EncryptedSharedPreferences.create(
                context,
                "private_home_member_removal_v1",
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
