package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeTaskSessionDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskMediaRepository
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class HomeTaskMediaApiTest {
    private lateinit var server: MockWebServer
    private lateinit var repository: HomeTaskMediaRepository
    private val session = HomeTaskSessionDto("actor", "home", "a".repeat(64))
    private val record =
        """{"id":"upload","home_id":"home","task_id":"task","uploaded_by":"actor",""" +
            """"file_name":"task-attachment-upload.txt","file_size":3,"mime_type":"text/plain","state":"ready","available":true}"""

    @Before fun setup() {
        server = MockWebServer().also { it.start() }
        val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
        val retrofit =
            Retrofit.Builder().baseUrl(server.url("/"))
                .addConverterFactory(MoshiConverterFactory.create(moshi)).build()
        repository = HomeTaskMediaRepository(retrofit.create(HomeTaskMediaApi::class.java))
    }

    @After fun teardown() = server.shutdown()

    @Test fun list_uses_exact_route_scope_and_no_store_header() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"media":[$record],"can_upload":false}"""))
            val response = repository.list(session, "task") as NetworkResult.Success
            assertFalse(response.data.canUpload)
            val request = server.takeRequest()
            assertEquals("/api/upload/home-task-media/home/task", request.path)
            assertEquals(session.sessionScope, request.getHeader("x-pantopus-session-scope"))
            assertEquals("no-store", request.getHeader("Cache-Control"))
        }

    @Test fun upload_sends_original_uuid_safe_filename_and_exact_bytes() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"media":[$record]}"""))
            val response = repository.upload(session, "task", "upload", "task-attachment-upload.txt", "text/plain", "ABC".toByteArray())
            assertTrue(response is NetworkResult.Success)
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals(session.sessionScope, request.getHeader("x-pantopus-session-scope"))
            val body = request.body.readUtf8()
            assertTrue(body.contains("name=\"upload_id\""))
            assertTrue(body.contains("filename=\"task-attachment-upload.txt\""))
            assertTrue(body.contains("ABC"))
            assertFalse(body.contains("file_url"))
            assertFalse(body.contains("storage_ref"))
        }

    @Test fun unsupported_or_empty_file_returns_typed_failure_without_http() =
        runTest {
            assertTrue(repository.upload(session, "task", "upload", "safe.txt", "text/plain", byteArrayOf()) is NetworkResult.Failure)
            val unsupported = repository.upload(session, "task", "upload", "safe.txt", "application/octet-stream", "ABC".toByteArray())
            assertTrue(unsupported is NetworkResult.Failure)
            assertEquals(0, server.requestCount)
        }

    @Test fun private_download_preserves_exact_bytes_and_mime_without_cache() =
        runTest {
            server.enqueue(MockResponse().setHeader("Content-Type", "text/plain; charset=utf-8").setChunkedBody("ABC", 1))
            val response = repository.download(session, "task", "upload") as NetworkResult.Success
            assertArrayEquals("ABC".toByteArray(), response.data.bytes)
            assertEquals("text/plain", response.data.mimeType)
            val request = server.takeRequest()
            assertEquals("/api/upload/home-task-media/home/task/upload/download", request.path)
            assertEquals("no-store", request.getHeader("Cache-Control"))
            assertEquals(session.sessionScope, request.getHeader("x-pantopus-session-scope"))
        }

    @Test fun deletion_decodes_only_the_exact_media_envelope() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"media":$record}"""))
            val response = repository.remove(session, "task", "upload") as NetworkResult.Success
            assertEquals("upload", response.data.media.id)
            val request = server.takeRequest()
            assertEquals("DELETE", request.method)
            assertEquals("/api/upload/home-task-media/home/task/upload", request.path)
            assertEquals(session.sessionScope, request.getHeader("x-pantopus-session-scope"))
        }
}
