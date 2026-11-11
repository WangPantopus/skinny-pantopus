@file:Suppress(
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
    "LongMethod",
    "CyclomaticComplexMethod",
)

@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)

package app.pantopus.android.ui.screens.moments.compose

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.compose.placepicker.MediaCaptureLocation
import app.pantopus.android.ui.screens.compose.placepicker.PlacePickerLimits
import app.pantopus.android.ui.screens.compose.placepicker.PlacePickerSheet
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import app.pantopus.android.ui.screens.moments.components.MomentCardBackground
import app.pantopus.android.ui.screens.moments.components.MomentHaptics
import app.pantopus.android.ui.screens.moments.components.StageKeyboardResize
import app.pantopus.android.ui.screens.moments.components.momentCardGradient
import app.pantopus.android.ui.screens.moments.viewer.StageSystemBars
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Posting a Moment (boards P1 to P4): the camera first, with Library (any photo or video) and Text beside it; then the
 * Post sheet over what was made. Location comes first (a Moment pins where you are), then the one-time 18+ question.
 */
@Composable
fun MomentsComposeScreen(
    onClose: () -> Unit,
    viewModel: MomentsComposeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val close by rememberUpdatedState(onClose)
    LaunchedEffect(state.done) { if (state.done) close() }
    StageSystemBars()
    StageKeyboardResize()
    val context = LocalContext.current
    val location =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            if (results.values.any { it }) viewModel.start() else viewModel.locationRefused()
        }
    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    // The document picker, as the Pulse composer picks: the system photo picker hides where a photo was taken, and a
    // library Moment pins there. The 24-hour rule is checked on the picked file.
    val library =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            uri?.let(viewModel::picked)
        }
    val openLibrary = { library.launch(arrayOf("image/*", "video/*")) }
    val mediaLocation =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) viewModel.rereadPickedPlace()
        }
    LaunchedEffect(Unit) {
        val allowed =
            listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }
        if (allowed) {
            viewModel.start()
        } else {
            location.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }
    // Coming back from the system settings with location turned on.
    LifecycleResumeEffect(state.gate) {
        if (state.gate == ComposeGate.NeedsLocation &&
            listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }
        ) {
            viewModel.start()
        }
        onPauseOrDispose { }
    }
    // Closing with something to lose asks first (REVIEW item 8): a written card from the camera or the card, or a photo
    // or video on the Post sheet (Back there goes back to the camera; Retake doesn't ask).
    var asksDiscard by remember { mutableStateOf(false) }
    val closeOrAsk: () -> Unit = {
        if (state.text.isNotBlank()) {
            asksDiscard = true
        } else {
            close()
        }
    }
    BackHandler(enabled = state.step != ComposeStep.Review && state.text.isNotBlank()) { asksDiscard = true }
    BackHandler(enabled = state.step == ComposeStep.Review) {
        if (state.media != null) {
            asksDiscard = true
        } else {
            viewModel.backFromReview()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.momentStage).semantics { testTagsAsResourceId = true }) {
        when (state.step) {
            ComposeStep.Camera ->
                CameraStep(
                    state = state,
                    hasCamera = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
                    askCamera = { cameraPermission.launch(Manifest.permission.CAMERA) },
                    onClose = closeOrAsk,
                    onCaptured = viewModel::captured,
                    onLibrary = openLibrary,
                    onText = { viewModel.showStep(ComposeStep.Text) },
                    onNotice = { message -> if (message != null) viewModel.showNotice(message) else viewModel.clearNotice() },
                )
            ComposeStep.Text ->
                TextStep(
                    state = state,
                    onClose = closeOrAsk,
                    onText = viewModel::setText,
                    onBackground = viewModel::setBackground,
                    onNext = viewModel::textNext,
                    onCamera = { viewModel.showStep(ComposeStep.Camera) },
                    onLibrary = openLibrary,
                )
            ComposeStep.Review ->
                ReviewStep(
                    state = state,
                    avatarUrl = viewModel.avatarUrl,
                    onBack = viewModel::backFromReview,
                    onShowArea = viewModel::setShowArea,
                    onHours = viewModel::setHours,
                    onAudience = viewModel::setAudience,
                    onCaption = viewModel::setCaption,
                    onPost = { viewModel.post() },
                    onPlace = viewModel::pickPlace,
                    onFindPlace = { viewModel.findPlace(true) },
                )
        }
        // The place picker (the Pulse composer's) around the Moment's pin: venues within reach of it, and search.
        val pin = state.pin
        if (state.findingPlace && pin != null) {
            val reach = state.pickWithinM.toDouble()
            PlacePickerSheet(
                currentTag = state.pickedVenue?.let { PostPlaceTag(it.name, null, it.latitude, it.longitude, it.placeId, "poi") },
                onSelect = viewModel::pickVenue,
                onRemove = viewModel::clearVenue,
                onDismiss = { viewModel.findPlace(false) },
                mediaLocation = MediaCaptureLocation(pin.latitude, pin.longitude),
                limits =
                    PlacePickerLimits(anchorChips = false, showLocality = false) { place ->
                        place.placeId?.startsWith("osm:") == true && (place.distanceM ?: Double.MAX_VALUE) <= reach
                    },
            )
        }
        if (asksDiscard) {
            val onSheet = state.step == ComposeStep.Review
            AlertDialog(
                onDismissRequest = { asksDiscard = false },
                title = { Text("Discard this Moment?") },
                text = {
                    Text(
                        when {
                            !onSheet -> "What you wrote won't be saved."
                            state.media is MomentMediaFile.Video -> "Your video won't be saved."
                            else -> "Your photo won't be saved."
                        },
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            asksDiscard = false
                            if (onSheet) viewModel.backFromReview() else close()
                        },
                        modifier = Modifier.testTag("moments.compose.discard"),
                    ) { Text("Discard", color = PantopusColors.error) }
                },
                dismissButton = {
                    TextButton(onClick = { asksDiscard = false }, modifier = Modifier.testTag("moments.compose.keep")) {
                        Text("Keep editing")
                    }
                },
            )
        }
        if (state.askMediaLocation) {
            AlertDialog(
                onDismissRequest = viewModel::mediaLocationAnswered,
                title = { Text("Pin where this photo was taken?") },
                text = {
                    Text(
                        "Android will ask about your photos and videos next. Pantopus still sees only the ones you pick, " +
                            "and this lets it read where they were taken.",
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            viewModel.mediaLocationAnswered()
                            mediaLocation.launch(Manifest.permission.ACCESS_MEDIA_LOCATION)
                        },
                        modifier = Modifier.testTag("moments.mediaLocation.continue"),
                    ) { Text("Continue") }
                },
                dismissButton = {
                    TextButton(onClick = viewModel::mediaLocationAnswered, modifier = Modifier.testTag("moments.mediaLocation.notNow")) {
                        Text("Not now")
                    }
                },
            )
        }
        when (state.gate) {
            ComposeGate.NeedsLocation ->
                GateCard(
                    title = "Turn on location",
                    body = state.notice ?: "A Moment pins where you are when you post it. Pantopus never shows your live location.",
                    primary = "Allow location",
                    onPrimary = {
                        location.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                    },
                    secondary = "Open Settings",
                    onSecondary = {
                        runCatching {
                            context.startActivity(
                                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                            )
                        }
                    },
                    onClose = close,
                )
            ComposeGate.NeedsAdult ->
                AdultSheet(
                    onConfirm = {
                        viewModel.confirmAdult(then = if (state.step == ComposeStep.Review) ({ viewModel.post() }) else null)
                    },
                    onNotNow = close,
                )
            ComposeGate.NotEligible ->
                AlertDialog(
                    onDismissRequest = close,
                    title = { Text("Moments are for people 18 and older.") },
                    confirmButton = { TextButton(onClick = close) { Text("OK") } },
                )
            ComposeGate.Locating, ComposeGate.Open -> Unit
        }
    }
}

/** P1: the live camera with the place chip ("pins at"), the shutter, the library, flash and the other lens. */
@Composable
private fun CameraStep(
    state: MomentsComposeUiState,
    hasCamera: Boolean,
    askCamera: () -> Unit,
    onClose: () -> Unit,
    onCaptured: (MomentMediaFile) -> Unit,
    onLibrary: () -> Unit,
    onText: () -> Unit,
    onNotice: (String?) -> Unit,
) {
    LaunchedEffect(hasCamera, state.gate) { if (!hasCamera && state.gate == ComposeGate.Open) askCamera() }
    val controller = remember { MomentsCameraController() }
    var front by remember { mutableStateOf(false) }
    var flash by remember { mutableStateOf(false) }
    var recording by remember { mutableStateOf(false) }
    // How long the video has run, for "0:07" over the shutter.
    var recordedSeconds by remember { mutableIntStateOf(0) }
    val view = LocalView.current
    LaunchedEffect(recording) {
        recordedSeconds = 0
        if (!recording) return@LaunchedEffect
        // A video starting is a tap you can feel; so is its stopping, below.
        MomentHaptics.firm(view)
        val started = System.currentTimeMillis()
        while (true) {
            recordedSeconds = ((System.currentTimeMillis() - started) / 1000).toInt()
            delay(200)
        }
    }
    var granted by remember { mutableStateOf(hasCamera) }
    val context = LocalContext.current
    LifecycleResumeEffect(Unit) {
        granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        onPauseOrDispose { }
    }
    Box(modifier = Modifier.fillMaxSize().testTag("moments.camera")) {
        if (granted && state.gate == ComposeGate.Open) {
            MomentsCameraPreview(
                controller = controller,
                front = front,
                flash = flash,
                onCaptured = onCaptured,
                onRecording = {
                    if (recording && !it) MomentHaptics.firm(view)
                    recording = it
                },
                onFailed = onNotice,
                modifier = Modifier.fillMaxSize(),
            )
        } else if (!granted) {
            Column(
                modifier = Modifier.align(Alignment.Center).padding(horizontal = Spacing.s8).testTag("moments.camera.unavailable"),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Text(
                    text = "Allow the camera to take a Moment",
                    color = Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "Or choose from your library, or write a text card.",
                    color = PantopusColors.momentOnStageSecondary,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                )
                OutlinePill(label = "Allow camera", onClick = askCamera)
            }
        }
        // The fades keep the controls readable over a bright scene.
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(170.dp)
                    .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.5f), Color.Transparent)))
                    .clearAndSetSemantics {},
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(300.dp)
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.6f))))
                    .clearAndSetSemantics {},
        )
        Row(
            modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(start = Spacing.s2, end = Spacing.s2, top = 9.dp).height(48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            StageIcon(
                icon = PantopusIcon.X,
                label = "Close",
                onClick = onClose,
                size = 26.dp,
                modifier = Modifier.testTag("moments.camera.close"),
            )
            Spacer(Modifier.weight(1f))
            PlaceChip(
                label = state.chipPlace,
                locating = state.gate == ComposeGate.Locating,
                modifier = Modifier.testTag("moments.camera.place"),
            )
            Spacer(Modifier.weight(1f))
            StageIcon(
                icon = if (flash) PantopusIcon.Zap else PantopusIcon.ZapOff,
                label = if (flash) "Flash on" else "Flash off",
                onClick = { flash = !flash },
                modifier = Modifier.testTag("moments.camera.flash"),
            )
        }
        Column(
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(bottom = Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val notice = state.notice
            Text(
                text =
                    notice ?: if (recording) {
                        "0:${recordedSeconds.toString().padStart(2, '0')} · let go to stop"
                    } else {
                        "Tap for a photo. Hold for a video up to 30 seconds."
                    },
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                style = TextStyle(shadow = androidx.compose.ui.graphics.Shadow(Color.Black.copy(alpha = 0.6f), blurRadius = 3f)),
                modifier = Modifier.padding(horizontal = Spacing.s6),
            )
            Spacer(Modifier.height(Spacing.s5))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s10),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier =
                        Modifier
                            .momentsLibraryFrame(onLibrary)
                            .testTag("moments.camera.library")
                            .clearAndSetSemantics {
                                contentDescription = "Choose from your library"
                                role = Role.Button
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(icon = PantopusIcon.Image, contentDescription = null, size = 22.dp, tint = Color.White)
                }
                Spacer(Modifier.weight(1f))
                MomentsShutter(
                    recording = recording,
                    onPhoto = {
                        if (granted) {
                            MomentHaptics.light(view)
                            controller.takePhoto?.invoke()
                        }
                    },
                    onStartVideo = { if (granted) controller.startVideo?.invoke() },
                    onStopVideo = { controller.stopVideo?.invoke() },
                )
                Spacer(Modifier.weight(1f))
                Box(
                    modifier =
                        Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.momentCameraChip)
                            .clickable(role = Role.Button) { front = !front }
                            .testTag("moments.camera.switch")
                            .clearAndSetSemantics {
                                contentDescription = "Switch camera"
                                role = Role.Button
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 22.dp, tint = Color.White)
                }
            }
            Spacer(Modifier.height(21.dp))
            ModeTabs(selected = "camera", onLibrary = onLibrary, onCamera = {}, onText = onText)
        }
    }
}

/** P2: the text card editor — the words in the middle, the x/200 count, the six backgrounds, and Next. */
@Composable
private fun TextStep(
    state: MomentsComposeUiState,
    onClose: () -> Unit,
    onText: (String) -> Unit,
    onBackground: (MomentCardBackground) -> Unit,
    onNext: () -> Unit,
    onCamera: () -> Unit,
    onLibrary: () -> Unit,
) {
    val focus = remember { FocusRequester() }
    LaunchedEffect(state.gate) { if (state.gate == ComposeGate.Open) runCatching { focus.requestFocus() } }
    val density = LocalDensity.current
    val keyboardPx = WindowInsets.ime.getBottom(density)
    val belowPx = WindowInsets.navigationBars.getBottom(density)
    val keyboardPadding = with(density) { (keyboardPx - belowPx).coerceAtLeast(0).toDp() }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .momentCardGradient(state.background)
                .padding(bottom = keyboardPadding)
                .testTag("moments.textCard"),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(start = Spacing.s2, end = Spacing.s3, top = 9.dp).height(48.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            StageIcon(
                icon = PantopusIcon.X,
                label = "Close",
                onClick = onClose,
                size = 26.dp,
                modifier = Modifier.testTag("moments.camera.close"),
            )
            Spacer(Modifier.weight(1f))
            PlaceChip(label = state.chipPlace, locating = state.gate == ComposeGate.Locating, light = true)
            Spacer(Modifier.weight(1f))
            // Next waits for the fix the card pins at.
            val canGo = state.text.isNotBlank() && state.here != null
            Text(
                text = "Next",
                color = state.background.top.copy(alpha = if (canGo) 1f else 0.5f),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                modifier =
                    Modifier
                        .heightIn(min = 36.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color.White.copy(alpha = if (canGo) 1f else 0.6f))
                        .clickable(enabled = canGo, role = Role.Button, onClick = onNext)
                        .padding(horizontal = 18.dp, vertical = Spacing.s2)
                        .testTag("moments.textCard.next"),
            )
        }
        Box(modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = Spacing.s8), contentAlignment = Alignment.Center) {
            BasicTextField(
                value = state.text,
                onValueChange = onText,
                textStyle =
                    TextStyle(
                        color = Color.White,
                        fontSize = 29.sp,
                        lineHeight = 37.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    ),
                cursorBrush = SolidColor(Color.White),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .focusRequester(focus)
                        .testTag("moments.textCard.field")
                        .semantics { contentDescription = "Your text" },
                decorationBox = { field ->
                    Box(contentAlignment = Alignment.Center) {
                        if (state.text.isEmpty()) {
                            Text(
                                text = "What's happening here?",
                                color = Color.White.copy(alpha = 0.6f),
                                fontSize = 29.sp,
                                lineHeight = 37.sp,
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center,
                            )
                        }
                        field()
                    }
                },
            )
        }
        Text(
            text = "${state.text.length} / 200",
            color = Color.White.copy(alpha = 0.78f),
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().testTag("moments.textCard.count"),
        )
        Spacer(Modifier.height(Spacing.s3))
        // Picking a color is part of writing the card: the keyboard stays up.
        Row(
            modifier = Modifier.keepsKeyboard().fillMaxWidth().height(44.dp).semantics { contentDescription = "Background color" },
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MomentCardBackground.entries.forEach { background ->
                val on = background == state.background
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clickable(role = Role.RadioButton) { onBackground(background) }
                            .testTag("moments.textCard.bg.${background.wire}")
                            .clearAndSetSemantics {
                                contentDescription = background.label
                                role = Role.RadioButton
                                selected = on
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(if (on) 34.dp else 28.dp)
                                .clip(CircleShape)
                                .background(background.top)
                                .border(if (on) 3.dp else 2.dp, Color.White.copy(alpha = if (on) 1f else 0.85f), CircleShape),
                    )
                }
            }
        }
        Spacer(Modifier.height(Spacing.s3))
        ModeTabs(selected = "text", onLibrary = onLibrary, onCamera = onCamera, onText = {})
        Spacer(Modifier.height(Spacing.s3))
    }
}

/** P3 and P4: the Post sheet over what was made, with Retake (or Edit for a text card) above it. */
@Composable
private fun ReviewStep(
    state: MomentsComposeUiState,
    avatarUrl: String?,
    onBack: () -> Unit,
    onShowArea: (Boolean) -> Unit,
    onHours: (Int) -> Unit,
    onAudience: (String) -> Unit,
    onCaption: (String) -> Unit,
    onPost: () -> Unit,
    onPlace: (String) -> Unit,
    onFindPlace: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        when (val media = state.media) {
            is MomentMediaFile.Photo ->
                AsyncImage(
                    model = media.file,
                    contentDescription = "Your photo",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            is MomentMediaFile.Video -> VideoStill(media)
            null ->
                Box(
                    modifier = Modifier.fillMaxSize().momentCardGradient(state.background).statusBarsPadding().padding(top = 54.dp),
                    contentAlignment = Alignment.TopCenter,
                ) {
                    Text(
                        text = state.text,
                        color = Color.White,
                        fontSize = 24.sp,
                        lineHeight = 31.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        maxLines = 4,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 36.dp),
                    )
                }
        }
        if (state.media != null) Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.3f)).clearAndSetSemantics {})
        Row(
            modifier =
                Modifier
                    .statusBarsPadding()
                    .padding(start = Spacing.s3, top = 11.dp)
                    .height(40.dp)
                    .clip(RoundedCornerShape(Radii.xl2))
                    .background(if (state.media != null) PantopusColors.momentCameraChip else Color.Black.copy(alpha = 0.25f))
                    .clickable(role = Role.Button, onClick = onBack)
                    .padding(start = Spacing.s2, end = 14.dp)
                    .testTag("moments.post.retake"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = null,
                size = 20.dp,
                strokeWidth = 2.2f,
                tint = Color.White,
            )
            Text(
                text = if (state.media != null) "Retake" else "Edit",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
        MomentsPostSheet(
            state = state,
            avatarUrl = avatarUrl,
            onShowArea = onShowArea,
            onHours = onHours,
            onAudience = onAudience,
            onCaption = onCaption,
            onPost = onPost,
            modifier = Modifier.align(Alignment.BottomCenter),
            onPlace = onPlace,
            onFindPlace = onFindPlace,
        )
    }
}

/** A video's first frame behind the Post sheet. */
@Composable
private fun VideoStill(media: MomentMediaFile.Video) {
    val still by produceState<android.graphics.Bitmap?>(null, media.file) {
        value =
            withContext(Dispatchers.IO) {
                runCatching {
                    val retriever = MediaMetadataRetriever()
                    try {
                        retriever.setDataSource(media.file.path)
                        retriever.getFrameAtTime(0)
                    } finally {
                        retriever.release()
                    }
                }.getOrNull()
            }
    }
    still?.let {
        androidx.compose.foundation.Image(
            bitmap = it.asImageBitmap(),
            contentDescription = "Your video",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

/** Library · Camera · Text (board P1): the selected one in a soft pill. */
@Composable
private fun ModeTabs(
    selected: String,
    onLibrary: () -> Unit,
    onCamera: () -> Unit,
    onText: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().height(44.dp),
        horizontalArrangement = Arrangement.spacedBy(26.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val tabs = listOf(Triple("library", "Library", onLibrary), Triple("camera", "Camera", onCamera), Triple("text", "Text", onText))
        tabs.forEach { (key, label, open) ->
            val on = key == selected
            Text(
                text = label,
                color = if (on) Color.White else Color.White.copy(alpha = 0.7f),
                fontSize = 15.sp,
                fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .background(if (on) PantopusColors.momentModeSelected else Color.Transparent)
                        .clickable(role = Role.Tab, onClick = open)
                        .padding(horizontal = if (on) 14.dp else Spacing.s1, vertical = Spacing.s3)
                        .testTag("moments.compose.$key")
                        .semantics { this.selected = on },
            )
        }
    }
}

/** "pins at Esther Short Park" (board P1): where the Moment will pin, before anything is taken. */
@Composable
private fun PlaceChip(
    label: String?,
    locating: Boolean,
    modifier: Modifier = Modifier,
    light: Boolean = false,
) {
    val text = label ?: if (locating) "Finding where you are…" else "Your location"
    Row(
        modifier =
            modifier
                .height(if (light) 34.dp else 36.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(if (light) Color.Black.copy(alpha = 0.22f) else PantopusColors.momentCameraChip)
                .padding(start = 10.dp, end = 14.dp)
                .clearAndSetSemantics { contentDescription = "This Moment will pin at ${if (text == HOME_CHIP) "your home" else text}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.MapPin, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(
            text = text,
            color = Color.White,
            fontSize = if (light) 13.5.sp else 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun StageIcon(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 24.dp,
) {
    Box(
        modifier =
            modifier
                .size(44.dp)
                .clickable(role = Role.Button, onClick = onClick)
                .clearAndSetSemantics {
                    contentDescription = label
                    role = Role.Button
                },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = size, tint = Color.White)
    }
}

@Composable
private fun OutlinePill(
    label: String,
    onClick: () -> Unit,
) {
    Text(
        text = label,
        color = Color.White,
        fontSize = 15.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .border(1.dp, PantopusColors.momentReplyOutline, RoundedCornerShape(Radii.pill))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s5, vertical = 10.dp),
    )
}

/** The location question over the camera: a Moment pins where you are, so posting needs it. */
@Composable
private fun GateCard(
    title: String,
    body: String,
    primary: String,
    onPrimary: () -> Unit,
    secondary: String,
    onSecondary: () -> Unit,
    onClose: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)).blocksTouches()) {
        StageIcon(
            icon = PantopusIcon.X,
            label = "Close",
            onClick = onClose,
            size = 26.dp,
            modifier = Modifier.statusBarsPadding().padding(start = Spacing.s2, top = 9.dp),
        )
        Column(
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = Spacing.s6)
                    .clip(RoundedCornerShape(Radii.xl3))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s5),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(title, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(body, fontSize = 15.sp, lineHeight = 21.sp, color = PantopusColors.appTextSecondary)
            SheetPrimaryButton(label = primary, onClick = onPrimary)
            Text(
                text = secondary,
                color = PantopusColors.primary600,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onSecondary).padding(vertical = 10.dp),
            )
        }
    }
}

/** The one-time 18+ question (MOMLEAD 20:45Z): "Before your first Moment", once, before the camera. */
@Composable
private fun AdultSheet(
    onConfirm: () -> Unit,
    onNotNow: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.55f)).blocksTouches().testTag("moments.adult")) {
        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = Radii.xl3, topEnd = Radii.xl3))
                    .background(PantopusColors.appSurface)
                    .padding(start = Spacing.s5, end = Spacing.s5, top = Spacing.s6, bottom = Spacing.s8),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text("Before your first Moment", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text("Moments are for people 18 and older.", fontSize = 15.sp, lineHeight = 21.sp, color = PantopusColors.appTextSecondary)
            Spacer(Modifier.height(Spacing.s1))
            SheetPrimaryButton(label = "I'm 18 or older", onClick = onConfirm, modifier = Modifier.testTag("moments.adult.confirm"))
            Text(
                text = "Not now",
                color = PantopusColors.appText,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(role = Role.Button, onClick = onNotNow)
                        .padding(vertical = Spacing.s3)
                        .testTag("moments.adult.notNow"),
            )
        }
    }
}

/**
 * Nothing under a gate (location, 18+) can be tapped while it is up: the shutter, Library and Text wait behind it
 * (REVIEW P5).
 */
private fun Modifier.blocksTouches(): Modifier = pointerInput(Unit) { detectTapGestures { } }

@Composable
internal fun SheetPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(50.dp)
                .clip(RoundedCornerShape(25.dp))
                .background(if (enabled) PantopusColors.primary600 else PantopusColors.primary600.copy(alpha = 0.5f))
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    }
}
