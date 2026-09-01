@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "LongParameterList",
    "TooManyFunctions",
    "LongMethod",
    "CyclomaticComplexMethod",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.shared.media

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import kotlinx.coroutines.withTimeoutOrNull

/** Tile heights per surface — feed cards are compact, detail is regular. */
enum class PostMediaGridStyle(
    val twoUpHeight: Int,
    val threeUpHeight: Int,
) {
    Compact(140, 160),
    Regular(160, 200),
}

/**
 * [PostMediaGrid] that owns the full-screen viewer — tapping any tile
 * opens [MediaViewerDialog] at that index. Mirrors iOS
 * `PostMediaGridView`'s fullScreenCover ownership.
 */
@Composable
fun PostMediaGridWithViewer(
    items: List<PostMediaItem>,
    style: PostMediaGridStyle,
    testTag: String,
    modifier: Modifier = Modifier,
    locationBadge: String? = null,
) {
    var viewerIndex by remember { mutableStateOf<Int?>(null) }
    PostMediaGrid(
        items = items,
        style = style,
        testTag = testTag,
        modifier = modifier,
        locationBadge = locationBadge,
        onTileTap = { index -> viewerIndex = index },
    )
    viewerIndex?.let { index ->
        MediaViewerDialog(
            items = items,
            startIndex = index,
            onDismiss = { viewerIndex = null },
        )
    }
}

/**
 * Typed media grid shared by the Pulse feed card and post detail body.
 * Layouts: 1 → 16:9, 2 → side-by-side, 3 → hero + stacked pair, 4+ →
 * 2x2 with a "+N" overflow veil. Mirrors iOS `PostMediaGridView`.
 */
@Composable
fun PostMediaGrid(
    items: List<PostMediaItem>,
    style: PostMediaGridStyle,
    testTag: String,
    modifier: Modifier = Modifier,
    locationBadge: String? = null,
    onTileTap: ((Int) -> Unit)? = null,
) {
    if (items.isEmpty()) return
    val photoLabel = "${items.size} attached ${if (items.size == 1) "item" else "items"}"

    Box(
        modifier =
            modifier
                .semantics { contentDescription = photoLabel }
                .testTag(testTag),
    ) {
        when (items.size) {
            1 ->
                PostMediaTile(
                    item = items[0],
                    onTap = onTileTap?.let { tap -> { tap(0) } },
                    badge = locationBadge,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f)
                            .clip(RoundedCornerShape(Radii.lg)),
                )
            2 ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(style.twoUpHeight.dp)
                            .clip(RoundedCornerShape(Radii.lg)),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PostMediaTile(
                        item = items[0],
                        onTap = onTileTap?.let { tap -> { tap(0) } },
                        modifier = Modifier.weight(1f).fillMaxSize(),
                    )
                    PostMediaTile(
                        item = items[1],
                        onTap = onTileTap?.let { tap -> { tap(1) } },
                        badge = locationBadge,
                        modifier = Modifier.weight(1f).fillMaxSize(),
                    )
                }
            3 ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(style.threeUpHeight.dp)
                            .clip(RoundedCornerShape(Radii.lg)),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PostMediaTile(
                        item = items[0],
                        onTap = onTileTap?.let { tap -> { tap(0) } },
                        modifier = Modifier.weight(1f).fillMaxSize(),
                    )
                    Column(
                        modifier = Modifier.weight(1f).fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                    ) {
                        PostMediaTile(
                            item = items[1],
                            onTap = onTileTap?.let { tap -> { tap(1) } },
                            modifier = Modifier.weight(1f).fillMaxWidth(),
                        )
                        PostMediaTile(
                            item = items[2],
                            onTap = onTileTap?.let { tap -> { tap(2) } },
                            badge = locationBadge,
                            modifier = Modifier.weight(1f).fillMaxWidth(),
                        )
                    }
                }
            else ->
                Column(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.lg)),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        PostMediaTile(
                            item = items[0],
                            onTap = onTileTap?.let { tap -> { tap(0) } },
                            modifier = Modifier.weight(1f).aspectRatio(1f),
                        )
                        PostMediaTile(
                            item = items[1],
                            onTap = onTileTap?.let { tap -> { tap(1) } },
                            modifier = Modifier.weight(1f).aspectRatio(1f),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                        PostMediaTile(
                            item = items[2],
                            onTap = onTileTap?.let { tap -> { tap(2) } },
                            modifier = Modifier.weight(1f).aspectRatio(1f),
                        )
                        PostMediaTile(
                            item = items[3],
                            onTap = onTileTap?.let { tap -> { tap(3) } },
                            overflowCount = if (items.size > 4) items.size - 4 else null,
                            badge = locationBadge,
                            modifier = Modifier.weight(1f).aspectRatio(1f),
                        )
                    }
                }
        }
    }
}

/** One typed tile — image, video poster + play disc, or Live Photo. */
@Composable
fun PostMediaTile(
    item: PostMediaItem,
    modifier: Modifier = Modifier,
    onTap: (() -> Unit)? = null,
    overflowCount: Int? = null,
    badge: String? = null,
) {
    Box(modifier = modifier) {
        when (item.kind) {
            PostMediaKind.Image ->
                MediaStillTile(
                    url = item.url,
                    onTap = onTap,
                    modifier = Modifier.fillMaxSize(),
                )
            PostMediaKind.Video -> {
                MediaStillTile(
                    url = item.thumbnailUrl ?: "",
                    onTap = onTap,
                    modifier = Modifier.fillMaxSize(),
                )
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    PlayDisc()
                }
            }
            PostMediaKind.LivePhoto -> {
                LivePhotoTile(
                    item = item,
                    onTap = onTap,
                    modifier = Modifier.fillMaxSize(),
                )
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.TopStart)
                            .padding(Spacing.s2)
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.liveBadge)
                            .semantics { contentDescription = "Live Photo" },
                )
            }
        }
        if (overflowCount != null && overflowCount > 0) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appText.copy(alpha = 0.4f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "+$overflowCount",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
        if (badge != null) {
            Row(
                modifier =
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(Spacing.s2)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(Color.Black.copy(alpha = 0.55f))
                        .padding(horizontal = Spacing.s2, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = badge,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

/** Still image tile (Coil) with shimmer-free loading + error states. */
@Composable
fun MediaStillTile(
    url: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    onTap: (() -> Unit)? = null,
) {
    val base =
        if (onTap != null) {
            modifier.pointerInput(Unit) { detectTapGestures(onTap = { onTap() }) }
        } else {
            modifier
        }
    SubcomposeAsyncImage(
        model = url,
        contentDescription = null,
        contentScale = contentScale,
        modifier = base.background(PantopusColors.appSurfaceSunken),
        loading = {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            }
        },
        error = {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                PantopusIconImage(
                    icon = PantopusIcon.AlertCircle,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        },
    )
}

/** Dark translucent play disc rendered over video posters. */
@Composable
private fun PlayDisc() {
    Box(
        modifier =
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(Color.Black.copy(alpha = 0.55f)),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Play,
            contentDescription = "Play video",
            size = 22.dp,
            tint = PantopusColors.appTextInverse,
        )
    }
}

/**
 * Live Photo tile — still image that crossfades into its paired video
 * clip while pressed (300 ms hold threshold, haptic on start, 1.05x
 * scale). Mirrors iOS `LivePhotoTileView`. With [showsReplayButton] the
 * clip plays once per LIVE-pill tap instead (viewer mode).
 */
// media3 PlayerView / AspectRatioFrameLayout are @UnstableApi; the opt-in is
// consumed here so it doesn't propagate to callers. Behaviour is unchanged.
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun LivePhotoTile(
    item: PostMediaItem,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    showsReplayButton: Boolean = false,
    onTap: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    var playing by remember { mutableStateOf(false) }
    var player by remember { mutableStateOf<ExoPlayer?>(null) }

    fun ensurePlayer(): ExoPlayer {
        player?.let { return it }
        val created =
            ExoPlayer.Builder(context).build().apply {
                val clip = item.liveVideoUrl ?: item.url
                setMediaItem(MediaItem.fromUri(clip))
                repeatMode = Player.REPEAT_MODE_OFF
                prepare()
                if (showsReplayButton) {
                    addListener(
                        object : Player.Listener {
                            override fun onPlaybackStateChanged(playbackState: Int) {
                                if (playbackState == Player.STATE_ENDED) playing = false
                            }
                        },
                    )
                }
            }
        player = created
        return created
    }

    DisposableEffect(Unit) {
        onDispose {
            player?.release()
            player = null
        }
    }

    LaunchedEffect(playing) {
        val active = player
        if (playing) {
            val target = active ?: ensurePlayer()
            target.seekTo(0)
            target.playWhenReady = true
        } else {
            active?.playWhenReady = false
        }
    }

    val clipAlpha by animateFloatAsState(
        targetValue = if (playing) 1f else 0f,
        animationSpec = tween(durationMillis = 150),
        label = "livePhotoCrossfade",
    )
    val stillScale by animateFloatAsState(
        targetValue = if (playing) 1.05f else 1f,
        animationSpec = tween(durationMillis = 150),
        label = "livePhotoScale",
    )

    val pressModifier =
        if (showsReplayButton) {
            Modifier
        } else {
            Modifier.pointerInput(item.id) {
                detectTapGestures(
                    onTap = { onTap?.invoke() },
                    onPress = {
                        val releasedEarly = withTimeoutOrNull(300L) { tryAwaitRelease() }
                        if (releasedEarly == null) {
                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            playing = true
                            tryAwaitRelease()
                            playing = false
                        }
                    },
                )
            }
        }

    Box(modifier = modifier.then(pressModifier)) {
        // Media (still + crossfaded clip) is the only layer that scales on
        // playback; the LIVE pill stays put — mirrors iOS where the pill is
        // a sibling of the scaled `mediaLayers`.
        Box(modifier = Modifier.fillMaxSize().scale(stillScale)) {
            MediaStillTile(
                url = item.url,
                contentScale = contentScale,
                modifier = Modifier.fillMaxSize(),
            )
            if (clipAlpha > 0f) {
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            useController = false
                            resizeMode =
                                if (contentScale == ContentScale.Crop) {
                                    AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                } else {
                                    AspectRatioFrameLayout.RESIZE_MODE_FIT
                                }
                        }
                    },
                    update = { view -> view.player = player },
                    modifier = Modifier.fillMaxSize().alpha(clipAlpha),
                )
            }
        }
        if (showsReplayButton) {
            // Bottom-left so it never overlaps the viewer's top-right close
            // button — matches iOS `MediaViewerView`.
            Row(
                modifier =
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(Spacing.s3)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(Color.Black.copy(alpha = 0.55f))
                        .pointerInput(Unit) {
                            detectTapGestures(onTap = { playing = true })
                        }
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                        .semantics { contentDescription = "Play Live Photo" }
                        .testTag("mediaViewerLivePill"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.liveBadge),
                )
                Text(
                    text = "LIVE",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
