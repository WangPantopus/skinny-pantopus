package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.UpdateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTasksRepository
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class HomeTasksApiTest {
    private lateinit var server: MockWebServer
    private lateinit var repository: HomeTasksRepository
    private val fingerprint = "a".repeat(64)
    private val task = """{"id":"task","home_id":"home","task_type":"chore","title":"Read me"}"""
    private val context = """{"actor_id":"actor","home_id":"home","session_scope":"$fingerprint"}"""

    @Before fun setup() {
        server = MockWebServer().also { it.start() }
        val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
        val retrofit =
            Retrofit.Builder().baseUrl(server.url("/"))
                .addConverterFactory(MoshiConverterFactory.create(moshi)).build()
        repository = HomeTasksRepository(retrofit.create(HomeTasksApi::class.java))
    }

    @After fun teardown() {
        server.shutdown()
    }

    @Test fun collection_decodes_explicit_capability_and_opening_session() =
        runTest {
            server.enqueue(
                MockResponse().setBody(
                    """{"tasks":[$task],"collection_capabilities":{"can_create":false},"task_session":$context}""",
                ),
            )
            val result = repository.getHomeTasks("home", fingerprint) as NetworkResult.Success
            assertFalse(checkNotNull(result.data.collectionCapabilities).canCreate)
            assertEquals("actor", result.data.taskSession?.actorId)
            val request = server.takeRequest()
            assertEquals("/api/homes/home/tasks", request.path)
            assertEquals(fingerprint, request.getHeader("x-pantopus-session-scope"))
        }

    @Test fun detail_uses_exact_path_and_missing_capabilities_stay_absent() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"task":$task,"task_session":$context}"""))
            val result = repository.getHomeTask("home", "task", fingerprint) as NetworkResult.Success
            assertNull(result.data.task.capabilities)
            assertEquals("task", result.data.task.id)
            assertEquals("/api/homes/home/tasks/task", server.takeRequest().path)
        }

    @Test fun completion_carries_expected_session_and_no_client_completion_timestamp() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"task":$task}"""))
            repository.updateHomeTask("home", "task", UpdateHomeTaskRequest(status = "done"), fingerprint)
            val request = server.takeRequest()
            assertEquals("PUT", request.method)
            assertEquals(fingerprint, request.getHeader("x-pantopus-session-scope"))
            assertEquals("""{"status":"done"}""", request.body.readUtf8())
        }

    @Test fun rejected_delete_remains_typed_failure() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(403).setBody("""{"error":"Denied"}"""))
            val result = repository.deleteHomeTask("home", "task", fingerprint)
            assertTrue(result is NetworkResult.Failure)
            val request = server.takeRequest()
            assertEquals("DELETE", request.method)
            assertEquals("/api/homes/home/tasks/task", request.path)
            assertEquals(fingerprint, request.getHeader("x-pantopus-session-scope"))
        }

    @Test fun delete_requires_exact_confirmation_message() =
        runTest {
            for (body in listOf("{}", """{"message":"Something else"}""", "<html>Sign in</html>")) {
                server.enqueue(MockResponse().setBody(body))
                assertTrue(repository.deleteHomeTask("home", "task", fingerprint) is NetworkResult.Failure)
            }
        }

    @Test fun exact_delete_confirmation_returns_success() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"message":"Task deleted"}"""))
            assertTrue(repository.deleteHomeTask("home", "task", fingerprint) is NetworkResult.Success)
        }
}
