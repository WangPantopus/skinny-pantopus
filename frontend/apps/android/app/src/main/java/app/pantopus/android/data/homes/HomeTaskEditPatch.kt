package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.HomeTaskDto
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset

/** Omitted keys preserve existing values; a present null intentionally clears a field. */
data class HomeTaskEditPatch(val fields: Map<String, String?>) {
    init {
        require(fields.keys.all { it in allowedFields }) { "Unsupported task field." }
        require(fields["title"] != null || "title" !in fields) { "A task title cannot be cleared." }
    }

    fun body(): RequestBody {
        val type = Types.newParameterizedType(Map::class.java, String::class.java, String::class.java)
        val adapter = Moshi.Builder().build().adapter<Map<String, String?>>(type).serializeNulls()
        return adapter.toJson(fields).toRequestBody("application/json; charset=utf-8".toMediaType())
    }

    fun matches(task: HomeTaskDto): Boolean =
        fields.all { (field, value) ->
            when (field) {
                "title" -> task.title == value
                "description" -> task.description == value
                "task_type" -> task.taskType == value
                "assigned_to" -> task.assignedTo == value
                "recurrence_rule" -> task.recurrenceRule == value
                "due_at" -> sameDate(value, task.dueAt)
                else -> false
            }
        }

    private fun sameDate(
        expected: String?,
        actual: String?,
    ): Boolean {
        if (expected == null) return actual == null
        val requested = date(expected) ?: return false
        return requested == actual?.let(::date)
    }

    private fun date(value: String) =
        runCatching {
            if (value.length == ISO_DAY_LENGTH) {
                LocalDate.parse(value).atStartOfDay().toInstant(ZoneOffset.UTC)
            } else {
                OffsetDateTime.parse(value).toInstant()
            }
        }.getOrNull()

    companion object {
        private const val ISO_DAY_LENGTH = 10
        private val allowedFields = setOf("title", "description", "assigned_to", "due_at", "recurrence_rule", "task_type")
    }
}
