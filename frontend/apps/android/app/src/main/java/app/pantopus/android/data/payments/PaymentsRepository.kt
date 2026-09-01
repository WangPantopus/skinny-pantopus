package app.pantopus.android.data.payments

import app.pantopus.android.data.api.models.payments.AddCardSheetParamsDto
import app.pantopus.android.data.api.models.payments.CreatePaymentIntentRequest
import app.pantopus.android.data.api.models.payments.PaymentIntentSheetParamsDto
import app.pantopus.android.data.api.models.payments.PaymentMethodAckResponse
import app.pantopus.android.data.api.models.payments.PaymentMethodsResponse
import app.pantopus.android.data.api.models.payments.PaymentsEarningsResponse
import app.pantopus.android.data.api.models.payments.SpendingSummaryResponse
import app.pantopus.android.data.api.models.payments.TipRefreshStatusResponse
import app.pantopus.android.data.api.models.payments.TipRequest
import app.pantopus.android.data.api.models.payments.TipResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PaymentsApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps the Stripe payment-methods [PaymentsApi] in the [NetworkResult] taxonomy. */
@Singleton
class PaymentsRepository
    @Inject
    constructor(
        private val api: PaymentsApi,
    ) {
        /** `GET /api/payments/methods`. */
        suspend fun paymentMethods(): NetworkResult<PaymentMethodsResponse> = safeApiCall { api.methods() }

        /** `POST /api/payments/payment-sheet-add-card`. */
        suspend fun addCardSheetParams(): NetworkResult<AddCardSheetParamsDto> = safeApiCall { api.addCardSheet() }

        /** `POST /api/payments/intent` — PaymentSheet params for a checkout (Block 3B). */
        suspend fun createPaymentIntent(request: CreatePaymentIntentRequest): NetworkResult<PaymentIntentSheetParamsDto> =
            safeApiCall { api.createIntent(request) }

        /** `POST /api/payments/tip` — tip the worker on a completed gig (Block 3D). */
        suspend fun tip(request: TipRequest): NetworkResult<TipResponse> = safeApiCall { api.tip(request) }

        /** `POST /api/payments/tip/{paymentId}/refresh-status` — reconcile a tip. */
        suspend fun tipRefreshStatus(paymentId: String): NetworkResult<TipRefreshStatusResponse> =
            safeApiCall { api.tipRefreshStatus(paymentId) }

        /** `GET /api/payments/earnings` — lifetime earned, integer cents. */
        suspend fun earnings(): NetworkResult<PaymentsEarningsResponse> = safeApiCall { api.earnings() }

        /** `GET /api/payments/spending` — lifetime spent, integer cents. */
        suspend fun spending(): NetworkResult<SpendingSummaryResponse> = safeApiCall { api.spending() }

        /** `PUT /api/payments/methods/{id}/default`. */
        suspend fun setDefault(id: String): NetworkResult<PaymentMethodAckResponse> = safeApiCall { api.setDefault(id) }

        /** `DELETE /api/payments/methods/{id}`. */
        suspend fun removeMethod(id: String): NetworkResult<PaymentMethodAckResponse> = safeApiCall { api.removeMethod(id) }
    }
