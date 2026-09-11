@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import android.util.Base64
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.Retrofit
import java.io.IOException
import java.net.HttpURLConnection.HTTP_CLIENT_TIMEOUT
import java.security.GeneralSecurityException
import java.security.MessageDigest
import javax.inject.Inject

internal const val CLAIM_SESSION_CHANGED = "Your session changed. Reopen the claim to continue."
internal const val CLAIM_SNAPSHOT_CHANGED = "The claim changed. Reopen it and review the current evidence."
internal const val CLAIM_PENDING_DECISION = "Retry the previous decision or reload the claim before choosing another action."
internal const val CLAIM_DISPUTE_REVIEW = "This disputed claim needs the dedicated dispute review flow."
private const val HTTP_TOO_MANY_REQUESTS = 429

class HomeClaimSessionScopeFactory
    @Inject
    constructor(
        private val tokens: TokenStorage,
        private val auth: AuthRepository,
        private val retrofit: Retrofit,
    ) {
        fun create(scope: CoroutineScope): HomeClaimSessionScope =
            HomeClaimSessionScope(
                scope = scope,
                tokens = tokens.accessTokenFlow,
                account = { (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id },
                accounts = auth.state.map { (it as? AuthRepository.State.SignedIn)?.user?.id },
                origin = retrofit.baseUrl().toString(),
                currentCredentials = { tokens.sessionCredentials() },
            )
    }

/** Capture the TokenStorage StateFlow immediately, before any suspended read. */
class HomeClaimSessionScope(
    scope: CoroutineScope,
    tokens: Flow<String?>,
    private val account: () -> String?,
    accounts: Flow<String?>,
    private val origin: String,
    private val currentCredentials: suspend () -> TokenStorage.SessionCredentials?,
) {
    private val openingAccount = account()
    private var openingIdentity: String? = null
    private var initialized = false
    private val _invalidated = MutableStateFlow(false)
    val invalidated = _invalidated.asStateFlow()

    init {
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            tokens.collect { token ->
                val current = tokenIdentity(token, account())
                if (!initialized) {
                    initialized = true
                    openingIdentity = current
                } else if (current != openingIdentity) {
                    _invalidated.value = true
                }
                if (current == null || account() != openingAccount) _invalidated.value = true
            }
        }
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            accounts.collect { if (it != openingAccount) _invalidated.value = true }
        }
    }

    val isCurrent: Boolean
        get() = initialized && openingIdentity != null && !_invalidated.value && openingAccount != null && account() == openingAccount

    val actorId: String? get() = openingAccount.takeIf { isCurrent }

    /** Draft restoration metadata never contains raw tokens or session IDs. */
    val storageIdentityHash: String?
        get() =
            openingIdentity?.takeIf { isCurrent }?.let {
                MessageDigest.getInstance("SHA-256").digest(it.toByteArray()).joinToString("") { byte -> "%02x".format(byte) }
            }

    suspend fun requireCurrent() {
        check(isCurrent) { CLAIM_SESSION_CHANGED }
        val stored =
            try {
                currentCredentials()
            } catch (error: IOException) {
                sessionReadFailed(error)
            } catch (error: GeneralSecurityException) {
                sessionReadFailed(error)
            } catch (error: SecurityException) {
                sessionReadFailed(error)
            }
        val identity = stored?.let { tokenIdentity(it.accessToken, it.userId, it.sessionId) }
        if (!isCurrent || identity == null || identity != openingIdentity) {
            _invalidated.value = true
            error(CLAIM_SESSION_CHANGED)
        }
    }

    suspend fun confirmCurrent(): Boolean =
        try {
            requireCurrent()
            true
        } catch (cancelled: kotlinx.coroutines.CancellationException) {
            throw cancelled
        } catch (_: IllegalStateException) {
            _invalidated.value = true
            false
        } catch (_: IllegalArgumentException) {
            _invalidated.value = true
            false
        }

    private fun sessionReadFailed(cause: Exception): Nothing {
        _invalidated.value = true
        throw IllegalStateException("Could not verify your current session. Reopen the claim and retry.", cause)
    }

    private fun tokenIdentity(
        token: String?,
        user: String?,
        storedSession: String? = null,
    ): String? {
        if (token.isNullOrBlank() || user.isNullOrBlank() || user != openingAccount) return null
        val claims = runCatching { JSONObject(String(Base64.decode(token.split('.')[1], Base64.URL_SAFE or Base64.NO_WRAP))) }.getOrNull()
        val subject = claims?.optString("sub")?.takeIf(String::isNotBlank)
        if (subject != null && subject != user) return null
        val tokenSession = claims?.optString("session_id")?.takeIf(String::isNotBlank)
        if (storedSession != null && tokenSession != null && storedSession != tokenSession) return null
        val session =
            tokenSession
                ?: MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
        return "$origin|$user|$session"
    }
}

data class HomeClaimReviewSnapshot(
    val homeId: String,
    val claimId: String,
    val claimantId: String,
    val reviewToken: String,
    val claimType: String,
    val eligibleEvidenceCount: Int,
    val evidenceCount: Int,
) {
    val summary: String get() = "Claim type: $claimType. $eligibleEvidenceCount of $evidenceCount evidence items are eligible for review."

    companion object {
        fun validToken(token: String?): Boolean = token?.matches(Regex("^[a-f0-9]{64}$")) == true
    }
}

/** HTTP timeout and rate-limit replies do not resolve an earlier unknown decision. */
internal fun Throwable.isFinalHomeClaimFailure(): Boolean {
    val status = (this as? NetworkError)?.code ?: return false
    return status in 400..499 && status != HTTP_CLIENT_TIMEOUT && status != HTTP_TOO_MANY_REQUESTS
}
