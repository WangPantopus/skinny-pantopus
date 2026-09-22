package app.pantopus.android.data.payments

import app.pantopus.android.data.api.models.payments.PaymentRefundAttempt
import app.pantopus.android.data.api.models.payments.PaymentRefundHistoryDto
import app.pantopus.android.data.api.models.payments.PaymentRefundRequestDto
import app.pantopus.android.data.api.models.payments.PaymentRefundResultDto
import app.pantopus.android.data.api.models.payments.RefundPaymentSummary
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.PaymentsApi
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class PaymentRefundApiTest {
    private val moshi = Moshi.Builder().build()
    private val paymentId = "11111111-1111-4111-8111-111111111111"
    private val attempt = PaymentRefundAttempt("22222222-2222-4222-8222-222222222222", null, "requested_by_customer")
    private val summary = RefundPaymentSummary(paymentId, "refund_pending", 1000, 0, "usd", payeeReleaseStatus = "held")
    private val receipt =
        PaymentRefundRequestDto(attempt.requestId, paymentId, "refund", 1000, "usd", "pending", true, null, attempt.reason)

    private fun repository(server: MockWebServer): PaymentsRepository =
        PaymentsRepository(
            Retrofit.Builder().baseUrl(
                server.url("/"),
            ).addConverterFactory(MoshiConverterFactory.create(moshi)).build().create(PaymentsApi::class.java),
        )

    @Test fun historyIsReadOnlyAndPostKeepsOriginalNullableTermsAndReceiptStatus() =
        runTest {
            MockWebServer().use { server ->
                val repository = repository(server)
                server.enqueue(
                    MockResponse().setBody(
                        moshi.adapter(PaymentRefundHistoryDto::class.java).toJson(PaymentRefundHistoryDto(emptyList(), summary)),
                    ),
                )
                assertTrue(repository.refunds(paymentId) is NetworkResult.Success)
                val read = server.takeRequest()
                assertEquals("GET", read.method)
                assertEquals("/api/payments/$paymentId/refunds", read.path)
                assertEquals(0L, read.bodySize)
                val result = moshi.adapter(PaymentRefundResultDto::class.java).toJson(PaymentRefundResultDto(receipt, summary))
                server.enqueue(MockResponse().setBody(result.dropLast(1) + ",\"success\":true}"))
                val response = repository.refund(paymentId, attempt) as NetworkResult.Success
                assertEquals("pending", response.data.refundRequest.status)
                val request = server.takeRequest()
                assertEquals("POST", request.method)
                assertEquals("/api/payments/$paymentId/refund", request.path)
                val body = moshi.adapter(Map::class.java).fromJson(request.body.readUtf8()).orEmpty()
                assertEquals(attempt.requestId, body["requestId"])
                assertEquals(attempt.reason, body["reason"])
                assertFalse(body.containsKey("amount"))
                assertFalse(body.containsKey("description"))
            }
        }

    @Test fun exactConflictBodyIsAvailableForSafeRecovery() =
        runTest {
            MockWebServer().use { server ->
                val body = "{\"code\":\"REFUND_ACTIVE\",\"refundRequest\":${moshi.adapter(
                    PaymentRefundRequestDto::class.java,
                ).toJson(receipt)}}"
                server.enqueue(MockResponse().setResponseCode(409).setBody(body))
                val response = repository(server).refund(paymentId, attempt.copy(requestedAmountCents = 300)) as NetworkResult.Failure
                val error = response.error as NetworkError.ClientError
                assertEquals(409, error.code)
                assertEquals(body, error.body)
                val request = server.takeRequest()
                assertEquals(300.0, moshi.adapter(Map::class.java).fromJson(request.body.readUtf8())?.get("amount"))
            }
        }
}
