@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.compose

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.pantopus.android.data.moments.MomentMedia
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.delay
import java.io.File

/** What the camera screen can ask of the camera: a photo, a video started and stopped, flash, the other lens. */
class MomentsCameraController {
    internal var takePhoto: (() -> Unit)? = null
    internal var startVideo: (() -> Unit)? = null
    internal var stopVideo: (() -> Unit)? = null
}

/**
 * The live camera (board P1), CameraX under Compose: a preview, a photo capture and a video recorder at about 720p that
 * stops itself at 30 seconds. Calls [onCaptured] with what it made.
 */
@Composable
fun MomentsCameraPreview(
    controller: MomentsCameraController,
    front: Boolean,
    flash: Boolean,
    onCaptured: (MomentMediaFile) -> Unit,
    onRecording: (Boolean) -> Unit,
    onFailed: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
    val imageCapture = remember { ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build() }
    val videoCapture =
        remember {
            VideoCapture.withOutput(
                Recorder
                    .Builder()
                    .setQualitySelector(QualitySelector.from(Quality.HD, FallbackStrategy.lowerQualityOrHigherThan(Quality.HD)))
                    .build(),
            )
        }
    var camera by remember { mutableStateOf<Camera?>(null) }
    var recording by remember { mutableStateOf<Recording?>(null) }
    val captured by rememberUpdatedState(onCaptured)
    val recordingChanged by rememberUpdatedState(onRecording)
    val failed by rememberUpdatedState(onFailed)

    DisposableEffect(front, lifecycleOwner) {
        val future = ProcessCameraProvider.getInstance(context)
        var provider: ProcessCameraProvider? = null
        future.addListener(
            {
                provider = runCatching { future.get() }.getOrNull()
                val ready = provider ?: return@addListener failed("The camera isn't available.")
                val selector = if (front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
                val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                runCatching {
                    ready.unbindAll()
                    camera = ready.bindToLifecycle(lifecycleOwner, selector, preview, imageCapture, videoCapture)
                }.onFailure {
                    // Some cameras (the emulator's among them) can't run photos and video at once: photos only then.
                    runCatching {
                        ready.unbindAll()
                        camera = ready.bindToLifecycle(lifecycleOwner, selector, preview, imageCapture)
                    }.onFailure { failed("The camera isn't available.") }
                }
            },
            ContextCompat.getMainExecutor(context),
        )
        onDispose {
            recording?.stop()
            provider?.unbindAll()
        }
    }
    LaunchedEffect(flash, camera) { imageCapture.flashMode = if (flash) ImageCapture.FLASH_MODE_ON else ImageCapture.FLASH_MODE_OFF }

    controller.takePhoto = {
        val file = MomentMedia.newFile(context, "jpg")
        val options =
            ImageCapture.OutputFileOptions
                .Builder(file)
                .setMetadata(ImageCapture.Metadata().apply { isReversedHorizontal = front })
                .build()
        imageCapture.takePicture(
            options,
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) = captured(MomentMediaFile.Photo(file))

                override fun onError(exception: ImageCaptureException) {
                    file.delete()
                    failed("Couldn't take the photo.")
                }
            },
        )
    }
    controller.startVideo = start@{
        if (recording != null) return@start
        val file = MomentMedia.newFile(context, "mp4")
        if (flash) camera?.cameraControl?.enableTorch(true)
        recording =
            startRecording(context, videoCapture, file) { event ->
                when (event) {
                    is VideoRecordEvent.Start -> recordingChanged(true)
                    is VideoRecordEvent.Finalize -> {
                        recording = null
                        recordingChanged(false)
                        camera?.cameraControl?.enableTorch(false)
                        val duration = event.recordingStats.recordedDurationNanos / 1_000_000
                        val usable =
                            !event.hasError() ||
                                event.error == VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED
                        if (usable && file.length() > 0 && duration >= MIN_VIDEO_MS) {
                            captured(MomentMediaFile.Video(file, duration, recordedHere = true))
                        } else {
                            file.delete()
                            val tooShort = duration < MIN_VIDEO_MS && usable
                            failed(if (tooShort) "Hold a little longer for a video." else "Couldn't record the video.")
                        }
                    }
                    else -> Unit
                }
            }
    }
    controller.stopVideo = { recording?.stop() }

    AndroidView(factory = { previewView }, modifier = modifier)
}

@SuppressLint("MissingPermission")
private fun startRecording(
    context: Context,
    videoCapture: VideoCapture<Recorder>,
    file: File,
    onEvent: (VideoRecordEvent) -> Unit,
): Recording? =
    runCatching {
        val options = FileOutputOptions.Builder(file).setDurationLimitMillis(MomentMedia.MAX_VIDEO_MS).build()
        val pending = videoCapture.output.prepareRecording(context, options)
        val withSound =
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                pending.withAudioEnabled()
            } else {
                pending
            }
        withSound.start(ContextCompat.getMainExecutor(context), onEvent)
    }.getOrNull()

/**
 * The shutter (board P1): an 80 dp white ring. Tap for a photo; hold for a video, while the ring fills red over the
 * 30 seconds. The first hold asks for the microphone, so the video carries its sound.
 */
@Composable
fun MomentsShutter(
    recording: Boolean,
    onPhoto: () -> Unit,
    onStartVideo: () -> Unit,
    onStopVideo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var asked by remember { mutableStateOf(false) }
    val microphone = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { asked = true }
    var progress by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(recording) {
        progress = 0f
        if (!recording) return@LaunchedEffect
        val started = System.currentTimeMillis()
        while (true) {
            progress = ((System.currentTimeMillis() - started).toFloat() / MomentMedia.MAX_VIDEO_MS).coerceIn(0f, 1f)
            delay(50)
        }
    }
    val photo by rememberUpdatedState(onPhoto)
    val start by rememberUpdatedState(onStartVideo)
    val stop by rememberUpdatedState(onStopVideo)
    Box(
        modifier =
            modifier
                .size(80.dp)
                .testTag("moments.camera.shutter")
                .pointerInput(Unit) {
                    awaitEachGesture {
                        awaitFirstDown()
                        val released =
                            withTimeoutOrNull(HOLD_FOR_VIDEO_MS) {
                                waitForUpOrCancellation()
                            }
                        if (released != null) {
                            photo()
                            return@awaitEachGesture
                        }
                        val hasMic =
                            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                                PackageManager.PERMISSION_GRANTED
                        if (!hasMic && !asked) {
                            asked = true
                            microphone.launch(Manifest.permission.RECORD_AUDIO)
                            return@awaitEachGesture
                        }
                        start()
                        waitForUpOrCancellation()
                        stop()
                    }
                }.clearAndSetSemantics {
                    contentDescription = if (recording) "Recording. Let go to stop" else "Take a photo, or hold for video"
                    role = Role.Button
                    onClick(label = "Take a photo") {
                        photo()
                        true
                    }
                    onLongClick(label = "Record a video") {
                        start()
                        true
                    }
                },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = 5.dp.toPx()
            val radius = size.minDimension / 2 - stroke / 2
            drawCircle(color = Color.White, radius = radius, style = Stroke(stroke))
            if (recording) {
                drawArc(
                    color = PantopusColors.error,
                    startAngle = -90f,
                    sweepAngle = 360f * progress,
                    useCenter = false,
                    topLeft = Offset(stroke / 2, stroke / 2),
                    size = Size(size.width - stroke, size.height - stroke),
                    style = Stroke(stroke, cap = StrokeCap.Round),
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .size(if (recording) 34.dp else 62.dp)
                    .clip(if (recording) androidx.compose.foundation.shape.RoundedCornerShape(8.dp) else CircleShape)
                    .background(if (recording) PantopusColors.error else Color.White),
        )
    }
}

/** The library button's frame (board P1): a 46 dp rounded square with a white border. */
fun Modifier.momentsLibraryFrame(onClick: () -> Unit): Modifier =
    this
        .size(46.dp)
        .clip(androidx.compose.foundation.shape.RoundedCornerShape(Radius12))
        .background(Color.Black.copy(alpha = 0.6f))
        .border(2.dp, Color.White, androidx.compose.foundation.shape.RoundedCornerShape(Radius12))
        .clickable(role = Role.Button, onClick = onClick)
        .padding(2.dp)

private val Radius12 = app.pantopus.android.ui.theme.Radii.lg
private const val HOLD_FOR_VIDEO_MS = 300L
private const val MIN_VIDEO_MS = 600L
