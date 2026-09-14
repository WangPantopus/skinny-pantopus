package app.pantopus.android.data.homes

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Own private results until the caller actually resumes; dispatcher return can cancel. */
internal suspend fun <T : Any> readPrivateHomeMedia(
    erase: (T) -> Unit,
    dispatcher: CoroutineDispatcher = Dispatchers.IO,
    read: () -> T,
): T {
    var acquired: T? = null
    var delivered = false
    try {
        val result = withContext(dispatcher) { read().also { acquired = it } }
        delivered = true
        return result
    } finally {
        if (!delivered) acquired?.let(erase)
    }
}
