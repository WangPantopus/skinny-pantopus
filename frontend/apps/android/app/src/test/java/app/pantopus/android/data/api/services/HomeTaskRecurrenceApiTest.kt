package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeTaskRecurrenceState
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.ui.screens.homes.tasks.HomeTaskRecurrenceFixture
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class HomeTaskRecurrenceApiTest {
    private val server = MockWebServer()
    private val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()
    private val f = HomeTaskRecurrenceFixture()
    private lateinit var repository: HomeTasksRepository

    @Before fun setup() {
        server.start()
        val retrofit =
            Retrofit.Builder().baseUrl(server.url("/"))
                .addConverterFactory(MoshiConverterFactory.create(moshi)).build()
        repository = HomeTasksRepository(retrofit.create(HomeTasksApi::class.java))
    }

    @After fun teardown() = server.shutdown()

    @Test fun get_decodes_current_flat_state_with_exact_route_scope_and_no_store() =
        runTest {
            server.enqueue(MockResponse().setBody(moshi.adapter(HomeTaskRecurrenceState::class.java).toJson(f.state)))
            val result = repository.getRecurrence(f.home, f.taskId, f.server.sessionScope) as NetworkResult.Success
            assertEquals(f.state, result.data)
            val request = server.takeRequest()
            assertEquals("/api/homes/${f.home}/tasks/${f.taskId}/recurrence", request.path)
            assertEquals("GET", request.method)
            assertEquals(f.server.sessionScope, request.getHeader("x-pantopus-session-scope"))
            assertEquals("no-store", request.getHeader("Cache-Control"))
        }

    @Test fun start_and_pause_send_only_exact_original_fields_without_local_scope_or_proof() =
        runTest {
            for (command in listOf(
                f.request,
                f.request.copy(
                    action = "pause",
                    expectedRevision = 1,
                    expectedTaskUpdatedAt = null,
                    frequency = null,
                    interval = null,
                    timezone = null,
                ),
            )) {
                val response = f.commit(command)
                server.enqueue(MockResponse().setBody(moshi.adapter(HomeTaskRecurrenceState::class.java).toJson(response)))
                val result = repository.changeRecurrence(f.home, f.taskId, command, f.server.sessionScope) as NetworkResult.Success
                assertEquals(response, result.data)
                val wire = server.takeRequest()
                assertEquals("POST", wire.method)
                assertEquals(f.server.sessionScope, wire.getHeader("x-pantopus-session-scope"))
                assertEquals("no-store", wire.getHeader("Cache-Control"))
                val json = JSONObject(wire.body.readUtf8())
                val required = setOf("request_id", "action", "expected_revision")
                val start = setOf("expected_task_updated_at", "frequency", "interval", "timezone")
                assertEquals(if (command.action == "start") required + start else required, json.keys().asSequence().toSet())
                assertEquals(command.requestId, json.getString("request_id"))
                assertEquals(command.expectedRevision, json.getLong("expected_revision"))
                if (command.action == "start") {
                    assertEquals(command.expectedTaskUpdatedAt, json.getString("expected_task_updated_at"))
                    assertEquals(command.timezone, json.getString("timezone"))
                    assertEquals(command.interval, json.getInt("interval"))
                    assertEquals(command.frequency, json.getString("frequency"))
                }
            }
        }

    @Test fun missing_required_current_state_is_decoding_failure() =
        runTest {
            server.enqueue(MockResponse().setBody("""{"ok":true,"revision":0}"""))
            assertTrue(repository.getRecurrence(f.home, f.taskId, f.server.sessionScope) is NetworkResult.Failure)
        }
}
