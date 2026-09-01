package app.pantopus.android.data.payments

import app.pantopus.android.data.api.models.payments.PaymentHistoryResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PaymentHistoryApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [PaymentHistoryApi] in the [NetworkResult] taxonomy. */
@Singleton
class PaymentHistoryRepository
    @Inject
    constructor(
        private val api: PaymentHistoryApi,
    ) {
        /** `GET api/payments/history` — merged payment + payout feed. */
        suspend fun history(
            limit: Int = 50,
            offset: Int = 0,
        ): NetworkResult<PaymentHistoryResponse> = safeApiCall { api.history(limit, offset) }
    }
