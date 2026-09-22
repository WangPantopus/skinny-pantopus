@file:Suppress("MagicNumber")

package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigAssignedAuthorizationBody
import app.pantopus.android.data.api.models.gigs.GigAssignedAuthorizationDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.GigsApi
import com.squareup.moshi.Moshi
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class GigAssignedAuthorizationApiTest {
    private val moshi = Moshi.Builder().build()

    private fun repository(server: MockWebServer) =
        GigsRepository(
            Retrofit.Builder().baseUrl(server.url("/")).addConverterFactory(MoshiConverterFactory.create(moshi))
                .build().create(GigsApi::class.java),
        )

    @Test fun statusEndpointCarriesNoResumeIntentAndSuccessDoesNotDecodeAsReady() =
        runTest {
            MockWebServer().use { server ->
                server.enqueue(MockResponse().setBody("{\"success\":true,\"recoveryState\":\"pending\"}"))
                val result = repository(server).assignedAuthorizationStatus("gig") as NetworkResult.Success
                assertNull(result.data.authorizationReady)
                val request = server.takeRequest()
                assertEquals("/api/gigs/gig/refresh-payment-status", request.path)
                assertEquals("POST", request.method)
                assertEquals(0L, request.bodySize)
            }
        }

    @Test fun continuationSendsOpeningSessionAndDisplayedTermsOnExactGig() =
        runTest {
            MockWebServer().use { server ->
                server.enqueue(MockResponse().setBody("{\"authorizationReady\":false,\"recoveryState\":\"pending\"}"))
                val body = GigAssignedAuthorizationBody("delegate", "a".repeat(64), "payment", "business", "worker", 1200)
                val result = repository(server).continueAssignedAuthorization("gig", body)
                assertTrue(result is NetworkResult.Success)
                val request = server.takeRequest()
                assertEquals("/api/gigs/gig/continue-authorization", request.path)
                val sent = moshi.adapter(GigAssignedAuthorizationBody::class.java).fromJson(request.body.readUtf8())
                assertEquals(body, sent)
            }
        }

    @Test fun receiptDecodesExplicitPendingCancellationAndAvailabilityWithoutDefaultsToSuccess() {
        val response =
            moshi.adapter(GigAssignedAuthorizationDto::class.java).fromJson(
                "{\"cancellationPending\":true,\"authorizationAvailableAt\":\"2026-10-10T01:00:00Z\",\"authorizationReady\":false}",
            )
        assertEquals(true, response?.cancellationPending)
        assertEquals(false, response?.authorizationReady)
        assertEquals("2026-10-10T01:00:00Z", response?.authorizationAvailableAt)
    }
}
