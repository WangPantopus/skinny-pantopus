@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.refunds

import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PersistentPendingRefundStore
import app.pantopus.android.ui.screens.gigs.checkout.GigPaymentIdentitySource
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CoroutineScope
import javax.inject.Inject

data class GigRefundIdentity(val actorId: String, val session: String, val apiOrigin: String)

class GigRefundFactory
    @Inject
    constructor(
        private val repository: PaymentsRepository,
        private val store: PersistentPendingRefundStore,
        private val identities: GigPaymentIdentitySource,
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
                identities::scopeMarker,
                identities.changes,
                onChanged,
            )

        private suspend fun currentIdentity(): GigRefundIdentity? =
            identities.paymentIdentity()?.let { snapshot ->
                GigRefundIdentity(snapshot.userId, checkNotNull(snapshot.sessionId), snapshot.apiOrigin)
            }
    }
