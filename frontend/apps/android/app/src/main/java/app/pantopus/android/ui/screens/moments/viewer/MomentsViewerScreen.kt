@file:Suppress(
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
    "LongMethod",
    "CyclomaticComplexMethod",
    "ComplexCondition",
    "LoopWithTooManyJumpStatements",
)

@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)

package app.pantopus.android.ui.screens.moments.viewer

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentViewerDto
import app.pantopus.android.data.moments.MomentGallerySaver
import app.pantopus.android.ui.components.CutoutBand
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.feed.pulseReportReasons
import app.pantopus.android.ui.screens.moments.components.MomentCardBackground
import app.pantopus.android.ui.screens.moments.components.MomentFace
import app.pantopus.android.ui.screens.moments.components.MomentHaptics
import app.pantopus.android.ui.screens.moments.components.MomentImages
import app.pantopus.android.ui.screens.moments.components.MomentTakenPill
import app.pantopus.android.ui.screens.moments.components.MomentVerifiedCheck
import app.pantopus.android.ui.screens.moments.components.StageKeyboardResize
import app.pantopus.android.ui.screens.moments.components.momentCardGradient
import app.pantopus.android.ui.screens.moments.components.rememberMomentImage
import app.pantopus.android.ui.screens.moments.components.takenLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

/** The seven quick reactions (board V4): the post set, with the names TalkBack reads and the test ids use. */
private val QUICK_REACTIONS =
    listOf(
        "👍" to "Like",
        "❤️" to "Love",
        "😂" to "Haha",
        "😮" to "Wow",
        "😢" to "Sad",
        "🙏" to "Thanks",
        "🎉" to "Celebrate",
    )

/** The six report reasons (REVIEW P7): the post set's, with "Something else" last. */
private val REPORT_REASONS = pulseReportReasons.map { (key, label) -> key to if (key == "other") "Something else" else label }

/**
 * Watching Moments (boards V1 to V5), full screen: a progress bar per Moment in the ring, the author, the place, how
 * long ago and how long it has left. Tap right for the next Moment and left for the one before, hold to pause, swipe
 * left for the next ring nearby, swipe down to go back to the map. A video plays with sound. Others get the reply box
 * and quick reactions (the reply lands in Messages); your own Moment gets "Seen by", Save to Photos and Delete.
 */
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
fun MomentsViewerScreen(
    onClose: () -> Unit,
    viewModel: MomentsViewerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val close by rememberUpdatedState(onClose)
    LaunchedEffect(state.finished) { if (state.finished) close() }
    StageSystemBars()
    StageKeyboardResize()
    val toast = remember { ToastController() }
    LaunchedEffect(Unit) { viewModel.messages.collect { toast.show(it) } }
    // After a mute, a note with Undo (MOMLEAD 22:10Z), gone after a few seconds.
    var mutedNote by remember { mutableStateOf<MutedAuthor?>(null) }
    LaunchedEffect(Unit) { viewModel.muted.collect { mutedNote = it } }
    LaunchedEffect(mutedNote) {
        if (mutedNote != null) {
            delay(MUTED_NOTE_MS)
            mutedNote = null
        }
    }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    val ring = state.ring
    val brief = state.brief
    val moment = state.moment
    val mine = ring?.ring?.mine == true
    // The gestures below are set up once (their pointerInput has a fixed key), so they read this through a state.
    val mineNow by rememberUpdatedState(mine)
    val curator = ring?.ring?.author?.kind == "pantopus"

    // What stops the clock: a finger held down, typing a reply, the reactions or a menu open, the app away.
    var holding by remember { mutableStateOf(false) }
    var typing by remember { mutableStateOf(false) }
    var reacting by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    var reporting by remember { mutableStateOf(false) }
    var confirmingBlock by remember { mutableStateOf(false) }
    var seenByOpen by remember { mutableStateOf(false) }
    var confirmingDelete by remember { mutableStateOf(false) }
    var away by remember { mutableStateOf(false) }
    // A finger is dragging to the person before or after, or pinching a photo bigger.
    var handling by remember { mutableStateOf(false) }
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) { away = true }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { away = false }
    // The notification shade or a system dialog over the app takes the window's focus without pausing the app.
    val covered = !LocalWindowInfo.current.isWindowFocused
    val touched = handling || holding || typing || reacting
    val paused = touched || menuOpen || reporting || confirmingBlock || seenByOpen || confirmingDelete || away || covered
    // Play picks up where it was; a Moment whose time ran out during the pause says so instead.
    LaunchedEffect(paused) { if (!paused) viewModel.endedOnScreen() }
    val view = LocalView.current
    // The reaction just picked, popping over the Moment (its number makes each pick a new one).
    var popped by remember { mutableStateOf<Pair<Int, String>?>(null) }
    var pops by remember { mutableIntStateOf(0) }
    // "Saved" on the Seen by sheet's button for a moment after Save to Photos.
    var saveNote by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(saveNote) {
        if (saveNote != null) {
            delay(SAVE_NOTE_MS)
            saveNote = null
        }
    }

    var reply by remember { mutableStateOf("") }
    var muted by remember { mutableStateOf(false) }
    // The clock of the Moment on screen.
    val momentKey = "${state.ringIndex}:${brief?.id}"
    var ready by remember(momentKey) { mutableStateOf(false) }
    var progress by remember(momentKey) { mutableFloatStateOf(0f) }
    var elapsed by remember(momentKey) { mutableLongStateOf(0L) }

    // Two players for the whole viewer: one plays the video Moment on screen, the other gets the next video ready
    // while it plays, so moving on starts at once instead of waiting on the network. They trade places.
    val players =
        remember { List(2) { ExoPlayer.Builder(context).build().apply { repeatMode = Player.REPEAT_MODE_OFF } } }
    DisposableEffect(players) { onDispose { players.forEach { it.release() } } }
    var active by remember { mutableIntStateOf(0) }
    val activeNow by rememberUpdatedState(active)
    val player = players[active]
    val standby = players[1 - active]
    // The Moment whose video the standby player holds.
    var standbyFor by remember { mutableStateOf<String?>(null) }
    // One state for every video (the players' listeners hold it), back to false for each new Moment.
    var videoStarted by remember { mutableStateOf(false) }
    LaunchedEffect(momentKey) { videoStarted = false }
    val onVideoEnded by rememberUpdatedState { viewModel.next() }
    DisposableEffect(players) {
        val listeners =
            players.mapIndexed { index, each ->
                // Only the player on screen speaks: the standby one stays quiet until it is.
                val listener =
                    object : Player.Listener {
                        override fun onRenderedFirstFrame() {
                            if (index == activeNow) videoStarted = true
                        }

                        override fun onPlaybackStateChanged(playbackState: Int) {
                            if (index == activeNow && playbackState == Player.STATE_ENDED) onVideoEnded()
                        }

                        // A video that can't play (its link ran out, the network dropped): on to the next Moment.
                        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                            if (index == activeNow) onVideoEnded() else standbyFor = null
                        }
                    }
                each.addListener(listener)
                each to listener
            }
        onDispose { listeners.forEach { (each, listener) -> each.removeListener(listener) } }
    }
    LaunchedEffect(moment?.id, moment?.mediaUrl) {
        val current = moment
        if (current?.kind == "video" && current.mediaUrl != null) {
            if (standbyFor == current.id) {
                // Made ready ahead: the players trade places, and the one that was playing is free for the next.
                standbyFor = null
                player.stop()
                player.clearMediaItems()
                active = 1 - active
            } else {
                player.setMediaItem(MediaItem.fromUri(current.mediaUrl))
                player.prepare()
            }
        } else {
            player.stop()
            player.clearMediaItems()
        }
    }
    val upNext by viewModel.upNext.collectAsStateWithLifecycle()
    LaunchedEffect(upNext?.id, moment?.id, active) {
        val next = upNext
        val link = next?.mediaUrl
        if (next != null && next.kind == "video" && link != null && next.id != moment?.id && standbyFor != next.id) {
            standby.playWhenReady = false
            standby.volume = 0f
            standby.setMediaItem(MediaItem.fromUri(link))
            standby.prepare()
            standbyFor = next.id
        }
    }
    LaunchedEffect(muted, active) { player.volume = if (muted) 0f else 1f }
    LaunchedEffect(moment?.id, paused, active) { if (moment?.kind == "video") player.playWhenReady = !paused }
    LaunchedEffect(videoStarted) { if (videoStarted) moment?.let(viewModel::shown) }

    // The clock: a photo shows for about 6 seconds, a text card a little longer when it's long, a video for its length.
    LaunchedEffect(momentKey, ready, paused, moment?.kind, active) {
        val current = moment ?: return@LaunchedEffect
        // The bar moves every frame the screen draws (it stepped 20 times a second before), read only where it's drawn.
        if (current.kind == "video") {
            while (true) {
                withFrameNanos { }
                val duration = player.duration.takeIf { it > 0 } ?: current.durationMs ?: 0L
                if (duration > 0) progress = (player.currentPosition.toFloat() / duration).coerceIn(0f, 1f)
            }
        }
        if (!ready || paused) return@LaunchedEffect
        val total = if (current.kind == "text") textDurationMs(current.text.orEmpty()) else PHOTO_MS
        var last = withFrameNanos { it }
        var sofar = elapsed.toDouble()
        while (sofar < total) {
            val now = withFrameNanos { it }
            sofar += (now - last) / NANOS_PER_MS
            last = now
            elapsed = sofar.toLong()
            progress = (sofar / total).toFloat().coerceIn(0f, 1f)
        }
        viewModel.next()
    }
    // A Moment that ended or can't be seen any more: a short notice, then on.
    LaunchedEffect(momentKey, state.load) {
        if (state.load == ViewerLoad.Ended) {
            delay(ENDED_NOTICE_MS)
            viewModel.removeCurrent()
        }
    }

    val dismissInput = {
        focusManager.clearFocus()
        typing = false
        reacting = false
    }
    // Back puts the quick reactions away before it closes the viewer.
    BackHandler(enabled = reacting && !typing) { dismissInput() }
    // A Moment that couldn't load or has ended has nothing to react or reply to: the keyboard and the quick reactions
    // go, so "Couldn't load this Moment / Try again" sits in the clear (what was typed stays in the box for later).
    val canAnswer = state.load != ViewerLoad.Failed && state.load != ViewerLoad.Ended
    LaunchedEffect(canAnswer) { if (!canAnswer && (typing || reacting)) dismissInput() }
    val density = LocalDensity.current
    val keyboardPx = WindowInsets.ime.getBottom(density)
    val belowPx = WindowInsets.navigationBars.getBottom(density)
    val keyboardPadding = with(density) { (keyboardPx - belowPx).coerceAtLeast(0).toDp() }
    // The keyboard put away with Back leaves the reply box focused: typing ends with it, and the Moment plays on.
    var keyboardWasUp by remember { mutableStateOf(false) }
    LaunchedEffect(keyboardPx > 0) {
        if (keyboardPx > 0) {
            keyboardWasUp = true
        } else if (keyboardWasUp && typing) {
            keyboardWasUp = false
            dismissInput()
        }
    }
    var dragY by remember { mutableFloatStateOf(0f) }
    // Moving between people with the finger (founder, 2026-11-11): a sideways drag turns the page as it goes, the
    // person after or before coming in beside the one showing like the next face of a box. [pageX] is how far.
    var pageX by remember { mutableFloatStateOf(0f) }
    var turning by remember { mutableStateOf(false) }
    // A turn that has finished holds its last frame for the ring it left, until the next ring is the one showing: the
    // page that came in and the Moment that replaces it are the same picture, so nothing blinks.
    var turned by remember { mutableStateOf<Pair<Int, Float>?>(null) }
    val ringIndexNow by rememberUpdatedState(state.ringIndex)
    val shownX = { turned?.takeIf { it.first == ringIndexNow }?.second ?: pageX }
    LaunchedEffect(state.ringIndex) { turned = null }
    // Which side a page is coming in from: read where it's needed, so a drag redraws without rebuilding the viewer.
    val incomingStep by remember {
        derivedStateOf {
            val x = shownX()
            if (x < 0f) {
                1
            } else if (x > 0f) {
                -1
            } else {
                0
            }
        }
    }
    // The page springing back; a finger that takes it again stops the spring.
    var settling by remember { mutableStateOf<Job?>(null) }
    val settlePage = {
        settling?.cancel()
        settling =
            scope.launch {
                animate(pageX, 0f, animationSpec = spring(dampingRatio = 0.85f, stiffness = Spring.StiffnessMediumLow)) { value, _ ->
                    pageX = value
                }
                handling = false
            }
    }
    val turnPage = { dx: Float, width: Float ->
        val step = if (dx < 0f) 1 else -1
        val there = viewModel.peek(step) != null
        when {
            abs(dx) < width * TURN_FRACTION || (!there && step < 0) -> settlePage()
            // Past the last person the viewer closes, as it always has.
            !there -> {
                settlePage()
                viewModel.nextRing()
            }
            else -> {
                turning = true
                settling?.cancel()
                scope.launch {
                    val end = -step * width
                    animate(pageX, end, animationSpec = tween(TURN_MS, easing = LinearOutSlowInEasing)) { value, _ -> pageX = value }
                    turned = state.ringIndex to end
                    pageX = 0f
                    if (step > 0) viewModel.nextRing() else viewModel.previousRing()
                    turning = false
                    handling = false
                }
            }
        }
        Unit
    }
    // A pinch makes a photo bigger where the fingers are, while they're held.
    var zoom by remember { mutableFloatStateOf(1f) }
    var zoomOrigin by remember { mutableStateOf(TransformOrigin.Center) }
    val canZoom by rememberUpdatedState(moment?.kind == "photo" && state.load is ViewerLoad.Ready)

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.momentStage)
                .testTag("moments.viewer")
                .semantics { testTagsAsResourceId = true },
    ) {
        // The person a sideways drag is bringing in, beside the one showing.
        if (incomingStep != 0) {
            viewModel.peek(incomingStep)?.let { peek ->
                PeekPage(
                    peek = peek,
                    state = state,
                    muted = muted,
                    modifier = Modifier.fillMaxSize().graphicsLayer { pageTurn(shownX() + incomingStep * size.width, size.width) },
                )
            }
        }
        Box(modifier = Modifier.fillMaxSize().graphicsLayer { pageTurn(shownX(), size.width) }) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = BOTTOM_BAR)
                        .fillMaxSize()
                        .graphicsLayer {
                            translationY = dragY.coerceAtLeast(0f) * 0.6f
                            alpha = 1f - (dragY.coerceAtLeast(0f) / 1600f).coerceIn(0f, 0.5f)
                        }.clip(RoundedCornerShape(bottomStart = 18.dp, bottomEnd = 18.dp))
                        .viewerGestures(
                            enabled = !typing && !reacting && !turning,
                            onHold = { holding = it },
                            onTap = { x, width -> if (x < width / 3f) viewModel.previous() else viewModel.next() },
                            onPage = { x ->
                                settling?.cancel()
                                handling = true
                                // All the way toward a person; a third of the way where there is none.
                                pageX = if (viewModel.peek(if (x < 0f) 1 else -1) == null) x / 3f else x
                            },
                            onTurn = turnPage,
                            onZoom = { scale, origin ->
                                if (origin == null) {
                                    handling = false
                                    scope.launch {
                                        animate(
                                            zoom,
                                            1f,
                                            animationSpec = spring(dampingRatio = ZOOM_BACK_DAMPING),
                                        ) { value, _ -> zoom = value }
                                    }
                                } else if (canZoom) {
                                    handling = true
                                    pageX = 0f
                                    if (zoom == 1f) zoomOrigin = origin
                                    zoom = scale.coerceIn(1f, MAX_ZOOM)
                                }
                            },
                            onSwipeDown = close,
                            onSwipeUp = {
                                if (mineNow) {
                                    seenByOpen = true
                                    viewModel.loadViewers()
                                }
                            },
                            onDrag = { dragY = it },
                        ).semantics {
                            customActions =
                                listOf(
                                    CustomAccessibilityAction("Next Moment") {
                                        viewModel.next()
                                        true
                                    },
                                    CustomAccessibilityAction("Previous Moment") {
                                        viewModel.previous()
                                        true
                                    },
                                    CustomAccessibilityAction("Next person nearby") {
                                        viewModel.nextRing()
                                        true
                                    },
                                )
                        },
            ) {
                when (val load = state.load) {
                    is ViewerLoad.Ready ->
                        Box(
                            modifier =
                                Modifier.fillMaxSize().graphicsLayer {
                                    scaleX = zoom
                                    scaleY = zoom
                                    transformOrigin = zoomOrigin
                                },
                        ) {
                            MomentStage(
                                moment = load.moment,
                                player = player,
                                videoStarted = videoStarted,
                                // A card's words give way to the quick reactions and the reply, as the caption does.
                                wordsHidden = typing || reacting,
                                onReady = {
                                    ready = true
                                    if (load.moment.kind != "video") viewModel.shown(load.moment)
                                },
                                onFailed = viewModel::next,
                            )
                        }
                    ViewerLoad.Loading -> Unit
                    ViewerLoad.Ended ->
                        Text(
                            text = "This Moment has ended.",
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.align(Alignment.Center),
                        )
                    ViewerLoad.Failed ->
                        Column(modifier = Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(text = "Couldn't load this Moment", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                            Spacer(Modifier.height(Spacing.s3))
                            Text(
                                text = "Try again",
                                color = Color.White,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier =
                                    Modifier
                                        .clip(RoundedCornerShape(Radii.pill))
                                        .border(1.dp, PantopusColors.momentReplyOutline, RoundedCornerShape(Radii.pill))
                                        .clickable(role = Role.Button, onClick = viewModel::retry)
                                        .padding(horizontal = Spacing.s4, vertical = 10.dp),
                            )
                        }
                }
                // The top fade keeps the bars and the header readable over a bright photo.
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(180.dp)
                            .background(Brush.verticalGradient(listOf(PantopusColors.momentTopFade, Color.Transparent)))
                            .clearAndSetSemantics {},
                )
                // The caption gives way to the quick reactions while they are up.
                moment?.caption?.takeIf { it.isNotBlank() && moment.kind != "text" && !typing && !reacting }?.let { caption ->
                    Text(
                        text = caption,
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        lineHeight = 21.sp,
                        textAlign = TextAlign.Center,
                        modifier =
                            Modifier
                                .align(Alignment.BottomCenter)
                                .padding(start = Spacing.s10, end = Spacing.s10, bottom = 63.dp)
                                .clip(RoundedCornerShape(Radii.lg))
                                .background(PantopusColors.momentCaptionPill)
                                .padding(horizontal = 14.dp, vertical = Spacing.s2)
                                .testTag("moments.viewer.caption"),
                    )
                }
            }

            // Bars and header, over the top of the Moment.
            Column(modifier = Modifier.fillMaxWidth().statusBarsPadding()) {
                ring?.let { current ->
                    ProgressBars(
                        count = current.moments.size,
                        index = state.momentIndex,
                        progress = { progress },
                        modifier = Modifier.padding(start = 10.dp, end = 10.dp, top = 9.dp),
                    )
                }
                ViewerHeader(
                    state = state,
                    mine = mine,
                    showsSound = moment?.kind == "video",
                    muted = muted,
                    showsMore = !mine && ring != null,
                    onSound = { muted = !muted },
                    onMore = { menuOpen = true },
                    onClose = close,
                    menuOpen = menuOpen,
                    onDismissMenu = { menuOpen = false },
                    onReport = {
                        menuOpen = false
                        reporting = true
                    },
                    onMute = {
                        menuOpen = false
                        viewModel.muteAuthor()
                    },
                    onBlock = {
                        menuOpen = false
                        confirmingBlock = true
                    },
                    onPlace = if (ring?.ring?.noLocation == false) viewModel::showPlace else null,
                )
                // A photo or video taken more than a day before it was posted says when (contract v3.3), under the name.
                takenLabel(moment?.takenAt)?.takeIf { state.load is ViewerLoad.Ready }?.let { taken ->
                    MomentTakenPill(label = taken, modifier = Modifier.padding(start = 58.dp, top = 2.dp))
                }
            }
        }

        // While typing or choosing a reaction, the Moment dims and the quick reactions come up (board V4).
        if (typing || reacting) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.momentDim)
                        .clickable(interactionSource = null, indication = null, onClick = dismissInput)
                        .clearAndSetSemantics {},
            )
        }

        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(bottom = keyboardPadding),
        ) {
            if (typing || reacting) {
                QuickReactions(
                    selected = moment?.myReaction,
                    onPick = { emoji ->
                        if (moment?.myReaction != emoji) {
                            pops += 1
                            popped = pops to emoji
                            MomentHaptics.light(view)
                        }
                        viewModel.react(emoji)
                        dismissInput()
                    },
                )
                if (typing) {
                    // Within reach of the thumb (REVIEW L3): the reactions, 14 dp, the line, 12 dp, the box.
                    Spacer(Modifier.height(14.dp))
                    Text(
                        text = "${ring?.ring?.author?.firstName ?: ring?.ring?.author?.name ?: "They"} gets your reply in Messages.",
                        color = Color.White.copy(alpha = 0.78f),
                        fontSize = 12.5.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().testTag("moments.viewer.replyHint"),
                    )
                    // The reply row keeps 10 dp of its own above the box: 12 dp from the line to the box in all.
                    Spacer(Modifier.height(2.dp))
                } else {
                    Spacer(Modifier.height(Spacing.s6))
                }
            }
            Box(modifier = Modifier.fillMaxWidth().height(BOTTOM_BAR), contentAlignment = Alignment.TopCenter) {
                when {
                    ring == null -> Unit
                    !mine && !canAnswer -> Unit
                    mine ->
                        SeenByRow(
                            count = moment?.viewerCount ?: 0,
                            onOpen = {
                                seenByOpen = true
                                viewModel.loadViewers()
                            },
                        )
                    else ->
                        ReplyRow(
                            name = ring.ring.author.firstName ?: ring.ring.author.name ?: "them",
                            canReply = !curator,
                            text = reply,
                            onText = { reply = it.take(1000) },
                            typing = typing,
                            onFocus = { focused ->
                                typing = focused
                                if (focused) reacting = false
                            },
                            onReact = { reacting = !reacting },
                            onSend = {
                                viewModel.reply(reply) {
                                    reply = ""
                                    dismissInput()
                                }
                            },
                        )
                }
            }
        }

        mutedNote?.let { note ->
            MutedNote(
                text = note.text,
                onUndo = {
                    viewModel.unmute(note.authorId)
                    mutedNote = null
                },
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = BOTTOM_BAR + Spacing.s3 + keyboardPadding),
            )
        }
        popped?.let { (number, emoji) ->
            key(number) {
                ReactionPop(
                    emoji = emoji,
                    onDone = { if (popped?.first == number) popped = null },
                    modifier = Modifier.align(Alignment.Center),
                )
            }
        }
        // Notes sit just above the reply box, never on it.
        ToastHost(
            controller = toast,
            modifier = Modifier.padding(bottom = BOTTOM_BAR - Spacing.s6 + keyboardPadding),
        )
    }

    if (reporting) {
        AlertDialog(
            onDismissRequest = { reporting = false },
            title = { Text("Report this Moment?") },
            text = {
                Column(
                    modifier = Modifier.semantics { testTagsAsResourceId = true },
                    verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Text(
                        text = "Reports go to the Pantopus team. The person isn't told who reported.",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    REPORT_REASONS.forEach { (key, label) ->
                        TextButton(
                            onClick = {
                                reporting = false
                                viewModel.report(key)
                            },
                            modifier = Modifier.fillMaxWidth().testTag("moments.report.$key"),
                        ) { Text(label, color = PantopusColors.appText) }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { reporting = false }) { Text("Cancel") } },
        )
    }
    val authorName = ring?.ring?.author?.let { it.firstName ?: it.name } ?: "this person"
    if (confirmingBlock) {
        AlertDialog(
            onDismissRequest = { confirmingBlock = false },
            title = { Text("Block $authorName?") },
            text = { Text("You won't see each other's Moments or posts, and you can't message each other. They aren't told.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmingBlock = false
                        viewModel.blockAuthor()
                    },
                    modifier = Modifier.semantics { testTagsAsResourceId = true }.testTag("moments.blockConfirm"),
                ) { Text("Block", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { confirmingBlock = false }) { Text("Cancel") } },
        )
    }
    if (seenByOpen && moment != null && mine) {
        val storage =
            rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
                if (granted) {
                    scope.launch { saveNote = if (MomentGallerySaver.save(context, moment)) "Saved" else "Couldn't save" }
                } else {
                    saveNote = "Allow storage to save"
                }
            }
        SeenBySheet(
            moment = moment,
            state = state,
            saveNote = saveNote,
            onDismiss = { seenByOpen = false },
            onSave = {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && !context.canWriteStorage()) {
                    storage.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                } else {
                    scope.launch { saveNote = if (MomentGallerySaver.save(context, moment)) "Saved" else "Couldn't save" }
                }
            },
            onDelete = { confirmingDelete = true },
        )
    }
    if (confirmingDelete) {
        AlertDialog(
            onDismissRequest = { confirmingDelete = false },
            title = { Text("Delete this Moment?") },
            text = { Text("It leaves the map for everyone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmingDelete = false
                        viewModel.delete { seenByOpen = false }
                    },
                    modifier = Modifier.semantics { testTagsAsResourceId = true }.testTag("moments.seenBy.deleteConfirm"),
                ) { Text("Delete", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { confirmingDelete = false }) { Text("Cancel") } },
        )
    }
}

/**
 * The Moment itself: the photo, the video over its poster, or the text card. With [wordsHidden] (the quick reactions
 * open, a reply being typed) a card's words fade out so the emoji row and the reply never sit on them; TalkBack still
 * reads them.
 */
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
private fun MomentStage(
    moment: MomentDto,
    player: ExoPlayer,
    videoStarted: Boolean,
    wordsHidden: Boolean,
    onReady: () -> Unit,
    onFailed: () -> Unit,
) {
    when (moment.kind) {
        "text" -> {
            LaunchedEffect(moment.id) { onReady() }
            val wordsAlpha by animateFloatAsState(if (wordsHidden) 0f else 1f, animationSpec = tween(WORDS_FADE_MS), label = "cardWords")
            MomentTextCard(moment = moment, wordsAlpha = { wordsAlpha }, modifier = Modifier.testTag("moments.viewer.text"))
        }
        "video" ->
            Box(modifier = Modifier.fillMaxSize().testTag("moments.viewer.video")) {
                rememberMomentImage(moment.posterUrl, MomentImages.posterKey(moment.id))?.let { poster ->
                    AsyncImage(
                        model = poster,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                AndroidView(
                    factory = { context ->
                        PlayerView(context).apply {
                            useController = false
                            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                            setShutterBackgroundColor(android.graphics.Color.TRANSPARENT)
                        }
                    },
                    update = { view -> view.player = player },
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .graphicsLayer { alpha = if (videoStarted) 1f else 0f }
                            .semantics { contentDescription = moment.caption?.let { "Video: $it" } ?: "Video" },
                )
            }
        else ->
            AsyncImage(
                model = rememberMomentImage(moment.mediaUrl, MomentImages.mediaKey(moment.id)),
                contentDescription = moment.caption?.let { "Photo: $it" } ?: "Photo",
                contentScale = ContentScale.Crop,
                onSuccess = { onReady() },
                onError = { onFailed() },
                modifier = Modifier.fillMaxSize().testTag("moments.viewer.photo"),
            )
    }
}

/** A text card: its words in white on its background. */
@Composable
private fun MomentTextCard(
    moment: MomentDto,
    wordsAlpha: () -> Float,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .momentCardGradient(MomentCardBackground.fromWire(moment.background))
                .padding(horizontal = 36.dp, vertical = Spacing.s10),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = moment.text.orEmpty(),
            color = Color.White,
            fontSize = 29.sp,
            lineHeight = 37.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.graphicsLayer { alpha = wordsAlpha() },
        )
    }
}

/**
 * The page a sideways drag brings in: the person's opening Moment (its photo, its video's first picture or its card,
 * when it was read ahead) under their bars and header, laid out as the viewer lays out the one showing. Nothing on it
 * can be tapped or read aloud until it is the one showing.
 */
@Composable
private fun PeekPage(
    peek: ViewerPeek,
    state: MomentsViewerUiState,
    muted: Boolean,
    modifier: Modifier = Modifier,
) {
    val peekState =
        remember(peek, state.rings) {
            state.copy(
                ringIndex = peek.ringIndex,
                momentIndex = peek.index,
                load = peek.moment?.let { ViewerLoad.Ready(it) } ?: ViewerLoad.Loading,
            )
        }
    val mine = peek.ring.ring.mine
    Box(modifier = modifier.background(PantopusColors.momentStage).clearAndSetSemantics {}) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = BOTTOM_BAR)
                    .fillMaxSize()
                    .clip(RoundedCornerShape(bottomStart = 18.dp, bottomEnd = 18.dp)),
        ) {
            peek.moment?.let { moment ->
                if (moment.kind == "text") {
                    MomentTextCard(moment = moment, wordsAlpha = { 1f })
                } else {
                    val video = moment.kind == "video"
                    AsyncImage(
                        model =
                            rememberMomentImage(
                                if (video) moment.posterUrl else moment.mediaUrl,
                                if (video) MomentImages.posterKey(moment.id) else MomentImages.mediaKey(moment.id),
                            ),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                        .background(Brush.verticalGradient(listOf(PantopusColors.momentTopFade, Color.Transparent))),
            )
        }
        Column(modifier = Modifier.fillMaxWidth().statusBarsPadding()) {
            ProgressBars(
                count = peek.ring.moments.size,
                index = peek.index,
                progress = { 0f },
                modifier = Modifier.padding(start = 10.dp, end = 10.dp, top = 9.dp),
            )
            ViewerHeader(
                state = peekState,
                mine = mine,
                showsSound = peek.brief.kind == "video",
                muted = muted,
                showsMore = !mine,
                onSound = {},
                onMore = {},
                onClose = {},
                menuOpen = false,
                onDismissMenu = {},
                onReport = {},
                onMute = {},
                onBlock = {},
            )
        }
    }
}

/** One page of the turn: [position] is how far its leading edge is from where it fills the screen. */
private fun GraphicsLayerScope.pageTurn(
    position: Float,
    width: Float,
) {
    translationX = position
    if (width > 0f && position != 0f) {
        rotationY = TURN_DEGREES * position / width
        transformOrigin = TransformOrigin(if (position > 0f) 0f else 1f, 0.5f)
        cameraDistance = TURN_CAMERA
    }
}

/** One bar per Moment in the ring (board V1): watched ones full, the current one filling, the rest empty. */
@Composable
private fun ProgressBars(
    count: Int,
    index: Int,
    progress: () -> Float,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().semantics { contentDescription = "Moment ${index + 1} of $count" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        repeat(count) { bar ->
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(PantopusColors.momentBarTrack)
                        // Drawn, not laid out: the bar on screen fills every frame without the viewer being built again.
                        .drawBehind {
                            val fill =
                                when {
                                    bar < index -> 1f
                                    bar == index -> progress().coerceIn(0f, 1f)
                                    else -> 0f
                                }
                            drawRect(Color.White, size = Size(size.width * fill, size.height))
                        }.testTag("moments.viewer.bar.$bar"),
            )
        }
    }
}

/** "You won't see Grace's Moments." with Undo, over the bottom of the viewer. */
@Composable
private fun MutedNote(
    text: String,
    onUndo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appText)
                .padding(start = Spacing.s4, end = Spacing.s1)
                .heightIn(min = 48.dp)
                .testTag("moments.viewer.toast"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = text, color = Color.White, fontSize = 14.sp, modifier = Modifier.weight(1f))
        Text(
            text = "Undo",
            color = PantopusColors.primary300,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(role = Role.Button, onClick = onUndo)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                    .testTag("moments.viewer.toastAction"),
        )
    }
}

/** The face, name and check, "place · 2h ago · 4h left", and sound, … and close (boards V1, V2, V5). */
@Composable
private fun ViewerHeader(
    state: MomentsViewerUiState,
    mine: Boolean,
    showsSound: Boolean,
    muted: Boolean,
    showsMore: Boolean,
    onSound: () -> Unit,
    onMore: () -> Unit,
    onClose: () -> Unit,
    menuOpen: Boolean,
    onDismissMenu: () -> Unit,
    onReport: () -> Unit,
    onMute: () -> Unit,
    onBlock: () -> Unit,
    /** The place is a button that shows it on the map; none for a Moment with no location or a page coming in. */
    onPlace: (() -> Unit)? = null,
) {
    val ring = state.ring?.ring
    val moment = state.moment
    val brief = state.brief
    Row(
        modifier = Modifier.fillMaxWidth().height(48.dp).padding(start = Spacing.s3, end = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (ring != null) {
            Row(
                modifier = Modifier.weight(1f).testTag("moments.viewer.author").semantics(mergeDescendants = true) {},
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // Your own Moment wears the face your ring does.
                MomentFace(author = ring.author, size = 36.dp, initialsSize = 13.sp)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(
                            text = if (mine) "Your Moment" else ring.author.name ?: ring.author.firstName ?: "",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = TextStyle(shadow = STAGE_SHADOW),
                        )
                        if (ring.author.verified && !mine) {
                            MomentVerifiedCheck(
                                size = 14.dp,
                                ring = 0.dp,
                                modifier = Modifier.semantics { contentDescription = "Verified resident" },
                            )
                        }
                    }
                    val place = moment?.placeLabel ?: ring.placeLabel
                    // Once it has ended, the header drops the time left ("This Moment has ended." is on screen).
                    val times =
                        listOfNotNull(
                            agoLabel(moment?.createdAt ?: brief?.createdAt),
                            leftLabel(moment?.expiresAt ?: brief?.expiresAt).takeIf { state.load != ViewerLoad.Ended },
                        ).joinToString(" · ")
                    // A long place name gives way; "2h ago · 4h left" always shows.
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier =
                            Modifier.testTag("moments.viewer.meta").clearAndSetSemantics {
                                contentDescription = listOfNotNull(place, times.takeIf { it.isNotEmpty() }).joinToString(" · ")
                                if (onPlace != null && place != null) {
                                    customActions =
                                        listOf(
                                            CustomAccessibilityAction("Show on the map") {
                                                onPlace()
                                                true
                                            },
                                        )
                                }
                            },
                    ) {
                        val metaStyle = TextStyle(shadow = STAGE_SHADOW)
                        if (place != null) {
                            val tappable = onPlace != null
                            if (tappable) {
                                PantopusIconImage(
                                    icon = PantopusIcon.MapPin,
                                    contentDescription = null,
                                    size = 11.dp,
                                    tint = PantopusColors.momentOnStageSecondary,
                                )
                                Spacer(Modifier.width(3.dp))
                            }
                            Text(
                                text = place,
                                color = PantopusColors.momentOnStageSecondary,
                                fontSize = 12.5.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                style = metaStyle,
                                modifier =
                                    Modifier
                                        .weight(1f, fill = false)
                                        .then(
                                            if (onPlace != null) {
                                                Modifier
                                                    .clickable(
                                                        interactionSource = null,
                                                        indication = null,
                                                        role = Role.Button,
                                                        onClick = onPlace,
                                                    ).testTag("moments.viewer.place")
                                            } else {
                                                Modifier
                                            },
                                        ),
                            )
                        }
                        if (times.isNotEmpty()) {
                            Text(
                                text = if (place != null) " · $times" else times,
                                color = PantopusColors.momentOnStageSecondary,
                                fontSize = 12.5.sp,
                                maxLines = 1,
                                style = metaStyle,
                            )
                        }
                    }
                }
            }
        } else {
            Spacer(Modifier.weight(1f))
        }
        if (showsSound) {
            StageButton(
                icon = if (muted) PantopusIcon.VolumeX else PantopusIcon.Volume2,
                label = if (muted) "Sound off. Turn on sound" else "Sound on. Mute",
                onClick = onSound,
                width = 40.dp,
                modifier = Modifier.testTag("moments.viewer.sound"),
            )
        }
        if (showsMore) {
            Box {
                StageButton(
                    icon = PantopusIcon.MoreHorizontal,
                    label = "More",
                    onClick = onMore,
                    width = if (showsSound) 40.dp else 44.dp,
                    modifier = Modifier.testTag("moments.viewer.more"),
                )
                // On the dark stage the menu is dark too (REVIEW LA6), not a light popup over the Moment.
                DropdownMenu(
                    expanded = menuOpen,
                    onDismissRequest = onDismissMenu,
                    containerColor = PantopusColors.momentMenuSurface,
                    modifier = Modifier.semantics { testTagsAsResourceId = true },
                ) {
                    DropdownMenuItem(
                        text = { Text("Report", color = Color.White) },
                        leadingIcon = {
                            PantopusIconImage(icon = PantopusIcon.Flag, contentDescription = null, size = 18.dp, tint = Color.White)
                        },
                        onClick = onReport,
                        modifier = Modifier.testTag("moments.menu.report"),
                    )
                    DropdownMenuItem(
                        text = { Text("Mute this person's Moments", color = Color.White) },
                        leadingIcon = {
                            PantopusIconImage(icon = PantopusIcon.BellOff, contentDescription = null, size = 18.dp, tint = Color.White)
                        },
                        onClick = onMute,
                        modifier = Modifier.testTag("moments.menu.mute"),
                    )
                    DropdownMenuItem(
                        text = { Text("Block", color = PantopusColors.momentMenuDanger) },
                        leadingIcon = {
                            PantopusIconImage(
                                icon = PantopusIcon.Ban,
                                contentDescription = null,
                                size = 18.dp,
                                tint = PantopusColors.momentMenuDanger,
                            )
                        },
                        onClick = onBlock,
                        modifier = Modifier.testTag("moments.menu.block"),
                    )
                }
            }
        }
        StageButton(
            icon = PantopusIcon.X,
            label = "Close",
            onClick = onClose,
            width = if (showsSound) 40.dp else 44.dp,
            iconSize = 24.dp,
            modifier = Modifier.testTag("moments.viewer.close"),
        )
    }
}

@Composable
private fun StageButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    width: androidx.compose.ui.unit.Dp = 44.dp,
    iconSize: androidx.compose.ui.unit.Dp = 22.dp,
) {
    Box(
        modifier =
            modifier
                .size(width = width, height = 44.dp)
                .clickable(role = Role.Button, onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = iconSize, tint = Color.White)
    }
}

/** The reply box and the reaction button (board V1); with a reply typed, Send (V4). */
@Composable
private fun ReplyRow(
    name: String,
    canReply: Boolean,
    text: String,
    onText: (String) -> Unit,
    typing: Boolean,
    onFocus: (Boolean) -> Unit,
    onReact: () -> Unit,
    onSend: () -> Unit,
) {
    val focus = remember { FocusRequester() }
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = Spacing.s3, end = Spacing.s3, top = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (typing) Spacing.s2 else 10.dp),
    ) {
        if (canReply) {
            BasicTextField(
                value = text,
                onValueChange = onText,
                singleLine = true,
                textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
                cursorBrush = SolidColor(PantopusColors.mapYou),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { if (text.isNotBlank()) onSend() }),
                modifier =
                    Modifier
                        .weight(1f)
                        .focusRequester(focus)
                        .onFocusChanged { onFocus(it.isFocused) }
                        .testTag("moments.viewer.reply")
                        .semantics { contentDescription = "Reply to $name" },
                decorationBox = { field ->
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(44.dp)
                                .clip(RoundedCornerShape(22.dp))
                                .background(if (typing) Color.Black.copy(alpha = 0.25f) else Color.Transparent)
                                .border(
                                    1.dp,
                                    if (typing) PantopusColors.momentReplyOutlineActive else PantopusColors.momentReplyOutline,
                                    RoundedCornerShape(22.dp),
                                ).padding(horizontal = if (typing) Spacing.s4 else 18.dp),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        if (text.isEmpty()) Text("Reply to $name", color = Color.White.copy(alpha = 0.85f), fontSize = 15.sp, maxLines = 1)
                        field()
                    }
                },
            )
        } else {
            Spacer(Modifier.weight(1f))
        }
        if (typing && text.isNotBlank()) {
            Box(
                modifier =
                    Modifier
                        .keepsKeyboard()
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600)
                        .clickable(role = Role.Button, onClick = onSend)
                        .testTag("moments.viewer.send")
                        .clearAndSetSemantics {
                            contentDescription = "Send"
                            role = Role.Button
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ArrowUp,
                    contentDescription = null,
                    size = 20.dp,
                    strokeWidth = 2.4f,
                    tint = Color.White,
                )
            }
        } else {
            StageButton(
                icon = PantopusIcon.Smile,
                label = "React",
                onClick = onReact,
                iconSize = 26.dp,
                modifier = Modifier.testTag("moments.viewer.react"),
            )
        }
    }
}

/** "Quick reactions" and the seven emojis (board V4); yours stands out. */
@Composable
private fun QuickReactions(
    selected: String?,
    onPick: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("moments.viewer.reactions"), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = "Quick reactions", color = Color.White.copy(alpha = 0.75f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(10.dp))
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            QUICK_REACTIONS.forEach { (emoji, name) ->
                val on = emoji == selected
                Box(
                    modifier =
                        Modifier
                            .size(width = 46.dp, height = 52.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (on) Color.White.copy(alpha = 0.2f) else Color.Transparent)
                            .clickable(role = Role.Button) { onPick(emoji) }
                            .testTag("moments.viewer.reaction.${name.lowercase()}")
                            .clearAndSetSemantics {
                                contentDescription = name
                                role = Role.Button
                                this.selected = on
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(text = emoji, fontSize = 34.sp)
                }
            }
        }
    }
}

/** On your own Moment, where others have the reply box: "Seen by 12", or "No views yet" (MOMLEAD 20:33Z). */
@Composable
private fun SeenByRow(
    count: Int,
    onOpen: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .padding(start = Spacing.s3, top = 10.dp)
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clickable(role = Role.Button, onClick = onOpen)
                .padding(horizontal = Spacing.s1)
                .testTag("moments.viewer.seenBy")
                .clearAndSetSemantics {
                    contentDescription = if (count > 0) "Seen by $count. Show who" else "No views yet"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Eye, contentDescription = null, size = 20.dp, tint = Color.White)
        Text(
            text = if (count > 0) "Seen by $count" else "No views yet",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** Seen by (board V5): the count and time left, Save to Photos and Delete, then who watched, newest first. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SeenBySheet(
    moment: MomentDto,
    state: MomentsViewerUiState,
    saveNote: String?,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    onDelete: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = false)
    val viewers = state.viewers
    val count = viewers?.count ?: moment.viewerCount ?: 0
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheet,
        containerColor = PantopusColors.appSurface,
        shape = RoundedCornerShape(topStart = Radii.xl3, topEnd = Radii.xl3),
        dragHandle = {
            Box(
                modifier =
                    Modifier
                        .padding(top = Spacing.s2, bottom = Spacing.s2)
                        .size(width = 36.dp, height = 5.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(PantopusColors.appBorder),
            )
        },
        modifier = Modifier.semantics { testTagsAsResourceId = true }.testTag("moments.seenBy"),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5, vertical = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Nobody yet: the title says so, as on iPhone ("Seen by 0" read like a count gone wrong).
                Text(
                    text = if (count > 0) "Seen by $count" else "No views yet",
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f).testTag("moments.seenBy.title"),
                )
                leftLabel(moment.expiresAt)?.let { left ->
                    Text(
                        text = left,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary600,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.primary100)
                                .padding(horizontal = 10.dp, vertical = Spacing.s1)
                                .testTag("moments.seenBy.timeLeft"),
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5, vertical = Spacing.s2),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                // The button itself says what happened: a note on the viewer would sit under this sheet.
                SheetButton(
                    icon = if (saveNote == "Saved") PantopusIcon.Check else PantopusIcon.Download,
                    label = saveNote ?: "Save to Photos",
                    tint = if (saveNote == "Saved") PantopusColors.success else PantopusColors.appText,
                    onClick = onSave,
                    modifier = Modifier.weight(1f).testTag("moments.seenBy.save"),
                )
                SheetButton(
                    icon = PantopusIcon.Trash2,
                    label = "Delete",
                    tint = PantopusColors.error,
                    onClick = onDelete,
                    modifier = Modifier.weight(1f).testTag("moments.seenBy.delete"),
                )
            }
            Spacer(Modifier.height(Spacing.s2))
            HorizontalDivider(color = PantopusColors.appBorder)
            when {
                viewers == null && state.viewersLoading ->
                    Text(
                        text = "Loading…",
                        fontSize = 14.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(Spacing.s5),
                    )
                (viewers?.viewers.isNullOrEmpty()) ->
                    Text(
                        text = "When someone watches it, they show up here.",
                        fontSize = 14.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.padding(Spacing.s5),
                    )
                else ->
                    LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp)) {
                        items(viewers?.viewers.orEmpty(), key = { it.user.id }) { viewer -> ViewerRow(viewer) }
                    }
            }
            Spacer(Modifier.height(Spacing.s6))
        }
    }
}

@Composable
private fun SheetButton(
    icon: PantopusIcon,
    label: String,
    tint: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .height(44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .clickable(role = Role.Button, onClick = onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = tint)
        Spacer(Modifier.width(Spacing.s2))
        Text(text = label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = tint)
    }
}

@Composable
private fun ViewerRow(viewer: MomentViewerDto) {
    val reactionName = QUICK_REACTIONS.firstOrNull { it.first == viewer.reaction }?.second
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(58.dp)
                .padding(horizontal = Spacing.s5)
                .testTag("moments.seenBy.row.${viewer.user.id}")
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        MomentFace(author = viewer.user, size = 40.dp, initialsSize = 14.sp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = viewer.user.name ?: viewer.user.firstName ?: "",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            agoLabel(viewer.viewedAt)?.let { Text(text = it, fontSize = 13.sp, color = PantopusColors.appTextSecondary) }
        }
        if (viewer.reaction != null) {
            Text(
                text = viewer.reaction,
                fontSize = 22.sp,
                modifier = Modifier.semantics { contentDescription = reactionName ?: viewer.reaction },
            )
        }
        if (viewer.replied) {
            Text(
                text = "Replied",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary100)
                        .padding(horizontal = 10.dp, vertical = Spacing.s1),
            )
        }
    }
    HorizontalDivider(color = PantopusColors.appBorder)
}

/**
 * The reaction you picked, over the Moment for about half a second: it springs up (0.6 → 1.2 → 1), drifts upward and
 * fades, and the Moment plays on.
 */
@Composable
private fun ReactionPop(
    emoji: String,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val progress = remember { Animatable(0f) }
    val done by rememberUpdatedState(onDone)
    LaunchedEffect(Unit) {
        progress.animateTo(1f, tween(durationMillis = POP_MS, easing = LinearEasing))
        done()
    }
    Text(
        text = emoji,
        fontSize = 96.sp,
        modifier =
            modifier
                .graphicsLayer {
                    val t = progress.value
                    val scale =
                        when {
                            t < 0.35f -> 0.6f + 0.6f * (t / 0.35f)
                            t < 0.55f -> 1.2f - 0.2f * ((t - 0.35f) / 0.2f)
                            else -> 1f
                        }
                    scaleX = scale
                    scaleY = scale
                    alpha = if (t < 0.6f) 1f else 1f - (t - 0.6f) / 0.4f
                    translationY = -t * 56.dp.toPx()
                }.clearAndSetSemantics {},
    )
}

/**
 * The viewer's gestures (board V1 note): a tap on the left third goes back and elsewhere forward, a hold pauses, a
 * swipe down closes, a swipe up opens Seen by on your own Moment. A drag keeps to the way it first goes: down, and
 * [onDrag] follows it so the Moment moves with the finger; sideways, and [onPage] follows it so the page turns with the
 * finger, [onTurn] saying how far it had gone when it lifted. Two fingers pinch: [onZoom] says how big and around
 * where (as a fraction of the picture), then null when they lift; a pinch is never also a tap or a swipe.
 */
@Suppress("LongParameterList", "CyclomaticComplexMethod", "LongMethod")
private fun Modifier.viewerGestures(
    enabled: Boolean,
    onHold: (Boolean) -> Unit,
    onTap: (x: Float, width: Float) -> Unit,
    onPage: (Float) -> Unit,
    onTurn: (dx: Float, width: Float) -> Unit,
    onZoom: (scale: Float, origin: TransformOrigin?) -> Unit,
    onSwipeDown: () -> Unit,
    onSwipeUp: () -> Unit,
    onDrag: (Float) -> Unit,
): Modifier =
    if (!enabled) {
        this
    } else {
        pointerInput(Unit) {
            val slop = viewConfiguration.touchSlop
            val swipe = SWIPE_DP * density
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                val start = down.position
                val startedAt = down.uptimeMillis
                var travel = Offset.Zero
                var holding = false
                // Sideways or up and down, once the finger has moved past the slop; it keeps to that until it lifts.
                var sideways: Boolean? = null
                // The fingers' distance when the second one landed; the pinch is measured against it.
                var pinchFrom = 0f
                // Whether the hold's wait is over: a finger resting on the glass sends nothing, so the hold starts on
                // the clock, not on the finger's next movement.
                var decided = false
                while (true) {
                    val left = HOLD_MS - (SystemClock.uptimeMillis() - startedAt)
                    val event =
                        when {
                            decided -> awaitPointerEvent()
                            left > 0 -> withTimeoutOrNull(left) { awaitPointerEvent() }
                            else -> null
                        }
                    if (event == null) {
                        decided = true
                        if (travel.getDistance() < slop && pinchFrom == 0f) {
                            holding = true
                            onHold(true)
                        }
                        continue
                    }
                    val pressed = event.changes.filter { it.pressed }
                    if (pressed.size >= 2) {
                        val between = (pressed[0].position - pressed[1].position).getDistance()
                        if (pinchFrom == 0f) {
                            pinchFrom = between.coerceAtLeast(1f)
                            onDrag(0f)
                            if (sideways == true) onPage(0f)
                        }
                        val middle = (pressed[0].position + pressed[1].position) / 2f
                        onZoom(between / pinchFrom, TransformOrigin(middle.x / size.width, middle.y / size.height))
                        event.changes.forEach { it.consume() }
                        continue
                    }
                    if (pressed.isEmpty()) break
                    if (pinchFrom > 0f) {
                        // One finger of a pinch is still down: it waits for the other, and moves nothing.
                        event.changes.forEach { it.consume() }
                        continue
                    }
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    travel = change.position - start
                    if (sideways == null && travel.getDistance() > slop) sideways = abs(travel.x) > abs(travel.y)
                    when (sideways) {
                        true -> onPage(travel.x)
                        false -> if (travel.y > 0f) onDrag(travel.y)
                        null -> Unit
                    }
                    change.consume()
                }
                onDrag(0f)
                if (holding) onHold(false)
                val dy = travel.y
                when {
                    pinchFrom > 0f -> onZoom(1f, null)
                    sideways == true -> onTurn(travel.x, size.width.toFloat())
                    sideways == false && dy > swipe -> onSwipeDown()
                    sideways == false && dy < -swipe -> onSwipeUp()
                    !holding && travel.getDistance() < slop -> onTap(start.x, size.width.toFloat())
                }
            }
        }
    }

/**
 * Light status and navigation icons over the dark stage while it shows, and the stage's black behind the status bar
 * (the band the activity paints around a camera cutout); the app's light bars and band come back after.
 */
@Composable
internal fun StageSystemBars() {
    val view = LocalView.current
    DisposableEffect(view) {
        val window = view.context.findActivity()?.window
        val controller = window?.let { WindowCompat.getInsetsController(it, view) }
        controller?.isAppearanceLightStatusBars = false
        controller?.isAppearanceLightNavigationBars = false
        CutoutBand.color = PantopusColors.momentStage
        onDispose {
            controller?.isAppearanceLightStatusBars = true
            controller?.isAppearanceLightNavigationBars = true
            CutoutBand.color = null
        }
    }
}

private tailrec fun Context.findActivity(): Activity? =
    when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }

private fun Context.canWriteStorage(): Boolean =
    androidx.core.content.ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
        PackageManager.PERMISSION_GRANTED

/** A text card stays up a little longer when it's long: 6 to 12 seconds. */
private fun textDurationMs(text: String): Long = (TEXT_BASE_MS + text.length * TEXT_PER_CHAR_MS).coerceIn(PHOTO_MS, TEXT_MAX_MS)

private val STAGE_SHADOW =
    androidx.compose.ui.graphics.Shadow(color = Color.Black.copy(alpha = 0.4f), offset = Offset(0f, 1f), blurRadius = 2f)

/** The strip under the Moment that holds the reply box (board V1: 68 of 844). */
private val BOTTOM_BAR = 68.dp

private const val PHOTO_MS = 6_000L
private const val TEXT_BASE_MS = 3_000L
private const val TEXT_PER_CHAR_MS = 45L
private const val TEXT_MAX_MS = 12_000L
private const val NANOS_PER_MS = 1_000_000.0
private const val HOLD_MS = 180L
private const val SWIPE_DP = 60f

/** How far across the screen a sideways drag has to go for the page to turn when the finger lifts. */
private const val TURN_FRACTION = 0.2f
private const val TURN_MS = 240

/** The two pages meet like the faces of a box: a quarter turn between them, seen from a little way off. */
private const val TURN_DEGREES = 90f
private const val TURN_CAMERA = 24f
private const val MAX_ZOOM = 4f
private const val ZOOM_BACK_DAMPING = 0.82f
private const val ENDED_NOTICE_MS = 1_200L
private const val MUTED_NOTE_MS = 4_000L
private const val SAVE_NOTE_MS = 2_500L
private const val POP_MS = 550

/** How fast a card's words fade for the quick reactions and the reply. */
private const val WORDS_FADE_MS = 150
