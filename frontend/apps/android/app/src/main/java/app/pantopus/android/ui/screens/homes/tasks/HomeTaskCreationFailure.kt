@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.tasks

import app.pantopus.android.data.api.net.NetworkError
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import java.net.HttpURLConnection

/** Marks only a failed creation POST, excluding errors from prerequisite reads. */
internal class HomeTaskCreationFailure(val error: NetworkError) : IllegalStateException(error.message, error)

internal fun canClearTaskCreation(error: NetworkError): Boolean {
    if (error !is NetworkError.ClientError) return false
    val type = Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
    val adapter = Moshi.Builder().build().adapter<Map<String, Any?>>(type)
    val code = runCatching { error.body?.let(adapter::fromJson)?.get("code") }.getOrNull()
    return (error.code == HttpURLConnection.HTTP_BAD_REQUEST && code == "HOME_RECORD_INVALID") ||
        (error.code == HttpURLConnection.HTTP_CONFLICT && code == "HOME_TASK_CREATE_RETIRED")
}
