@file:Suppress("PackageNaming")

package app.pantopus.android.core.routing

import com.squareup.moshi.Moshi
import java.util.Locale

/** Exact task metadata takes precedence over the historical dashboard link. */
object HomeTaskNotificationRoute {
    private val uuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    private val metadataAdapter = Moshi.Builder().build().adapter(Any::class.java)

    fun isTask(type: String?): Boolean = type?.lowercase(Locale.ROOT) in setOf("task_assigned", "task_completed")

    fun canonicalId(value: String?): String? = value?.takeIf(uuid::matches)?.lowercase(Locale.ROOT)

    fun path(
        type: String?,
        homeId: String?,
        taskId: String?,
    ): String? {
        if (!isTask(type)) return null
        val home = canonicalId(homeId) ?: return null
        val task = canonicalId(taskId) ?: return null
        return "/app/homes/$home/tasks/$task"
    }

    fun metadataPath(
        type: String?,
        metadata: Any?,
    ): String? {
        val fields = metadata as? Map<*, *> ?: return null
        return path(type, fields["home_id"] as? String, fields["task_id"] as? String)
    }

    fun pushPath(data: Map<String, String>): String? {
        if (!isTask(data["type"])) return null
        val fields = runCatching { data["metadata"]?.let(metadataAdapter::fromJson) }.getOrNull() as? Map<*, *>
        return path(
            data["type"],
            data["home_id"] ?: fields?.get("home_id") as? String,
            data["task_id"] ?: fields?.get("task_id") as? String,
        )
    }
}
