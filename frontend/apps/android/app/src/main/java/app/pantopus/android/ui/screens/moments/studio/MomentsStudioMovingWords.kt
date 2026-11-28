@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.studio

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.exclude
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentMovingWords
import app.pantopus.android.data.api.models.moments.MomentPlayItemDto
import app.pantopus.android.data.api.models.moments.MomentPlayKinds
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.ui.screens.moments.components.MomentMovingWordsText
import app.pantopus.android.ui.screens.moments.components.MomentPlayCard
import app.pantopus.android.ui.screens.moments.components.card
import app.pantopus.android.ui.screens.moments.components.centredAt
import app.pantopus.android.ui.screens.moments.components.movingWords
import app.pantopus.android.ui.screens.moments.components.movingWordsColor
import app.pantopus.android.ui.screens.moments.components.stampFrame
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.screens.moments.compose.marks.MomentFont
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/*
 * "Pulse, reinvented", moving words in the Studio (CONTRACT 7k; as on iPhone #5176): from the "Stamps and Play" tray, one
 * line of the author's own words (up to 60), a lettering by its shared id, a motion and a colour. Placed on the photo,
 * drawn moving as readers will see it, dragged, pinched and turned with two fingers; a tap opens it again to change it or
 * remove it. On a photo only, at most two on a post. They go out in `play`; nothing is drawn into the picture.
 */

/** Playable items take at most four places on a post (CONTRACT 7b), before and after's included. */
private const val MOST_ITEMS = 4

/** Moving words may be added here: a photo (not a before and after), under two of them and four items in all. */
internal val MomentsComposeUiState.offersMovingWords: Boolean
    get() =
        media is MomentMediaFile.Photo && studioPair == null &&
            items.count { it.kind == MomentPlayKinds.MOVING_WORDS } < MomentMovingWords.MOST &&
            items.size < MOST_ITEMS

/** The Studio's own playable items as they go out: moving words on a photo only, inside the four items in all. */
internal val MomentsComposeUiState.sentItems: List<MomentPlayItemDto>
    get() {
        val onPhoto = media is MomentMediaFile.Photo && studioPair == null
        val room = MOST_ITEMS - (if (studioPair != null) 1 else 0)
        var words = 0
        return items
            .mapNotNull { item ->
                if (item.kind == MomentPlayKinds.MOVING_WORDS) {
                    item
                        .takeIf { it.movingWords && onPhoto && words < MomentMovingWords.MOST }
                        ?.copy(text = MomentMovingWords.cut(item.text.orEmpty()).trim())
                        ?.takeIf { it.text.orEmpty().isNotEmpty() }
                        ?.also { words++ }
                } else {
                    // A poll or a countdown (CONTRACT 7b): on a photo or a video.
                    item.takeIf { media != null }?.sentCard()
                }
            }.take(room)
    }

/** The tray's Play row: "Moving words", with what it does in one line. */
@Composable
internal fun StudioMovingWordsRow(onMake: () -> Unit) {
    val shape = RoundedCornerShape(19.dp)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(
            modifier =
                Modifier
                    .height(38.dp)
                    .clip(shape)
                    .background(PantopusColors.studioPillFill)
                    .border(1.dp, PantopusColors.studioPillOutline, shape)
                    .clickable(role = Role.Button, onClick = onMake)
                    .padding(horizontal = 12.dp)
                    .testTag("moments.studio.tray.movingWords")
                    .semantics(mergeDescendants = true) { contentDescription = "Moving words" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = Color.White)
            Text(text = "Moving words", color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        }
        Text(
            text = "Your own line over the photo, drifting, pulsing, waving or typing itself out.",
            color = PantopusColors.studioPillSecondary,
            fontSize = 13.sp,
        )
    }
}

/** The Studio's playable items over the picture of [picture] px: drawn as readers see them; drag, pinch and turn; tap. */
@Composable
internal fun StudioPlayLayer(
    items: List<MomentPlayItemDto>,
    picture: IntSize?,
    enabled: Boolean,
    onItems: (List<MomentPlayItemDto>) -> Unit,
    onOpen: (String) -> Unit,
) {
    val shown = items.filter { it.movingWords || it.card }
    if (shown.isEmpty()) return
    val current by rememberUpdatedState(items)
    BoxWithConstraints(modifier = Modifier.fillMaxSize().testTag("moments.studio.items")) {
        val box = constraints.maxWidth.toFloat()
        val frame = stampFrame(picture, box, constraints.maxHeight.toFloat())
        val unit = minOf(frame.width, box) / LocalDensity.current.density / 402f
        shown.forEach { item ->
            // Touches are read on the screen, before a card's own size and turn, so a drag follows the finger.
            val touched =
                Modifier
                    .centredAt(frame.left + item.x.toFloat() * frame.width, frame.top + item.y.toFloat() * frame.height)
                    .pointerInput(item.id, enabled) {
                        if (!enabled) return@pointerInput
                        detectTapGestures { onOpen(item.id) }
                    }.pointerInput(item.id, enabled, frame) {
                        if (!enabled) return@pointerInput
                        detectTransformGestures { _, pan, zoom, turn ->
                            onItems(
                                current.map {
                                    if (it.id != item.id) it else it.moved(pan.x / frame.width, pan.y / frame.height, zoom, turn)
                                },
                            )
                        }
                    }.semantics { role = Role.Button }
                    .testTag("moments.studio.item")
            if (item.movingWords) {
                MomentMovingWordsText(item = item, shownWidth = minOf(frame.width, box), modifier = touched)
            } else {
                // A card at its author's size and turn, as readers will see it.
                MomentPlayCard(
                    item = item,
                    mine = true,
                    modifier =
                        touched.graphicsLayer {
                            val size = (item.scale.toFloat() * unit).coerceIn(0.4f, 2.5f)
                            scaleX = size
                            scaleY = size
                            rotationZ = item.rotation.toFloat()
                        },
                )
            }
        }
    }
}

/** The item moved by a share of the picture, made bigger or smaller by [zoom], and turned by [turn] degrees. */
private fun MomentPlayItemDto.moved(
    dx: Float,
    dy: Float,
    zoom: Float,
    turn: Float,
): MomentPlayItemDto {
    var rotationNow = rotation + turn
    if (rotationNow > 180) rotationNow -= 360
    if (rotationNow < -180) rotationNow += 360
    return copy(
        x = (x + dx).coerceIn(0.05, 0.95),
        y = (y + dy).coerceIn(0.05, 0.95),
        scale = (scale * zoom).coerceIn(0.25, 4.0),
        rotation = rotationNow,
    )
}

/**
 * The moving-words form over the Studio: [editing] is the item's id, or null for a new one. "Add" places a new one on
 * the photo; "Done" keeps the changes; "Remove" takes it off.
 */
@Composable
internal fun StudioMovingWordsPanel(
    visible: Boolean,
    editing: String?,
    items: List<MomentPlayItemDto>,
    onItems: (List<MomentPlayItemDto>) -> Unit,
    onDone: () -> Unit,
) {
    BackHandler(enabled = visible, onBack = onDone)
    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedVisibility(visible = visible, enter = fadeIn(), exit = fadeOut()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.momentDim)
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDone)
                        .semantics {
                            contentDescription = "Close"
                            role = Role.Button
                        },
            )
        }
        AnimatedVisibility(
            visible = visible,
            enter = slideInVertically { it },
            exit = slideOutVertically { it },
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            Column(
                modifier =
                    Modifier
                        .windowInsetsPadding(WindowInsets.ime.exclude(WindowInsets.navigationBars))
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                        .background(Color.Black)
                        .background(PantopusColors.studioBar)
                        .verticalScroll(rememberScrollState())
                        .navigationBarsPadding()
                        .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s5, bottom = Spacing.s5)
                        .testTag("moments.studio.movingWords"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                MovingWordsForm(items.firstOrNull { it.id == editing }, items, onItems, onDone)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MovingWordsForm(
    item: MomentPlayItemDto?,
    items: List<MomentPlayItemDto>,
    onItems: (List<MomentPlayItemDto>) -> Unit,
    onDone: () -> Unit,
) {
    var words by rememberSaveable(item?.id) { mutableStateOf(item?.text.orEmpty()) }
    var lettering by rememberSaveable(item?.id) { mutableStateOf(item?.lettering ?: MomentFont.Classic.key) }
    var motion by rememberSaveable(item?.id) { mutableStateOf(item?.motion ?: MomentMovingWords.MOTIONS.first().first) }
    var color by rememberSaveable(item?.id) { mutableStateOf(item?.color ?: MomentMovingWords.WHITE) }
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            "Moving words",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.semantics { heading() },
        )
        Text("One line, up to ${MomentMovingWords.LONGEST}", color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
    }
    WordsField(words) { words = MomentMovingWords.cut(it) }
    Label("Lettering")
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        MomentFont.entries.forEach { font ->
            Choice(font.spoken, on = lettering == font.key, tag = "moments.studio.movingWords.lettering.${font.key}", font = font) {
                lettering = font.key
            }
        }
    }
    Label("Motion")
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        MomentMovingWords.MOTIONS.forEach { (id, name) ->
            Choice(name, on = motion == id, tag = "moments.studio.movingWords.motion.$id") { motion = id }
        }
    }
    Label("Colour")
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        MomentMovingWords.COLORS.forEachIndexed { at, hex ->
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(movingWordsColor(hex))
                        .border(
                            if (color == hex) 3.dp else 1.dp,
                            if (color == hex) Color.White else PantopusColors.studioPillOutline,
                            CircleShape,
                        )
                        .clickable(role = Role.Button) { color = hex }
                        .semantics {
                            contentDescription = listOf("White", "Yellow", "Black", "Sky")[at]
                            selected = color == hex
                        }.testTag("moments.studio.movingWords.color$at"),
            )
        }
    }
    val ready = words.trim().isNotEmpty()
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Choice(if (item == null) "Add" else "Done", on = ready, tag = "moments.studio.movingWords.save") {
            if (!ready) return@Choice
            val made = (item ?: newItem(items)).copy(text = words.trim(), lettering = lettering, motion = motion, color = color)
            onItems(if (item == null) items + made else items.map { if (it.id == made.id) made else it })
            onDone()
        }
        if (item != null) {
            Choice("Remove", tag = "moments.studio.movingWords.remove") {
                onItems(items.filterNot { it.id == item.id })
                onDone()
            }
        }
    }
    Text("Drag them where they go; pinch and turn with two fingers.", color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
}

/** A new moving-words item, a little lower on the photo for each one already there. */
private fun newItem(items: List<MomentPlayItemDto>): MomentPlayItemDto {
    val taken = items.map { it.id }.toSet()
    val id = (1..9).map { "mw-$it" }.first { it !in taken }
    val count = items.count { it.kind == MomentPlayKinds.MOVING_WORDS }
    return MomentPlayItemDto(id = id, kind = MomentPlayKinds.MOVING_WORDS, x = 0.5, y = 0.3 + 0.18 * count)
}

@Composable
private fun WordsField(
    value: String,
    onChange: (String) -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    BasicTextField(
        value = value,
        onValueChange = onChange,
        singleLine = true,
        textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
        cursorBrush = SolidColor(Color.White),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        modifier = Modifier.fillMaxWidth().testTag("moments.studio.movingWords.text").semantics { contentDescription = "Your words" },
        decorationBox = { field ->
            Box(
                contentAlignment = Alignment.CenterStart,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .clip(shape)
                        .background(PantopusColors.studioPillFill)
                        .border(1.dp, PantopusColors.studioPillOutline, shape)
                        .padding(horizontal = 12.dp),
            ) {
                if (value.isEmpty()) Text("First frost on the lake", color = PantopusColors.studioPillSecondary, fontSize = 15.sp)
                field()
            }
        },
    )
}

@Composable
private fun Label(words: String) {
    Text(words, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
}

@Composable
private fun Choice(
    words: String,
    on: Boolean = false,
    tag: String,
    font: MomentFont? = null,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(19.dp)
    Text(
        text = words,
        color = if (on) PantopusColors.studioBar else Color.White,
        fontSize = 14.5.sp,
        fontWeight = font?.weight ?: FontWeight.SemiBold,
        fontFamily = font?.let { FontFamily(it.typeface) },
        modifier =
            Modifier
                .clip(shape)
                .background(if (on) Color.White else PantopusColors.studioPillFill)
                .border(1.dp, PantopusColors.studioPillOutline, shape)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 14.dp, vertical = Spacing.s2)
                .semantics { selected = on }
                .testTag(tag),
    )
}
