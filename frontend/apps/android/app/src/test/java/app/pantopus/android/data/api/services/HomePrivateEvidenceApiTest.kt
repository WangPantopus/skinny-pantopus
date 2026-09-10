package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeEvidenceSessionDto
import app.pantopus.android.data.api.models.homes.SubmitClaimRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HOME_EVIDENCE_MAX_BYTES
import app.pantopus.android.data.homes.HomePrivateEvidenceRepository
import app.pantopus.android.data.homes.readHomeEvidenceBytes
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.io.InputStream
import java.net.URLDecoder

class HomePrivateEvidenceApiTest {
    private lateinit var server: MockWebServer
    private lateinit var repository: HomePrivateEvidenceRepository
    private lateinit var homesApi: HomesApi
    private val scope = HomeEvidenceSessionDto("actor", "a".repeat(64), "home", "claim")
    private val document =
        """
        {"id":"upload","home_id":"home","claim_id":"claim","evidence_type":"lease",
         "file_name":"lease.txt","file_size":3,"mime_type":"text/plain","status":"pending",
         "state":"ready","available":true,"eligible_for_review":false,"cleanup_pending":true}
        """.trimIndent()

    @Before fun setup() {
        server = MockWebServer().also { it.start() }
        val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
        val retrofit =
            Retrofit.Builder().baseUrl(
                server.url("/"),
            ).addConverterFactory(MoshiConverterFactory.create(moshi)).build()
        repository = HomePrivateEvidenceRepository(retrofit.create(HomePrivateEvidenceApi::class.java))
        homesApi = retrofit.create(HomesApi::class.java)
    }

    @After fun teardown() {
        server.shutdown()
    }

    @Test fun list_uses_exact_home_claim_mode_and_optional_expected_header() =
        runTest {
            server.enqueue(
                MockResponse().setBody(
                    """
                    {"evidence":[$document],"can_verify":false,"review_token":null,
                     "claim_session":{"actor_id":"actor","session_scope":"${scope.sessionScope}",
                     "home_id":"home","claim_id":"claim"}}
                    """.trimIndent(),
                ),
            )
            val response = repository.list("home", "claim", scope.sessionScope, true)
            assertTrue(response is NetworkResult.Success)
            assertTrue((response as NetworkResult.Success).data.evidence.single().cleanupPending)
            val request = server.takeRequest()
            assertEquals("/api/upload/home-claim-evidence/home/claim?review=platform", request.path)
            assertEquals(scope.sessionScope, request.getHeader("x-pantopus-session-scope"))
        }

    @Test fun private_upload_sends_stable_id_type_and_bytes_without_storage_reference() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"evidence":$document}"""))
            val response = repository.upload(scope, "upload", "lease", "lease.txt", "text/plain", byteArrayOf(65, 66, 67))
            assertTrue(response is NetworkResult.Success)
            val request = server.takeRequest()
            val body = request.body.readUtf8()
            assertEquals("/api/upload/ownership-evidence/home/claim", request.path)
            assertEquals(scope.sessionScope, request.getHeader("x-pantopus-session-scope"))
            assertTrue(body.contains("name=\"upload_id\""))
            assertTrue(body.contains("name=\"evidence_type\""))
            assertTrue(body.contains("ABC"))
            assertFalse(body.contains("storage_ref"))
            assertFalse(body.contains("file_url"))
        }

    @Test fun first_claim_submission_uses_scope_from_authenticated_claims_response() =
        runTest {
            server.enqueue(
                MockResponse().setBody(
                    """{"claims":[],"upload_session":{"actor_id":"actor","session_scope":"${scope.sessionScope}"}}""",
                ),
            )
            server.enqueue(MockResponse().setBody("""{"message":"ok","claim":{"id":"claim","status":"under_review"}}"""))
            val context = requireNotNull(homesApi.myOwnershipClaims().uploadSession)
            assertEquals("actor", context.actorId)
            homesApi.submitClaim("home", SubmitClaimRequest("owner", "doc_upload"), context.sessionScope)
            assertEquals("/api/homes/my-ownership-claims", server.takeRequest().path)
            val request = server.takeRequest()
            assertEquals("/api/homes/home/ownership-claims", request.path)
            assertEquals(scope.sessionScope, request.getHeader("x-pantopus-session-scope"))
        }

    @Test fun exact_byte_download_preserves_receipt_and_scope_header() =
        runTest {
            server.enqueue(
                MockResponse().setHeader(
                    "Content-Type",
                    "text/plain",
                ).setHeader("X-Claim-Evidence-Inspection", "d".repeat(64)).setBody("ABC"),
            )
            val response = repository.download(scope, "upload", false, "b".repeat(64)) as NetworkResult.Success
            assertArrayEquals("ABC".toByteArray(), response.data.bytes)
            assertEquals("d".repeat(64), response.data.inspection)
            val request = server.takeRequest()
            assertEquals(
                "/api/upload/home-claim-evidence/home/claim/upload/download?review=home&review_token=${"b".repeat(64)}",
                request.path,
            )
            assertEquals(scope.sessionScope, request.getHeader("x-pantopus-session-scope"))
        }

    @Test fun verification_sends_only_exact_snapshot_and_inspection_not_a_claim_decision() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(503))
            repository.verify(scope, "upload", true, "b".repeat(64), "d".repeat(64))
            val request = server.takeRequest()
            assertEquals("/api/upload/home-claim-evidence/home/claim/upload/verify?review=platform", request.path)
            val body = request.body.readUtf8()
            assertTrue(body.contains("\"review_token\""))
            assertTrue(body.contains("\"inspection\""))
            assertFalse(body.contains("approve"))
        }

    @Test fun retirement_is_exact_delete_with_required_scope() =
        runTest {
            server.enqueue(
                MockResponse().setBody(
                    """{"evidence":${document.replace("ready", "retired").replace("\"available\":true", "\"available\":false")}}""",
                ),
            )
            assertTrue(repository.remove(scope, "upload") is NetworkResult.Success)
            val request = server.takeRequest()
            assertEquals("DELETE", request.method)
            assertEquals("/api/upload/home-claim-evidence/home/claim/upload", request.path)
            assertEquals(scope.sessionScope, request.getHeader("x-pantopus-session-scope"))
        }

    @Test fun manual_identity_or_title_upload_is_rejected_before_network() =
        runTest {
            for (type in listOf("idv", "title_match", "escrow_attestation")) {
                val response = repository.upload(scope, "upload", type, "id.pdf", "application/pdf", byteArrayOf(1))
                assertTrue(response is NetworkResult.Failure)
                assertEquals(400, (response as NetworkResult.Failure).error.code)
            }
            assertEquals(0, server.requestCount)
        }

    @Test fun unsupported_mime_empty_bytes_and_blank_name_return_typed_error_before_network() =
        runTest {
            val invalid =
                listOf(
                    Triple("lease.txt", "text/plain", byteArrayOf()),
                    Triple("lease.txt", "application/octet-stream", byteArrayOf(1)),
                    Triple(" ", "text/plain", byteArrayOf(1)),
                )
            for ((name, mime, bytes) in invalid) {
                val response = repository.upload(scope, "upload", "lease", name, mime, bytes)
                assertTrue(response is NetworkResult.Failure)
                assertEquals(400, (response as NetworkResult.Failure).error.code)
            }
            assertEquals(0, server.requestCount)
        }

    @Test fun unbounded_provider_stream_stops_at_document_limit() {
        var consumed = 0
        val stream =
            object : InputStream() {
                override fun read(): Int {
                    consumed++
                    return 1
                }

                override fun read(
                    b: ByteArray,
                    off: Int,
                    len: Int,
                ): Int {
                    consumed += len
                    b.fill(1, off, off + len)
                    return len
                }
            }
        assertThrows(IllegalArgumentException::class.java) { readHomeEvidenceBytes(stream) }
        assertTrue(consumed <= HOME_EVIDENCE_MAX_BYTES + DEFAULT_BUFFER_SIZE)
    }

    @Test fun unicode_filename_has_exact_utf8_extended_parameter() =
        runTest {
            val name = "住所-証明-é.txt"
            server.enqueue(MockResponse().setBody("""{"evidence":${document.replace("lease.txt", name)}}"""))
            val response = repository.upload(scope, "upload", "lease", name, "text/plain", byteArrayOf(65, 66, 67))
            assertTrue(response is NetworkResult.Success)
            val body = server.takeRequest().body.readUtf8()
            val encoded = body.substringAfter("filename*=UTF-8''").substringBefore("\r\n")
            assertEquals(name, URLDecoder.decode(encoded, "UTF-8"))
            assertTrue(body.contains("filename=\"__-__-_.txt\""))
        }
}
