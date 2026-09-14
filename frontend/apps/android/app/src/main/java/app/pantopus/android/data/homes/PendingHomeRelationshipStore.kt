package app.pantopus.android.data.homes

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import app.pantopus.android.data.api.models.homes.HomeRelationshipCommand
import app.pantopus.android.data.api.models.homes.HomeRelationshipReceipt
import com.squareup.moshi.JsonClass
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

@JsonClass(generateAdapter = true)
data class HomeRelationshipScope(val origin: String, val actorId: String, val homeId: String)

@JsonClass(generateAdapter = true)
data class PendingHomeRelationship(
    val scope: HomeRelationshipScope,
    val claimId: String,
    val command: HomeRelationshipCommand,
    val confirmed: HomeRelationshipReceipt? = null,
    val version: Int = 1,
)

interface PendingHomeRelationshipStore {
    suspend fun read(scope: HomeRelationshipScope): PendingHomeRelationship?

    /** Compare and durably replace; an occupied slot never means permission to overwrite. */
    suspend fun replace(
        scope: HomeRelationshipScope,
        expected: PendingHomeRelationship?,
        next: PendingHomeRelationship?,
    )
}

/** Original relationship decisions use dedicated encrypted storage with no plaintext fallback. */
@Singleton
class PersistentPendingHomeRelationshipStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        moshi: Moshi,
    ) : PendingHomeRelationshipStore {
        private val adapter = moshi.adapter(PendingHomeRelationship::class.java)
        private val lock = Mutex()
        private var preferences: SharedPreferences? = null
        private val uncertainValues = mutableMapOf<String, String?>()

        override suspend fun read(scope: HomeRelationshipScope): PendingHomeRelationship? = locked { read(it, scope) }

        override suspend fun replace(
            scope: HomeRelationshipScope,
            expected: PendingHomeRelationship?,
            next: PendingHomeRelationship?,
        ) {
            locked { prefs ->
                check(read(prefs, scope) == expected) { "Another relationship decision is saved. Reload to recover its original." }
                check(next == null || validPendingRelationship(next, scope)) { "The saved relationship decision could not be verified." }
                val key = key(scope)
                val edit = prefs.edit()
                if (next == null) edit.remove(key) else edit.putString(key, adapter.toJson(next))
                if (!edit.commit()) {
                    // SharedPreferences may change its memory cache even when the disk write fails.
                    uncertainValues[key] = expected?.let(adapter::toJson)
                    error("Relationship recovery could not be saved. Retry before leaving this screen.")
                }
                uncertainValues.remove(key)
            }
        }

        private fun read(
            prefs: SharedPreferences,
            scope: HomeRelationshipScope,
        ): PendingHomeRelationship? {
            val key = key(scope)
            val raw = (if (uncertainValues.containsKey(key)) uncertainValues[key] else prefs.getString(key, null)) ?: return null
            val value = adapter.fromJson(raw)
            check(
                value != null && validPendingRelationship(value, scope),
            ) { "Saved relationship recovery could not be verified. Contact support." }
            return value
        }

        private suspend fun <T> locked(action: (SharedPreferences) -> T): T =
            withContext(Dispatchers.IO) {
                lock.withLock {
                    try {
                        val prefs = preferences ?: open().also { preferences = it }
                        action(prefs)
                    } catch (error: IOException) {
                        throw IllegalStateException("Relationship recovery storage is unavailable. Check again before submitting.", error)
                    } catch (error: GeneralSecurityException) {
                        throw IllegalStateException("Private relationship recovery storage could not be opened.", error)
                    } catch (error: SecurityException) {
                        throw IllegalStateException("Private relationship recovery storage could not be accessed.", error)
                    } catch (error: JsonDataException) {
                        throw IllegalStateException("Saved relationship recovery could not be verified. Contact support.", error)
                    }
                }
            }

        private fun open(): SharedPreferences {
            val master = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            return EncryptedSharedPreferences.create(
                context,
                "private_home_relationship_v1",
                master,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }

        private fun key(scope: HomeRelationshipScope): String {
            val identity = "${scope.origin.length}:${scope.origin}:${scope.actorId}:${scope.homeId}"
            return MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
        }
    }

fun validPendingRelationship(
    value: PendingHomeRelationship,
    scope: HomeRelationshipScope,
): Boolean {
    if (value.version != 1 || value.scope != scope || scope.origin.isBlank()) return false
    if (!value.command.valid()) return false
    if (!listOf(scope.actorId, scope.homeId, value.claimId).all(::homeTaskUUID)) return false
    return value.confirmed?.matches(value) ?: true
}
