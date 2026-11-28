package app.pantopus.android.data.location

import com.google.android.gms.tasks.Task
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import timber.log.Timber

/**
 * Awaits a Play services location read, and counts a failed one as no reading. Play services can drop the
 * connection while the app is open (an update or a restart: `ApiException: 20`), and that must read as "no location",
 * never as an uncaught throw. A [SecurityException] (permission withdrawn) and cancellation still reach the caller,
 * which handles them as it did before.
 */
internal suspend fun <T> Task<T>.awaitLocationOrNull(): T? =
    try {
        await()
    } catch (denied: SecurityException) {
        throw denied
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (
        // Any failed Task counts: ApiException is only the one seen; a Task can fail with any exception.
        @Suppress("TooGenericExceptionCaught") failure: Exception,
    ) {
        Timber.w(failure, "Play services location read failed")
        null
    }
