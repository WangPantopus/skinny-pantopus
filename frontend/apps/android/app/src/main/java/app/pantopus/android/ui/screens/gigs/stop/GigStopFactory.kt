@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.stop

import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.gigs.GigStopRepository
import app.pantopus.android.data.gigs.PersistentPendingGigStopStore
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.map
import retrofit2.Retrofit
import java.security.MessageDigest
import javax.inject.Inject

data class GigStopIdentity(val actorId: String, val sessionId: String, val apiOrigin: String)

class GigStopFactory
    @Inject
    constructor(
        private val repository: GigStopRepository,
        private val store: PersistentPendingGigStopStore,
        private val tokens: TokenStorage,
        private val auth: AuthRepository,
        private val retrofit: Retrofit,
        private val moshi: Moshi,
    ) {
        fun create(
            scope: CoroutineScope,
            onCompleted: () -> Unit,
        ): GigStopCoordinator =
            GigStopCoordinator(
                repository,
                store,
                scope,
                { currentIdentity() },
                moshi,
                { currentScopeMarker() },
                tokens.accessTokenFlow.map { Unit },
                onCompleted,
            )

        private suspend fun currentIdentity(): GigStopIdentity? {
            val credentials = tokens.sessionCredentials() ?: return null
            val tokenMarker = tokenMarker(credentials.accessToken)
            if (credentials.userId != currentActor() || tokenMarker != tokens.accessTokenMarker()) return null
            val session =
                credentials.sessionId ?: tokenMarker
            return GigStopIdentity(credentials.userId, session, retrofit.baseUrl().toString())
        }

        private fun currentActor(): String? = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        private fun currentScopeMarker(): String? {
            val actor = currentActor() ?: return null
            val token = tokens.accessTokenMarker() ?: return null
            return "$actor|$token|${retrofit.baseUrl()}"
        }

        private fun tokenMarker(token: String): String =
            MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
    }
