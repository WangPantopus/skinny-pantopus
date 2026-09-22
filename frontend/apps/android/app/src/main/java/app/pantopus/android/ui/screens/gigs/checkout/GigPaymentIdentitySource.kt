package app.pantopus.android.ui.screens.gigs.checkout

import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import kotlinx.coroutines.flow.combine
import retrofit2.Retrofit
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

/** Opening proof is synchronous; credential reads cannot adopt a later account or login. */
@Singleton
class GigPaymentIdentitySource
    @Inject
    constructor(
        private val tokens: TokenStorage,
        private val auth: AuthRepository,
        private val retrofit: Retrofit,
    ) {
        val changes get() = combine(tokens.accessTokenFlow, auth.state) { _, _ -> Unit }

        fun scopeMarker(): String {
            val principal =
                when (val state = auth.state.value) {
                    is AuthRepository.State.SignedIn -> "actor:${state.user.id}"
                    AuthRepository.State.SignedOut -> "anonymous"
                    else -> "unavailable"
                }
            return "$principal|${tokens.accessTokenMarker().orEmpty()}|${retrofit.baseUrl()}"
        }

        /** Anonymous reads require affirmative sign-out and no stored request credential. */
        suspend fun permitsAnonymousRead(): Boolean {
            if (auth.state.value != AuthRepository.State.SignedOut || tokens.accessTokenMarker() != null) return false
            return tokens.accessToken() == null &&
                auth.state.value == AuthRepository.State.SignedOut && tokens.accessTokenMarker() == null
        }

        /** Existing public/legacy detail reads remain distinct from payment admission. */
        suspend fun checkoutIdentity(): GigCheckoutIdentity? = readIdentity(legacySessionFallback = false)

        suspend fun paymentIdentity(): GigCheckoutIdentity? = readIdentity(legacySessionFallback = true)

        private suspend fun readIdentity(legacySessionFallback: Boolean): GigCheckoutIdentity? {
            val openingActor = actor() ?: return null
            val stored = tokens.sessionCredentials() ?: return null
            val tokenMarker =
                MessageDigest.getInstance("SHA-256").digest(stored.accessToken.toByteArray())
                    .joinToString("") { "%02x".format(it) }
            if (stored.userId != openingActor || actor() != openingActor || tokens.accessTokenMarker() != tokenMarker) return null
            val session = if (legacySessionFallback) stored.sessionId ?: tokenMarker else stored.sessionId
            return GigCheckoutIdentity(openingActor, session, retrofit.baseUrl().toString())
        }

        private fun actor(): String? = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id
    }
