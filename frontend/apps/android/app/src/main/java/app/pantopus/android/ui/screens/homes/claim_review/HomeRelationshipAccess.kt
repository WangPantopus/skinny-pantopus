@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import app.pantopus.android.data.api.models.homes.HomeRelationshipResponse
import app.pantopus.android.data.api.models.homes.HomeRelationshipReview
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeRelationshipApi
import app.pantopus.android.data.homes.HomeRelationshipScope
import app.pantopus.android.data.homes.PendingHomeRelationship
import app.pantopus.android.data.homes.homeTaskUUID
import app.pantopus.android.data.homes.validPendingRelationship
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

internal const val RELATIONSHIP_CHANGED = "The relationship decision could not be verified. Reload to recover the original."

class HomeRelationshipAccess(
    val identity: HomeRelationshipScope,
    private val session: HomeClaimSessionScope,
    private val api: HomeRelationshipApi,
) {
    private var serverSession: String? = null
    val isCurrent get() = session.isCurrent
    val invalidated get() = session.invalidated

    suspend fun requireCurrent() = session.requireCurrent()

    suspend fun read(claim: String): HomeRelationshipReview {
        session.requireCurrent()
        check(homeTaskUUID(identity.homeId) && homeTaskUUID(claim)) { RELATIONSHIP_CHANGED }
        val result = safeApiCall { api.read(identity.homeId, claim, serverSession) }.relationshipValue()
        session.requireCurrent()
        check(result.matches(identity.homeId, claim, identity.actorId)) { RELATIONSHIP_CHANGED }
        if (serverSession != null && serverSession != result.session.sessionScope) throw HomeRelationshipSessionChanged()
        serverSession = result.session.sessionScope
        return result
    }

    suspend fun decide(
        original: PendingHomeRelationship,
        beforeDispatch: suspend (HomeRelationshipReview) -> Unit,
    ): HomeRelationshipResponse {
        val current = read(original.claimId)
        check(validPendingRelationship(original, identity) && session.actorId == identity.actorId) { RELATIONSHIP_CHANGED }
        beforeDispatch(current)
        currentCoroutineContext().ensureActive()
        check(isCurrent) { CLAIM_SESSION_CHANGED }
        val response =
            try {
                safeApiCall {
                    api.decide(identity.homeId, original.claimId, original.command, checkNotNull(serverSession))
                }.relationshipValue()
            } catch (error: NetworkError) {
                throw HomeRelationshipDispatchFailure(error)
            }
        session.requireCurrent()
        check(response.matches(original, current.claim.claimantUserId)) { RELATIONSHIP_CHANGED }
        return response
    }
}

internal class HomeRelationshipSessionChanged : IllegalStateException(CLAIM_SESSION_CHANGED)

internal class HomeRelationshipDispatchFailure(val failure: NetworkError) : IllegalStateException(failure.message, failure)

internal fun <T> NetworkResult<T>.relationshipValue(): T =
    when (this) {
        is NetworkResult.Success -> data
        is NetworkResult.Failure -> throw error
    }
