package app.pantopus.android.data.store

import app.pantopus.android.data.auth.AuthRepository
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton

/** Contract §6 "Memory": a list's copies of its items are kept for at most this many items. */
private const val MAX_SEEDS = 300

private const val LOAD_FACTOR = 0.75f

/**
 * A list's copies of its items (the feed's posts), standing in for each item's own read until that read answers
 * (Instant Screens: a post opened from the feed shows at once). Memory only, never fresh and never saved on the phone,
 * least recently used first beyond [MAX_SEEDS]. They belong to the signed-in account: another account (or none) finds
 * none of them.
 */
@Singleton
class ScreenSeeds
    @Inject
    constructor(
        private val auth: Provider<AuthRepository>,
    ) {
        // Access order; guarded by itself.
        private val seeds =
            object : LinkedHashMap<String, Any>(MAX_SEEDS, LOAD_FACTOR, true) {
                override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Any>?): Boolean = size > MAX_SEEDS
            }
        private var owner: String? = null

        /** Keeps [data] as [key]'s stand-in. */
        fun <T : Any> put(
            key: StoreKey<T>,
            data: T,
        ) {
            val account = accountId() ?: return
            synchronized(seeds) {
                ownedBy(account)
                seeds[key.id] = data
            }
        }

        /** [key]'s stand-in, or null. */
        fun <T : Any> get(key: StoreKey<T>): T? {
            val account = accountId() ?: return null
            return synchronized(seeds) {
                ownedBy(account)
                @Suppress("UNCHECKED_CAST")
                seeds[key.id] as T?
            }
        }

        /** Another account signed in: the last one's stand-ins go first. */
        private fun ownedBy(account: String) {
            if (owner == account) return
            seeds.clear()
            owner = account
        }

        private fun accountId(): String? = (auth.get().state.value as? AuthRepository.State.SignedIn)?.user?.id
    }
