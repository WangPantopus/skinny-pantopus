@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.moments.compose.marks

import android.view.View
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextMotion
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.moments.components.MomentHaptics
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * A label's place on the picture as drawn: [width] × [height] px, the picture itself [pictureWidth] × [pictureHeight];
 * [floor] is where the editor's own controls start (px down the drawn picture), which a label stays above so it can
 * always be picked up again.
 */
internal class LabelFrame(
    val width: Float,
    val height: Float,
    val pictureWidth: Int,
    val pictureHeight: Int,
    val floor: Float = Float.MAX_VALUE,
    val ceiling: Float = 0f,
    // "Pulse, reinvented"'s Studio on its canvas (PHASE-6 I): px of a label that stay on the picture as drawn, anywhere
    // on it; 0 keeps today's rules.
    val keep: Float = 0f,
) {
    /**
     * [label] kept inside the part every phone shows, below the editor's top buttons ([ceiling]) and above its bottom
     * controls ([floor]), so it can always be picked up again; the top buttons win where both can't be met.
     */
    fun kept(label: MomentLabel): MomentLabel {
        val inside =
            if (keep > 0f) {
                val keepX = keep * pictureWidth / width
                MomentMarksPainter.keptAnywhere(label, pictureWidth, pictureHeight, keepX, keep * pictureHeight / height)
            } else {
                MomentMarksPainter.keptIn(label, pictureWidth, pictureHeight)
            }
        // The upright box around it, when it's turned.
        val box = MomentMarksPainter.turnedBounds(MomentMarksPainter.layout(inside, width, height).box, inside.turn)
        val upper = if (keep > 0f) ceiling else max(ceiling, MomentMarkRules.labelBox(pictureWidth, pictureHeight).top * height)
        val shift =
            when {
                box.top < upper -> upper - box.top
                box.bottom > floor -> -(box.bottom - floor).coerceAtMost(box.top - upper)
                else -> 0f
            }
        // "Pulse, reinvented"'s Studio: its canvas is drawn between the editor's controls, so they hold nothing back.
        return if (shift != 0f && keep == 0f) inside.copy(y = inside.y + shift / height) else inside
    }

    /** [label] moved by [dx], [dy] px and scaled by [zoom], kept as [kept] keeps it. */
    fun moved(
        label: MomentLabel,
        dx: Float,
        dy: Float,
        zoom: Float = 1f,
    ): MomentLabel = kept(label.copy(x = label.x + dx / width, y = label.y + dy / height, size = label.size * zoom))

    /**
     * [label] turned to [turn] degrees and kept as [kept] keeps it; or as it was when, turned so, it can't fit where a
     * label may go even moved and at the smallest letters (it keeps the last angle that fit).
     */
    fun turned(
        label: MomentLabel,
        turn: Float,
    ): MomentLabel {
        if (turn == label.turn) return label
        val candidate = label.copy(turn = turn)
        return if (keep > 0f || MomentMarksPainter.fitsTurned(candidate, pictureWidth, pictureHeight)) kept(candidate) else label
    }
}

/**
 * Text's labels over the picture (board T2): each takes a drag to move it, two fingers to resize and turn it (step R3)
 * and a tap to type in it; a turned one is grabbed by its turned shape. The one picked is outlined, with a handle at its
 * corner that resizes it too; the one being typed is a text field drawn upright as the label is. TalkBack can move,
 * resize, turn, change and delete each one.
 */
@Composable
internal fun TextLabels(
    editing: MomentMarksEditing,
    frame: LabelFrame,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
) {
    val now by rememberUpdatedState(frame)
    val labelsNow by rememberUpdatedState(editing.marks.labels)
    val density = LocalDensity.current
    val view = LocalView.current
    editing.marks.labels.forEachIndexed { index, label ->
        val laid = MomentMarksPainter.layout(label, frame.width, frame.height)
        val change = { edit: (MomentLabel) -> MomentLabel ->
            onEdit { current ->
                current.marks.labels.firstOrNull { it.id == label.id }?.let { current.moved(edit(it)) } ?: current
            }
        }
        if (editing.typing && editing.selected == label.id) {
            LabelField(label, laid, now, onEdit)
        } else {
            val picked = editing.selected == label.id
            Box(
                modifier =
                    Modifier
                        .offset { IntOffset(laid.box.left.roundToInt(), laid.box.top.roundToInt()) }
                        .size(with(density) { laid.box.width().toDp() }, with(density) { laid.box.height().toDp() })
                        // Turned about its middle, so it's touched by its turned shape.
                        .graphicsLayer { rotationZ = label.turn }
                        .keepsKeyboard()
                        .then(if (picked) Modifier.pickedOutline(laid.corner) else Modifier)
                        .pointerInput(label.id) {
                            val twist = LabelTwist()
                            detectPlacementGestures(
                                onStart = { twist.start(labelsNow.firstOrNull { it.id == label.id }?.turn ?: 0f) },
                                onGesture = { _, pan, zoom, turnBy ->
                                    val turn = twist.by(turnBy, view)
                                    change { current ->
                                        // The fingers' move comes in the label's own turned frame: turned back to the picture's.
                                        val moved = turnedBy(pan, current.turn)
                                        now.turned(now.moved(current, moved.x, moved.y, zoom), turn)
                                    }
                                },
                                onEnd = {},
                            )
                        }.pointerInput(label.id) { detectTapGestures { onEdit { it.editing(label.id) } } }
                        .testTag("moments.marks.label.$index")
                        .labelActions(label, onEdit = { onEdit { it.editing(label.id) } }, onChange = change, frame = now) {
                            onEdit { it.removed(label.id) }
                        },
            )
            if (picked) {
                val handle = with(density) { HANDLE.toPx() }
                // At the label's bottom right corner, turned with it.
                val corner = turnedBy(Offset(laid.box.width() / 2, laid.box.height() / 2), label.turn)
                val cornerX = laid.box.centerX() + corner.x
                val cornerY = laid.box.centerY() + corner.y
                ResizeHandle(
                    Modifier.offset { IntOffset((cornerX - handle / 2).roundToInt(), (cornerY - handle / 2).roundToInt()) },
                ) { dx, dy ->
                    change { current ->
                        val box = MomentMarksPainter.layout(current, now.width, now.height).box
                        // Outward along the label's own diagonal makes it larger.
                        val along = turnedBy(Offset(dx, dy), -current.turn)
                        now.moved(current, 0f, 0f, 1f + (along.x + along.y) / (box.width() + box.height()))
                    }
                }
            }
        }
    }
}

/**
 * A twist's turn for a label (step R3): kept unstuck while the fingers are down, so a turn that sticks can be pulled
 * away again, and stuck when shown, with a light tick when it newly catches on a quarter turn.
 */
internal class LabelTwist {
    private var raw = 0f
    private var caught = false

    fun start(turn: Float) {
        raw = turn
        caught = onQuarter(turn)
    }

    /** The turn shown after [turnBy] more degrees. */
    fun by(
        turnBy: Float,
        view: View,
    ): Float {
        raw += turnBy
        val turn = stuckTurn(raw)
        if (onQuarter(turn) && !caught) MomentHaptics.light(view)
        caught = onQuarter(turn)
        return turn
    }
}

/**
 * Two fingers anywhere on the picture in Text resize and turn the picked label, as they do on the label itself:
 * `(zoom, turnBy, first)` per event, [first] at a gesture's start. A label being typed in (shown upright) doesn't turn.
 * It reads the latest state when called.
 */
@Composable
internal fun rememberPickedPinch(
    editing: MomentMarksEditing,
    frame: LabelFrame,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
): (Float, Float, Boolean) -> Unit {
    val view = LocalView.current
    val twist = remember { LabelTwist() }
    val picked by rememberUpdatedState(editing.picked)
    val typing by rememberUpdatedState(editing.typing)
    val now by rememberUpdatedState(frame)
    val edit by rememberUpdatedState(onEdit)
    return remember {
        { zoom: Float, turnBy: Float, first: Boolean ->
            picked?.let { label ->
                if (first) twist.start(label.turn)
                val turn = if (typing) label.turn else twist.by(turnBy, view)
                edit { e -> e.picked?.let { e.changed(now.turned(now.moved(it, 0f, 0f, zoom), turn)) } ?: e }
            }
        }
    }
}

/** [offset] turned [degrees] clockwise (y down). */
private fun turnedBy(
    offset: Offset,
    degrees: Float,
): Offset {
    if (degrees == 0f) return offset
    val radians = Math.toRadians(degrees.toDouble())
    val cos = cos(radians).toFloat()
    val sin = sin(radians).toFloat()
    return Offset(offset.x * cos - offset.y * sin, offset.x * sin + offset.y * cos)
}

/** TalkBack's way to do what fingers do on a label: change its words, move it, resize it, turn it, delete it. */
private fun Modifier.labelActions(
    label: MomentLabel,
    onEdit: () -> Unit,
    onChange: ((MomentLabel) -> MomentLabel) -> Unit,
    frame: LabelFrame,
    onDelete: () -> Unit,
): Modifier =
    semantics {
        contentDescription = "Words on the picture: ${label.text}"
        role = Role.Button
        onClick(label = "Change the words") {
            onEdit()
            true
        }
        val step = MomentMarkRules.MOVE_STEP
        val moves =
            listOf(
                "Move up" to Offset(0f, -step),
                "Move down" to Offset(0f, step),
                "Move left" to Offset(-step, 0f),
                "Move right" to Offset(step, 0f),
            )
        customActions =
            moves.map { (name, by) ->
                CustomAccessibilityAction(name) {
                    onChange { frame.moved(it, by.x * frame.width, by.y * frame.height) }
                    true
                }
            } +
            listOf(
                CustomAccessibilityAction("Make larger") {
                    onChange { frame.moved(it, 0f, 0f, MomentMarkRules.SIZE_STEP) }
                    true
                },
                CustomAccessibilityAction("Make smaller") {
                    onChange { frame.moved(it, 0f, 0f, 1f / MomentMarkRules.SIZE_STEP) }
                    true
                },
                CustomAccessibilityAction("Turn left") {
                    onChange { frame.turned(it, stuckTurn(it.turn - MomentMarkRules.TURN_STEP)) }
                    true
                },
                CustomAccessibilityAction("Turn right") {
                    onChange { frame.turned(it, stuckTurn(it.turn + MomentMarkRules.TURN_STEP)) }
                    true
                },
                CustomAccessibilityAction("Delete") {
                    onDelete()
                    true
                },
            )
    }

/** Board T2's dashed outline around the picked label, a little outside its box. */
private fun Modifier.pickedOutline(corner: Float): Modifier =
    drawBehind {
        val gap = 6.dp.toPx()
        val dash = 5.dp.toPx()
        drawRoundRect(
            color = PantopusColors.momentInkWhite,
            topLeft = Offset(-gap, -gap),
            size = Size(size.width + gap * 2, size.height + gap * 2),
            cornerRadius = CornerRadius(corner + gap),
            style = Stroke(width = 1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash))),
        )
    }

/** The picked label's corner handle (board T2). */
private val HANDLE = 26.dp

/** The picked label's corner handle (board T2): a drag resizes the label. */
@Composable
private fun ResizeHandle(
    modifier: Modifier,
    onDrag: (Float, Float) -> Unit,
) {
    Box(
        modifier =
            modifier
                .size(HANDLE)
                .clip(CircleShape)
                .background(PantopusColors.momentInkWhite)
                .keepsKeyboard()
                .pointerInput(Unit) {
                    detectDragGestures { change, amount ->
                        change.consume()
                        onDrag(amount.x, amount.y)
                    }
                }
                .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.Maximize, contentDescription = null, size = 14.dp, tint = PantopusColors.momentInkBlack)
    }
}

/**
 * The label being typed: a text field in the label's own letters and box, centred where the label sits. Putting the
 * keyboard away ends the typing (an empty label is removed).
 */
@Composable
private fun LabelField(
    label: MomentLabel,
    laid: MomentMarksPainter.LabelLayout,
    frame: LabelFrame,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
) {
    val density = LocalDensity.current
    val focus = remember { FocusRequester() }
    LaunchedEffect(label.id) { runCatching { focus.requestFocus() } }
    val keyboardUp = WindowInsets.ime.getBottom(density) > 0
    var sawKeyboard by remember { mutableStateOf(false) }
    LaunchedEffect(keyboardUp) {
        if (keyboardUp) {
            sawKeyboard = true
        } else if (sawKeyboard) {
            sawKeyboard = false
            onEdit { it.typingEnded() }
        }
    }
    val letters = laid.letters
    val letterColor = MomentMarksPainter.letterColor(label)
    val box = MomentMarksPainter.boxColor(label)
    val shape = RoundedCornerShape(with(density) { laid.corner.toDp() })
    val (across, down) = MomentMarksPainter.padding(label, letters)
    // A label typed in low on the picture is raised above the keyboard and the controls over it, and goes back after.
    val window = LocalView.current.rootView.height
    val keyboardTop = window - WindowInsets.ime.getBottom(density)
    val clear = with(density) { (TYPING_TOOLS + Spacing.s2).toPx() }
    var bottom by remember { mutableStateOf(0f) }
    val raise = (bottom - (keyboardTop - clear)).coerceAtLeast(0f).takeIf { keyboardUp } ?: 0f
    val style =
        with(density) {
            TextStyle(
                color = letterColor,
                fontSize = letters.toSp(),
                lineHeight = (letters * MomentMarkRules.LINE_HEIGHT).toSp(),
                // The Studio's lettering asks its typeface's own weight, as the painter draws it; today's bold system font
                // (no family) for Classic.
                fontWeight = if (label.font == MomentFont.Classic) FontWeight.Bold else label.font.weight,
                fontFamily = label.font.takeIf { it != MomentFont.Classic }?.let { FontFamily(it.typeface) },
                textAlign = TextAlign.Center,
                // Unhinted, like the painter's letters, so the words wrap where the photo's do.
                textMotion = TextMotion.Animated,
            )
        }
    val edge = MomentMarksPainter.edgeColor(label)
    BasicTextField(
        value = label.text,
        // Words that make the label wider or taller keep it inside the part every phone shows.
        onValueChange = { text -> onEdit { it.typed(text).let { typed -> typed.picked?.let { typed.changed(frame.kept(it)) } ?: typed } } },
        textStyle = style,
        cursorBrush = SolidColor(letterColor),
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        modifier =
            Modifier
                .centredAt(laid.box.centerX(), laid.box.centerY(), (laid.wrap + across * 2).roundToInt())
                .onGloballyPositioned { bottom = it.boundsInWindow().bottom }
                .graphicsLayer { translationY = -raise }
                .pickedOutline(laid.corner)
                .focusRequester(focus)
                .testTag("moments.marks.field")
                .semantics { contentDescription = "Words on the picture" },
        decorationBox = { field ->
            Box(
                modifier =
                    Modifier
                        .then(if (box != null) Modifier.background(box, shape) else Modifier)
                        .padding(horizontal = with(density) { across.toDp() }, vertical = with(density) { down.toDp() }),
                contentAlignment = Alignment.Center,
            ) {
                if (label.text.isEmpty()) {
                    Text(
                        text = "Type here",
                        style = style.copy(color = letterColor.copy(alpha = 0.6f)),
                        modifier = Modifier.clearAndSetSemantics {},
                    )
                } else if (edge != null) {
                    // Plain letters' edge behind the words being typed, as the photo will have it.
                    BasicText(
                        text = label.text,
                        style = style.copy(color = edge, drawStyle = Stroke(MomentMarksPainter.EDGE * letters, join = StrokeJoin.Round)),
                        modifier = Modifier.clearAndSetSemantics {},
                    )
                }
                field()
            }
        },
    )
}

/** How tall Text's controls over the keyboard are while a label is typed: the looks, a gap, the inks, the margin. */
private val TYPING_TOOLS = 44.dp + 14.dp + 44.dp + Spacing.s6

/** Lays the content out as small as it measures (at most [maxWidth] px) with its middle at [x], [y] of the parent. */
private fun Modifier.centredAt(
    x: Float,
    y: Float,
    maxWidth: Int,
): Modifier =
    layout { measurable, constraints ->
        val placeable = measurable.measure(Constraints(maxWidth = maxWidth.coerceAtLeast(1)))
        layout(constraints.maxWidth, constraints.maxHeight) {
            placeable.place((x - placeable.width / 2f).roundToInt(), (y - placeable.height / 2f).roundToInt())
        }
    }

/**
 * Text's controls under the picture (board T2): the hint, the three looks and the six inks. While a label is typed the
 * hint gives way and the looks shrink to their "Aa", so the label stays in view above the keyboard; they keep the
 * keyboard up.
 */
@Composable
internal fun TextTools(
    editing: MomentMarksEditing,
    onEdit: ((MomentMarksEditing) -> MomentMarksEditing) -> Unit,
    modifier: Modifier = Modifier,
    // "Pulse, reinvented"'s Studio: the ten letterings over the looks, and colours from the photo under the inks.
    studio: Boolean = false,
    photo: List<Int> = emptyList(),
    // "Pulse, reinvented"'s Studio on a photo: "Behind" for the picked label (the subject lifted on the phone).
    lift: SubjectLift? = null,
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        if (!editing.typing) {
            Text(
                text =
                    if (editing.dropping) {
                        DROPPER_HINT
                    } else if (editing.marks.labels.isEmpty()) {
                        "Tap the picture to add words."
                    } else {
                        "Drag to move. Pinch to resize. Twist to turn."
                    },
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                style = TextStyle(shadow = Shadow(PantopusColors.momentMarksShadow, offset = Offset(0f, 1f), blurRadius = 2f)),
            )
            Spacer(Modifier.height(14.dp))
        }
        if (studio) {
            StudioLetterings(picked = editing.font, onPick = { font -> onEdit { it.fonted(font) } })
            Spacer(Modifier.height(Spacing.s3))
        }
        Row(
            modifier = Modifier.fillMaxWidth().keepsKeyboard().semantics { contentDescription = "Look" },
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            MomentLabelStyle.entries.forEach { style ->
                StyleButton(style, on = style == editing.style, compact = editing.typing) { onEdit { it.styled(style) } }
            }
        }
        if (studio && lift != null) {
            Spacer(Modifier.height(Spacing.s2))
            StudioBehindRow(editing, onEdit, lift)
        }
        Spacer(Modifier.height(14.dp))
        Box(Modifier.keepsKeyboard()) {
            Inks(
                picked = editing.textInk,
                onPick = { ink -> onEdit { it.inked(ink).copy(dropping = false) } },
                group = "Text color",
                picking = editing.textTint,
            )
        }
        if (studio) {
            Box(Modifier.keepsKeyboard()) {
                PhotoColors(
                    photo = photo,
                    picked = editing.textTint,
                    onPick = { color -> onEdit { it.tinted(color).copy(dropping = false) } },
                    dropping = editing.dropping,
                    onDropper = { onEdit { it.copy(dropping = !it.dropping) } },
                )
            }
        }
    }
}

/** One of Text's styles (board T2): a sample "Aa" in the style over its name. */
@Composable
private fun RowScope.StyleButton(
    style: MomentLabelStyle,
    on: Boolean,
    compact: Boolean,
    onPick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .weight(1f)
                .height(if (compact) 44.dp else 64.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.momentCameraChip)
                .border(if (on) 2.dp else 1.dp, if (on) Color.White else PantopusColors.momentReplyOutline, RoundedCornerShape(14.dp))
                .clickable(role = Role.RadioButton, onClick = onPick)
                .testTag("moments.marks.style.${style.key}")
                .clearAndSetSemantics {
                    contentDescription = style.spoken
                    role = Role.RadioButton
                    selected = on
                },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterVertically),
    ) {
        val sample =
            when (style) {
                MomentLabelStyle.Plain -> Modifier
                MomentLabelStyle.Label -> Modifier.background(PantopusColors.momentMarksLabelBox, RoundedCornerShape(6.dp))
                MomentLabelStyle.Sign -> Modifier.background(PantopusColors.momentInkYellow, RoundedCornerShape(6.dp))
            }
        Text(
            text = "Aa",
            color = if (style == MomentLabelStyle.Sign) PantopusColors.momentInkBlack else Color.White,
            fontSize = if (style == MomentLabelStyle.Plain) 18.sp else 16.sp,
            fontWeight = FontWeight.Bold,
            style =
                TextStyle(shadow = Shadow(PantopusColors.momentMarksShadow, blurRadius = 3f).takeIf { style == MomentLabelStyle.Plain }),
            modifier = sample.padding(horizontal = Spacing.s2, vertical = 1.dp),
        )
        if (!compact) {
            Text(text = style.spoken, color = Color.White, fontSize = 12.sp, fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold)
        }
    }
}
