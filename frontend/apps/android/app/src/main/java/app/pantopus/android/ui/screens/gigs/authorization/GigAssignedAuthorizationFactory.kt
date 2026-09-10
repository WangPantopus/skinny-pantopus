@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.authorization

import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.ui.screens.gigs.checkout.GigCheckoutIdentity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.map
import retrofit2.Retrofit
import java.security.MessageDigest
import javax.inject.Inject

class GigAssignedAuthorizationFactory
    @Inject
    constructor(
        private val repository: GigsRepository,
        private val tokens: TokenStorage,
        private val retrofit: Retrofit,
    ) {
        fun create(
            scope: CoroutineScope,
            onReady: () -> Unit,
        ): GigAssignedAuthorizationCoordinator =
            GigAssignedAuthorizationCoordinator(
                repository,
                scope,
                { currentIdentity() },
                tokens.accessTokenFlow.map { Unit },
                onReady,
            )

        private suspend fun currentIdentity(): GigCheckoutIdentity? {
            val stored = tokens.sessionCredentials() ?: return null
            val session =
                stored.sessionId ?: MessageDigest.getInstance("SHA-256")
                    .digest(stored.accessToken.toByteArray()).joinToString("") { "%02x".format(it) }
            return GigCheckoutIdentity(stored.userId, session, retrofit.baseUrl().toString())
        }
    }
