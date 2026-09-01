package app.pantopus.android.data.businessfounding

import app.pantopus.android.data.api.models.businessfounding.FoundingOfferStatusDto
import app.pantopus.android.data.api.models.businessfounding.FoundingSlotClaimDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessFoundingApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [BusinessFoundingApi] in the `NetworkResult` taxonomy. */
@Singleton
class BusinessFoundingRepository
    @Inject
    constructor(
        private val api: BusinessFoundingApi,
    ) {
        suspend fun status(): NetworkResult<FoundingOfferStatusDto> = safeApiCall { api.foundingOfferStatus() }

        suspend fun claim(businessId: String): NetworkResult<FoundingSlotClaimDto> = safeApiCall { api.claimFoundingOffer(businessId) }
    }
