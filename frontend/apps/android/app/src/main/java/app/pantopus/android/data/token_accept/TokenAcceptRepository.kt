package app.pantopus.android.data.token_accept

import app.pantopus.android.data.api.models.token_accept.BusinessSeatAcceptBody
import app.pantopus.android.data.api.models.token_accept.BusinessSeatAcceptResponse
import app.pantopus.android.data.api.models.token_accept.BusinessSeatDeclineBody
import app.pantopus.android.data.api.models.token_accept.BusinessSeatInviteResponse
import app.pantopus.android.data.api.models.token_accept.GenericAcknowledgement
import app.pantopus.android.data.api.models.token_accept.GuestPassResponse
import app.pantopus.android.data.api.models.token_accept.HomeAcceptResponse
import app.pantopus.android.data.api.models.token_accept.HomeInviteResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.TokenAcceptApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the three resolver routes + accept/decline POSTs in
 *  [NetworkResult]. */
@Singleton
class TokenAcceptRepository
    @Inject
    constructor(
        private val api: TokenAcceptApi,
    ) {
        suspend fun homeInvite(token: String): NetworkResult<HomeInviteResponse> = safeApiCall { api.homeInvite(token) }

        suspend fun businessSeatInvite(token: String): NetworkResult<BusinessSeatInviteResponse> =
            safeApiCall { api.businessSeatInvite(token) }

        suspend fun guestPass(token: String): NetworkResult<GuestPassResponse> = safeApiCall { api.guestPass(token) }

        suspend fun acceptHomeInvite(token: String): NetworkResult<HomeAcceptResponse> = safeApiCall { api.acceptHomeInvite(token) }

        suspend fun declineHomeInvite(invitationId: String): NetworkResult<GenericAcknowledgement> =
            safeApiCall { api.declineHomeInvite(invitationId) }

        suspend fun acceptBusinessSeat(
            token: String,
            displayName: String? = null,
        ): NetworkResult<BusinessSeatAcceptResponse> =
            safeApiCall { api.acceptBusinessSeat(BusinessSeatAcceptBody(token = token, displayName = displayName)) }

        suspend fun declineBusinessSeat(token: String): NetworkResult<GenericAcknowledgement> =
            safeApiCall { api.declineBusinessSeat(BusinessSeatDeclineBody(token = token)) }
    }
