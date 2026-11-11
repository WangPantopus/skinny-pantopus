package app.pantopus.android.data.moments

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.TimeUnit

/**
 * A Moment's photo or video finishes uploading after the app is swiped away (Moments REVIEW B7, founder 2026-11-10).
 * Each upload also has a job with Android's WorkManager, one per Moment, that runs once there is a connection. While the
 * app is open the job only waits for the upload the app is already doing. When Android has closed the app, it starts
 * the app again for the job, which picks the upload up from the note beside its file (A4) and sees it through, trying
 * again later while the connection or the server fails. Discard and sign-out cancel the job.
 */
class MomentUploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val momentId = inputData.getString(KEY_MOMENT) ?: return Result.failure()
        val entry = EntryPointAccessors.fromApplication(applicationContext, MomentUploadEntryPoint::class.java)
        val auth = entry.auth()
        // Started by Android with the app closed: the session hasn't been read yet (as the notification actions do).
        if (auth.state.value == AuthRepository.State.Unknown) withTimeoutOrNull(RESTORE_MS) { auth.restore() }
        val userId = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id ?: return Result.failure()
        return when (entry.posting().finishInBackground(momentId, userId)) {
            MomentsPosting.BackgroundUpload.DONE -> Result.success()
            MomentsPosting.BackgroundUpload.GAVE_UP -> Result.failure()
            MomentsPosting.BackgroundUpload.TRY_LATER -> if (runAttemptCount + 1 >= MAX_RUNS) Result.failure() else Result.retry()
        }
    }

    companion object {
        private const val KEY_MOMENT = "momentId"
        private const val TAG = "moments-upload"

        /** How long a job started with the app closed waits for the saved session. */
        private const val RESTORE_MS = 20_000L

        /** Runs of the job before it gives up; the Moment then waits for "Try again" in the app. */
        private const val MAX_RUNS = 8
        private const val BACKOFF_SECONDS = 30L

        private fun name(momentId: String): String = "moment-upload-$momentId"

        /** Gives [momentId]'s upload its job, which runs once there is a connection; one already waiting is kept. */
        fun schedule(
            context: Context,
            momentId: String,
        ) {
            val request =
                OneTimeWorkRequestBuilder<MomentUploadWorker>()
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, BACKOFF_SECONDS, TimeUnit.SECONDS)
                    .setInputData(workDataOf(KEY_MOMENT to momentId))
                    .addTag(TAG)
                    .build()
            runCatching { WorkManager.getInstance(context).enqueueUniqueWork(name(momentId), ExistingWorkPolicy.KEEP, request) }
                .onFailure { timber.log.Timber.tag("Moments").w(it, "couldn't give the upload its job") }
        }

        /** Discard: the Moment's job goes too. */
        fun cancel(
            context: Context,
            momentId: String,
        ) {
            runCatching { WorkManager.getInstance(context).cancelUniqueWork(name(momentId)) }
        }

        /** Sign-out: every Moments upload job goes. */
        fun cancelAll(context: Context) {
            runCatching { WorkManager.getInstance(context).cancelAllWorkByTag(TAG) }
        }
    }
}

/** What the upload job needs from the app, which Android may have just started for it. */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface MomentUploadEntryPoint {
    fun posting(): MomentsPosting

    fun auth(): AuthRepository
}
