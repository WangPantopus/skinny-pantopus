@file:Suppress("MagicNumber", "FunctionNaming", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.components

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import androidx.compose.ui.tooling.preview.Preview as ComposePreview

private val FEED_HEIGHT = 208.dp

/**
 * Live camera viewfinder with a shutter — the `Viewfinder` slot in the
 * A17.14 Unboxing design. Dark frame, white framing brackets, a glowing
 * [accent] scan-line, an "Item detected" pill, and a stroke-ring shutter over
 * a control deck.
 *
 * Determinism + permissions: the live CameraX preview is skipped under
 * Compose inspection (Paparazzi) and when CAMERA permission is not granted,
 * falling back to a STATIC placeholder with a disabled shutter and a hint — so
 * snapshots never spin and never depend on a camera. The scan-line animates
 * only in production and honors Reduce Motion. Mirrors `CameraScanner` on iOS.
 *
 * @param accent The scan-line + "detected" pill tint (the screen's category tone).
 * @param onCapture Called with the still [Bitmap] when the shutter fires.
 * @param detectedLabel Text for the live "detected" pill; pass `null` to hide it.
 * @param onGallery Tap handler for the left rail (pick from library); `null` disables it.
 * @param onFlip Tap handler for the right rail (flip camera); `null` disables it.
 * @param cameraPreviewEnabled Pass `false` for deterministic previews/snapshots that must not bind CameraX.
 */
@Composable
fun CameraScanner(
    accent: Color,
    onCapture: (Bitmap) -> Unit,
    modifier: Modifier = Modifier,
    detectedLabel: String? = "Item detected",
    onGallery: (() -> Unit)? = null,
    onFlip: (() -> Unit)? = null,
    cameraPreviewEnabled: Boolean = true,
) {
    val context = LocalContext.current
    val previewHost = LocalInspectionMode.current || LocalView.current.isInEditMode
    val staticPreview = !cameraPreviewEnabled || previewHost
    // The primitive reflects current permission; the hosting screen (B2.4)
    // owns the system request. This keeps the activity-result plumbing out of
    // a reusable component and out of Paparazzi's composition.
    val isLive = !staticPreview && cameraGranted(context)
    // Never build CameraX use cases under Paparazzi/preview.
    val imageCapture = remember(staticPreview) { if (staticPreview) null else ImageCapture.Builder().build() }

    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.xl))
                .background(Color.Black),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(FEED_HEIGHT)
                    .background(Color(red = 0.07f, green = 0.07f, blue = 0.07f)),
        ) {
            if (isLive && imageCapture != null) {
                CameraPreview(imageCapture = imageCapture, modifier = Modifier.fillMaxSize())
            } else {
                val hint =
                    when {
                        staticPreview -> "Camera preview unavailable here."
                        !cameraGranted(context) -> "Camera access is off — enable it in Settings to scan."
                        else -> "Camera preview unavailable here."
                    }
                Placeholder(hint = hint)
            }
            FramingBrackets(modifier = Modifier.fillMaxSize().padding(22.dp))
            if (isLive) {
                ScanLine(accent = accent)
                TopPills(accent = accent, detectedLabel = detectedLabel)
            }
        }
        ControlDeck(
            isLive = isLive,
            onGallery = onGallery,
            onFlip = onFlip,
            onShutter = { imageCapture?.let { capturePhoto(context, it, onCapture) } },
        )
    }
}

private fun cameraGranted(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

private fun capturePhoto(
    context: Context,
    imageCapture: ImageCapture,
    onCapture: (Bitmap) -> Unit,
) {
    imageCapture.takePicture(
        ContextCompat.getMainExecutor(context),
        object : ImageCapture.OnImageCapturedCallback() {
            override fun onCaptureSuccess(image: ImageProxy) {
                val bitmap = image.toBitmap()
                image.close()
                onCapture(bitmap)
            }
            // A failed capture must not crash the scanner; the default
            // (no-op) onError keeps the viewfinder live for a retry.
        },
    )
}

@Composable
private fun CameraPreview(
    imageCapture: ImageCapture,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            PreviewView(ctx).apply {
                scaleType = PreviewView.ScaleType.FILL_CENTER
                val providerFuture = ProcessCameraProvider.getInstance(ctx)
                providerFuture.addListener(
                    {
                        val provider = providerFuture.get()
                        val preview =
                            Preview.Builder().build().also { it.setSurfaceProvider(surfaceProvider) }
                        provider.unbindAll()
                        provider.bindToLifecycle(
                            lifecycleOwner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            preview,
                            imageCapture,
                        )
                    },
                    ContextCompat.getMainExecutor(context),
                )
            }
        },
    )
}

@Composable
private fun Placeholder(hint: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        StripeField(modifier = Modifier.fillMaxSize())
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier = Modifier.padding(horizontal = Spacing.s5).semantics { contentDescription = hint },
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Camera,
                contentDescription = null,
                size = 28.dp,
                tint = Color.White.copy(alpha = 0.5f),
            )
            Text(
                text = hint,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White.copy(alpha = 0.6f),
            )
        }
    }
}

@Composable
private fun ScanLine(accent: Color) {
    val reduceMotion = rememberReduceMotion()
    val phase =
        if (reduceMotion) {
            0.5f
        } else {
            val transition = rememberInfiniteTransition(label = "scanLine")
            transition
                .animateFloat(
                    initialValue = 0f,
                    targetValue = 1f,
                    animationSpec =
                        infiniteRepeatable(
                            animation = tween(durationMillis = 1800),
                            repeatMode = RepeatMode.Reverse,
                        ),
                    label = "scanPhase",
                ).value
        }
    Canvas(modifier = Modifier.fillMaxSize()) {
        val inset = 22.dp.toPx()
        val travel = size.height - 44.dp.toPx()
        val y = inset + travel * phase
        drawLine(
            brush =
                Brush.horizontalGradient(
                    colors = listOf(Color.Transparent, accent, Color.Transparent),
                    startX = inset,
                    endX = size.width - inset,
                ),
            start = Offset(inset, y),
            end = Offset(size.width - inset, y),
            strokeWidth = 6.dp.toPx(),
            cap = StrokeCap.Round,
            alpha = 0.35f,
        )
        drawLine(
            brush =
                Brush.horizontalGradient(
                    colors = listOf(Color.Transparent, accent, Color.Transparent),
                    startX = inset,
                    endX = size.width - inset,
                ),
            start = Offset(inset, y),
            end = Offset(size.width - inset, y),
            strokeWidth = 2.dp.toPx(),
            cap = StrokeCap.Round,
        )
    }
}

@Composable
private fun TopPills(
    accent: Color,
    detectedLabel: String?,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s2),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        if (detectedLabel != null) {
            Pill(
                icon = PantopusIcon.ScanLine,
                text = detectedLabel,
                background = accent.copy(alpha = 0.9f),
            )
        } else {
            Box(modifier = Modifier)
        }
        Pill(icon = PantopusIcon.Zap, text = "Auto", background = Color.Black.copy(alpha = 0.45f))
    }
}

@Composable
private fun Pill(
    icon: PantopusIcon,
    text: String,
    background: Color,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = Color.White)
        Text(text = text, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White)
    }
}

@Composable
private fun ControlDeck(
    isLive: Boolean,
    onGallery: (() -> Unit)?,
    onFlip: (() -> Unit)?,
    onShutter: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(red = 0.08f, green = 0.08f, blue = 0.08f),
                                Color.Black,
                            ),
                    ),
                ).padding(horizontal = Spacing.s5, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RailButton(icon = PantopusIcon.Image, label = "Library", onClick = onGallery)
        Box(modifier = Modifier.weight(1f))
        ShutterButton(enabled = isLive, onClick = onShutter)
        Box(modifier = Modifier.weight(1f))
        RailButton(icon = PantopusIcon.RefreshCw, label = "Flip", onClick = onFlip)
    }
}

@Composable
private fun ShutterButton(
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(58.dp)
                .clip(CircleShape)
                .border(3.dp, Color.White.copy(alpha = if (enabled) 0.85f else 0.3f), CircleShape)
                .then(
                    if (enabled) {
                        Modifier.clickable(role = Role.Button, onClick = onClick)
                    } else {
                        Modifier
                    },
                ).testTag("cameraScanner_shutter")
                .semantics {
                    contentDescription = if (enabled) "Capture photo" else "Capture photo, camera unavailable"
                },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = if (enabled) 1f else 0.3f)),
        )
    }
}

@Composable
private fun RailButton(
    icon: PantopusIcon,
    label: String,
    onClick: (() -> Unit)?,
) {
    Box(
        modifier =
            Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(Color.White.copy(alpha = 0.06f))
                .border(1.dp, Color.White.copy(alpha = 0.14f), RoundedCornerShape(Radii.lg))
                .then(
                    if (onClick != null) {
                        Modifier.clickable(role = Role.Button, onClick = onClick)
                    } else {
                        Modifier
                    },
                ).semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 18.dp,
            tint = Color.White.copy(alpha = if (onClick == null) 0.3f else 1f),
        )
    }
}

// MARK: - Decorative bits

@Composable
private fun FramingBrackets(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val color = Color.White.copy(alpha = 0.9f)
        val len = 18.dp.toPx()
        val stroke = 2.5.dp.toPx()

        fun corner(
            x: Float,
            y: Float,
            xDir: Float,
            yDir: Float,
        ) {
            drawLine(color, Offset(x, y), Offset(x + len * xDir, y), strokeWidth = stroke, cap = StrokeCap.Round)
            drawLine(color, Offset(x, y), Offset(x, y + len * yDir), strokeWidth = stroke, cap = StrokeCap.Round)
        }
        corner(0f, 0f, 1f, 1f)
        corner(size.width, 0f, -1f, 1f)
        corner(0f, size.height, 1f, -1f)
        corner(size.width, size.height, -1f, -1f)
    }
}

@Composable
private fun StripeField(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val step = 9.dp.toPx()
        val color = Color.White.copy(alpha = 0.05f)
        var x = -size.height
        while (x < size.width + size.height) {
            drawLine(color, Offset(x, 0f), Offset(x + size.height, size.height), strokeWidth = 1f)
            x += step
        }
    }
}

// MARK: - CapturedFilmstrip

/** One thumbnail in a [CapturedFilmstrip]. */
data class CameraScannerShot(
    /** Mono corner tag, e.g. `UNIT` / `BOX` / `RECEIPT` / `LABEL`. */
    val tag: String,
    /** Caption under the thumbnail, e.g. "The machine". */
    val label: String,
    /** The hero shot — gets the accent border + star badge. */
    val isMain: Boolean = false,
    /** Captured image; `null` renders the dark striped placeholder. */
    val bitmap: Bitmap? = null,
)

/** Horizontal rail of captured thumbnails with a trailing "Add" tile. */
@Composable
fun CapturedFilmstrip(
    accent: Color,
    shots: List<CameraScannerShot>,
    modifier: Modifier = Modifier,
    title: String = "Captured",
    onAdd: (() -> Unit)? = null,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = title.uppercase(),
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
            )
            Box(modifier = Modifier.weight(1f))
            Text(
                text = "${shots.size} shots",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
        Row(
            modifier =
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            shots.forEach { ThumbnailTile(shot = it, accent = accent) }
            if (onAdd != null) AddTile(accent = accent, onClick = onAdd)
        }
    }
}

@Composable
private fun ThumbnailTile(
    shot: CameraScannerShot,
    accent: Color,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(5.dp),
        modifier =
            Modifier.semantics {
                contentDescription = shot.label + if (shot.isMain) ", main shot" else ""
            },
    ) {
        Box(
            modifier =
                Modifier
                    .size(width = 72.dp, height = 88.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(red = 0.11f, green = 0.11f, blue = 0.11f))
                    .border(
                        width = if (shot.isMain) 2.dp else 1.dp,
                        color = if (shot.isMain) accent else PantopusColors.appBorder,
                        shape = RoundedCornerShape(10.dp),
                    ),
        ) {
            if (shot.bitmap != null) {
                Image(
                    bitmap = shot.bitmap.asImageBitmap(),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                StripeField(modifier = Modifier.fillMaxSize())
            }
            Text(
                text = shot.tag,
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = Color.White.copy(alpha = 0.55f),
                modifier = Modifier.padding(5.dp),
            )
            if (shot.isMain) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomEnd)
                            .padding(Spacing.s1)
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(accent),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Star,
                        contentDescription = null,
                        size = 9.dp,
                        tint = Color.White,
                    )
                }
            }
        }
        Text(
            text = shot.label,
            fontSize = 10.sp,
            color = PantopusColors.appTextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(72.dp),
        )
    }
}

@Composable
private fun AddTile(
    accent: Color,
    onClick: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier =
            Modifier
                .size(width = 72.dp, height = 88.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(accent.copy(alpha = 0.08f))
                .border(1.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                .clickable(role = Role.Button, onClick = onClick)
                .testTag("cameraScanner_addShot")
                .semantics { contentDescription = "Add a shot" },
    ) {
        PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 18.dp, tint = accent)
        Text(text = "Add", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = accent)
    }
}

@Suppress("UnusedPrivateMember")
@ComposePreview(showBackground = true, widthDp = 360)
@Composable
private fun CameraScannerPreview() {
    Column(
        modifier = Modifier.background(PantopusColors.appBg).padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        CameraScanner(accent = PantopusColors.success, onCapture = {}, cameraPreviewEnabled = false)
        CapturedFilmstrip(
            accent = PantopusColors.success,
            shots =
                listOf(
                    CameraScannerShot("UNIT", "The machine", isMain = true),
                    CameraScannerShot("BOX", "Box + barcode"),
                    CameraScannerShot("RECEIPT", "Store receipt"),
                    CameraScannerShot("LABEL", "Serial label"),
                ),
            onAdd = {},
        )
    }
}
