package app.pantopus.android.data.posts

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedFile
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import app.pantopus.android.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

/** Stable string keys, rather than enum names or reflection, also survive an R8 build. */
data class PulseComposeDraft(
    val values: Map<String, String>,
    val photos: List<PulseDraftPhoto> = emptyList(),
)

class PulseDraftPhoto(
    val id: String,
    val bytes: ByteArray,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/**
 * A private draft per account and API origin. Sign-out retains it for that account's next sign-in.
 * Text and photos are encrypted on this device and excluded from backup. A single writer preserves
 * keystroke/save/discard order and outlives a departing screen; no draft is ever submitted in the background.
 */
@Singleton
class PulseComposeDraftStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        private val operations = Channel<() -> Unit>(Channel.UNLIMITED)
        private val worker = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        private val root = File(context.noBackupFilesDir, "pulse-compose-drafts")
        private val uncertainValues = mutableMapOf<String, String?>()
        private val master by lazy { MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build() }
        private val preferences: SharedPreferences by lazy {
            EncryptedSharedPreferences.create(
                context,
                PREFERENCES,
                master,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }

        init {
            worker.launch { for (operation in operations) operation() }
        }

        suspend fun read(scope: String): PulseComposeDraft? = enqueue { readDraft(scope) }.await()

        /** Queue immediately on the caller's thread, even if its view-model is about to be disposed. */
        fun save(
            scope: String,
            draft: PulseComposeDraft,
        ): Deferred<Unit> = enqueue { writeDraft(scope, draft) }

        fun discard(scope: String): Deferred<Unit> =
            enqueue {
                val key = digest(scope)
                val previous = persistedValue(key)
                if (!preferences.edit().remove(key).commit()) {
                    uncertainValues[key] = previous
                    error("Couldn't discard your draft. Try again.")
                }
                uncertainValues.remove(key)
                File(root, key).deleteRecursively()
                Unit
            }

        private fun readDraft(scope: String): PulseComposeDraft? {
            val key = digest(scope)
            val raw = persistedValue(key) ?: return null
            val json = JSONObject(raw)
            check(json.getInt("version") == VERSION) { "This saved draft needs a newer app." }
            val values = json.getJSONObject("values")
            val fields = values.keys().asSequence().associateWith { values.getString(it) }
            val photos = json.getJSONArray("photos")
            check(photos.length() <= MAX_PHOTOS) { "The saved photos couldn't be read. Try again." }
            val restored =
                (0 until photos.length()).map { index ->
                    val photo = photos.getJSONObject(index)
                    val id = photo.getString("id")
                    PulseDraftPhoto(
                        id = id,
                        bytes = encrypted(photoFile(key, id)).openFileInput().use { it.readBytes() },
                        latitude = photo.optionalDouble("latitude"),
                        longitude = photo.optionalDouble("longitude"),
                    )
                }
            return PulseComposeDraft(fields, restored)
        }

        private fun writeDraft(
            scope: String,
            draft: PulseComposeDraft,
        ) {
            check(draft.photos.size <= MAX_PHOTOS)
            val key = digest(scope)
            val directory = File(root, key)
            check(directory.isDirectory || directory.mkdirs()) { "Couldn't save your draft. Try again." }
            val photos = JSONArray()
            draft.photos.forEach { photo ->
                writePhoto(photoFile(key, photo.id), photo.bytes)
                photos.put(
                    JSONObject().put("id", photo.id)
                        .put("latitude", photo.latitude)
                        .put("longitude", photo.longitude),
                )
            }
            val json = JSONObject().put("version", VERSION).put("values", JSONObject(draft.values)).put("photos", photos)
            val previous = persistedValue(key)
            if (!preferences.edit().putString(key, json.toString()).commit()) {
                uncertainValues[key] = previous
                error("Couldn't save your draft. Try again.")
            }
            uncertainValues.remove(key)
            // Only after the new metadata commits can an older draft's removed attachment be deleted.
            val retained = draft.photos.mapTo(mutableSetOf()) { photoFile(key, it.id).name }
            directory.listFiles()?.filter { it.name !in retained }?.forEach { it.delete() }
        }

        private fun writePhoto(
            file: File,
            bytes: ByteArray,
        ) {
            if (file.isFile) return
            // EncryptedFile authenticates the basename. Keep that name in a sibling staging directory,
            // then publish only a fully closed file; process death never turns a partial write into a saved photo.
            val staging = File(file.parentFile, "pending")
            check(staging.isDirectory || staging.mkdirs()) { "Couldn't save your photo. Try again." }
            val temporary = File(staging, file.name)
            if (temporary.exists()) check(temporary.delete())
            try {
                encrypted(temporary).openFileOutput().use { it.write(bytes) }
                check(temporary.renameTo(file)) { "Couldn't save your photo. Try again." }
            } finally {
                temporary.delete()
                staging.delete()
            }
        }

        private fun persistedValue(key: String): String? =
            if (uncertainValues.containsKey(key)) uncertainValues[key] else preferences.getString(key, null)

        private fun encrypted(file: File): EncryptedFile =
            EncryptedFile.Builder(context, file, master, EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB)
                .setKeysetPrefName(PHOTO_KEYS)
                .build()

        private fun photoFile(
            scopeKey: String,
            id: String,
        ): File = File(File(root, scopeKey), "${digest(id)}.bin")

        private fun <T> enqueue(action: () -> T): Deferred<T> {
            val result = CompletableDeferred<T>()
            check(
                operations.trySend {
                    try {
                        result.complete(action())
                    } catch (error: Exception) {
                        result.completeExceptionally(error)
                    }
                }.isSuccess,
            )
            return result
        }

        private fun JSONObject.optionalDouble(key: String): Double? = if (isNull(key)) null else getDouble(key)

        private fun digest(value: String): String =
            MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

        companion object {
            fun accountScope(actorId: String): String = "${BuildConfig.PANTOPUS_API_BASE_URL}|$actorId|new-post"

            const val PREFERENCES = "private_pulse_compose_drafts_v1"
            const val PHOTO_KEYS = "private_pulse_compose_photo_keys_v1"
            const val VERSION = 1
            const val MAX_PHOTOS = 9
        }
    }
