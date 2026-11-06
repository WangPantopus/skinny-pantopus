package app.pantopus.android.ui.screens.compose.placepicker

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlin.math.abs

/**
 * A media attachment's capture coordinate — where (and, when the metadata
 * says, when) the photo/video was TAKEN, read from its own metadata.
 * Mirrors the iOS `MediaCaptureLocation` value type 1:1.
 */
data class MediaCaptureLocation(
    val latitude: Double,
    val longitude: Double,
    /** The GPS time stamp, else the camera's capture time; null when the file carries neither. */
    val capturedAt: Instant? = null,
)

/**
 * Reads the capture location out of picked media so the place picker can
 * anchor its NEARBY suggestions on where the photo or video was taken
 * (Instagram parity), not only on where the user is right now.
 *
 * PRIVACY RULE (founder decision, 2026-11-05): where an attachment was
 * taken anchors the picker's "Photo location" suggestions, and it is sent
 * with a Place post (`mediaLocations`) as evidence that the author was at
 * the place, the way a fresh GPS fix is. The backend uses it for the Place
 * check and the post's pin (the tagged venue, or the capture point for a
 * town tag; no exact pin within 150 m of the author's home) and keeps no
 * other copy of the points.
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
            val exif = ExifInterface(ByteArrayInputStream(bytes))
            exif.latLong?.let { coords ->
                validated(latitude = coords[0], longitude = coords[1], capturedAt = gpsTime(exif) ?: cameraTime(exif))
            }
        }.getOrNull()

    /** The GPS block's own UTC time ("2026:11:02" + "18:04:31"). */
    private fun gpsTime(exif: ExifInterface): Instant? {
        val day = exif.getAttribute(ExifInterface.TAG_GPS_DATESTAMP) ?: return null
        val time = exif.getAttribute(ExifInterface.TAG_GPS_TIMESTAMP)?.substringBefore('.') ?: return null
        return runCatching { LocalDateTime.parse("$day $time", EXIF_TIME).toInstant(ZoneOffset.UTC) }.getOrNull()
    }

    /** The camera's capture time, in its recorded offset ("-07:00") when there is one, else the phone's zone. */
    private fun cameraTime(exif: ExifInterface): Instant? {
        val raw = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL) ?: return null
        return runCatching {
            val local = LocalDateTime.parse(raw, EXIF_TIME)
            val offset =
                exif.getAttribute(ExifInterface.TAG_OFFSET_TIME_ORIGINAL)?.let { runCatching { ZoneOffset.of(it) }.getOrNull() }
            if (offset != null) local.toInstant(offset) else local.atZone(ZoneId.systemDefault()).toInstant()
        }.getOrNull()
    }

    /** A video's creation date ("20261102T180431.000Z"; some writers drop the milliseconds). */
    private fun videoTime(raw: String?): Instant? {
        val value = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return VIDEO_TIMES.firstNotNullOfOrNull { format ->
            runCatching { LocalDateTime.parse(value, format).toInstant(ZoneOffset.UTC) }.getOrNull()
        }
    }

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
                    ?.copy(capturedAt = videoTime(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE)))
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
        capturedAt: Instant? = null,
    ): MediaCaptureLocation? {
        val latitudeValid = latitude.isFinite() && abs(latitude) <= MAX_LATITUDE
        val longitudeValid = longitude.isFinite() && abs(longitude) <= MAX_LONGITUDE
        // 0, 0 is where a missing fix lands, not a photo from the Gulf of Guinea.
        val placed = latitude != 0.0 || longitude != 0.0
        return if (latitudeValid && longitudeValid && placed) {
            MediaCaptureLocation(latitude = latitude, longitude = longitude, capturedAt = capturedAt)
        } else {
            null
        }
    }

    /** Two leading sign-prefixed decimal groups; altitude/CRS suffix ignored. */
    private val ISO_6709_PREFIX = Regex("""^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)""")
    private const val MAX_LATITUDE = 90.0
    private const val MAX_LONGITUDE = 180.0
    private val EXIF_TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy:MM:dd HH:mm:ss")
    private val VIDEO_TIMES: List<DateTimeFormatter> =
        listOf(
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'"),
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"),
        )
}
