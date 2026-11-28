@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.studio

import android.graphics.Bitmap
import android.graphics.RectF
import androidx.activity.compose.BackHandler
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.pulse.PulseReinventedFeature
import app.pantopus.android.ui.screens.moments.compose.marks.MomentStandIn
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Over the Studio's camera (switch on only; the caller draws it only then): "Front and back" where this phone can run
 * both cameras at once, and, once picked, the mode itself in place of today's camera ([open]). [onCaptured] gets the one
 * picture as a photo taken here.
 */
@Composable
internal fun StudioFrontBackMode(
    open: Boolean,
    onOpen: () -> Unit,
    onClose: () -> Unit,
    onCaptured: (MomentMediaFile) -> Unit,
) {
    val switch: FrontBackSwitchViewModel = hiltViewModel()
    val context = LocalContext.current
    val offered by produceState(false) { value = offersBothCameras(context) }
    // The switch read off (the app re-reads it when it comes back to the front): the mode closes and today's camera
    // takes the screen again, and the pill is gone.
    val on by switch.on.collectAsStateWithLifecycle()
    LaunchedEffect(on, open) { if (!on && open) onClose() }
    if (!offered || !on) return
    if (open) {
        FrontBackScreen(onClose = onClose, onCaptured = onCaptured)
    } else {
        Box(modifier = Modifier.fillMaxSize()) {
            FrontBackEntry(onOpen, Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top = 64.dp, end = Spacing.s3))
        }
    }
}

@Composable
private fun FrontBackEntry(
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(19.dp))
                .background(PantopusColors.studioPillFill)
                .border(1.dp, PantopusColors.studioPillOutline, RoundedCornerShape(19.dp))
                .clickable(role = Role.Button, onClick = onOpen)
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .testTag("moments.studio.frontBack.open")
                .clearAndSetSemantics {
                    contentDescription = "Front and back together. Takes the back and front cameras in one shot"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = PantopusIcon.Camera, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = Color.White)
        Spacer(Modifier.size(6.dp))
        Text("Front and back", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** The person's switch as the app last read it, so the mode can give way to today's camera at once. */
@HiltViewModel
class FrontBackSwitchViewModel
    @Inject
    constructor(
        feature: PulseReinventedFeature,
    ) : ViewModel() {
        val on: StateFlow<Boolean> = feature.on
    }

/** The mode: the big picture filling the screen, the small one at the top left (tap it to swap), the shutter, the X. */
@Composable
private fun FrontBackScreen(
    onClose: () -> Unit,
    onCaptured: (MomentMediaFile) -> Unit,
) {
    BackHandler(onBack = onClose)
    val context = LocalContext.current
    val density = LocalDensity.current
    val standIn = MomentStandIn.active
    var frontBig by remember { mutableStateOf(false) }
    var shooting by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf<String?>(null) }
    val bigView = remember { PreviewView(context).apply { implementationMode = PreviewView.ImplementationMode.COMPATIBLE } }
    val smallView = remember { PreviewView(context).apply { implementationMode = PreviewView.ImplementationMode.COMPATIBLE } }
    val scope = rememberCoroutineScope()
    val cameras = if (standIn) null else rememberBothCameras(frontBig, bigView, smallView) { failed = it }
    BoxWithConstraints(modifier = Modifier.fillMaxSize().background(Color.Black).testTag("moments.studio.frontBack")) {
        val screenWidth = constraints.maxWidth.toFloat()
        val screenHeight = constraints.maxHeight.toFloat()
        val safeTop = WindowInsets.statusBars.getTop(density).toFloat()
        val inset = frontBackInset(safeTop, density.density)
        val stands =
            remember(standIn, screenWidth, screenHeight) {
                if (standIn) {
                    standInPicture((screenWidth / 2).toInt(), (screenHeight / 2).toInt(), front = false) to
                        standInPicture(480, 640, front = true)
                } else {
                    null
                }
            }
        Picture(stands?.let { if (frontBig) it.second else it.first }, bigView, Modifier.fillMaxSize())
        Picture(
            stands?.let { if (frontBig) it.first else it.second },
            smallView,
            Modifier
                .offset(FrontBackInset.LEFT.dp, with(density) { safeTop.toDp() } + FrontBackInset.TOP.dp)
                .size(FrontBackInset.WIDTH.dp, FrontBackInset.HEIGHT.dp)
                .clip(RoundedCornerShape(FrontBackInset.RADIUS.dp))
                .border(FrontBackInset.EDGE.dp, Color.White, RoundedCornerShape(FrontBackInset.RADIUS.dp))
                .clickable(role = Role.Button) { frontBig = !frontBig }
                .testTag("moments.studio.frontBack.small")
                .clearAndSetSemantics {
                    contentDescription = if (frontBig) "Back camera, small. Tap to swap" else "Front camera, small. Tap to swap"
                    role = Role.Button
                },
        )
        FrontBackTop(standIn, failed, onClose)
        Shutter(
            busy = shooting,
            enabled = (standIn || cameras != null) && !shooting,
            modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = Spacing.s8),
        ) {
            shooting = true
            scope.launch {
                val shot = stands ?: cameras?.shoot(context)
                val file =
                    shot?.let { (back, front) ->
                        val (big, small) = if (frontBig) front to back else back to front
                        saveFrontBack(context, composeFrontBack(big, small, screenWidth, screenHeight, inset, density.density))
                    }
                shooting = false
                if (file != null) onCaptured(MomentMediaFile.Photo(file)) else failed = "Couldn't take the photo."
            }
        }
    }
}

/** Both cameras bound while this is on screen (let go when it leaves), their previews in [bigView] and [smallView]. */
@Composable
private fun rememberBothCameras(
    frontBig: Boolean,
    bigView: PreviewView,
    smallView: PreviewView,
    onFailed: (String) -> Unit,
): BothCameras? {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var cameras by remember { mutableStateOf<BothCameras?>(null) }
    DisposableEffect(owner) {
        var provider: androidx.camera.lifecycle.ProcessCameraProvider? = null
        val job =
            scope.launch {
                provider = cameraProvider(context)
                cameras = provider?.let { BothCameras.bind(it, owner) }
                if (cameras == null) onFailed("This phone can't use both cameras at once.")
            }
        onDispose {
            job.cancel()
            provider?.unbindAll()
        }
    }
    DisposableEffect(cameras, frontBig) {
        cameras?.let {
            it.backPreview.setSurfaceProvider((if (frontBig) smallView else bigView).surfaceProvider)
            it.frontPreview.setSurfaceProvider((if (frontBig) bigView else smallView).surfaceProvider)
        }
        onDispose { }
    }
    return cameras
}

/** The small picture's place on the screen, px, under a status bar [safeTop] px high. */
private fun frontBackInset(
    safeTop: Float,
    density: Float,
): RectF =
    with(FrontBackInset) {
        RectF(LEFT * density, safeTop + TOP * density, (LEFT + WIDTH) * density, safeTop + (TOP + HEIGHT) * density)
    }

/** One camera's picture: its live preview, or a stand-in picture on a debug emulator build. */
@Composable
private fun Picture(
    standIn: Bitmap?,
    preview: PreviewView,
    modifier: Modifier,
) {
    if (standIn != null) {
        Image(bitmap = standIn.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = modifier)
    } else {
        AndroidView(factory = { preview.apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }, modifier = modifier)
    }
}

@Composable
private fun FrontBackTop(
    standIn: Boolean,
    failed: String?,
    onClose: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(top = 9.dp)) {
        Box(modifier = Modifier.fillMaxWidth().height(48.dp).padding(horizontal = Spacing.s2)) {
            Box(
                contentAlignment = Alignment.Center,
                modifier =
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .clickable(role = Role.Button, onClick = onClose)
                        .testTag("moments.studio.frontBack.close")
                        .clearAndSetSemantics {
                            contentDescription = "Close front and back"
                            role = Role.Button
                        },
            ) {
                PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = 26.dp, strokeWidth = 2.4f, tint = Color.White)
            }
            Text(
                text = if (standIn) "Stand-in pictures: this build has no second camera." else "Front and back together",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.Center).padding(horizontal = 56.dp),
            )
        }
        failed?.let {
            Text(
                text = it,
                color = Color.White,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2).testTag("moments.studio.frontBack.unavailable"),
            )
        }
    }
}

@Composable
private fun Shutter(
    busy: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onShoot: () -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            modifier
                .size(78.dp)
                .border(4.dp, Color.White, CircleShape)
                .padding(7.dp)
                .clip(CircleShape)
                .background(if (busy) Color.White.copy(alpha = 0.5f) else Color.White)
                .clickable(enabled = enabled, role = Role.Button, onClick = onShoot)
                .testTag("moments.studio.frontBack.shutter")
                .clearAndSetSemantics {
                    contentDescription = "Take front and back"
                    role = Role.Button
                },
    ) {}
}
