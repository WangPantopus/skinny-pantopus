package app.pantopus.android.ui.screens.compose.placepicker

import androidx.exifinterface.media.ExifInterface
import app.cash.paparazzi.Paparazzi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.Base64

/**
 * Coverage for [MediaLocationExtractor] — mirrors the iOS
 * `MediaLocationExtractorTests`: EXIF GPS off synthesized JPEG bytes
 * (all four hemisphere sign combinations), the failure-silent paths, and
 * the shared ISO-6709 parser used by the video reader.
 *
 * The Paparazzi rule is here ONLY for its runtime environment (this
 * suite never snapshots): androidx ExifInterface's static init calls
 * the NATIVE `Log.isLoggable`, which throws on the plain JVM (the repo
 * has no Robolectric); Paparazzi boots layoutlib's android runtime and
 * registers those natives, making ExifInterface loadable.
 */
class MediaLocationExtractorTest {
    @get:Rule
    val paparazzi = Paparazzi()

    /**
     * Write the baseline JPEG fixture to a temp file and stamp GPS EXIF
     * onto it with ExifInterface — `setLatLong` writes the unsigned DMS
     * rationals plus the N/S + E/W refs, so extraction must re-apply
     * hemisphere signs.
     */
    private fun geotaggedJpegBytes(
        latitude: Double,
        longitude: Double,
    ): ByteArray {
        val file = File.createTempFile("exif-gps", ".jpg")
        return try {
            file.writeBytes(plainJpegBytes())
            val exif = ExifInterface(file.absolutePath)
            exif.setLatLong(latitude, longitude)
            exif.saveAttributes()
            file.readBytes()
        } finally {
            file.delete()
        }
    }

    /**
     * A real 4×4 baseline JPEG, embedded because the Android unit-test
     * compile classpath (android.jar) has no `javax.imageio` to
     * synthesize one at runtime.
     */
    private fun plainJpegBytes(): ByteArray = Base64.getDecoder().decode(TINY_JPEG_BASE64)

    // MARK: - EXIF stills (hemisphere signs)

    @Test
    fun extractsNorthWestCoordinates() {
        val location = MediaLocationExtractor.fromImageBytes(geotaggedJpegBytes(41.8781, -87.6298))
        assertEquals(41.8781, location!!.latitude, DMS_TOLERANCE)
        assertEquals(-87.6298, location.longitude, DMS_TOLERANCE)
    }

    @Test
    fun extractsSouthEastCoordinates() {
        val location = MediaLocationExtractor.fromImageBytes(geotaggedJpegBytes(-33.8688, 151.2093))
        assertEquals(-33.8688, location!!.latitude, DMS_TOLERANCE)
        assertEquals(151.2093, location.longitude, DMS_TOLERANCE)
    }

    @Test
    fun extractsSouthWestCoordinates() {
        val location = MediaLocationExtractor.fromImageBytes(geotaggedJpegBytes(-54.8019, -68.3030))
        assertEquals(-54.8019, location!!.latitude, DMS_TOLERANCE)
        assertEquals(-68.3030, location.longitude, DMS_TOLERANCE)
    }

    @Test
    fun extractsNorthEastCoordinates() {
        val location = MediaLocationExtractor.fromImageBytes(geotaggedJpegBytes(64.1466, 21.9426))
        assertEquals(64.1466, location!!.latitude, DMS_TOLERANCE)
        assertEquals(21.9426, location.longitude, DMS_TOLERANCE)
    }

    // MARK: - Failure-silent paths

    @Test
    fun jpegWithoutGpsReturnsNull() {
        // The system-picker redaction reality on API 29+: the bytes the
        // app holds simply carry no GPS — extraction must be null, so
        // the picker renders no anchor chips.
        assertNull(MediaLocationExtractor.fromImageBytes(plainJpegBytes()))
    }

    @Test
    fun garbageBytesReturnNull() {
        assertNull(MediaLocationExtractor.fromImageBytes(byteArrayOf(0x01, 0x02, 0x03)))
    }

    @Test
    fun emptyBytesReturnNull() {
        assertNull(MediaLocationExtractor.fromImageBytes(ByteArray(0)))
    }

    // MARK: - ISO-6709 parser (video location atom)

    @Test
    fun parsesBasicIso6709Point() {
        val location = MediaLocationExtractor.parseIso6709("+41.8781-087.6298/")
        assertEquals(41.8781, location!!.latitude, 0.0)
        assertEquals(-87.6298, location.longitude, 0.0)
    }

    @Test
    fun parsesAltitudeSuffixedIso6709Point() {
        val location = MediaLocationExtractor.parseIso6709("+41.8781-087.6298+000.000/")
        assertEquals(41.8781, location!!.latitude, 0.0)
        assertEquals(-87.6298, location.longitude, 0.0)
    }

    @Test
    fun parsesSouthEastIso6709Point() {
        val location = MediaLocationExtractor.parseIso6709("-33.8688+151.2093/")
        assertEquals(-33.8688, location!!.latitude, 0.0)
        assertEquals(151.2093, location.longitude, 0.0)
    }

    @Test
    fun parsesIntegerDegreesAndTrailingWhitespace() {
        val location = MediaLocationExtractor.parseIso6709(" +41-087/ ")
        assertEquals(41.0, location!!.latitude, 0.0)
        assertEquals(-87.0, location.longitude, 0.0)
    }

    @Test
    fun rejectsMalformedIso6709Values() {
        assertNull(MediaLocationExtractor.parseIso6709(""))
        assertNull(MediaLocationExtractor.parseIso6709("garbage"))
        // Missing longitude group.
        assertNull(MediaLocationExtractor.parseIso6709("+41.8781/"))
        // Unsigned groups aren't ISO-6709 points.
        assertNull(MediaLocationExtractor.parseIso6709("41.8781-087.6298/"))
    }

    @Test
    fun rejectsOutOfRangeCoordinates() {
        assertNull(MediaLocationExtractor.parseIso6709("+91.0000-087.6298/"))
        assertNull(MediaLocationExtractor.parseIso6709("+41.8781-187.6298/"))
    }

    private companion object {
        /** EXIF stores DMS rationals — round-trips are ~1e-5 accurate. */
        const val DMS_TOLERANCE = 1e-4

        /** 4×4 all-black baseline JPEG (631 bytes), `javax.imageio` output. */
        const val TINY_JPEG_BASE64 =
            "/9j/4AAQSkZJRgABAgAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5" +
                "PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/" +
                "wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQR" +
                "BRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1" +
                "dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6" +
                "/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKR" +
                "obHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOU" +
                "lZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5/ooo" +
                "oA//2Q=="
    }
}
