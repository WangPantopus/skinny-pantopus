package app.pantopus.android.data.auth

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Never sends the same DPoP proof twice.
 *
 * OkHttp re-sends a request on its own when the connection fails after the
 * request went out (`retryOnConnectionFailure`, on by default), with the same
 * headers. The server keeps each proof's `jti` single-use, so the re-send of a
 * refresh, device registration or step-up key answered 401 `DPOP_REPLAY`, which
 * signs the person out. Installed as a **network** interceptor, this runs on
 * every network attempt: a proof it has already sent is re-minted
 * ([DPoPProofBuilder.remint]) with the same `htm`, `htu` and `rth` and a fresh
 * `jti` and `iat`. A proof it can't re-mint (another key, unreadable) goes out
 * as it is, as before.
 */
@Singleton
class DPoPReplayGuard
    @Inject
    constructor(
        private val proofs: DPoPProofBuilder,
        private val deviceKeyStore: DeviceKeyStore,
    ) : Interceptor {
        private val sent =
            object : LinkedHashMap<String, Boolean>(SENT_CAPACITY, LOAD_FACTOR, true) {
                override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Boolean>?): Boolean = size > SENT_CAPACITY
            }

        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            val proof = request.header(HEADER) ?: return chain.proceed(request)
            val alreadySent = synchronized(sent) { sent.put(proof, true) != null }
            if (!alreadySent) return chain.proceed(request)
            val fresh =
                deviceKeyStore.existing()?.let { key -> runCatching { proofs.remint(key, proof) }.getOrNull() }
                    ?: return chain.proceed(request)
            synchronized(sent) { sent[fresh] = true }
            return chain.proceed(request.newBuilder().header(HEADER, fresh).build())
        }

        private companion object {
            const val HEADER = "DPoP"

            /** Proofs are minted for a handful of auth calls; a short memory covers every re-send. */
            const val SENT_CAPACITY = 64
            const val LOAD_FACTOR = 0.75f
        }
    }
