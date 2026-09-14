package app.pantopus.android.data.homes

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceReceipt
import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceRequest
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
data class HomeTaskRecurrenceScope(val origin: String, val actorId: String, val homeId: String, val taskId: String)

@JsonClass(generateAdapter = true)
data class PendingHomeTaskRecurrence(
    val scope: HomeTaskRecurrenceScope,
    val request: HomeTaskRecurrenceRequest,
    val confirmed: HomeTaskRecurrenceReceipt? = null,
    val version: Int = 1,
)

interface PendingHomeTaskRecurrenceStore {
    suspend fun read(scope: HomeTaskRecurrenceScope): PendingHomeTaskRecurrence?

    /** Compare and durably replace; an occupied slot never means permission to overwrite. */
    suspend fun replace(
        scope: HomeTaskRecurrenceScope,
        expected: PendingHomeTaskRecurrence?,
        next: PendingHomeTaskRecurrence?,
    )
}

/** Original schedule commands use dedicated encrypted storage with no plaintext fallback. */
@Singleton
class PersistentPendingHomeTaskRecurrenceStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        moshi: Moshi,
    ) : PendingHomeTaskRecurrenceStore {
        private val adapter = moshi.adapter(PendingHomeTaskRecurrence::class.java)
        private val lock = Mutex()
        private var preferences: SharedPreferences? = null
        private val uncertainValues = mutableMapOf<String, String?>()

        override suspend fun read(scope: HomeTaskRecurrenceScope): PendingHomeTaskRecurrence? = locked { read(it, scope) }

        override suspend fun replace(
            scope: HomeTaskRecurrenceScope,
            expected: PendingHomeTaskRecurrence?,
            next: PendingHomeTaskRecurrence?,
        ) {
            locked { prefs ->
                check(read(prefs, scope) == expected) { "Another schedule change is saved. Reload to recover its original request." }
                check(next == null || validPendingTaskRecurrence(next, scope)) { "The saved schedule change could not be verified." }
                val key = key(scope)
                val edit = prefs.edit()
                if (next == null) edit.remove(key) else edit.putString(key, adapter.toJson(next))
                if (!edit.commit()) {
                    // SharedPreferences may change its memory cache even when the disk write fails.
                    uncertainValues[key] = expected?.let(adapter::toJson)
                    error("Schedule recovery could not be saved. Retry before leaving this screen.")
                }
                uncertainValues.remove(key)
            }
        }

        private fun read(
            prefs: SharedPreferences,
            scope: HomeTaskRecurrenceScope,
        ): PendingHomeTaskRecurrence? {
            val key = key(scope)
            val raw = (if (uncertainValues.containsKey(key)) uncertainValues[key] else prefs.getString(key, null)) ?: return null
            val value = adapter.fromJson(raw)
            check(
                value != null && validPendingTaskRecurrence(value, scope),
            ) { "Saved schedule recovery could not be verified. Contact support." }
            return value
        }

        private suspend fun <T> locked(action: (SharedPreferences) -> T): T =
            withContext(Dispatchers.IO) {
                lock.withLock {
                    try {
                        val prefs = preferences ?: open().also { preferences = it }
                        action(prefs)
                    } catch (error: IOException) {
                        throw IllegalStateException("Schedule recovery storage is unavailable. Check again before changing repeats.", error)
                    } catch (error: GeneralSecurityException) {
                        throw IllegalStateException("Private schedule recovery storage could not be opened.", error)
                    } catch (error: SecurityException) {
                        throw IllegalStateException("Private schedule recovery storage could not be accessed.", error)
                    } catch (error: JsonDataException) {
                        throw IllegalStateException("Saved schedule recovery could not be verified. Contact support.", error)
                    }
                }
            }

        private fun open(): SharedPreferences {
            val master = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            return EncryptedSharedPreferences.create(
                context,
                "private_home_task_recurrence_v1",
                master,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }

        private fun key(scope: HomeTaskRecurrenceScope): String {
            val identity = "${scope.origin.length}:${scope.origin}:${scope.actorId}:${scope.homeId}:${scope.taskId}"
            return MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
        }
    }

fun validPendingTaskRecurrence(
    value: PendingHomeTaskRecurrence,
    scope: HomeTaskRecurrenceScope,
): Boolean {
    if (value.version != 1 || value.scope != scope || scope.origin.isBlank()) return false
    if (!value.request.valid()) return false
    if (!listOf(scope.actorId, scope.homeId, scope.taskId).all(::homeTaskUUID)) return false
    return value.confirmed?.let {
        it.matches(value.request) && it.actorId == scope.actorId && it.homeId == scope.homeId && it.taskId == scope.taskId
    } ?: true
}
