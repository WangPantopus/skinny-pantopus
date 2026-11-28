@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.compose.marks

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/*
 * Text and Draw on a Moment's photo (plan part 1, boards T2 and T3). Marks live in the picture's own coordinates, the
 * same on iPhone: x and y run 0 to 1 across the upright picture's width and down its height, and a line's width or a
 * label's letters are a share of the picture's width. Never screen points: the picture is cropped differently on every
 * phone. They are drawn into the photo on the phone, so the server and every app receive an ordinary JPEG.
 */

/** The six inks (boards T2 and T3), the same on iPhone; [key] is the test id's last part. */
enum class MomentInk(
    val key: String,
    val spoken: String,
) {
    White("white", "White"),
    Black("black", "Black"),
    Yellow("yellow", "Yellow"),
    Red("red", "Red"),
    Sky("sky", "Sky blue"),
    Green("green", "Green"),
    ;

    val color: Color
        get() =
            when (this) {
                White -> PantopusColors.momentInkWhite
                Black -> PantopusColors.momentInkBlack
                Yellow -> PantopusColors.momentInkYellow
                Red -> PantopusColors.momentInkRed
                Sky -> PantopusColors.momentInkSky
                Green -> PantopusColors.momentInkGreen
            }
}

/**
 * Draw's three line widths, in dp on the screen showing the picture (as iPhone's points): a new line keeps that share of
 * the picture's width as shown, so it looks the same whatever the picture's shape.
 */
enum class MomentLineWidth(
    val key: String,
    val spoken: String,
    val points: Float,
) {
    Thin("thin", "Thin line", 3f),
    Medium("medium", "Medium line", 5.5f),
    Thick("thick", "Thick line", 10f),
}

/** Text's three styles (board T2): words alone, words on a dark box, dark words on a box of the ink. */
enum class MomentLabelStyle(
    val key: String,
    val spoken: String,
) {
    Plain("plain", "Plain"),
    Label("label", "Label"),
    Sign("sign", "Sign"),
}

/** One line drawn with a finger. */
@Immutable
data class MomentStroke(
    /** x0, y0, x1, y1, …: 0 to 1 across the picture's width and down its height. */
    val points: List<Float>,
    val ink: MomentInk,
    /** The line's width as a share of the picture's width. */
    val width: Float,
    /** "Pulse, reinvented"'s Studio: a colour from the photo (ARGB) in place of [ink]; null everywhere else. */
    val tint: Int? = null,
    /** "Pulse, reinvented"'s Studio: what drew it ([MomentPens]); today's pen everywhere else. */
    val pen: MomentPen = MomentPen.Marker,
)

/** One label written on the picture. */
@Immutable
data class MomentLabel(
    /** Tells labels apart while they move (unique within one picture's marks). */
    val id: Int,
    val text: String,
    /** Its middle: 0 to 1 across the picture's width and down its height. */
    val x: Float,
    val y: Float,
    /** Letter size as a share of the picture's width. */
    val size: Float,
    val style: MomentLabelStyle,
    val ink: MomentInk,
    /** Degrees clockwise about its middle, in (−180, 180] (step R3); 0 when made. */
    val turn: Float = 0f,
    /** "Pulse, reinvented"'s Studio: its lettering; [MomentFont.Classic], today's bold system font, everywhere else. */
    val font: MomentFont = MomentFont.Classic,
    /** "Pulse, reinvented"'s Studio: a colour from the photo (ARGB) in place of [ink]; null everywhere else. */
    val tint: Int? = null,
    /** "Pulse, reinvented"'s Studio: drawn behind the photo's subject ([MomentMarks.subject]); in front everywhere else. */
    val behind: Boolean = false,
)

/** Everything written and drawn on one picture. */
@Immutable
data class MomentMarks(
    val strokes: List<MomentStroke> = emptyList(),
    val labels: List<MomentLabel> = emptyList(),
    /** "Pulse, reinvented"'s Studio: a film look over the whole photo ([MomentLooks]); the photo as it came everywhere else. */
    val look: MomentLook = MomentLook.Original,
    /** "Pulse, reinvented"'s Studio: the photo's subject, for labels set behind it; none everywhere else. */
    val subject: MomentSubject? = null,
    /** "Pulse, reinvented"'s Studio: things lifted from the photo, as objects on it ([MomentCutouts]); none elsewhere. */
    val cutouts: List<MomentCutout> = emptyList(),
    /** "Pulse, reinvented"'s Studio: what the person chose to blur before posting, on the photo as it came; none elsewhere. */
    val blur: List<app.pantopus.android.ui.screens.moments.studio.blur.MomentBlurBox> = emptyList(),
) {
    /** Nothing that would show: no line, no label with words, and no look. */
    val isEmpty: Boolean get() = strokes.isEmpty() && labels.none { it.text.isNotBlank() } && noStudioMarks

    /** "Pulse, reinvented"'s Studio: no look, no cutout and no blur (always so in today's composer). */
    private val noStudioMarks: Boolean get() = look == MomentLook.Original && cutouts.isEmpty() && blur.isEmpty()

    /** As they are kept: a label left empty is removed. */
    val kept: MomentMarks
        get() = if (labels.all { it.text.isNotBlank() }) this else copy(labels = labels.filter { it.text.isNotBlank() })
}

/** Which tool the editor opened with: the Post screen's "Text", "Draw" or "Resize" pill. */
enum class MomentMarksTool { Text, Draw, Resize }

/**
 * The marks editor while it is open: the marks as they are now, as they were when it opened (the X goes back to those),
 * and the ink, width and style picked. Kept on the view model, so turning the phone keeps all of it.
 */
@Immutable
data class MomentMarksEditing(
    val tool: MomentMarksTool,
    val marks: MomentMarks,
    val atOpen: MomentMarks,
    val ink: MomentInk = MomentInk.Yellow,
    val width: MomentLineWidth = MomentLineWidth.Medium,
    /** Text's ink and style (board T2: white on a label), apart from Draw's. */
    val textInk: MomentInk = MomentInk.White,
    val style: MomentLabelStyle = MomentLabelStyle.Label,
    /** Text: the label picked (outlined, the style and ink change it), and whether its words are being typed. */
    val selected: Int? = null,
    val typing: Boolean = false,
    /** Text opened: a new label goes in the middle once the editor knows the picture's size. */
    val addsLabel: Boolean = false,
    /** Resize: where the picture sits on the 9:16 canvas ([MomentPlacement]); null while it is as taken. */
    val placement: MomentPlacement? = null,
    val placementAtOpen: MomentPlacement? = null,
    /** Resize: a finger has moved the picture in this visit (its hint goes). */
    val gestured: Boolean = false,
    /** "Pulse, reinvented"'s Studio: the lettering for new labels; today's (Classic) everywhere else. */
    val font: MomentFont = MomentFont.Classic,
    /** "Pulse, reinvented"'s Studio: a colour from the photo for Text and for Draw, in place of the ink; null otherwise. */
    val textTint: Int? = null,
    val drawTint: Int? = null,
    /** "Pulse, reinvented"'s Studio: Draw's pen, and the eyedropper out; today's pen, and never out, everywhere else. */
    val pen: MomentPen = MomentPen.Marker,
    val dropping: Boolean = false,
) {
    /** The marks as Done keeps them. */
    val result: MomentMarks get() = marks.kept

    /** Something changed in this visit: the X asks before it drops it. */
    val changed: Boolean get() = result != atOpen || placement != placementAtOpen

    /** The label picked, if any. */
    val picked: MomentLabel? get() = selected?.let { id -> marks.labels.firstOrNull { it.id == id } }

    /** Room for another label (at most five). */
    val roomForLabel: Boolean get() = marks.kept.labels.size < MomentMarkRules.MAX_LABELS

    /** A line drawn: [points] in picture coordinates, [width] a share of the picture's width. */
    fun drawn(
        points: List<Float>,
        width: Float,
    ): MomentMarksEditing =
        if (points.size < 2 || marks.strokes.size >= MomentMarkRules.MAX_STROKES) {
            this
        } else {
            copy(marks = marks.copy(strokes = marks.strokes + line(points, width)))
        }

    /** Undo: the last line goes. */
    fun undone(): MomentMarksEditing = copy(marks = marks.copy(strokes = marks.strokes.dropLast(1)))

    /**
     * A new label with the keyboard up, if there's room: its middle at [x], [y], letters [size] (shares of the picture),
     * then [kept] inside the part every phone shows.
     */
    fun withNewLabel(
        x: Float,
        y: Float,
        size: Float,
        kept: (MomentLabel) -> MomentLabel,
    ): MomentMarksEditing {
        val settled = unpicked().copy(addsLabel = false)
        if (!settled.roomForLabel) return settled
        val id = (settled.marks.labels.maxOfOrNull { it.id } ?: 0) + 1
        val label = kept(MomentLabel(id, "", x, y, size, style, textInk, font = font, tint = textTint))
        return settled.copy(marks = settled.marks.copy(labels = settled.marks.labels + label), selected = id, typing = true)
    }

    /** A label tapped: it's picked and its words open for typing; the style and ink show its own. */
    fun editing(id: Int): MomentMarksEditing {
        val label = marks.labels.firstOrNull { it.id == id } ?: return this
        val settled = if (selected == id) this else typingEnded()
        return settled.copy(
            selected = id,
            typing = true,
            style = label.style,
            textInk = label.ink,
            font = label.font,
            textTint = label.tint,
        )
    }

    /** A label moved or resized with a finger: it's picked (not typed in). */
    fun moved(label: MomentLabel): MomentMarksEditing {
        val settled = if (selected == label.id) this else typingEnded()
        return settled.changed(
            label,
        ).copy(selected = label.id, style = label.style, textInk = label.ink, font = label.font, textTint = label.tint)
    }

    /** One label changed in place (TalkBack's moves, a resize). */
    fun changed(label: MomentLabel): MomentMarksEditing =
        copy(marks = marks.copy(labels = marks.labels.map { if (it.id == label.id) label else it }))

    /** The picked label's words, at most 80 characters (never cutting an emoji or other two-part letter in half). */
    fun typed(text: String): MomentMarksEditing {
        val kept = text.take(MomentMarkRules.MAX_LABEL_CHARS).let { if (it.lastOrNull()?.isHighSurrogate() == true) it.dropLast(1) else it }
        return picked?.let { changed(it.copy(text = kept)) } ?: this
    }

    /** Typing stops (a tap elsewhere, the keyboard put away): the label stays picked; one left empty is removed. */
    fun typingEnded(): MomentMarksEditing {
        val label = picked
        return when {
            label == null -> copy(selected = null, typing = false)
            label.text.isBlank() -> removed(label.id)
            else -> copy(typing = false)
        }
    }

    /** Nothing picked any more (a tap on the picture away from the labels). */
    fun unpicked(): MomentMarksEditing = typingEnded().copy(selected = null)

    fun removed(id: Int): MomentMarksEditing =
        copy(marks = marks.copy(labels = marks.labels.filterNot { it.id == id }), selected = selected.takeIf { it != id }, typing = false)

    /** Text's style: the picked label takes it, and so do new ones. */
    fun styled(style: MomentLabelStyle): MomentMarksEditing = (picked?.let { changed(it.copy(style = style)) } ?: this).copy(style = style)

    /** Text's ink: the picked label takes it, and so do new ones. */
    fun inked(ink: MomentInk): MomentMarksEditing =
        (picked?.let { changed(it.copy(ink = ink, tint = null)) } ?: this).copy(textInk = ink, textTint = null)

    /** The Studio's colour from the photo: on the picked label, and for the next ones (an ink picked takes it back). */
    fun tinted(color: Int): MomentMarksEditing = (picked?.let { changed(it.copy(tint = color)) } ?: this).copy(textTint = color)

    /** The Studio's lettering: on the picked label, and for the next ones. */
    fun fonted(font: MomentFont): MomentMarksEditing = (picked?.let { changed(it.copy(font = font)) } ?: this).copy(font = font)
}

/** The limits both phones keep, and the part of a picture every phone shows (the same numbers as iPhone's). */
object MomentMarkRules {
    const val MAX_LABELS = 5
    const val MAX_LABEL_CHARS = 80

    /** The most lines one picture keeps: Undo goes back one at a time, and the drawing stays cheap to redraw. */
    const val MAX_STROKES = 200

    /** Letters at least this tall in the 1024-px copy the picture check reads. */
    private const val CHECK_LETTERS_PX = 16f
    private const val CHECK_LONG_EDGE = 1024f

    /** The smallest letters, as a share of the picture's width, that the picture check still reads (16 px of 1024). */
    fun smallestLetters(
        pictureWidth: Int,
        pictureHeight: Int,
    ): Float = CHECK_LETTERS_PX * max(1f, pictureHeight.toFloat() / pictureWidth.coerceAtLeast(1)) / CHECK_LONG_EDGE

    /** A new label's letters, in dp on the screen showing the picture (board T2). */
    const val NEW_LABEL_POINTS = 22f

    /** Where Text puts its first label: this far down the editor's frame, above where the keyboard comes up. */
    const val NEW_LABEL_DOWN = 0.4f

    /** The largest letters a pinch makes, as a share of the picture's width. */
    const val LARGEST_LETTERS = 0.15f

    /**
     * Where a label's words wrap, in its own letter sizes: 288 pt at the default 22 pt (board T2). So a label is its
     * text, size and style alone, wraps the same in the editor and in the photo, and a pinch scales all of it.
     */
    const val WRAP_LETTERS = 288f / 22f

    /** A label's line height, and its box's padding and corners, in its own letter sizes (board T2). */
    const val LINE_HEIGHT = 1.27f
    const val PAD_DOWN = 0.41f
    const val PAD_ACROSS = 0.64f
    const val CORNER = 0.45f

    /** TalkBack's steps: a move is 5% of the picture, a resize a fifth, a turn 15°. */
    const val MOVE_STEP = 0.05f
    const val SIZE_STEP = 1.2f
    const val TURN_STEP = 15f

    /** The narrowest frame a viewer shows a Moment in (a 9:21 phone) and the widest (iPhone SE's, less its reply bar). */
    private const val NARROWEST_FRAME = 9f / 21f
    private const val WIDEST_FRAME = 0.63f

    /**
     * The share of a viewer frame its top bar covers, with one row of pills under the name (Live or Taken, and the
     * weather), on the phones where it covers the most: 19.6% on a 720 × 1280 Android phone with a 3-button bar and
     * 19.5% on an iPhone 17, with a little room. A second, wrapped pill row on a narrow phone isn't covered.
     */
    private const val TOP_BAR = 0.23f

    private const val SHAPE_STEPS = 10_000f

    /**
     * Where a label may go on a picture, in its own coordinates (shares of 1): as wide as a 9:21 screen shows, as tall
     * as iPhone SE's viewer frame shows, and below the lowest line any phone's top bar reaches in it. The whole label
     * stays inside; drawing isn't held to it; the editor's dashed line is drawn at its top. Tablets and unfolded phones
     * are not promised.
     */
    fun labelBox(
        pictureWidth: Int,
        pictureHeight: Int,
    ): LabelBox = labelBox(pictureWidth.toFloat() / pictureHeight.coerceAtLeast(1))

    /**
     * The part of a picture of [shape] every phone shows, centred: as wide as a 9:21 screen shows and as tall as iPhone
     * SE's viewer frame shows (on the 9:16 canvas, 0.762 × 0.893). Resize outlines it while the picture moves.
     */
    fun shownPart(shape: Float): LabelBox {
        val width = min(1f, NARROWEST_FRAME / shape)
        val height = min(1f, shape / WIDEST_FRAME)
        return LabelBox((1f - width) / 2, (1f - height) / 2, (1f + width) / 2, (1f + height) / 2)
    }

    /**
     * [labelBox] from the picture's shape alone (width over height), rounded to a ten-thousandth so the picture drawn
     * at any size, on the screen or in the photo, gets exactly the same box (and its labels the same line breaks).
     */
    fun labelBox(shape: Float): LabelBox {
        val aspect = (shape * SHAPE_STEPS).roundToInt() / SHAPE_STEPS
        val width = min(1f, NARROWEST_FRAME / aspect)
        val height = min(1f, aspect / WIDEST_FRAME)
        return LabelBox(
            left = (1f - width) / 2,
            top = (1f - height) / 2 + TOP_BAR * height,
            right = (1f + width) / 2,
            bottom = (1f + height) / 2,
        )
    }
}

/** Where a label may go ([MomentMarkRules.labelBox]), in the picture's own coordinates. */
@Immutable
data class LabelBox(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top
}
