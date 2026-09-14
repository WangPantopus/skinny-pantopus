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

interface PendingHomeResidencyReviewStore {
    suspend fun read(scope: HomeResidencyReviewScope): PendingHomeResidencyReview?

    suspend fun replace(
        scope: HomeResidencyReviewScope,
        expected: PendingHomeResidencyReview?,
        next: PendingHomeResidencyReview?,
    )
}

/** One encrypted original per account/origin/Home. No plaintext or empty-on-error fallback. */
@Singleton
class PersistentPendingHomeResidencyReviewStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        moshi: Moshi,
    ) : PendingHomeResidencyReviewStore {
        private val adapter = moshi.adapter(PendingHomeResidencyReview::class.java).failOnUnknown()
        private val codec = HomeResidencyReviewCodec(moshi)
        private val lock = Mutex()
        private var preferences: SharedPreferences? = null
        private val uncertainValues = mutableMapOf<String, String?>()

        override suspend fun read(scope: HomeResidencyReviewScope): PendingHomeResidencyReview? = locked { read(it, scope) }

        override suspend fun replace(
            scope: HomeResidencyReviewScope,
            expected: PendingHomeResidencyReview?,
            next: PendingHomeResidencyReview?,
        ) {
            locked { prefs ->
                check(read(prefs, scope) == expected) { "Another residency decision is saved. Reopen residency review to recover it." }
                check(next == null || codec.valid(next, scope)) { "The original residency decision could not be verified." }
                val key = key(scope)
                val edit = prefs.edit()
                if (next == null) edit.remove(key) else edit.putString(key, adapter.toJson(next))
                if (!edit.commit()) {
                    // A failed disk commit may still replace SharedPreferences' memory cache.
                    uncertainValues[key] = expected?.let(adapter::toJson)
                    error("Residency decision recovery could not be saved. Retry before starting another request.")
                }
                uncertainValues.remove(key)
            }
        }

        private fun read(
            prefs: SharedPreferences,
            scope: HomeResidencyReviewScope,
        ): PendingHomeResidencyReview? {
            check(scope.isValid()) { "Your session changed. Reopen residency review to recover the original request." }
            val key = key(scope)
            val raw = (if (uncertainValues.containsKey(key)) uncertainValues[key] else prefs.getString(key, null)) ?: return null
            val value = adapter.fromJson(raw)
            check(
                value != null && codec.valid(value, scope),
            ) { "The saved residency decision could not be read. Keep it and retry recovery." }
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
                            "Residency decision recovery storage is unavailable. Keep the original and retry.",
                            error,
                        )
                    } catch (error: GeneralSecurityException) {
                        throw IllegalStateException("Private residency decision recovery storage could not be opened.", error)
                    } catch (error: SecurityException) {
                        throw IllegalStateException("Private residency decision recovery storage could not be accessed.", error)
                    } catch (error: JsonDataException) {
                        throw IllegalStateException("The saved residency decision could not be read. Keep it and retry recovery.", error)
                    }
                }
            }

        private fun open(): SharedPreferences {
            val master = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            return EncryptedSharedPreferences.create(
                context,
                "private_home_residency_review_v1",
                master,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }

        private fun key(scope: HomeResidencyReviewScope): String {
            val identity = "${scope.origin.length}:${scope.origin}:${scope.actorId}:${scope.homeId}"
            return MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
        }
    }
