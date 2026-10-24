package app.pantopus.android.data.chats

import android.app.job.JobParameters
import android.app.job.JobService
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/** An OS-scheduled opportunity to drain existing encrypted intent; it never creates another outgoing queue. */
@AndroidEntryPoint
class ChatOutboxJobService : JobService() {
    @Inject lateinit var outbox: ChatOutbox

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var delivery: Job? = null

    override fun onStartJob(params: JobParameters): Boolean {
        delivery =
            scope.launch {
                try {
                    jobFinished(params, outbox.runScheduledDelivery())
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (
                    // Failure details can contain message/provider data; only a generic local diagnostic is safe.
                    @Suppress("TooGenericExceptionCaught", "SwallowedException") error: Exception,
                ) {
                    Timber.w("Background chat delivery could not finish")
                    jobFinished(params, true)
                }
            }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        delivery?.cancel()
        delivery = null
        return outbox.hasPendingDelivery()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
