package app.pantopus.android.data.earn

import app.pantopus.android.data.api.models.earn.EarnCloseOfferRequest
import app.pantopus.android.data.api.models.earn.EarnCloseOfferResponse
import app.pantopus.android.data.api.models.earn.EarnOffersResponse
import app.pantopus.android.data.api.models.earn.EarnOpenOfferRequest
import app.pantopus.android.data.api.models.earn.EarnOpenOfferResponse
import app.pantopus.android.data.api.models.earn.EarnRevealOfferResponse
import app.pantopus.android.data.api.models.earn.EarnSaveOfferResponse
import app.pantopus.android.data.api.models.mailbox.v2.EarnBalanceResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.EarnOffersApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Mailbox Earn drawer — paid-offer wall data access. Wraps
 * [EarnOffersApi] in the shared `NetworkResult` taxonomy so the view-model
 * can route the daily-cap 429 as its own first-class state.
 *
 * Mirrors the iOS `EarnOffersViewModel` call sites (which talk to
 * `EarnOffersEndpoints` directly).
 */
@Singleton
class EarnOffersRepository
    @Inject
    constructor(
        private val api: EarnOffersApi,
    ) {
        /** `GET /api/mailbox/v2/earn/offers` — active offers for the caller. */
        suspend fun offers(): NetworkResult<EarnOffersResponse> = safeApiCall { api.offers() }

        /** `GET /api/mailbox/v2/earn/balance` — server-computed payout sums. */
        suspend fun balance(): NetworkResult<EarnBalanceResponse> = safeApiCall { api.balance() }

        /**
         * `POST /api/mailbox/v2/earn/open` — opens the envelope. A 429
         * surfaces as `NetworkError.ClientError(429)`; that is the daily cap.
         */
        suspend fun openOffer(offerId: String): NetworkResult<EarnOpenOfferResponse> =
            safeApiCall { api.openOffer(EarnOpenOfferRequest(offerId = offerId)) }

        /** `POST /api/mailbox/v2/earn/close/:offerId` — banks the reward. */
        suspend fun closeOffer(
            offerId: String,
            dwellMs: Long,
        ): NetworkResult<EarnCloseOfferResponse> = safeApiCall { api.closeOffer(offerId, EarnCloseOfferRequest(dwellMs = dwellMs)) }

        /** `POST /api/mailbox/v2/earn/save/:offerId`. */
        suspend fun saveOffer(offerId: String): NetworkResult<EarnSaveOfferResponse> = safeApiCall { api.saveOffer(offerId) }

        /** `POST /api/mailbox/v2/earn/reveal/:offerId`. */
        suspend fun revealOffer(offerId: String): NetworkResult<EarnRevealOfferResponse> = safeApiCall { api.revealOffer(offerId) }
    }
