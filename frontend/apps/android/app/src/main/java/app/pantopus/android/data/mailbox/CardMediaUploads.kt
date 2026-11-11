package app.pantopus.android.data.mailbox

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import app.pantopus.android.data.api.models.mailbox.CardMediaFile
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HolidayCardsApi
import app.pantopus.android.data.moments.MomentMedia
import app.pantopus.android.data.moments.ProgressBody
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/** A photo ready to upload: the JPEG and its upright size. */
data class PreparedPhoto(
    val file: File,
    val width: Int,
    val height: Int,
)

/**
 * A card's own photo (memories plan step 4, launch key `holiday_card_memories`) on its way to the server: the picked
 * picture is turned upright and made a JPEG of at most 1600 px on its long side on the phone, so no location or other
 * EXIF ever leaves it, then uploaded to `POST /api/mailbox/cards/media` with its progress. The prepared copy lives in the
 * app's cache only while the card is written; nothing of it is kept for another account.
 */
@Singleton
class CardMediaUploads
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val api: HolidayCardsApi,
    ) {
        private fun folder(): File = File(context.cacheDir, FOLDER).apply { mkdirs() }

        /** The picked photo, upright, as a JPEG at most [PHOTO_LONG_SIDE] px on its long side; null when it can't be read. */
        suspend fun preparePhoto(uri: Uri): PreparedPhoto? =
            withContext(Dispatchers.IO) {
                val picked = File(folder(), "picked-${UUID.randomUUID()}")
                try {
                    context.contentResolver.openInputStream(uri)?.use { input -> FileOutputStream(picked).use { input.copyTo(it) } }
                        ?: return@withContext null
                    val bitmap = MomentMedia.decodeUpright(picked, PHOTO_LONG_SIDE) ?: return@withContext null
                    val out = File(folder(), "photo-${UUID.randomUUID()}.jpg")
                    FileOutputStream(out).use { bitmap.compress(Bitmap.CompressFormat.JPEG, PHOTO_QUALITY, it) }
                    val prepared = PreparedPhoto(out, bitmap.width, bitmap.height)
                    bitmap.recycle()
                    prepared
                } catch (_: Exception) {
                    null
                } finally {
                    picked.delete()
                }
            }

        /** `POST /api/mailbox/cards/media`: [file] as the card's [kind] (`photo` or `voice`), [onProgress] 0 to 1 as it goes. */
        suspend fun upload(
            kind: String,
            file: File,
            type: String,
            onProgress: (Float) -> Unit,
        ): NetworkResult<CardMediaFile> {
            val body = ProgressBody(file, type.toMediaType(), onProgress)
            val part = MultipartBody.Part.createFormData("file", file.name, body)
            return when (val result = safeApiCall { api.uploadMedia(kind.toRequestBody(TEXT), part) }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.media)
                is NetworkResult.Failure -> result
            }
        }

        /** Lets go of a prepared photo once it's sent, removed or replaced. */
        fun forget(file: File?) {
            file?.takeIf { it.parentFile == folder() }?.delete()
        }

        /** Sign-out and a new card: every prepared photo leaves the phone. */
        fun clear() {
            runCatching { File(context.cacheDir, FOLDER).deleteRecursively() }
        }

        private companion object {
            const val FOLDER = "card-media"
            const val PHOTO_LONG_SIDE = 1600
            const val PHOTO_QUALITY = 90
            val TEXT = "text/plain".toMediaType()
        }
    }
