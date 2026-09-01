package app.pantopus.android.data.membership

import app.pantopus.android.data.api.models.membership.MembershipRefundRequestBody
import app.pantopus.android.data.api.models.membership.MembershipTierChangeBody
import app.pantopus.android.data.api.models.membership.PersonaMembershipResponse
import app.pantopus.android.data.api.models.membership.PersonaPublicTiersResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MembershipApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps the fan-side membership lifecycle in [NetworkResult]: read, cancel,
 * upgrade (immediate), downgrade (scheduled at period end), SLA-missed
 * refund request, and the public tier ladder the picker offers.
 */
@Singleton
class MembershipRepository
    @Inject
    constructor(
        private val api: MembershipApi,
    ) {
        suspend fun membership(personaId: String): NetworkResult<PersonaMembershipResponse> = safeApiCall { api.membership(personaId) }

        /** Single-tap cancel — no charge (Phase-1 safe). */
        suspend fun cancel(personaId: String): NetworkResult<PersonaMembershipResponse> = safeApiCall { api.cancel(personaId) }

        /** Immediate move to a higher tier rank. */
        suspend fun upgrade(
            personaId: String,
            tierRank: Int,
        ): NetworkResult<PersonaMembershipResponse> = safeApiCall { api.upgrade(personaId, MembershipTierChangeBody(tierRank)) }

        /** Move to a lower tier rank — scheduled for the end of the period. */
        suspend fun downgrade(
            personaId: String,
            tierRank: Int,
        ): NetworkResult<PersonaMembershipResponse> = safeApiCall { api.downgrade(personaId, MembershipTierChangeBody(tierRank)) }

        /** SLA-missed refund request (the only reason v1.0 supports). */
        suspend fun requestRefund(
            personaId: String,
            reason: String = "sla_missed",
            threadId: String? = null,
        ): NetworkResult<PersonaMembershipResponse> =
            safeApiCall {
                api.refundRequest(personaId, MembershipRefundRequestBody(reason = reason, threadId = threadId))
            }

        /** Public tier ladder, addressed by handle. */
        suspend fun publicTiers(handle: String): NetworkResult<PersonaPublicTiersResponse> = safeApiCall { api.publicTiers(handle) }
    }
