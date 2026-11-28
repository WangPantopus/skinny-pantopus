@file:Suppress("MagicNumber", "LongParameterList", "LongMethod")

package app.pantopus.android.ui.screens.moments.studio

import android.graphics.Bitmap
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.exclude
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.moments.MomentDotDto
import app.pantopus.android.data.api.models.moments.MomentPlayItemDto
import app.pantopus.android.data.api.models.moments.MomentStampPlacement
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.ui.screens.feed.reinvented.after.StudioPostKindRow
import app.pantopus.android.ui.screens.feed.reinvented.after.TogetherStudioGhost
import app.pantopus.android.ui.screens.feed.reinvented.after.studioPostPill
import app.pantopus.android.ui.screens.moments.components.MomentCardBackground
import app.pantopus.android.ui.screens.moments.components.momentCardGradient
import app.pantopus.android.ui.screens.moments.components.movingWords
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.screens.moments.compose.MomentsPostFullMap
import app.pantopus.android.ui.screens.moments.compose.MomentsPostSheet
import app.pantopus.android.ui.screens.moments.compose.MomentsSkyActions
import app.pantopus.android.ui.screens.moments.compose.VideoStill
import app.pantopus.android.ui.screens.moments.compose.marks.MomentLook
import app.pantopus.android.ui.screens.moments.compose.marks.MomentMarksTool
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacement
import app.pantopus.android.ui.screens.moments.compose.marks.MomentPlacementPainter
import app.pantopus.android.ui.screens.moments.compose.postAtHome
import app.pantopus.android.ui.screens.moments.compose.postMapSpot
import app.pantopus.android.ui.screens.moments.compose.postPlaceKind
import app.pantopus.android.ui.screens.moments.compose.postPlaceLabel
import app.pantopus.android.ui.screens.moments.compose.sharesAt
import app.pantopus.android.ui.screens.moments.compose.skyAtHome
import app.pantopus.android.ui.screens.moments.compose.skyPlaceName
import app.pantopus.android.ui.screens.pennames.PenNameChoiceViewModel
import app.pantopus.android.ui.screens.pennames.PenNamePostAsUi
import app.pantopus.android.ui.screens.pennames.PenNameSetupSheet
import app.pantopus.android.ui.screens.pennames.PenNameVoice
import app.pantopus.android.ui.sky.SkyWords
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/** The two "who sees it" choices on the Studio's bar, as the server names them (today's Post sheet's two). */
private val AUDIENCES = listOf("nearby" to "Nearby", "connections" to "Friends")

/** Letters over the picture keep a shadow strong enough to read over a bright sky or snow. */
private val OnPicture = Shadow(Color.Black.copy(alpha = 0.75f), blurRadius = 10f)

/**
 * "Pulse, reinvented" (board B2), while the `pulse_reinvented` switch is on: the Studio after a shot. The photo or
 * video fills the screen, with a tool rail on the right, the caption written on the picture and one bar at the
 * bottom: who sees it (Nearby, Friends), a pill with how long it shows and where ("Fades in 24 hours" over the place),
 * and Post. The pill opens a drawer holding every row of today's Post sheet (the map and the place, Show the area
 * instead, No location, height, weather, Share later, how long). It reads and writes the same posting state as
 * today's Post sheet, so a Moment posted here is an ordinary Moment.
 *
 * Built beside today's Post screen, never in place of it: with the switch off, the composer shows today's.
 */
@Composable
internal fun MomentsStudioStep(
    state: MomentsComposeUiState,
    avatarUrl: String?,
    onBack: () -> Unit,
    onMarks: (MomentMarksTool) -> Unit,
    onShowArea: (Boolean) -> Unit,
    onHours: (Int) -> Unit,
    onAudience: (String) -> Unit,
    onCaption: (String) -> Unit,
    onPost: () -> Unit,
    onPlace: (String) -> Unit,
    onFindPlace: () -> Unit,
    onNoLocation: (Boolean) -> Unit,
    onShowHeight: (Boolean) -> Unit,
    onShowWeather: (Boolean) -> Unit,
    sky: MomentsSkyActions,
    onMadeUp: (Boolean) -> Unit = {},
    onStamps: (List<MomentStampPlacement>) -> Unit = {},
    onGuess: (Boolean) -> Unit = {},
    // Film looks (step 5): put one on the photo; the tray opened (the photo as it came is read for the looks' copies).
    onLook: (MomentLook) -> Unit = {},
    onPhotostrip: () -> Unit = {},
    onTrayOpen: () -> Unit = {},
    lookPicture: StateFlow<Bitmap?> = NO_LOOK_PICTURE,
    // Cutouts (step 4): a long press on the photo lifts one; "Your cutouts" in the tray places one.
    onLiftCutout: (Float, Float) -> Unit = { _, _ -> },
    onPlaceCutout: (File) -> Unit = {},
    // Mentions (step 5, CONTRACT 7h): a person picked after "@" in the caption.
    onMention: (StudioMention) -> Unit = {},
    // Before and after (step 5, CONTRACT 7g): make one from the next photo picked, its two words, take it apart.
    beforeAfter: StudioBeforeAfterActions = StudioBeforeAfterActions(),
    // Illuminate (phase 2, CONTRACT 7c): the dots as they are now.
    onDots: (List<MomentDotDto>) -> Unit = {},
    // Playable items (phase 2, CONTRACT 7b, 7k: moving words so far): the items as they are now.
    onItems: (List<MomentPlayItemDto>) -> Unit = {},
    // See the picture first (PHASE-5 A, CONTRACT 10c): the photo shows and posts whole on these colours; moved there.
    onWhole: (MomentPlacementPainter.Backdrop) -> Unit = {},
    onPlaceWhole: (MomentPlacement?, IntSize) -> Unit = { _, _ -> },
    gate: MomentsStudioGateViewModel = hiltViewModel(),
    penNames: PenNameChoiceViewModel = hiltViewModel(),
) {
    var drawer by rememberSaveable { mutableStateOf(false) }
    // "Stamps and Play" (step 3): the tray of stamps Pantopus checked.
    var tray by rememberSaveable { mutableStateOf(false) }
    // Illuminate (phase 2): its panel, and the dot it shows.
    var illuminate by rememberSaveable { mutableStateOf(false) }
    var pickedDot by rememberSaveable { mutableStateOf<String?>(null) }
    // Moving words (CONTRACT 7k): their form, and the item it changes (null: a new one).
    var wordsForm by rememberSaveable { mutableStateOf(false) }
    var wordsItem by rememberSaveable { mutableStateOf<String?>(null) }
    // A poll or a countdown (CONTRACT 7b): its form, the kind of a new one, and the item it changes.
    var playForm by rememberSaveable { mutableStateOf(false) }
    var playKind by rememberSaveable { mutableStateOf<String?>(null) }
    var playItem by rememberSaveable { mutableStateOf<String?>(null) }
    // "Made-up name" (made-up-names contract, "Moments"): offered once `/api/pen-names/me` has answered, checked at the pin.
    val postAs by penNames.postAs.collectAsStateWithLifecycle()
    val setupOpen by penNames.setupOpen.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { penNames.load() }
    LaunchedEffect(state.pin?.latitude, state.pin?.longitude) { penNames.checkAt(state.pin?.latitude, state.pin?.longitude) }
    // What the bar shows picked is what goes with the post (a made-up name no longer allowed here goes back to the person's own).
    val madeUp = postAs?.isMadeUp == true
    LaunchedEffect(madeUp) { onMadeUp(madeUp) }
    // Why the made-up name can't be picked, after a tap on it (the server's words).
    var refused by remember { mutableStateOf<String?>(null) }
    // A tap on the drawer's small map opens it full screen; its back button (or Back) returns to the drawer.
    var fullMap by rememberSaveable { mutableStateOf(false) }
    BackHandler(enabled = drawer && !fullMap) { drawer = false }
    BackHandler(enabled = fullMap && state.postMapSpot != null) { fullMap = false }
    // Under the marks editor, TalkBack reads only the editor.
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("moments.studio")
                .then(if (state.marking != null) Modifier.clearAndSetSemantics {} else Modifier),
    ) {
        val pair = state.studioPair
        // A photo shows whole, on its own colours (PHASE-5 A); a video, a text card and before and after as before.
        val whole = rememberStudioWhole(state, lookPicture, read = onTrayOpen, onWhole = onWhole)
        val wholeLive = remember { mutableStateOf<MomentPlacement?>(null) }
        // The canvas fits between the status bar and the bottom bar, which never covers it (PHASE-6 K1).
        var barHeight by remember { mutableIntStateOf(0) }
        val room = StudioRoom(top = WindowInsets.statusBars.getTop(LocalDensity.current).toFloat(), bottom = barHeight.toFloat())
        StudioPictureAndLayers(
            whole = whole,
            state = state,
            live = wholeLive,
            onPlace = onPlaceWhole,
            room = room,
            picture = { if (pair != null) StudioBeforeAfterPicture(pair) else StudioPicture(state) },
        ) {
            TogetherStudioGhost(state)
            if (pair == null) StudioCutoutPress(state, onLift = onLiftCutout)
        }
        // The fades keep the rail and the caption readable over a bright picture.
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .background(Brush.verticalGradient(listOf(PantopusColors.momentTopFade, Color.Transparent)))
                    .clearAndSetSemantics {},
        )
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(320.dp)
                    .background(Brush.verticalGradient(listOf(Color.Transparent, PantopusColors.momentDim)))
                    .clearAndSetSemantics {},
        )
        StudioClose(
            enabled = state.canRetake,
            card = state.media == null,
            onClick = onBack,
            // While an item is dragged the X and the tools fade and take no touches (PHASE-6 K3).
            modifier = Modifier.fadesWhileAnItemMoves().statusBarsPadding().padding(start = Spacing.s4, top = 11.dp),
        )
        // Text, Draw and Resize change a photo or a video; Stamps and Play reads the spot, so it needs a place (a text
        // card has only Stamps and Play).
        StudioRail(
            enabled = !state.posting,
            // Before and after takes stamps only: its words and drawings are drawn in.
            media = state.media.takeIf { pair == null },
            onOpen = { tool -> openMarksOnCanvas(tool, whole, state, wholeLive, onPlaceWhole, onMarks) },
            onStamps =
                {
                    tray = true
                    onTrayOpen()
                }.takeIf { !state.noLocationOn },
            onIlluminate = { illuminate = true }.takeIf { state.media != null },
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .fadesWhileAnItemMoves()
                    .statusBarsPadding()
                    .padding(end = Spacing.s4, top = 11.dp),
        )
        // The items on the picture: over the X and the tools, so an item under one gets the touch (PHASE-6 K3), and under
        // the caption and the bar.
        StudioItemsOver(whole, state, room) {
            // A swatch slider's part of the photo (CONTRACT 7g), under the stamps and items.
            StudioSwatchBoxLayer(state.items, rememberStudioPicture(state), enabled = !state.posting, onItems = onItems) { id ->
                playItem = id
                playForm = true
            }
            StudioStampLayer(state = state, onStamps = onStamps)
            StudioDotLayer(state.dots, rememberStudioPicture(state), enabled = !state.posting, onDots = onDots) { id ->
                pickedDot = id
                illuminate = true
            }
            StudioPlayLayer(state.items, rememberStudioPicture(state), enabled = !state.posting, onItems = onItems) { id ->
                // Moving words open their own form; a poll or a countdown opens the play form.
                val words = state.items.any { it.id == id && it.movingWords }
                wordsItem = id.takeIf { words }
                wordsForm = words
                playItem = id.takeUnless { words }
                playForm = !words
            }
        }
        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    // The caption and the bar ride above the keyboard while the caption is typed (the bar pads itself for
                    // the navigation bar, so its color reaches the bottom edge).
                    .windowInsetsPadding(WindowInsets.ime.exclude(WindowInsets.navigationBars)),
        ) {
            state.notice?.let { notice ->
                Text(
                    text = notice,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s4)
                            .clip(RoundedCornerShape(12.dp))
                            .background(PantopusColors.momentCaptionPill)
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                            .testTag("moments.studio.error"),
                )
                Spacer(Modifier.height(Spacing.s3))
            }
            // "Pulse, reinvented" one camera: "+ Ask / Kind" makes the picture or the words one of today's Pulse posts.
            StudioPostKindRow(state, Modifier.padding(horizontal = Spacing.s4).padding(bottom = Spacing.s3))
            // "Guess the spot" picked: what others will see.
            StudioGuessLine(state)
            // A whole photo: Fill or Fit, and Reset (PHASE-5 A).
            StudioWholeRow(state, whole, wholeLive, onPlaceWhole, Modifier.padding(start = Spacing.s4, bottom = Spacing.s3))
            // A motion photo: "Keep the motion" (PHASE-5 C).
            StudioMotionRow(state, Modifier.padding(start = Spacing.s4, bottom = Spacing.s3))
            // A caption goes with a photo or a video; a text card is its own words.
            if (state.media != null) {
                // After "@" at the end of the caption: the author's connections (never under a made-up name).
                StudioMentionRow(
                    caption = state.caption,
                    madeUp = state.madeUp,
                    onPick = { person ->
                        onCaption(captionWithMention(state.caption, person))
                        onMention(person)
                    },
                    modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s2),
                )
                StudioCaption(
                    caption = state.caption,
                    enabled = !state.posting,
                    onCaption = onCaption,
                    modifier = Modifier.padding(horizontal = Spacing.s4),
                )
                Spacer(Modifier.height(Spacing.s4))
            }
            Box(modifier = Modifier.onSizeChanged { barHeight = it.height }) {
                StudioBar(
                    state = state,
                    homeNoteDue = gate.homeNoteDue,
                    onHomeNoteShown = gate::homeNoteShown,
                    postAs = postAs,
                    refused = refused,
                    onOpenDrawer = { drawer = true },
                    onPost = onPost,
                )
            }
        }
        // The drawer: today's Post sheet, without what the bar already holds (who sees it, the caption, Post).
        AnimatedVisibility(visible = drawer, enter = fadeIn(), exit = fadeOut()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.momentDim)
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { drawer = false }
                        .semantics {
                            contentDescription = "Close"
                            role = Role.Button
                        },
            )
        }
        AnimatedVisibility(
            visible = drawer,
            enter = slideInVertically { it },
            exit = slideOutVertically { it },
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            // See the picture first (PHASE-5 A): who sees it is the drawer's first row; the bar keeps one line and Post.
            Column(modifier = Modifier.statusBarsPadding().padding(top = 64.dp)) {
                StudioWhoSeesIt(
                    state = state,
                    postAs = postAs,
                    refused = refused,
                    onAudience = { key ->
                        refused = null
                        penNames.choose(PenNameVoice.Own)
                        onAudience(key)
                    },
                    onMadeUp = {
                        refused =
                            when {
                                state.noLocationLocked -> MADE_UP_NEEDS_PLACE
                                else -> postAs?.refusal?.ifBlank { MADE_UP_NOT_HERE }
                            }
                        if (refused == null) penNames.choose(PenNameVoice.MadeUp)
                    },
                    onClose = { drawer = false },
                )
                MomentsPostSheet(
                    state = state,
                    avatarUrl = avatarUrl,
                    onShowArea = onShowArea,
                    onHours = onHours,
                    onAudience = onAudience,
                    onCaption = onCaption,
                    onPost = onPost,
                    modifier = Modifier.testTag("moments.studio.drawer"),
                    onPlace = onPlace,
                    onFindPlace = onFindPlace,
                    onNoLocation = onNoLocation,
                    onShowHeight = onShowHeight,
                    onShowWeather = onShowWeather,
                    sky = sky,
                    onOpenMap = { fullMap = true },
                    studio = true,
                )
            }
        }
        StudioStampTray(
            visible = tray,
            state = state,
            onStamps = onStamps,
            onDone = { tray = false },
            onGuess = onGuess,
            onLook = onLook,
            lookPicture = lookPicture,
            onPhotostrip = {
                tray = false
                onPhotostrip()
            },
            onPlaceCutout = { file ->
                tray = false
                onPlaceCutout(file)
            },
            cutoutsAccount = gate.account,
            onMovingWords =
                {
                    tray = false
                    wordsItem = null
                    wordsForm = true
                }.takeIf { state.offersMovingWords },
            onPlayKind =
                { kind: String ->
                    tray = false
                    playKind = kind
                    playItem = null
                    playForm = true
                }.takeIf { state.offersPlayCards },
            beforeAfter =
                beforeAfter.copy(
                    make = {
                        tray = false
                        beforeAfter.make()
                    },
                ),
        )
        StudioIlluminate(
            visible = illuminate,
            dots = state.dots,
            picked = pickedDot,
            madeUp = state.madeUp,
            onPick = { pickedDot = it },
            onDots = onDots,
            onDone = { illuminate = false },
        )
        StudioMovingWordsPanel(
            visible = wordsForm,
            editing = wordsItem,
            items = state.items,
            onItems = onItems,
            onDone = { wordsForm = false },
        )
        StudioPlayPanel(
            visible = playForm,
            kind = playKind,
            editing = playItem,
            items = state.items,
            onItems = onItems,
            onDone = { playForm = false },
        )
        if (fullMap) {
            state.postMapSpot?.let { spot ->
                MomentsPostFullMap(
                    spot = spot,
                    avatarUrl = avatarUrl,
                    placeLabel = state.postPlaceLabel,
                    placeKind = state.postPlaceKind,
                    atHome = (state.postAtHome && !state.showArea) || state.skyAtHome,
                    onBack = { fullMap = false },
                )
            }
        }
        // The first time, today's name screen (the one Pulse's "Post as" opens): a name kept here is picked at once.
        if (setupOpen) PenNameSetupSheet(replace = false, onDone = penNames::onTaken, onDismiss = penNames::dismissSetup)
    }
}

/**
 * The X at the top left: back to the camera, as today's Retake (it asks first when something would be lost); for a
 * text card, back to the card's words, as today's Edit.
 */
@Composable
private fun StudioClose(
    enabled: Boolean,
    card: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(44.dp)
                .alpha(if (enabled) 1f else 0.5f)
                .clip(CircleShape)
                .background(PantopusColors.momentCameraChip)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .testTag("moments.studio.close")
                .semantics { contentDescription = if (card) "Back to your card" else "Back to the camera" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = 20.dp, strokeWidth = 2.2f, tint = Color.White)
    }
}

/**
 * The tool rail (board B2): each tool's name beside its round button, in iPhone's order: Text, Stamps and Play, Draw,
 * Resize. Text, Draw and Resize open today's marks editor on a photo or video; Stamps and Play opens the tray. The tools
 * of later steps join the rail as they are built; a tool that can't be used here isn't drawn.
 */
@Composable
private fun StudioRail(
    enabled: Boolean,
    media: MomentMediaFile?,
    onOpen: (MomentMarksTool) -> Unit,
    onStamps: (() -> Unit)?,
    onIlluminate: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    if (media == null && onStamps == null && onIlluminate == null) return
    Column(
        modifier = modifier.semantics { contentDescription = "Tools" },
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        if (media != null) MarksTool(MomentMarksTool.Text, media, enabled, onOpen)
        if (onStamps != null) {
            RailTool(label = "Stamps and Play", spoken = "Stamps and Play", enabled = enabled, tag = "stamps", onClick = onStamps) {
                PantopusIconImage(
                    icon = PantopusIcon.Stamp,
                    contentDescription = null,
                    size = 20.dp,
                    strokeWidth = 2.2f,
                    tint = Color.White,
                )
            }
        }
        if (onIlluminate != null) {
            RailTool(
                label = "Illuminate",
                spoken = "Illuminate: dots people tap",
                enabled = enabled,
                tag = "illuminate",
                onClick = onIlluminate,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Sparkles,
                    contentDescription = null,
                    size = 20.dp,
                    strokeWidth = 2.2f,
                    tint = Color.White,
                )
            }
        }
        if (media != null) {
            MarksTool(MomentMarksTool.Draw, media, enabled, onOpen)
            MarksTool(MomentMarksTool.Resize, media, enabled, onOpen)
        }
    }
}

/** Text, Draw or Resize on the rail: today's marks editor on the photo or video. */
@Composable
private fun MarksTool(
    tool: MomentMarksTool,
    media: MomentMediaFile,
    enabled: Boolean,
    onOpen: (MomentMarksTool) -> Unit,
) {
    val what = if (media is MomentMediaFile.Video) "video" else "photo"
    val (label, spoken) =
        when (tool) {
            MomentMarksTool.Text -> "Text" to "Write on the $what"
            MomentMarksTool.Draw -> "Draw" to "Draw on the $what"
            MomentMarksTool.Resize -> "Resize" to "Resize the $what"
        }
    RailTool(label = label, spoken = spoken, enabled = enabled, tag = label.lowercase(), onClick = { onOpen(tool) }) {
        when (tool) {
            MomentMarksTool.Text ->
                Text(text = "Aa", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp)
            MomentMarksTool.Draw ->
                PantopusIconImage(
                    icon = PantopusIcon.Pencil,
                    contentDescription = null,
                    size = 20.dp,
                    tint = Color.White,
                )
            MomentMarksTool.Resize ->
                PantopusIconImage(icon = PantopusIcon.Maximize, contentDescription = null, size = 20.dp, tint = Color.White)
        }
    }
}

@Composable
internal fun RailTool(
    label: String,
    spoken: String,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
    glyph: @Composable () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 48.dp)
                .alpha(if (enabled) 1f else 0.5f)
                .clip(RoundedCornerShape(24.dp))
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .testTag("moments.studio.rail.$tag")
                .clearAndSetSemantics {
                    contentDescription = spoken
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = label,
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            style = TextStyle(shadow = OnPicture),
        )
        Box(
            modifier = Modifier.size(44.dp).clip(CircleShape).background(PantopusColors.momentCameraChip),
            contentAlignment = Alignment.Center,
        ) { glyph() }
    }
}

/** What the Studio shows behind everything: the photo, the video's first frame, or the text card. */
@Composable
private fun StudioPicture(state: MomentsComposeUiState) {
    when (val media = state.media) {
        is MomentMediaFile.Photo ->
            AsyncImage(
                model = media.file,
                contentDescription = "Your photo",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        is MomentMediaFile.Video -> VideoStill(media, state.marks, state.placement)
        // A text card (as on iPhone): the card itself, its words in the middle of what the bar leaves.
        null -> StudioTextCard(text = state.text, background = state.background)
    }
}

/** A text card in the Studio: its colour and its words, as the viewer shows them, above the bar. */
@Composable
private fun StudioTextCard(
    text: String,
    background: MomentCardBackground,
) {
    Box(
        modifier = Modifier.fillMaxSize().momentCardGradient(background).padding(bottom = 200.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 26.sp,
            lineHeight = 33.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 36.dp).testTag("moments.studio.card"),
        )
    }
}

/** The caption, written on the picture (board B2); the same 100 letters as today's caption box. */
@Composable
internal fun StudioCaption(
    caption: String,
    enabled: Boolean,
    onCaption: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val style = TextStyle(color = Color.White, fontSize = 21.sp, lineHeight = 27.sp, fontWeight = FontWeight.Bold, shadow = OnPicture)
    // The words with the cursor; a change from outside (a mention picked) puts the cursor at the end, after the name.
    var field by remember { mutableStateOf(TextFieldValue(caption, TextRange(caption.length))) }
    var seen by remember { mutableStateOf(caption) }
    if (caption != seen) {
        seen = caption
        if (caption != field.text) field = TextFieldValue(caption, TextRange(caption.length))
    }
    BasicTextField(
        value = field,
        onValueChange = { next ->
            field = next
            if (next.text != caption) onCaption(next.text)
        },
        enabled = enabled,
        textStyle = style,
        maxLines = 3,
        cursorBrush = SolidColor(PantopusColors.momentInkSky),
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
        modifier = modifier.fillMaxWidth().testTag("moments.studio.caption").semantics { contentDescription = "Caption" },
        decorationBox = { field ->
            Box {
                if (caption.isEmpty()) Text("Add a caption", style = style.copy(color = PantopusColors.studioPillSecondary))
                field()
            }
        },
    )
}

/**
 * The bar at the bottom (board B2, PHASE-5 A): one line of details (where, how long, who sees it), which opens the
 * drawer, and Post. Nothing of the details covers the picture until asked.
 */
@Composable
private fun StudioBar(
    state: MomentsComposeUiState,
    homeNoteDue: Boolean,
    onHomeNoteShown: () -> Unit,
    postAs: PenNamePostAsUi?,
    refused: String?,
    onOpenDrawer: () -> Unit,
    onPost: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(PantopusColors.studioBar)
                .navigationBarsPadding()
                // A real sheet (PHASE-6 F3): dragging the bar up opens the details.
                .studioSheetDrag(up = true, onDone = onOpenDrawer)
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s2, bottom = Spacing.s3)
                .testTag("moments.studio.bar"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        StudioGrabber()
        StudioBarRest(state = state, homeNoteDue = homeNoteDue, onHomeNoteShown = onHomeNoteShown, postAs = postAs, refused = refused) {
            StudioWhenPill(state = state, onClick = onOpenDrawer, modifier = Modifier.weight(1f))
            StudioPost(state = state, onPost = onPost)
        }
    }
}

/** Who sees it, the drawer's first row (PHASE-5 A): Nearby, Friends, and the made-up name once `/me` has answered. */
@Composable
private fun StudioWhoSeesIt(
    state: MomentsComposeUiState,
    postAs: PenNamePostAsUi?,
    refused: String?,
    onAudience: (String) -> Unit,
    onMadeUp: () -> Unit,
    onClose: () -> Unit,
) {
    // "Don't show where": no pin, connections only (as today's Post sheet).
    val unplaced = state.noLocationOn
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(PantopusColors.studioBar)
                // The sheet's top: dragging it down closes the details (PHASE-6 F3).
                .studioSheetDrag(up = false, onDone = onClose)
                .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s2, bottom = Spacing.s3)
                .testTag("moments.studio.whoSees"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        StudioGrabber()
        Text(text = "Who sees it", color = PantopusColors.studioPillSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Row(
            modifier = Modifier.semantics { contentDescription = "Who sees it" },
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            AUDIENCES.forEach { (key, text) ->
                val on = !state.madeUp && key == if (unplaced) "connections" else state.audience
                val usable = !state.posting && (!unplaced || key == "connections")
                StudioChip(
                    text = text,
                    on = on,
                    usable = usable,
                    // iPhone's ids: moments.studio.audience.nearby / .friends / .madeUp.
                    tag = if (key == "connections") "friends" else key,
                    onClick = { onAudience(key) },
                )
            }
            // The third choice once `/me` has answered: one choice of three, under a made-up name people nearby only.
            if (postAs != null) {
                StudioChip(text = MADE_UP_NAME, on = state.madeUp, usable = !state.posting, tag = "madeUp", onClick = onMadeUp)
            }
        }
        refused?.let { Text(text = it, color = Color.White, fontSize = 12.sp) }
    }
}

/** One "who sees it" chip: white while picked, an outline otherwise. */
@Composable
internal fun StudioChip(
    text: String,
    on: Boolean,
    usable: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    // 28 dp drawn, 44 dp to the finger (PHASE-6 C).
    Box(
        modifier =
            Modifier
                .height(44.dp)
                .clickable(enabled = usable, role = Role.RadioButton, onClick = onClick)
                .testTag("moments.studio.audience.$tag")
                .clearAndSetSemantics {
                    contentDescription = text
                    role = Role.RadioButton
                    selected = on
                },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .height(28.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (on) Color.White else Color.Transparent)
                    .then(if (on) Modifier else Modifier.border(1.dp, PantopusColors.studioChipOutline, RoundedCornerShape(14.dp)))
                    .padding(horizontal = Spacing.s3),
            contentAlignment = Alignment.Center,
        ) {
            StudioChipWords(text, on, usable)
        }
    }
}

/** A "who sees it" chip's words (13 sp, PHASE-6 C). */
@Composable
private fun StudioChipWords(
    text: String,
    on: Boolean,
    usable: Boolean,
) {
    Text(
        text = text,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        color =
            when {
                on -> PantopusColors.appText
                usable -> Color.White
                else -> Color.White.copy(alpha = 0.4f)
            },
    )
}

/**
 * The bar under the chips: the pill and Post, then the lines that may follow them: why the made-up name can't be picked,
 * "Posting as Noble Pinecone. Others can't see it's you." (LEAD's shared words) with the server's few-homes warning, and
 * the at-home line.
 */
@Composable
private fun StudioBarRest(
    state: MomentsComposeUiState,
    homeNoteDue: Boolean,
    onHomeNoteShown: () -> Unit,
    postAs: PenNamePostAsUi?,
    refused: String?,
    pillAndPost: @Composable RowScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), content = pillAndPost)
        refused?.takeIf { !state.madeUp }?.let { StudioBarLine(text = it, tag = "madeUpRefused") }
        if (state.madeUp) {
            postAs?.penName?.name?.let { name -> StudioBarLine(text = "Posting as $name. Others can't see it's you.", tag = "postingAs") }
            postAs?.warning?.let { StudioBarLine(text = it, tag = "madeUpWarning") }
        }
        StudioHomeLine(state = state, homeNoteDue = homeNoteDue, onShown = onHomeNoteShown)
    }
}

@Composable
private fun StudioBarLine(
    text: String,
    tag: String,
) {
    Text(
        text = text,
        color = PantopusColors.studioPillSecondary,
        fontSize = 12.sp,
        modifier = Modifier.testTag("moments.studio.$tag"),
    )
}

/** In the drawer while the made-up name is picked (the web's words, #4933). */
@Composable
internal fun StudioMadeUpNote() {
    Text(
        text = "Under a made-up name it shows over its area, or at a public place, to people nearby.",
        fontSize = 12.sp,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(horizontal = Spacing.s5).padding(top = 2.dp).testTag("moments.studio.madeUpNote"),
    )
}

/**
 * At home, a line under the pill. Where the Moment shows only its area (the Sky at home), it says why, the first time
 * only (the lead, 2026-11-26), in the words of today's at-home note. Where it would pin on the home itself (before the
 * Sky, with Show the area instead off), today's Post sheet warns every time, and so does the Studio.
 */
@Composable
private fun StudioHomeLine(
    state: MomentsComposeUiState,
    homeNoteDue: Boolean,
    onShown: () -> Unit,
) {
    val line =
        when {
            state.skyAtHome -> SkyWords.HOME_TITLE.takeIf { homeNoteDue }
            state.postAtHome && !state.showArea -> HOME_PIN_WARNING
            else -> null
        } ?: return
    if (state.skyAtHome) LaunchedEffect(Unit) { onShown() }
    Row(
        modifier = Modifier.testTag("moments.studio.home").semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Home, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(text = line, color = PantopusColors.studioPillSecondary, fontSize = 12.sp)
    }
}

/** The third "who sees it" chip (LEAD's shared words). */
private const val MADE_UP_NAME = "Made-up name"

/** The server's words (`PEN_NAME_NEEDS_PLACE`), for a Moment with no place at all. */
private const val MADE_UP_NEEDS_PLACE = "A Moment under a made-up name needs a place, so it reaches people nearby."

/** A refusal that came without a sentence (the web's words, #4933). */
private const val MADE_UP_NOT_HERE = "A made-up name can't post from here."

/** Today's at-home warning (the Post sheet's own words): the Moment will pin on the home. */
private const val HOME_PIN_WARNING = "This is your home. People will see the pin on it."

/**
 * The pill's second line: the place's name as today's Post sheet says it, or "Area · Camas, WA" when the Moment shows
 * only its area at home (the lead, 2026-11-26).
 */
private val MomentsComposeUiState.studioPlaceLine: String
    get() =
        when {
            // Under a made-up name: "At Heritage Trail" when the author pins it at a place, else the area it floats over.
            madeUp && !noLocationOn -> skyPlaceName?.let(SkyWords::at) ?: "Area · ${place?.area?.label ?: place?.areaLabel ?: "your area"}"
            skyAtHome -> "Area · ${place?.area?.label ?: place?.areaLabel ?: "your area"}"
            postAtHome && showArea -> "Area · ${place?.areaLabel ?: place?.placeLabel ?: "your area"}"
            else -> postPlaceLabel
        }

/** One line of details, "Lacamas Lake · 24 hours · Everyone nearby" ("Shares at 6:40 pm" with Share later): opens the drawer. */
@Composable
private fun StudioWhenPill(
    state: MomentsComposeUiState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val howLong = state.studioPostPill() ?: state.sharesAt?.let(SkyWords::sharesAt) ?: hoursWord(state.hours)
    val who =
        when {
            state.madeUp -> MADE_UP_NAME
            state.noLocationOn || state.audience == "connections" -> "Friends"
            else -> "Everyone nearby"
        }
    val line = "${state.studioPlaceLine} · $howLong · $who"
    Row(
        modifier =
            modifier
                .height(44.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(PantopusColors.studioPillFill)
                .border(1.dp, PantopusColors.studioPillOutline, RoundedCornerShape(18.dp))
                .clickable(enabled = !state.posting, role = Role.Button, onClick = onClick)
                .padding(horizontal = 14.dp)
                .testTag("moments.studio.pill")
                .clearAndSetSemantics {
                    contentDescription = "$line. Where, how long and who sees it"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Clock, contentDescription = null, size = 18.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(
            text = line,
            color = Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 18.dp, strokeWidth = 2.2f, tint = Color.White)
    }
}

/** Post: the same tap as today's Post sheet's button, which waits the same way for a video getting ready. */
@Composable
private fun StudioPost(
    state: MomentsComposeUiState,
    onPost: () -> Unit,
) {
    val enabled = !state.posting && (state.pin != null || state.noLocationOn)
    val label =
        when {
            state.posting && state.readying != null -> "${(state.readying * 100).toInt()}%"
            state.posting -> "Posting…"
            // Several picked together: which one this is.
            state.pickedTogether > 1 -> "Post ${state.pickedAt} of ${state.pickedTogether}"
            // A video longer than one Moment posts as several, one after another.
            state.videoParts > 1 -> "Post as ${state.videoParts}"
            else -> "Post"
        }
    Row(
        modifier =
            Modifier
                .height(44.dp)
                .alpha(if (enabled || state.posting) 1f else 0.5f)
                .clip(RoundedCornerShape(28.dp))
                .background(PantopusColors.primary600)
                .clickable(enabled = enabled, role = Role.Button, onClick = onPost)
                .padding(horizontal = 18.dp)
                .testTag("moments.studio.post")
                .clearAndSetSemantics {
                    contentDescription =
                        when {
                            state.posting && state.readying != null -> "Getting your video ready, $label"
                            state.videoParts > 1 -> "Post as ${state.videoParts} Moments"
                            else -> label
                        }
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(text = label, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        if (!state.posting) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowRight,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.4f,
                tint = Color.White,
            )
        }
    }
}

/** No photo to read for the film looks (a caller without one). */
private val NO_LOOK_PICTURE: StateFlow<Bitmap?> = MutableStateFlow(null)

/** "Fades in 24 hours" (founder's word for a Moment's time: it fades when its hours are up). */

private fun hoursWord(hours: Int): String = if (hours == 1) "1 hour" else "$hours hours"

/** The sheet's grabber (PHASE-6 F3): a short bar at the top that says it can be dragged. */
@Composable
private fun StudioGrabber() {
    Box(modifier = Modifier.fillMaxWidth().padding(bottom = 2.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(width = 36.dp, height = 4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(PantopusColors.studioPillSecondary)
                    .clearAndSetSemantics {},
        )
    }
}

/** How far a drag must go to open or close the details sheet. */
private const val SHEET_DRAG_DP = 24

/**
 * The details sheet follows the finger's direction (PHASE-6 F3): a drag [up] (or down) past 24 dp, or a quick flick that
 * way, calls [onDone] once the finger lifts. Taps inside keep their own buttons.
 */
private fun Modifier.studioSheetDrag(
    up: Boolean,
    onDone: () -> Unit,
): Modifier =
    pointerInput(up) {
        var travel = 0f
        detectVerticalDragGestures(
            onDragStart = { travel = 0f },
            onVerticalDrag = { change, dy ->
                travel += dy
                change.consume()
            },
            onDragEnd = {
                // Up by the bar opens the details, down by their top closes them.
                val toward = if (up) -travel else travel
                if (toward > SHEET_DRAG_DP.dp.toPx()) onDone()
            },
        )
    }
