package app.pantopus.android.ui.screens.compose.placepicker

import androidx.exifinterface.media.ExifInterface
import app.pantopus.android.data.location.HeightReading
import java.io.ByteArrayInputStream

/**
 * Reads how high a picked photo says it was taken, for a Moment's "Show elevation". Beside [MediaLocationExtractor],
 * which reads where; failure-silent the same way (no height: no row on the Post sheet).
 */
object MediaHeightExtractor {
    /**
     * EXIF GPSAltitude off a still's picked bytes, which the standard counts from sea level and is taken as written
     * (some Android cameras write the height above the WGS84 ellipsoid instead, about 20 m lower around Vancouver,
     * WA), with the speed when the file has one, which tells a flight from a mountain. Null without an altitude tag.
     */
    fun fromImageBytes(bytes: ByteArray): HeightReading? =
        runCatching {
            val exif = ExifInterface(ByteArrayInputStream(bytes))
            exif
                .takeIf { it.hasAttribute(ExifInterface.TAG_GPS_ALTITUDE) }
                ?.getAltitude(Double.NaN)
                ?.takeIf { it.isFinite() }
                ?.let { HeightReading(meters = it, speedMps = speedMps(exif)) }
        }.getOrNull()

    /** EXIF GPSSpeed in metres a second: its unit is km/h unless GPSSpeedRef says miles an hour (M) or knots (N). */
    private fun speedMps(exif: ExifInterface): Double? {
        val speed = exif.getAttributeDouble(ExifInterface.TAG_GPS_SPEED, Double.NaN).takeIf { it.isFinite() && it >= 0 } ?: return null
        return when (exif.getAttribute(ExifInterface.TAG_GPS_SPEED_REF)) {
            "M" -> speed * MPS_PER_MPH
            "N" -> speed * MPS_PER_KNOT
            else -> speed / KMH_PER_MPS
        }
    }

    private const val MPS_PER_MPH = 0.44704
    private const val MPS_PER_KNOT = 0.514444
    private const val KMH_PER_MPS = 3.6
}
