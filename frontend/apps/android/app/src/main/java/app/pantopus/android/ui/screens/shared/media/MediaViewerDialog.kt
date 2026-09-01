@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.shared.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Full-screen media viewer — black canvas, horizontal pager over every
 * media item, "n / m" index pill, X to dismiss. Mirrors iOS
 * `MediaViewerView`: images fit, videos play with controls while the
 * page is active, Live Photos replay via the LIVE pill.
 */
@Composable
fun MediaViewerDialog(
    items: List<PostMediaItem>,
    startIndex: Int,
    onDismiss: () -> Unit,
) {
    if (items.isEmpty()) return
    val pagerState =
        rememberPagerState(initialPage = startIndex.coerceIn(0, items.size - 1)) { items.size }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Color.Black)
                    .testTag("mediaViewer"),
        ) {
            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
                val item = items[page]
                when (item.kind) {
                    PostMediaKind.Image ->
                        MediaStillTile(
                            url = item.url,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize(),
                        )
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
                            .statusBarsPadding()
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
                        .statusBarsPadding()
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
