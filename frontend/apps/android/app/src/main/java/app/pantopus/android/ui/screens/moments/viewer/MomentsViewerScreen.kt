@file:Suppress(
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
    "LongMethod",
    "CyclomaticComplexMethod",
    "ComplexCondition",
)

@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)

package app.pantopus.android.ui.screens.moments.viewer

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalViewConfiguration
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
import app.pantopus.android.ui.components.KeyboardResizeEffect
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.feed.pulseReportReasons
import app.pantopus.android.ui.screens.moments.components.MomentCardBackground
import app.pantopus.android.ui.screens.moments.components.MomentFace
import app.pantopus.android.ui.screens.moments.components.MomentSelfFace
import app.pantopus.android.ui.screens.moments.components.MomentVerifiedCheck
import app.pantopus.android.ui.screens.moments.components.momentCardGradient
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

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
    KeyboardResizeEffect()
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
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) { away = true }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { away = false }
    val paused = holding || typing || reacting || menuOpen || reporting || confirmingBlock || seenByOpen || confirmingDelete || away

    var reply by remember { mutableStateOf("") }
    var muted by remember { mutableStateOf(false) }
    // The clock of the Moment on screen.
    val momentKey = "${state.ringIndex}:${brief?.id}"
    var ready by remember(momentKey) { mutableStateOf(false) }
    var progress by remember(momentKey) { mutableFloatStateOf(0f) }
    var elapsed by remember(momentKey) { mutableLongStateOf(0L) }

    // One player for the whole viewer; a video Moment hands it its signed link.
    val player = remember { ExoPlayer.Builder(context).build().apply { repeatMode = Player.REPEAT_MODE_OFF } }
    DisposableEffect(player) { onDispose { player.release() } }
    // One state for every video (the player's listener holds it), back to false for each new Moment.
    var videoStarted by remember { mutableStateOf(false) }
    LaunchedEffect(momentKey) { videoStarted = false }
    val onVideoEnded by rememberUpdatedState { viewModel.next() }
    DisposableEffect(player) {
        val listener =
            object : Player.Listener {
                override fun onRenderedFirstFrame() {
                    videoStarted = true
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_ENDED) onVideoEnded()
                }

                // A video that can't play (its link ran out, the network dropped): on to the next Moment.
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    onVideoEnded()
                }
            }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }
    LaunchedEffect(moment?.id, moment?.mediaUrl) {
        val current = moment
        if (current?.kind == "video" && current.mediaUrl != null) {
            player.setMediaItem(MediaItem.fromUri(current.mediaUrl))
            player.prepare()
        } else {
            player.stop()
            player.clearMediaItems()
        }
    }
    LaunchedEffect(muted) { player.volume = if (muted) 0f else 1f }
    LaunchedEffect(moment?.id, paused) { if (moment?.kind == "video") player.playWhenReady = !paused }
    LaunchedEffect(videoStarted) { if (videoStarted) moment?.let(viewModel::shown) }

    // The clock: a photo shows for about 6 seconds, a text card a little longer when it's long, a video for its length.
    LaunchedEffect(momentKey, ready, paused, moment?.kind) {
        val current = moment ?: return@LaunchedEffect
        if (current.kind == "video") {
            while (true) {
                val duration = player.duration.takeIf { it > 0 } ?: current.durationMs ?: 0L
                if (duration > 0) progress = (player.currentPosition.toFloat() / duration).coerceIn(0f, 1f)
                delay(FRAME_MS)
            }
        }
        if (!ready || paused) return@LaunchedEffect
        val total = if (current.kind == "text") textDurationMs(current.text.orEmpty()) else PHOTO_MS
        while (elapsed < total) {
            delay(FRAME_MS)
            elapsed += FRAME_MS
            progress = (elapsed.toFloat() / total).coerceIn(0f, 1f)
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

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.momentStage)
                .testTag("moments.viewer")
                .semantics { testTagsAsResourceId = true },
    ) {
        BoxWithConstraints(
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
                        enabled = !typing && !reacting,
                        onHold = { holding = it },
                        onTap = { x, width -> if (x < width / 3f) viewModel.previous() else viewModel.next() },
                        onSwipeLeft = viewModel::nextRing,
                        onSwipeRight = viewModel::previousRing,
                        onSwipeDown = close,
                        onSwipeUp = {
                            if (mine) {
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
                    MomentStage(
                        moment = load.moment,
                        player = player,
                        videoStarted = videoStarted,
                        onReady = {
                            ready = true
                            if (load.moment.kind != "video") viewModel.shown(load.moment)
                        },
                        onFailed = viewModel::next,
                    )
                ViewerLoad.Loading -> Unit
                ViewerLoad.Ended ->
                    Text(
                        text = "This Moment has ended",
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
            moment?.caption?.takeIf { it.isNotBlank() && moment.kind != "text" }?.let { caption ->
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
                    progress = progress,
                    modifier = Modifier.padding(start = 10.dp, end = 10.dp, top = 9.dp),
                )
            }
            ViewerHeader(
                state = state,
                mine = mine,
                avatarUrl = viewModel.avatarUrl,
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
            )
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
                        viewModel.react(emoji)
                        dismissInput()
                    },
                )
                if (typing) {
                    Spacer(Modifier.height(Spacing.s16))
                    Text(
                        text = "${ring?.ring?.author?.firstName ?: ring?.ring?.author?.name ?: "They"} gets your reply in Messages.",
                        color = Color.White.copy(alpha = 0.78f),
                        fontSize = 12.5.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().testTag("moments.viewer.replyHint"),
                    )
                    Spacer(Modifier.height(10.dp))
                } else {
                    Spacer(Modifier.height(Spacing.s6))
                }
            }
            Box(modifier = Modifier.fillMaxWidth().height(BOTTOM_BAR), contentAlignment = Alignment.TopCenter) {
                when {
                    ring == null -> Unit
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
        ToastHost(
            controller = toast,
            modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = Spacing.s16),
        )
    }

    if (reporting) {
        AlertDialog(
            onDismissRequest = { reporting = false },
            title = { Text("Report this Moment?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Text(
                        text = "Reports are reviewed by the Pantopus team. The person isn't told who reported.",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    pulseReportReasons.forEach { (key, label) ->
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
            text = { Text("You won't see each other's Moments or posts, and they can't message you.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmingBlock = false
                        viewModel.blockAuthor()
                    },
                    modifier = Modifier.testTag("moments.blockConfirm"),
                ) { Text("Block", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { confirmingBlock = false }) { Text("Cancel") } },
        )
    }
    if (seenByOpen && moment != null) {
        val storage =
            rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
                if (granted) {
                    scope.launch { toast.show(if (MomentGallerySaver.save(context, moment)) "Saved to Photos" else "Couldn't save it.") }
                } else {
                    toast.show("Allow storage to save it.")
                }
            }
        SeenBySheet(
            moment = moment,
            state = state,
            onDismiss = { seenByOpen = false },
            onSave = {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && !context.canWriteStorage()) {
                    storage.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                } else {
                    scope.launch { toast.show(if (MomentGallerySaver.save(context, moment)) "Saved to Photos" else "Couldn't save it.") }
                }
            },
            onDelete = { confirmingDelete = true },
        )
    }
    if (confirmingDelete) {
        AlertDialog(
            onDismissRequest = { confirmingDelete = false },
            title = { Text("Delete this Moment?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmingDelete = false
                        viewModel.delete { seenByOpen = false }
                    },
                    modifier = Modifier.testTag("moments.seenBy.deleteConfirm"),
                ) { Text("Delete", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { confirmingDelete = false }) { Text("Cancel") } },
        )
    }
}

/** The Moment itself: the photo, the video over its poster, or the text card. */
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
private fun MomentStage(
    moment: MomentDto,
    player: ExoPlayer,
    videoStarted: Boolean,
    onReady: () -> Unit,
    onFailed: () -> Unit,
) {
    when (moment.kind) {
        "text" -> {
            LaunchedEffect(moment.id) { onReady() }
            val background = MomentCardBackground.fromWire(moment.background)
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .momentCardGradient(background)
                        .padding(horizontal = 36.dp, vertical = Spacing.s10)
                        .testTag("moments.viewer.text"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = moment.text.orEmpty(),
                    color = Color.White,
                    fontSize = 29.sp,
                    lineHeight = 37.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
            }
        }
        "video" ->
            Box(modifier = Modifier.fillMaxSize().testTag("moments.viewer.video")) {
                moment.posterUrl?.let { poster ->
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
                model = moment.mediaUrl,
                contentDescription = moment.caption?.let { "Photo: $it" } ?: "Photo",
                contentScale = ContentScale.Crop,
                onSuccess = { onReady() },
                onError = { onFailed() },
                modifier = Modifier.fillMaxSize().testTag("moments.viewer.photo"),
            )
    }
}

/** One bar per Moment in the ring (board V1): watched ones full, the current one filling, the rest empty. */
@Composable
private fun ProgressBars(
    count: Int,
    index: Int,
    progress: Float,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().semantics { contentDescription = "Moment ${index + 1} of $count" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        repeat(count) { bar ->
            val fill =
                when {
                    bar < index -> 1f
                    bar == index -> progress
                    else -> 0f
                }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(PantopusColors.momentBarTrack)
                        .testTag("moments.viewer.bar.$bar"),
            ) {
                Box(modifier = Modifier.fillMaxWidth(fill).height(3.dp).background(Color.White))
            }
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
    avatarUrl: String?,
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
                if (mine) {
                    MomentSelfFace(size = 36.dp, avatarUrl = avatarUrl)
                } else {
                    MomentFace(author = ring.author, size = 36.dp, initialsSize = 13.sp)
                }
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
                    val line =
                        listOfNotNull(
                            place,
                            agoLabel(moment?.createdAt ?: brief?.createdAt),
                            leftLabel(moment?.expiresAt ?: brief?.expiresAt),
                        ).joinToString(" · ")
                    Text(
                        text = line,
                        color = PantopusColors.momentOnStageSecondary,
                        fontSize = 12.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = TextStyle(shadow = STAGE_SHADOW),
                        modifier = Modifier.testTag("moments.viewer.meta"),
                    )
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
                DropdownMenu(expanded = menuOpen, onDismissRequest = onDismissMenu) {
                    DropdownMenuItem(
                        text = { Text("Report") },
                        leadingIcon = { PantopusIconImage(icon = PantopusIcon.Flag, contentDescription = null, size = 18.dp) },
                        onClick = onReport,
                        modifier = Modifier.testTag("moments.menu.report"),
                    )
                    DropdownMenuItem(
                        text = { Text("Mute this person's Moments") },
                        leadingIcon = { PantopusIconImage(icon = PantopusIcon.BellOff, contentDescription = null, size = 18.dp) },
                        onClick = onMute,
                        modifier = Modifier.testTag("moments.menu.mute"),
                    )
                    DropdownMenuItem(
                        text = { Text("Block", color = PantopusColors.error) },
                        leadingIcon = {
                            PantopusIconImage(icon = PantopusIcon.Ban, contentDescription = null, size = 18.dp, tint = PantopusColors.error)
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
        modifier = Modifier.testTag("moments.seenBy"),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5, vertical = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Seen by $count",
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
                SheetButton(
                    icon = PantopusIcon.Download,
                    label = "Save to Photos",
                    tint = PantopusColors.appText,
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
                        text = "No views yet.",
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
 * The viewer's gestures (board V1 note): a tap on the left third goes back and elsewhere forward, a hold pauses, a
 * swipe left or right changes ring, a swipe down closes, a swipe up opens Seen by on your own Moment. [onDrag] follows
 * a downward drag so the Moment can move with the finger.
 */
private fun Modifier.viewerGestures(
    enabled: Boolean,
    onHold: (Boolean) -> Unit,
    onTap: (x: Float, width: Float) -> Unit,
    onSwipeLeft: () -> Unit,
    onSwipeRight: () -> Unit,
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
                while (true) {
                    val event = awaitPointerEvent()
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    travel = change.position - start
                    if (!holding && travel.getDistance() < slop && change.uptimeMillis - startedAt > HOLD_MS) {
                        holding = true
                        onHold(true)
                    }
                    if (abs(travel.y) > abs(travel.x) && travel.y > slop) onDrag(travel.y)
                    if (!change.pressed) break
                    change.consume()
                }
                onDrag(0f)
                if (holding) onHold(false)
                val dx = travel.x
                val dy = travel.y
                when {
                    abs(dx) > swipe && abs(dx) > abs(dy) -> if (dx < 0) onSwipeLeft() else onSwipeRight()
                    dy > swipe && abs(dy) > abs(dx) -> onSwipeDown()
                    dy < -swipe && abs(dy) > abs(dx) -> onSwipeUp()
                    !holding && travel.getDistance() < slop -> onTap(start.x, size.width.toFloat())
                }
            }
        }
    }

/** Light status and navigation icons over the dark stage while it shows; the app's light bars come back after. */
@Composable
internal fun StageSystemBars() {
    val view = LocalView.current
    DisposableEffect(view) {
        val window = view.context.findActivity()?.window
        val controller = window?.let { WindowCompat.getInsetsController(it, view) }
        controller?.isAppearanceLightStatusBars = false
        controller?.isAppearanceLightNavigationBars = false
        onDispose {
            controller?.isAppearanceLightStatusBars = true
            controller?.isAppearanceLightNavigationBars = true
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
private const val FRAME_MS = 50L
private const val HOLD_MS = 180L
private const val SWIPE_DP = 60f
private const val ENDED_NOTICE_MS = 1_200L
private const val MUTED_NOTE_MS = 4_000L
