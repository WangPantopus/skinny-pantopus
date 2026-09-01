@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.compose.listing

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

/**
 * Normalizes Snap & Sell photos before they reach the wizard. Mirrors
 * iOS `ListingPhotoProcessor`: downscale so the longest edge is at
 * most 1600px, re-encode as JPEG at 0.8 quality. Re-encoding through a
 * [Bitmap] drops every EXIF tag (GPS, timestamps) from the bytes that
 * get uploaded.
 */
object ListingPhotoProcessor {
    /** Longest edge after downscale. */
    const val MAX_PIXEL_DIMENSION = 1600

    /** JPEG compression quality (0–100), mirrors iOS 0.8. */
    const val JPEG_QUALITY = 80

    private const val DEGREES_FULL_TURN = 360

    /**
     * Decode raw camera/library bytes into normalized upload bytes.
     * `rotationDegrees` overrides the EXIF orientation when the source
     * is a CameraX [androidx.camera.core.ImageProxy] (its rotation is
     * carried out-of-band). Returns null when the bytes don't decode.
     */
    fun uploadData(
        bytes: ByteArray,
        rotationDegrees: Int? = null,
    ): ByteArray? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        // Power-of-two pre-shrink keeps peak memory bounded for large
        // camera frames before the exact scale below.
        val options =
            BitmapFactory.Options().apply {
                inSampleSize = sampleSize(maxOf(bounds.outWidth, bounds.outHeight))
            }
        val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) ?: return null
        val oriented = rotate(decoded, rotationDegrees ?: exifRotation(bytes))
        val scaled = scaleDown(oriented)
        return ByteArrayOutputStream().use { out ->
            scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
            out.toByteArray()
        }
    }

    private fun sampleSize(longestEdge: Int): Int {
        var sample = 1
        var edge = longestEdge
        while (edge / 2 >= MAX_PIXEL_DIMENSION) {
            sample *= 2
            edge /= 2
        }
        return sample
    }

    private fun exifRotation(bytes: ByteArray): Int =
        runCatching {
            ByteArrayInputStream(bytes).use { ExifInterface(it).rotationDegrees }
        }.getOrDefault(0)

    private fun rotate(
        bitmap: Bitmap,
        degrees: Int,
    ): Bitmap {
        if (degrees % DEGREES_FULL_TURN == 0) return bitmap
        val matrix = Matrix().apply { postRotate(degrees.toFloat()) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun scaleDown(bitmap: Bitmap): Bitmap {
        val longest = maxOf(bitmap.width, bitmap.height)
        if (longest <= MAX_PIXEL_DIMENSION) return bitmap
        val scale = MAX_PIXEL_DIMENSION.toFloat() / longest
        val width = (bitmap.width * scale).toInt().coerceAtLeast(1)
        val height = (bitmap.height * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, width, height, true)
    }
}
