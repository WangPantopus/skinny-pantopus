package app.pantopus.android.data.payments

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import app.pantopus.android.data.api.models.payments.TipOriginal
import app.pantopus.android.data.api.models.payments.TipValidation
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

interface PendingGigTipStore {
    suspend fun read(key: String): TipOriginal?

    suspend fun replace(
        key: String,
        expected: TipOriginal?,
        next: TipOriginal?,
        canCommit: () -> Boolean,
    )
}

/** Uses the existing Android protected-preferences mechanism; never stores SDK credentials. */
@Singleton
class PersistentPendingGigTipStore internal constructor(
    moshi: Moshi,
    private val preferencesFactory: () -> SharedPreferences,
) : PendingGigTipStore {
    @Inject
    constructor(
        @ApplicationContext context: Context,
        moshi: Moshi,
    ) : this(moshi, {
        val master = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(
            context,
            "private_gig_tips_v1",
            master,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    })

    private val adapter = moshi.adapter(TipOriginal::class.java)
    private var preferences: SharedPreferences? = null
    private val uncertain = mutableMapOf<String, String?>()
    private val lock = Mutex()

    override suspend fun read(key: String): TipOriginal? = withContext(Dispatchers.IO) { lock.withLock { readValue(open(), key) } }

    // A platform commit exception can still mutate memory; preserve the expected original.
    @Suppress("TooGenericExceptionCaught")
    override suspend fun replace(
        key: String,
        expected: TipOriginal?,
        next: TipOriginal?,
        canCommit: () -> Boolean,
    ) {
        withContext(Dispatchers.IO) {
            lock.withLock {
                val prefs = open()
                check(readValue(prefs, key) == expected) { "The saved tip changed. Reopen its original status." }
                check(next == null || TipValidation.original(next, next.gigId, next.payerId)) { "The original tip could not be verified." }
                val value = next?.let(adapter::toJson)
                currentCoroutineContext().ensureActive()
                check(canCommit()) { "The tip session changed. Its original was kept." }
                val edit = prefs.edit()
                if (value == null) edit.remove(key) else edit.putString(key, value)
                val committed =
                    try {
                        edit.commit()
                    } catch (error: Exception) {
                        uncertain[key] = expected?.let(adapter::toJson)
                        throw error
                    }
                if (!committed) {
                    // A failed commit can still change SharedPreferences' memory cache.
                    uncertain[key] = expected?.let(adapter::toJson)
                    error("The tip could not be retained. Check storage before continuing.")
                }
                uncertain.remove(key)
            }
        }
    }

    private fun readValue(
        prefs: SharedPreferences,
        key: String,
    ): TipOriginal? {
        val raw = (if (uncertain.containsKey(key)) uncertain[key] else prefs.getString(key, null)) ?: return null
        val value = adapter.fromJson(raw)
        check(value != null && TipValidation.original(value, value.gigId, value.payerId)) {
            "The retained tip could not be read. Keep its original request."
        }
        return value
    }

    private fun open(): SharedPreferences {
        preferences?.let { return it }
        return preferencesFactory().also { preferences = it }
    }
}
