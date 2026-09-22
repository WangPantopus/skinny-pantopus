@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.authorization

import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.gigs.checkout.GigPaymentIdentitySource
import kotlinx.coroutines.CoroutineScope
import javax.inject.Inject

class GigAssignedAuthorizationFactory
    @Inject
    constructor(
        private val repository: GigsRepository,
        private val identities: GigPaymentIdentitySource,
    ) {
        fun create(
            scope: CoroutineScope,
            onReady: () -> Unit,
        ): GigAssignedAuthorizationCoordinator =
            GigAssignedAuthorizationCoordinator(
                repository,
                scope,
                identities::paymentIdentity,
                identities::scopeMarker,
                identities.changes,
                onReady,
            )
    }
