@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.shared.media

import android.view.ViewGroup
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.util.VelocityTracker
import androidx.compose.ui.input.pointer.util.addPointerInputChange
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.rememberReduceMotion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Full-screen media viewer — black canvas, horizontal pager over every
 * media item, "n / m" index pill, X to dismiss. Mirrors iOS
 * `MediaViewerView`: images fit, videos play with controls while the
 * page is active, Live Photos replay via the LIVE pill.
 *
 * Dragging a photo down closes the viewer: the photo follows the finger and the black behind it fades, and letting go
 * far enough down, or flicking down, closes it; otherwise it settles back. Video and PDF pages keep the drag for their
 * own controls (the player, pinch-zoom), so they close with the X.
 */
@Composable
fun MediaViewerDialog(
    items: List<PostMediaItem>,
    startIndex: Int,
    onDismiss: () -> Unit,
    localPdfFile: java.io.File? = null,
) {
    if (items.isEmpty()) return
    val pagerState =
        rememberPagerState(initialPage = startIndex.coerceIn(0, items.size - 1)) { items.size }
    val pullDown = rememberPullDownToClose(onClose = onDismiss)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(decorFitsSystemWindows = false),
    ) {
        val window = (LocalView.current.parent as? DialogWindowProvider)?.window
        SideEffect {
            // Compose 1.7 measures non-default-width dialogs against the full display,
            // which can exceed the actual window on Android 15. Keep window constraints
            // and expand the window itself so bottom playback/page controls stay visible.
            window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .onSizeChanged { pullDown.viewerHeight = it.height }
                    // Fades as the photo is pulled down, showing the screen the viewer opened over.
                    .drawBehind { drawRect(Color.Black, alpha = pullDown.backdropAlpha) }
                    .systemBarsPadding()
                    .testTag("mediaViewer"),
        ) {
            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize().pullDownToClose(pullDown)) { page ->
                val item = items[page]
                when (item.kind) {
                    PostMediaKind.Image ->
                        MediaStillTile(
                            url = item.url,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize(),
                            // Originals are never written to the disk cache (Instant Screens §6).
                            cacheOnDisk = false,
                            // On the black canvas, so only the photo moves when it's pulled down.
                            background = Color.Transparent,
                        )
                    PostMediaKind.Document -> PostPdfSlide(url = item.url, localFile = localPdfFile)
                    PostMediaKind.Video ->
                        ViewerVideoSlide(
                            url = item.url,
                            isActive = pagerState.currentPage == page,
                        )
                    PostMediaKind.LivePhoto ->
                        LivePhotoTile(
                            item = item,
                            contentScale = ContentScale.Fit,
                            showsReplayButton = true,
                            isActive = pagerState.currentPage == page,
                            modifier = Modifier.fillMaxSize(),
                        )
                }
            }

            // Index pill top-left, close button top-right — mirrors iOS
            // `MediaViewerView.topBar` so neither collides with the LIVE
            // replay pill (bottom-left).
            if (items.size > 1) {
                Text(
                    text = "${pagerState.currentPage + 1} / ${items.size}",
                    fontSize = 12.sp,
                    color = Color.White,
                    modifier =
                        Modifier
                            .align(Alignment.TopStart)
                            .padding(Spacing.s3)
                            .background(
                                Color.Black.copy(alpha = 0.45f),
                                RoundedCornerShape(Radii.pill),
                            )
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                            .testTag("mediaViewerIndex"),
                )
            }

            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(Spacing.s3)
                        .size(36.dp)
                        .background(Color.Black.copy(alpha = 0.45f), CircleShape)
                        .clickable(onClick = onDismiss)
                        .testTag("mediaViewerClose")
                        .semantics { contentDescription = "Close media viewer" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 18.dp,
                    tint = Color.White,
                )
            }
        }
    }
}

/** A photo being pulled down to close the viewer: how far it is, in px, and what letting go does. */
private class PullDownToClose(
    private val scope: CoroutineScope,
    private val reduceMotion: Boolean,
    private val onClose: () -> Unit,
) {
    var pulled by mutableFloatStateOf(0f)
        private set
    var viewerHeight = 0
    private var settling: Job? = null

    /** Opaque at rest, down to [MIN_BACKDROP_ALPHA] once the photo is half the viewer down. */
    val backdropAlpha: Float
        get() {
            if (viewerHeight == 0) return 1f
            val progress = (pulled / (viewerHeight * 0.5f)).coerceIn(0f, 1f)
            return 1f - progress * (1f - MIN_BACKDROP_ALPHA)
        }

    /** A new drag takes the photo from wherever it is, settling back or not. */
    fun hold() {
        settling?.cancel()
    }

    fun drag(by: Float) {
        pulled = (pulled + by).coerceAtLeast(0f)
    }

    fun letGo(
        velocityDown: Float,
        flingPx: Float,
    ) {
        val closes = pulled > viewerHeight * CLOSE_FRACTION || (pulled > 0f && velocityDown > flingPx)
        settling =
            scope.launch {
                when {
                    closes && reduceMotion -> onClose()
                    closes -> {
                        animate(pulled, viewerHeight.toFloat(), animationSpec = tween(CLOSE_MS)) { value, _ -> pulled = value }
                        onClose()
                    }
                    reduceMotion -> pulled = 0f
                    else -> animate(pulled, 0f, animationSpec = spring()) { value, _ -> pulled = value }
                }
            }
    }
}

@Composable
private fun rememberPullDownToClose(onClose: () -> Unit): PullDownToClose {
    val scope = rememberCoroutineScope()
    val reduceMotion = rememberReduceMotion()
    val close by rememberUpdatedState(onClose)
    return remember(scope, reduceMotion) { PullDownToClose(scope, reduceMotion) { close() } }
}

/**
 * The pages follow a vertical drag and [PullDownToClose] decides on letting go. A sideways drag stays with the pager
 * (whichever passes the touch slop first takes the gesture), and a page's own player or pinch-zoom keeps its drags.
 */
private fun Modifier.pullDownToClose(state: PullDownToClose): Modifier =
    pointerInput(state) {
        val velocity = VelocityTracker()
        val flingPx = CLOSE_FLING.toPx()
        detectVerticalDragGestures(
            onDragStart = {
                state.hold()
                velocity.resetTracking()
            },
            onDragEnd = { state.letGo(velocity.calculateVelocity().y, flingPx) },
            onDragCancel = { state.letGo(velocityDown = 0f, flingPx = flingPx) },
        ) { change, amount ->
            change.consume()
            velocity.addPointerInputChange(change)
            state.drag(amount)
        }
    }.graphicsLayer { translationY = state.pulled }

/** Let go this far down (of the viewer's height), or flick down this fast, and the viewer closes. */
private const val CLOSE_FRACTION = 0.2f
private val CLOSE_FLING = 1000.dp
private const val CLOSE_MS = 180
private const val MIN_BACKDROP_ALPHA = 0.25f

/** Video page — ExoPlayer with controls; plays while its page is active. */
// media3 PlayerView / AspectRatioFrameLayout are @UnstableApi; the opt-in is
// consumed here so it doesn't propagate to callers. Behaviour is unchanged.
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun ViewerVideoSlide(
    url: String,
    isActive: Boolean,
) {
    val context = LocalContext.current
    var player by remember { mutableStateOf<ExoPlayer?>(null) }

    LaunchedEffect(isActive) {
        if (isActive) {
            val target =
                player ?: ExoPlayer.Builder(context).build().apply {
                    setMediaItem(MediaItem.fromUri(url))
                    prepare()
                }.also { player = it }
            target.playWhenReady = true
        } else {
            player?.playWhenReady = false
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            player?.release()
            player = null
        }
    }

    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    useController = true
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                    setShowNextButton(false)
                    setShowPreviousButton(false)
                }
            },
            update = { view -> view.player = player },
            modifier = Modifier.fillMaxSize().background(PantopusColors.appText.copy(alpha = 0f)),
        )
    }
}
