@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.refunds

import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PersistentPendingRefundStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.map
import retrofit2.Retrofit
import java.security.MessageDigest
import javax.inject.Inject

data class GigRefundIdentity(val actorId: String, val session: String, val apiOrigin: String)

class GigRefundFactory
    @Inject
    constructor(
        private val repository: PaymentsRepository,
        private val store: PersistentPendingRefundStore,
        private val tokens: TokenStorage,
        private val retrofit: Retrofit,
        private val moshi: Moshi,
    ) {
        fun create(
            scope: CoroutineScope,
            onChanged: () -> Unit,
        ): GigRefundCoordinator =
            GigRefundCoordinator(
                repository,
                store,
                scope,
                { currentIdentity() },
                moshi,
                tokens.accessTokenFlow.map { Unit },
                onChanged,
            )

        private suspend fun currentIdentity(): GigRefundIdentity? {
            val account = tokens.sessionIdentity() ?: return null
            val session =
                account.second ?: tokens.accessToken()?.let { token ->
                    MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
                } ?: return null
            if (tokens.sessionIdentity() != account) return null
            return GigRefundIdentity(account.first, session, retrofit.baseUrl().toString())
        }
    }
