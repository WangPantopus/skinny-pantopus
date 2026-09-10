@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.gigs.refunds

import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import app.pantopus.android.data.api.models.payments.PaymentRefundHistoryDto
import app.pantopus.android.data.api.models.payments.RefundPaymentSummary
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.payments.PersistentPendingRefundStore
import app.pantopus.android.ui.screens.gigs.checkout.GigPaymentIdentitySource
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import java.security.MessageDigest

@OptIn(ExperimentalCoroutinesApi::class)
class GigRefundFactoryTest {
    @Test fun legacySessionWorksAndTokenReplacementHidesIdleDataUsingTheInjectedApiScope() =
        runTest {
            val tokens = mockk<TokenStorage>()
            val repository = mockk<PaymentsRepository>()
            val store = mockk<PersistentPendingRefundStore>()
            val tokenFlow = MutableStateFlow<String?>("legacy-one")
            coEvery { tokens.sessionCredentials() } coAnswers {
                tokenFlow.value?.let { TokenStorage.SessionCredentials("payer", null, it) }
            }
            every { tokens.accessTokenMarker() } answers {
                tokenFlow.value?.let { token ->
                    MessageDigest.getInstance("SHA-256").digest(token.toByteArray()).joinToString("") { "%02x".format(it) }
                }
            }
            val authState =
                MutableStateFlow<AuthRepository.State>(
                    AuthRepository.State.SignedIn(UserDto("payer", "test@example.invalid", "Test", null)),
                )
            every { tokens.accessTokenFlow } returns tokenFlow
            val id = "11111111-1111-4111-8111-111111111111"
            val summary = RefundPaymentSummary(id, "captured_hold", 1000, currency = "usd", payeeReleaseStatus = "held")
            coEvery { repository.refunds(id) } returns NetworkResult.Success(PaymentRefundHistoryDto(emptyList(), summary))
            coEvery { store.read(any()) } returns null
            val factory =
                GigRefundFactory(
                    repository,
                    store,
                    GigPaymentIdentitySource(
                        tokens,
                        mockk { every { state } returns authState },
                        Retrofit.Builder().baseUrl("https://injected.example.invalid/").build(),
                    ),
                    Moshi.Builder().build(),
                )
            val flow = factory.create(backgroundScope) {}
            flow.open("gig", GigPaymentDto(id = id, gigId = "gig", payerId = "payer", amountTotal = 1000, currency = "usd"))
            runCurrent()
            assertTrue(flow.state.value.mayRequest)
            coVerify(exactly = 1) { store.read("https://injected.example.invalid/|payer|$id") }
            tokenFlow.value = "legacy-two"
            runCurrent()
            assertTrue(flow.state.value.invalidated)
            assertNull(flow.state.value.summary)
            assertFalse(flow.state.value.mayRequest)
            tokenFlow.value = "legacy-one"
            runCurrent()
            assertTrue(flow.state.value.invalidated)
        }

    @Test fun labelsKeepPendingHoldReleaseDistinctFromCapturedCharges() {
        val payment = GigPaymentDto(amountTotal = 1000, tipAmount = 200)
        assertEquals("Authorization hold", gigPaymentAmountLabel(payment.copy(paymentStatus = "authorized")))
        assertEquals("Capture pending", gigPaymentAmountLabel(payment.copy(paymentStatus = "capture_pending")))
        assertEquals("Payment total", gigPaymentAmountLabel(payment.copy(paymentStatus = "refund_pending")))
        assertEquals(
            "Task charged",
            gigPaymentAmountLabel(payment.copy(paymentStatus = "refund_pending", capturedAt = "2026-09-10T00:00:00Z")),
        )
        assertEquals(1000, payment.amountTotal)
        assertEquals(200, payment.tipAmount)
    }
}
