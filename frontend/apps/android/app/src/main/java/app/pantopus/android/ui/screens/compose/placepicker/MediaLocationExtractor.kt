package app.pantopus.android.ui.screens.compose.placepicker

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import kotlin.math.abs

/**
 * A media attachment's capture coordinate — where the photo/video was
 * TAKEN, read from its own metadata. Mirrors the iOS
 * `MediaCaptureLocation` value type 1:1.
 */
data class MediaCaptureLocation(
    val latitude: Double,
    val longitude: Double,
)

/**
 * Reads the capture location out of picked media so the place picker can
 * anchor its NEARBY suggestions on where the photo or video was taken
 * (Instagram parity), not only on where the user is right now.
 *
 * PRIVACY RULE: media GPS is a LOCAL picker anchor only. It is NEVER
 * auto-attached to an outgoing post or broadcast body — those carry only
 * the venue the user explicitly picks, exactly as before.
 *
 * Platform reality: both composers receive system-photo-picker URIs
 * (`PickMultipleVisualMedia`), and on API 29+ the platform REDACTS
 * location EXIF / video atoms at read time for those URIs —
 * `ACCESS_MEDIA_LOCATION` and `setRequireOriginal` do NOT apply to
 * picker URIs, so extraction legitimately returns null there and the
 * picker simply renders no anchor chips (zero UX regression). On
 * API 26-28 (minSdk 26, pre-redaction) the picked bytes DO carry GPS,
 * and any future unredacted source works unchanged. Every reader is
 * failure-silent by design: no location → no chips.
 */
object MediaLocationExtractor {
    /**
     * EXIF GPS off a still's picked bytes. [ExifInterface.getLatLong]
     * applies the S/W hemisphere refs, so the result is already signed.
     */
    fun fromImageBytes(bytes: ByteArray): MediaCaptureLocation? =
        runCatching {
            ExifInterface(ByteArrayInputStream(bytes)).latLong?.let { coords ->
                validated(latitude = coords[0], longitude = coords[1])
            }
        }.getOrNull()

    /**
     * ISO-6709 location atom off a picked video.
     * [MediaMetadataRetriever] needs a file/URI (it cannot read bytes),
     * so this must run while the picker URI is still in scope — inside
     * the picker callback; the URI is never retained beyond it.
     */
    fun fromVideoUri(
        context: Context,
        uri: Uri,
    ): MediaCaptureLocation? =
        runCatching {
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(context, uri)
                retriever
                    .extractMetadata(MediaMetadataRetriever.METADATA_KEY_LOCATION)
                    ?.let(::parseIso6709)
            } finally {
                retriever.release()
            }
        }.getOrNull()

    /**
     * Parse an ISO-6709 point — "+41.8781-087.6298/" or the
     * altitude-suffixed "+41.8781-087.6298+000.000/". The two leading
     * sign-prefixed groups are latitude then longitude; anything
     * malformed or out of range yields null. Shared by [fromVideoUri]
     * and the iOS video reader (same wire shape), unit-tested directly.
     */
    fun parseIso6709(value: String): MediaCaptureLocation? {
        val match = ISO_6709_PREFIX.find(value.trim()) ?: return null
        val latitude = match.groupValues[1].toDoubleOrNull() ?: return null
        val longitude = match.groupValues[2].toDoubleOrNull() ?: return null
        return validated(latitude = latitude, longitude = longitude)
    }

    private fun validated(
        latitude: Double,
        longitude: Double,
    ): MediaCaptureLocation? {
        val latitudeValid = latitude.isFinite() && abs(latitude) <= MAX_LATITUDE
        val longitudeValid = longitude.isFinite() && abs(longitude) <= MAX_LONGITUDE
        return if (latitudeValid && longitudeValid) {
            MediaCaptureLocation(latitude = latitude, longitude = longitude)
        } else {
            null
        }
    }

    /** Two leading sign-prefixed decimal groups; altitude/CRS suffix ignored. */
    private val ISO_6709_PREFIX = Regex("""^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)""")
    private const val MAX_LATITUDE = 90.0
    private const val MAX_LONGITUDE = 180.0
}
