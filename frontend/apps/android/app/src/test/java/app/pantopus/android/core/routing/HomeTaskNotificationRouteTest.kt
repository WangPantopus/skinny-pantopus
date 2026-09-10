@file:Suppress("PackageNaming")

package app.pantopus.android.core.routing

import app.pantopus.android.data.api.models.notifications.NotificationDto
import com.squareup.moshi.Moshi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HomeTaskNotificationRouteTest {
    private val home = "a1000000-0000-4000-8000-000000000001"
    private val task = "b1000000-0000-4000-8000-000000000002"
    private val expected = "/app/homes/$home/tasks/$task"

    @Test fun assignment_and_completion_require_both_exact_ids() {
        for (type in listOf("task_assigned", "task_completed", "TASK_ASSIGNED")) {
            assertEquals(expected, HomeTaskNotificationRoute.path(type, home.uppercase(), task.uppercase()))
            assertNull(HomeTaskNotificationRoute.path(type, home, null))
            assertNull(HomeTaskNotificationRoute.path(type, "wrong", task))
        }
        assertNull(HomeTaskNotificationRoute.path("persona_post", home, task))
    }

    @Test fun fcm_flat_and_serialized_nested_metadata_resolve_the_same_task() {
        assertEquals(expected, HomeTaskNotificationRoute.pushPath(mapOf("type" to "task_assigned", "home_id" to home, "task_id" to task)))
        val nested = mapOf("type" to "task_completed", "metadata" to """{"home_id":"$home","task_id":"$task"}""")
        assertEquals(expected, HomeTaskNotificationRoute.pushPath(nested))
        assertNull(HomeTaskNotificationRoute.pushPath(nested + ("home_id" to "malformed")))
        assertNull(HomeTaskNotificationRoute.pushPath(mapOf("type" to "task_assigned", "metadata" to "broken")))
    }

    @Test fun heterogeneous_metadata_decodes_and_cannot_select_an_unrelated_task() {
        val adapter = Moshi.Builder().build().adapter(NotificationDto::class.java)
        for (metadata in listOf("[]", "42", "\"legacy\"", "{\"home_id\":42}")) {
            val note =
                requireNotNull(
                    adapter.fromJson(
                        """{"id":"note","user_id":null,"type":"task_assigned","title":null,
                "body":null,"icon":null,"link":null,"is_read":false,"created_at":null,"metadata":$metadata}""",
                    ),
                )
            assertNull(HomeTaskNotificationRoute.metadataPath(note.type, note.metadata))
        }
    }
}
