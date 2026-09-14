package app.pantopus.android.data.homes

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
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
data class HomeTaskCreateScope(val origin: String, val actorId: String, val homeId: String)

@JsonClass(generateAdapter = true)
data class PendingHomeTaskCreate(
    val scope: HomeTaskCreateScope,
    val request: CreateHomeTaskRequest,
    val taskId: String? = null,
    val payloadHash: String? = null,
)

interface PendingHomeTaskCreateStore {
    suspend fun read(scope: HomeTaskCreateScope): PendingHomeTaskCreate?

    /** Compare and durably replace; an occupied slot never means permission to overwrite. */
    suspend fun replace(
        scope: HomeTaskCreateScope,
        expected: PendingHomeTaskCreate?,
        next: PendingHomeTaskCreate?,
    )
}

/** Private task text uses dedicated encrypted storage; there is no plaintext fallback. */
@Singleton
class PersistentPendingHomeTaskCreateStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        moshi: Moshi,
    ) : PendingHomeTaskCreateStore {
        private val adapter = moshi.adapter(PendingHomeTaskCreate::class.java)
        private val lock = Mutex()
        private var preferences: SharedPreferences? = null
        private val uncertainValues = mutableMapOf<String, String?>()

        override suspend fun read(scope: HomeTaskCreateScope): PendingHomeTaskCreate? = locked { read(it, scope) }

        override suspend fun replace(
            scope: HomeTaskCreateScope,
            expected: PendingHomeTaskCreate?,
            next: PendingHomeTaskCreate?,
        ) {
            locked { prefs ->
                check(read(prefs, scope) == expected) { "Another task request is saved. Reopen the form to recover it." }
                check(next == null || validPendingTaskCreate(next, scope)) { "The saved task request could not be verified." }
                val key = key(scope)
                val edit = prefs.edit()
                if (next == null) edit.remove(key) else edit.putString(key, adapter.toJson(next))
                if (!edit.commit()) {
                    // SharedPreferences may change its memory cache even when the disk write fails.
                    uncertainValues[key] = expected?.let(adapter::toJson)
                    error("Task recovery could not be saved. Retry before leaving this screen.")
                }
                uncertainValues.remove(key)
            }
        }

        private fun read(
            prefs: SharedPreferences,
            scope: HomeTaskCreateScope,
        ): PendingHomeTaskCreate? {
            val key = key(scope)
            val raw = (if (uncertainValues.containsKey(key)) uncertainValues[key] else prefs.getString(key, null)) ?: return null
            val value = adapter.fromJson(raw)
            check(value != null && validPendingTaskCreate(value, scope)) { "Saved task recovery could not be verified. Contact support." }
            return value
        }

        private suspend fun <T> locked(action: (SharedPreferences) -> T): T =
            withContext(Dispatchers.IO) {
                lock.withLock {
                    try {
                        val prefs = preferences ?: open().also { preferences = it }
                        action(prefs)
                    } catch (error: IOException) {
                        throw IllegalStateException("Task recovery storage is unavailable. Check again before creating a task.", error)
                    } catch (error: GeneralSecurityException) {
                        throw IllegalStateException("Private task recovery storage could not be opened.", error)
                    } catch (error: SecurityException) {
                        throw IllegalStateException("Private task recovery storage could not be accessed.", error)
                    } catch (error: JsonDataException) {
                        throw IllegalStateException("Saved task recovery could not be verified. Contact support.", error)
                    }
                }
            }

        private fun open(): SharedPreferences {
            val master = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            return EncryptedSharedPreferences.create(
                context,
                "private_home_task_creation_v1",
                master,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }

        private fun key(scope: HomeTaskCreateScope): String {
            val identity = "${scope.origin.length}:${scope.origin}:${scope.actorId}:${scope.homeId}"
            return MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
        }
    }

fun validPendingTaskCreate(
    value: PendingHomeTaskCreate,
    scope: HomeTaskCreateScope,
): Boolean {
    if (value.scope != scope || scope.origin.isBlank()) return false
    if (!listOf(scope.actorId, scope.homeId, value.request.requestId).all(::homeTaskUUID)) return false
    val knownType = value.request.taskType in setOf("chore", "shopping", "project", "reminder", "repair")
    if (value.request.title.isBlank() || !knownType) return false
    return if (value.taskId == null) {
        value.payloadHash == null
    } else {
        homeTaskUUID(value.taskId) && value.payloadHash?.matches(Regex("^[a-f0-9]{64}$")) == true
    }
}

internal fun homeTaskUUID(value: String?): Boolean =
    value != null &&
        value.matches(Regex("^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"))
