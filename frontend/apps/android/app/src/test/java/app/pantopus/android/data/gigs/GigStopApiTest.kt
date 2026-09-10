package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigStopCommand
import app.pantopus.android.data.api.models.gigs.GigStopTerms
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.GigStopApi
import app.pantopus.android.di.NetworkModule
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class GigStopApiTest {
    private val moshi = NetworkModule.provideMoshi()

    private fun repository(server: MockWebServer) =
        GigStopRepository(
            Retrofit.Builder().baseUrl(server.url("/"))
                .addConverterFactory(MoshiConverterFactory.create(moshi)).build().create(GigStopApi::class.java),
        )

    @Test fun previewAndRequestUseReadonlyExactGigAndUuidPaths() =
        runTest {
            MockWebServer().use { server ->
                server.enqueue(MockResponse().setResponseCode(403))
                server.enqueue(MockResponse().setResponseCode(404))
                repository(server).preview("gig", "worker_release")
                repository(server).request("gig", "request")
                val preview = server.takeRequest()
                assertEquals("GET", preview.method)
                assertEquals("/api/gigs/gig/stop-preview?action=worker_release", preview.path)
                assertEquals(0L, preview.bodySize)
                val request = server.takeRequest()
                assertEquals("GET", request.method)
                assertEquals("/api/gigs/gig/stop-requests/request", request.path)
                assertEquals(0L, request.bodySize)
            }
        }

    @Test fun originalNullableCommandAndOpeningScopeSurviveJsonButPlainSuccessCannotComplete() =
        runTest {
            MockWebServer().use { server ->
                server.enqueue(MockResponse().setBody("{\"success\":true}"))
                val command =
                    GigStopCommand(
                        "request",
                        "close",
                        "actor",
                        "a".repeat(64),
                        GigStopTerms("gig", "owner", null, null, 0, "usd", "open", null, null, "standard", 0),
                        null,
                        null,
                    )
                val result = repository(server).submit("gig", command)
                assertTrue(result is NetworkResult.Failure)
                val sent = server.takeRequest()
                assertEquals("POST", sent.method)
                assertEquals("/api/gigs/gig/stop-requests", sent.path)
                val raw = sent.body.readUtf8()
                assertEquals(command, moshi.adapter(GigStopCommand::class.java).fromJson(raw))
                val sentTerms = checkNotNull(moshi.adapter(Map::class.java).fromJson(raw))["expectedTerms"] as Map<*, *>
                assertEquals(
                    setOf(
                        "gigId", "ownerId", "workerId", "paymentId", "amountCents", "currency", "gigStatus",
                        "acceptedAt", "acceptedBidId", "policy", "policyFeeCents",
                    ),
                    sentTerms.keys,
                )
                listOf("workerId", "paymentId", "acceptedAt", "acceptedBidId").forEach { key ->
                    assertTrue(sentTerms.containsKey(key))
                    assertNull(sentTerms[key])
                }
            }
        }

    @Test fun activeConflictRemainsStructuredAndDoesNotGetConvertedToSuccess() =
        runTest {
            MockWebServer().use { server ->
                server.enqueue(
                    MockResponse().setResponseCode(409).setBody("{\"code\":\"STOP_ACTIVE\",\"activeRequestId\":\"same-request\"}"),
                )
                val result = repository(server).request("gig", "request") as NetworkResult.Failure
                assertEquals(409, result.error.code)
                assertTrue((result.error as NetworkError.ClientError).body.orEmpty().contains("STOP_ACTIVE"))
            }
        }

    private val termsJson =
        """
        {"gigId":"gig","ownerId":"actor","workerId":null,"paymentId":null,
         "amountCents":0,"currency":"usd","gigStatus":"open","acceptedAt":null,
         "acceptedBidId":null,"policy":"standard","policyFeeCents":0}
        """.trimIndent()

    private val receiptJson =
        """
        {"requestId":"request","gigId":"gig","paymentId":null,"ownerId":"actor","workerId":null,
         "amountCents":0,"currency":"usd","action":"close","gigStatus":"cancelled","financialStatus":"none"}
        """.trimIndent()

    private fun progressJson(receipt: String) =
        """
        {"actorId":"actor","sessionScope":"${"a".repeat(64)}","requestId":"request","action":"close",
         "status":"completed","financialStatus":"none","canRetry":false,
         "request":{"requestId":"request","gigId":"gig","actorId":"actor","action":"close",
                    "terms":$termsJson,"reason":null,"rollbackMode":null,"financialAction":"none"},
         "receipt":$receipt}
        """.trimIndent()

    @Test fun nullableReceiptFieldsMustBeExplicitAndMissingProofCannotDecodeAsCompletion() =
        runTest {
            MockWebServer().use { server ->
                server.enqueue(MockResponse().setBody(progressJson(receiptJson)))
                assertTrue(repository(server).request("gig", "request") is NetworkResult.Success)
                listOf("paymentId", "workerId").forEach { key ->
                    val incomplete = receiptJson.replace("\"$key\":null,", "")
                    server.enqueue(MockResponse().setBody(progressJson(incomplete)))
                    val result = repository(server).request("gig", "request")
                    assertTrue(result is NetworkResult.Failure && result.error is NetworkError.Decoding)
                }
            }
        }

    @Test fun missingNullablePreviewTermsAreRejectedInsteadOfSilentlyInventedAsNull() =
        runTest {
            MockWebServer().use { server ->
                listOf("workerId", "paymentId", "acceptedAt", "acceptedBidId").forEach { key ->
                    val incomplete = termsJson.replace("\"$key\":null,", "")
                    server.enqueue(
                        MockResponse().setBody(
                            """
                            {"actorId":"actor","sessionScope":"${"a".repeat(64)}","action":"close","terms":$incomplete,
                             "eligible":true,"unavailableReason":null,"financialAction":"none","activeRequestId":null}
                            """.trimIndent(),
                        ),
                    )
                    val result = repository(server).preview("gig", "close")
                    assertTrue(result is NetworkResult.Failure && result.error is NetworkError.Decoding)
                }
            }
        }

    @Test fun stopAdaptersDoNotChangeUnrelatedNullSerialization() {
        val raw = moshi.adapter(Map::class.java).toJson(mapOf("present" to "yes", "absent" to null))
        assertFalse(raw.contains("absent"))
    }
}
