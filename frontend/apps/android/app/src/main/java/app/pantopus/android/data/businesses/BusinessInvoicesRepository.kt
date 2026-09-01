package app.pantopus.android.data.businesses

import app.pantopus.android.data.api.models.businesses.BusinessInvoiceResponse
import app.pantopus.android.data.api.models.businesses.BusinessInvoicesResponse
import app.pantopus.android.data.api.models.businesses.PayInvoiceRequest
import app.pantopus.android.data.api.models.businesses.PayInvoiceResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BusinessInvoicesApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps the recipient-side [BusinessInvoicesApi] in the [NetworkResult]
 * taxonomy. Mirrors iOS `BusinessInvoicesEndpoints`.
 */
@Singleton
class BusinessInvoicesRepository
    @Inject
    constructor(
        private val api: BusinessInvoicesApi,
    ) {
        /** `GET api/businesses/invoices/{invoiceId}`. */
        suspend fun invoice(invoiceId: String): NetworkResult<BusinessInvoiceResponse> = safeApiCall { api.receivedInvoice(invoiceId) }

        /** `GET api/businesses/invoices/received`. */
        suspend fun receivedInvoices(
            page: Int = 1,
            pageSize: Int = 20,
        ): NetworkResult<BusinessInvoicesResponse> = safeApiCall { api.receivedInvoices(page, pageSize) }

        /** `POST api/businesses/invoices/{invoiceId}/pay` — PaymentIntent client secret. */
        suspend fun payInvoice(invoiceId: String): NetworkResult<PayInvoiceResponse> =
            safeApiCall { api.payInvoice(invoiceId, PayInvoiceRequest()) }

        /** `POST api/businesses/invoices/{invoiceId}/confirm` — mark it paid. */
        suspend fun confirmInvoicePayment(invoiceId: String): NetworkResult<BusinessInvoiceResponse> =
            safeApiCall { api.confirmInvoicePayment(invoiceId) }
    }
