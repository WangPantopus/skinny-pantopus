package app.pantopus.android.data.ai

import android.content.Context
import android.net.Uri
import app.pantopus.android.data.api.models.ai.AIDraftPickupScheduleRequest
import app.pantopus.android.data.api.models.ai.AIPickupScheduleReadingDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.compose.listing.ListingPhotoProcessor
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/** What reading a flyer found, for the pickup editor to fill in. */
sealed interface PickupFlyerReading {
    data class Read(
        val schedule: AIPickupScheduleReadingDto,
        val note: String?,
    ) : PickupFlyerReading

    /** [message] is for the person: the server's own sentence when it gave one. */
    data class Failed(
        val message: String,
    ) : PickupFlyerReading
}

/**
 * "Read a flyer" in the pickup editor: the photo goes up as the person's own AI upload
 * (`/api/upload/ai-media`, re-encoded as a JPEG without its EXIF) and is read by
 * `POST /api/ai/draft/pickup-schedule`. Nothing is saved; the editor's Save writes the days.
 */
@Singleton
class PickupFlyerReader
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val uploads: UploadRepository,
        private val drafts: AIDraftRepository,
    ) {
        suspend fun read(photo: Uri): PickupFlyerReading {
            val jpeg =
                withContext(Dispatchers.IO) {
                    runCatching { context.contentResolver.openInputStream(photo)?.use { it.readBytes() } }
                        .getOrNull()
                        ?.let { ListingPhotoProcessor.uploadData(it) }
                } ?: return PickupFlyerReading.Failed("Couldn't open that photo. Try another one.")
            val urls =
                when (val upload = uploads.uploadAIMedia(listOf(UploadFile("flyer.jpg", "image/jpeg", jpeg)))) {
                    is NetworkResult.Success -> upload.data.images.map { it.url }
                    is NetworkResult.Failure -> return PickupFlyerReading.Failed(upload.error.flyerMessage())
                }
            return when (val result = drafts.readPickupSchedule(AIDraftPickupScheduleRequest(images = urls))) {
                is NetworkResult.Success -> PickupFlyerReading.Read(result.data.schedule, result.data.note)
                is NetworkResult.Failure -> PickupFlyerReading.Failed(result.error.flyerMessage())
            }
        }
    }

/** The server's sentence when it gave one ("This looks like a yard sale sign…"), else the error's own copy. */
private fun NetworkError.flyerMessage(): String =
    when (this) {
        is NetworkError.Server -> NetworkError.ClientError.friendlyClientMessage(body) ?: message
        else -> message
    }
