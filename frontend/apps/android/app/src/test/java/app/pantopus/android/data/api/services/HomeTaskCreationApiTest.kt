package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.CreateHomeTaskRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTaskEditPatch
import app.pantopus.android.data.homes.HomeTasksRepository
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class HomeTaskCreationApiTest {
    private lateinit var server: MockWebServer
    private lateinit var repository: HomeTasksRepository
    private val session = "a".repeat(64)
    private val task = """{"id":"task","home_id":"home","task_type":"chore","title":"Current title","created_by":"actor"}"""
    private val receipt =
        """{"home_id":"home","actor_id":"actor","request_id":"request","task_id":"task",""" +
            """"payload_hash":"${"b".repeat(64)}","created_at":"2026-09-10T00:00:00Z"}"""
    private val response =
        """{"task":$task,"creation_receipt":$receipt,""" +
            """"task_session":{"actor_id":"actor","home_id":"home","session_scope":"$session"},"replayed":true}"""

    @Before fun setup() {
        server = MockWebServer().also { it.start() }
        val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
        repository =
            HomeTasksRepository(
                Retrofit.Builder().baseUrl(server.url("/"))
                    .addConverterFactory(MoshiConverterFactory.create(moshi)).build().create(HomeTasksApi::class.java),
            )
    }

    @After fun teardown() {
        server.shutdown()
    }

    @Test fun retained_create_sends_flat_original_uuid_and_fixed_session() =
        runTest {
            server.enqueue(MockResponse().setBody(response))
            val result =
                repository.createHomeTaskWithReceipt(
                    "home",
                    CreateHomeTaskRequest("chore", "住所 — original", description = "line one\nline two", requestId = "request"),
                    session,
                )
            assertTrue(result is NetworkResult.Success)
            val request = server.takeRequest()
            assertEquals("POST", request.method)
            assertEquals("/api/homes/home/tasks", request.path)
            assertEquals(session, request.getHeader("x-pantopus-session-scope"))
            assertEquals(
                """{"task_type":"chore","title":"住所 — original","description":"line one\nline two","request_id":"request"}""",
                request.body.readUtf8(),
            )
            val confirmed = (result as NetworkResult.Success).data
            assertTrue(confirmed.replayed)
            assertEquals("Current title", confirmed.task.title)
            assertEquals("request", confirmed.creationReceipt.requestId)
        }

    @Test fun explicit_sparse_null_clears_survive_actual_http_serialization() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"task":$task}"""))
            repository.patchHomeTask(
                "home",
                "task",
                HomeTaskEditPatch(
                    linkedMapOf(
                        "description" to null,
                        "assigned_to" to null,
                        "due_at" to null,
                        "recurrence_rule" to null,
                    ),
                ),
                session,
            )
            val request = server.takeRequest()
            assertEquals("PUT", request.method)
            assertEquals("/api/homes/home/tasks/task", request.path)
            assertEquals(session, request.getHeader("x-pantopus-session-scope"))
            assertEquals("""{"description":null,"assigned_to":null,"due_at":null,"recurrence_rule":null}""", request.body.readUtf8())
        }

    @Test fun untouched_fields_are_absent_from_sparse_http_edit() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"task":$task}"""))
            repository.patchHomeTask("home", "task", HomeTaskEditPatch(mapOf("title" to "Only change")), session)
            assertEquals("""{"title":"Only change"}""", server.takeRequest().body.readUtf8())
        }

    @Test fun missing_or_malformed_creation_proof_is_typed_failure() =
        runTest {
            for (body in listOf(
                """{"task":$task}""",
                response.replace("\"replayed\":true", "\"ignored\":true"),
                response.replace("\"payload_hash\":", "\"unknown\":"),
            )) {
                server.enqueue(MockResponse().setBody(body))
                assertTrue(
                    repository.createHomeTaskWithReceipt(
                        "home",
                        CreateHomeTaskRequest("chore", "Task", requestId = "request"),
                        session,
                    ) is NetworkResult.Failure,
                )
            }
        }

    @Test fun retryable_http_codes_remain_typed_without_changing_body() =
        runTest {
            val original = CreateHomeTaskRequest("chore", "Original", dueAt = "2026-09-10T18:32:00-07:00", requestId = "request")
            for (status in listOf(408, 429)) {
                server.enqueue(MockResponse().setResponseCode(status).setBody("""{"error":"Try later"}"""))
                assertTrue(repository.createHomeTaskWithReceipt("home", original, session) is NetworkResult.Failure)
            }
            assertEquals(server.takeRequest().body.readUtf8(), server.takeRequest().body.readUtf8())
        }
}
