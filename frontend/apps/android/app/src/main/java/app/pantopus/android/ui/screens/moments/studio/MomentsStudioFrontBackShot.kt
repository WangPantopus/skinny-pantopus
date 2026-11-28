@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.studio

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.camera.core.CameraSelector
import androidx.camera.core.ConcurrentCamera
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import app.pantopus.android.data.moments.MomentMedia
import app.pantopus.android.ui.screens.moments.compose.marks.MomentStandIn
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.math.max
import kotlin.math.min

/*
 * "Pulse, reinvented", front and back together (DESIGN row 7; as on iPhone #5178): the back camera and the front camera
 * in one shot, the small picture inside the big one. A mode the person picks over the Studio's camera, never the default,
 * and only while the switch is on and the phone can run both cameras at once (CameraX's concurrent cameras). Today's
 * camera is left exactly as it is: it stops while this mode is open and starts again when it closes, and the shot reaches
 * the Studio as an ordinary photo taken here, so nothing new is sent and a reader with the switch off sees the same
 * picture.
 *
 * An emulator can't run two cameras: on debug builds on an emulator only ([MomentStandIn]), two stand-in pictures go
 * through this same code (the small picture inside the big one, swapping them, the Studio taking the result). The real
 * two-camera capture needs a real Android phone.
 */

/** The phone's back and front cameras that run together, or null where they can't (most phones, every emulator). */
internal fun bothCamerasOf(provider: ProcessCameraProvider): Pair<CameraSelector, CameraSelector>? =
    runCatching {
        provider.availableConcurrentCameraInfos.firstNotNullOfOrNull { infos ->
            val back = CameraSelector.DEFAULT_BACK_CAMERA.filter(infos).firstOrNull()
            val front = CameraSelector.DEFAULT_FRONT_CAMERA.filter(infos).firstOrNull()
            if (back != null && front != null) back.cameraSelector to front.cameraSelector else null
        }
    }.getOrNull()

/** Whether this phone (or a debug emulator build, with stand-ins) offers front and back together. */
internal suspend fun offersBothCameras(context: Context): Boolean {
    if (MomentStandIn.active) return true
    val provider = cameraProvider(context) ?: return false
    return bothCamerasOf(provider) != null
}

internal suspend fun cameraProvider(context: Context): ProcessCameraProvider? =
    suspendCancellableCoroutine { done ->
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({ done.resume(runCatching { future.get() }.getOrNull()) }, ContextCompat.getMainExecutor(context))
    }

/** The two cameras bound together, each with a preview and a still picture. */
internal class BothCameras(
    val backPreview: Preview,
    val frontPreview: Preview,
    private val backCapture: ImageCapture,
    private val frontCapture: ImageCapture,
) {
    /** One still from each camera, upright, the front one mirrored as the person saw it; null if either failed. */
    suspend fun shoot(context: Context): Pair<Bitmap, Bitmap>? {
        val back = still(context, backCapture, mirror = false) ?: return null
        val front = still(context, frontCapture, mirror = true) ?: return null
        return back to front
    }

    companion object {
        /** Binds both cameras to [owner] (today's camera has let go of them), or null where that fails. */
        fun bind(
            provider: ProcessCameraProvider,
            owner: LifecycleOwner,
        ): BothCameras? {
            val (backSelector, frontSelector) = bothCamerasOf(provider) ?: return null
            val cameras =
                BothCameras(
                    Preview.Builder().build(),
                    Preview.Builder().build(),
                    ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build(),
                    ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build(),
                )
            return runCatching {
                provider.unbindAll()
                provider.bindToLifecycle(
                    listOf(
                        ConcurrentCamera.SingleCameraConfig(
                            backSelector,
                            UseCaseGroup.Builder().addUseCase(cameras.backPreview).addUseCase(cameras.backCapture).build(),
                            owner,
                        ),
                        ConcurrentCamera.SingleCameraConfig(
                            frontSelector,
                            UseCaseGroup.Builder().addUseCase(cameras.frontPreview).addUseCase(cameras.frontCapture).build(),
                            owner,
                        ),
                    ),
                )
                cameras
            }.getOrElse {
                provider.unbindAll()
                null
            }
        }

        private suspend fun still(
            context: Context,
            capture: ImageCapture,
            mirror: Boolean,
        ): Bitmap? =
            suspendCancellableCoroutine { done ->
                capture.takePicture(
                    ContextCompat.getMainExecutor(context),
                    object : ImageCapture.OnImageCapturedCallback() {
                        override fun onCaptureSuccess(image: ImageProxy) {
                            val picture = runCatching { upright(image, mirror) }.getOrNull()
                            image.close()
                            done.resume(picture)
                        }

                        override fun onError(exception: ImageCaptureException) = done.resume(null)
                    },
                )
            }

        private fun upright(
            image: ImageProxy,
            mirror: Boolean,
        ): Bitmap {
            val raw = image.toBitmap()
            val turn =
                Matrix().apply {
                    postRotate(image.imageInfo.rotationDegrees.toFloat())
                    if (mirror) postScale(-1f, 1f)
                }
            return Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, turn, true)
        }
    }
}

/** The small picture on the screen, in dp: 118 by 157, 16 from the left and 140 under the top of the safe area. */
internal object FrontBackInset {
    const val LEFT = 16f
    const val TOP = 140f
    const val WIDTH = 118f
    const val HEIGHT = 157f
    const val RADIUS = 14f
    const val EDGE = 3f
}

/**
 * The picture exactly as the screen showed it: [big] cut to the screen's shape ([screenWidth] by [screenHeight] px,
 * centred, as the preview fills the screen), and [small] filling [inset] (screen px) with rounded corners and a white
 * edge. The output keeps the big picture's own detail: as many pixels as the part of it that showed.
 */
internal fun composeFrontBack(
    big: Bitmap,
    small: Bitmap,
    screenWidth: Float,
    screenHeight: Float,
    inset: RectF,
    density: Float,
): Bitmap {
    val scale = min(big.width / max(screenWidth, 1f), big.height / max(screenHeight, 1f))
    val width = (screenWidth * scale).toInt().coerceAtLeast(1)
    val height = (screenHeight * scale).toInt().coerceAtLeast(1)
    val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    canvas.drawBitmap(big, -(big.width - width) / 2f, -(big.height - height) / 2f, paint)
    val box = RectF(inset.left * scale, inset.top * scale, inset.right * scale, inset.bottom * scale)
    val edge = FrontBackInset.EDGE * density * scale
    val radius = FrontBackInset.RADIUS * density * scale
    paint.color = android.graphics.Color.WHITE
    canvas.drawRoundRect(RectF(box).apply { inset(-edge / 2, -edge / 2) }, radius + edge / 2, radius + edge / 2, paint)
    canvas.save()
    canvas.clipPath(
        Path().apply {
            addRoundRect(RectF(box).apply { inset(edge / 2, edge / 2) }, radius - edge / 2, radius - edge / 2, Path.Direction.CW)
        },
    )
    val fill = max(box.width() / small.width, box.height() / small.height)
    val shownWidth = small.width * fill
    val shownHeight = small.height * fill
    canvas.drawBitmap(
        small,
        null,
        RectF(
            box.centerX() - shownWidth / 2,
            box.centerY() - shownHeight / 2,
            box.centerX() + shownWidth / 2,
            box.centerY() + shownHeight / 2,
        ),
        paint,
    )
    canvas.restore()
    return out
}

/** Writes [picture] as a JPEG Moment file, or null if it can't be written. */
internal suspend fun saveFrontBack(
    context: Context,
    picture: Bitmap,
): File? =
    withContext(Dispatchers.IO) {
        val file = MomentMedia.newFile(context, "jpg")
        runCatching {
            file.outputStream().use { picture.compress(Bitmap.CompressFormat.JPEG, 92, it) }
            file
        }.getOrElse {
            file.delete()
            null
        }
    }

/** Debug emulator builds only: a stand-in picture for one camera, [width] by [height] px, with its name on it. */
internal fun standInPicture(
    width: Int,
    height: Int,
    front: Boolean,
): Bitmap {
    val out = Bitmap.createBitmap(width.coerceAtLeast(2), height.coerceAtLeast(2), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val top = if (front) 0xFF7C3AED.toInt() else 0xFF0EA5E9.toInt()
    val bottom = if (front) 0xFFF472B6.toInt() else 0xFF14532D.toInt()
    val paint = Paint().apply { shader = LinearGradient(0f, 0f, 0f, out.height.toFloat(), top, bottom, Shader.TileMode.CLAMP) }
    canvas.drawRect(0f, 0f, out.width.toFloat(), out.height.toFloat(), paint)
    val words =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
            textSize = out.width / 11f
        }
    canvas.drawText(if (front) "Front camera" else "Back camera", out.width / 2f, out.height / 2f, words)
    canvas.drawText("(stand-in)", out.width / 2f, out.height / 2f + words.textSize * 1.3f, words)
    return out
}
