package app.pantopus.android.data.auth

import android.content.Context
import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Non-secret display hint for one remembered account (CONTRACT §"Client
 * storage keys": `{userId, displayName, avatarUrl, maskedEmail, lastMethod,
 * lastSeenAt}`). Drives the "Continue as Ying" card and login prefill.
 */
@JsonClass(generateAdapter = true)
data class AccountHint(
    val userId: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    /** `y•••@gmail.com` — never the full address. */
    val maskedEmail: String? = null,
    /** `password` | `google` | `apple` | `resume` — picks the L3 affordance. */
    val lastMethod: String? = null,
    /** Unix millis of the last sign-in / resume with this account. */
    val lastSeenAt: Long? = null,
) {
    companion object {
        const val METHOD_PASSWORD = "password"
        const val METHOD_GOOGLE = "google"
        const val METHOD_APPLE = "apple"
        const val METHOD_RESUME = "resume"

        /** `ying@gmail.com` → `y•••@gmail.com`; blank / malformed → `null`. */
        fun maskEmail(email: String?): String? {
            val value = email?.trim().orEmpty()
            val at = value.indexOf('@')
            if (at <= 0 || at == value.lastIndex) return null
            return value.substring(0, 1) + "•••" + value.substring(at)
        }
    }
}

/**
 * The Block Store entry (`pantopus.account_hint`) as JSON:
 * `{ v:1, accounts:[…max 3, most recent first…], resumeGrant?, grantUserId?, issuedAt }`.
 * [resumeGrant] is the single-use, server-hashed grant redeemable ONLY by
 * this device's hardware key behind BiometricPrompt; it belongs to
 * [grantUserId] (always the most recent account).
 */
@JsonClass(generateAdapter = true)
data class AccountHintPayload(
    val v: Int = VERSION,
    val accounts: List<AccountHint> = emptyList(),
    val resumeGrant: String? = null,
    val grantUserId: String? = null,
    /** Unix millis when this payload was last written. */
    val issuedAt: Long? = null,
) {
    /** The account "Continue as …" should show — most recent first. */
    val primary: AccountHint? get() = accounts.firstOrNull()

    /** The account the grant belongs to, if the grant is present. */
    val grantAccount: AccountHint?
        get() = if (resumeGrant.isNullOrBlank()) null else accounts.firstOrNull { it.userId == grantUserId }

    fun withAccount(hint: AccountHint): AccountHintPayload {
        val rest = accounts.filterNot { it.userId == hint.userId }
        return copy(accounts = (listOf(hint) + rest).take(MAX_ACCOUNTS))
    }

    fun withoutAccount(userId: String): AccountHintPayload {
        val remaining = accounts.filterNot { it.userId == userId }
        val grantStillValid = grantUserId != userId
        return copy(
            accounts = remaining,
            resumeGrant = if (grantStillValid) resumeGrant else null,
            grantUserId = if (grantStillValid) grantUserId else null,
        )
    }

    fun withGrant(
        grant: String?,
        userId: String?,
    ): AccountHintPayload = copy(resumeGrant = grant?.takeIf { it.isNotBlank() }, grantUserId = userId?.takeIf { grant != null })

    fun withoutGrant(): AccountHintPayload = copy(resumeGrant = null, grantUserId = null)

    companion object {
        const val VERSION = 1
        const val MAX_ACCOUNTS = 3
    }
}

/**
 * Persistent "remembered accounts + resume grant" store that survives
 * delete + reinstall on the same device (design §3 L2, §7.4).
 *
 * Production = Google Block Store ([BlockStoreAccountHintStore]);
 * unit tests inject an in-memory fake. Every method is a no-op / `null`
 * when the backing store is unavailable (GMS-less devices) — the app then
 * simply lands on L3 (login screen).
 */
interface AccountHintStore {
    /** Whether the backing store exists on this device (GMS present). */
    suspend fun isAvailable(): Boolean

    /** The stored payload, or `null` when absent / unreadable / unavailable. */
    suspend fun read(): AccountHintPayload?

    /** Overwrite the payload (stamps `issuedAt`). Best-effort. */
    suspend fun write(payload: AccountHintPayload)

    /** Remove the entry entirely ("Not you? Remove", account deletion). */
    suspend fun delete()

    /** Merge [hint] to the front (max 3) keeping any existing grant. */
    suspend fun upsertAccount(hint: AccountHint) {
        val current = read() ?: AccountHintPayload()
        write(current.withAccount(hint))
    }

    /** Attach a fresh single-use grant for [userId] (moves that account to the front if known). */
    suspend fun setGrant(
        grant: String,
        userId: String,
    ) {
        val current = read() ?: AccountHintPayload()
        write(current.withGrant(grant, userId))
    }

    /** Explicit local sign-out: drop the grant, keep the display hints. */
    suspend fun clearGrant() {
        val current = read() ?: return
        if (current.resumeGrant == null && current.grantUserId == null) return
        write(current.withoutGrant())
    }

    /** Forget one account; deletes the entry when none remain. */
    suspend fun removeAccount(userId: String) {
        val current = read() ?: return
        val next = current.withoutAccount(userId)
        if (next.accounts.isEmpty()) delete() else write(next)
    }
}

/**
 * Block Store implementation. Key `pantopus.account_hint`; entries are
 * `setShouldBackupToCloud(false)` — same-device (and D2D transfer) only,
 * per WORKLOG decision 3 — so a restored cloud backup elsewhere never
 * carries a grant. Payload stays far below the 4 KB per-entry limit.
 */
@Singleton
class BlockStoreAccountHintStore
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) : AccountHintStore {
        private val adapter = Moshi.Builder().build().adapter(AccountHintPayload::class.java).lenient()
        private val mutex = Mutex()

        @Volatile
        private var cache: AccountHintPayload? = null

        @Volatile
        private var cacheValid = false

        private val gmsAvailable: Boolean by lazy {
            runCatching {
                GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
            }.getOrDefault(false)
        }

        override suspend fun isAvailable(): Boolean = gmsAvailable

        override suspend fun read(): AccountHintPayload? {
            if (!gmsAvailable) return null
            if (cacheValid) return cache
            return mutex.withLock {
                if (cacheValid) return@withLock cache
                val payload =
                    runCatching {
                        val request = RetrieveBytesRequest.Builder().setKeys(listOf(KEY)).build()
                        val response = Blockstore.getClient(context).retrieveBytes(request).await()
                        val bytes = response.blockstoreDataMap[KEY]?.bytes ?: return@runCatching null
                        adapter.fromJson(String(bytes, Charsets.UTF_8))
                    }.onFailure { Timber.w(it, "Block Store read failed") }
                        .getOrNull()
                        ?.takeIf { it.v == AccountHintPayload.VERSION }
                cache = payload
                cacheValid = true
                payload
            }
        }

        override suspend fun write(payload: AccountHintPayload) {
            if (!gmsAvailable) return
            mutex.withLock {
                val stamped = payload.copy(v = AccountHintPayload.VERSION, issuedAt = System.currentTimeMillis())
                val bytes = adapter.toJson(stamped).toByteArray(Charsets.UTF_8)
                if (bytes.size > MAX_BYTES) {
                    Timber.w("Block Store payload too large (%d bytes) — dropping avatar urls", bytes.size)
                }
                val trimmed =
                    if (bytes.size > MAX_BYTES) {
                        stamped.copy(accounts = stamped.accounts.map { it.copy(avatarUrl = null) })
                    } else {
                        stamped
                    }
                runCatching {
                    val data =
                        StoreBytesData
                            .Builder()
                            .setBytes(adapter.toJson(trimmed).toByteArray(Charsets.UTF_8))
                            .setKey(KEY)
                            .setShouldBackupToCloud(false)
                            .build()
                    Blockstore.getClient(context).storeBytes(data).await()
                    cache = trimmed
                    cacheValid = true
                }.onFailure {
                    Timber.w(it, "Block Store write failed")
                    cacheValid = false
                }
            }
        }

        override suspend fun delete() {
            if (!gmsAvailable) return
            mutex.withLock {
                runCatching {
                    val request = DeleteBytesRequest.Builder().setKeys(listOf(KEY)).build()
                    Blockstore.getClient(context).deleteBytes(request).await()
                }.onFailure { Timber.w(it, "Block Store delete failed") }
                cache = null
                cacheValid = true
            }
        }

        companion object {
            const val KEY = "pantopus.account_hint"

            /** Block Store caps a single entry at 4 KB. */
            private const val MAX_BYTES = 4096
        }
    }

/** Hilt binding for the production store. */
@Module
@InstallIn(SingletonComponent::class)
abstract class AccountHintStoreModule {
    @Binds
    @Singleton
    abstract fun bindAccountHintStore(impl: BlockStoreAccountHintStore): AccountHintStore
}
