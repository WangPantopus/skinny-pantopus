@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardArt.agedEdges
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardArt.paperGrain
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.rememberReduceMotion
import coil.compose.AsyncImage

/**
 * Sizes on a card as parts of its width, as the printed card has them; the lettering is printed, so it keeps its size
 * whatever the phone's text size (the note is read out in full to a screen reader).
 */
private class CardScale(
    private val widthPx: Float,
    private val density: Density,
) {
    fun dp(part: Float): Dp = with(density) { (widthPx * part).toDp() }

    fun sp(part: Float): TextUnit = with(density) { (widthPx * part).toSp() }

    fun px(part: Float): Float = widthPx * part
}

/**
 * The picture side of a Christmas card: the founder's photo (with its own cream border) and, under it, the strip the
 * app prints as the original card had it: the picture's caption by hand, CHRISTMAS, 2026, and a red postmark with the
 * day it was mailed ([mailedOn]; none while it's being written).
 */
@Composable
fun HolidayCardFront(
    design: String,
    caption: String?,
    paper: String?,
    year: Int,
    modifier: Modifier = Modifier,
    mailedOn: String? = null,
    thumb: Boolean = false,
) {
    val paperColor = remember(paper) { HolidayCardArt.paper(paper) }
    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxWidth()
                .aspectRatio(HolidayCardArt.cardAspect(design))
                .background(paperColor),
    ) {
        val scale = CardScale(constraints.maxWidth.toFloat(), LocalDensity.current)
        Column(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = HolidayCardArt.picture(design, thumb),
                contentDescription = null,
                contentScale = ContentScale.FillBounds,
                modifier = Modifier.fillMaxWidth().aspectRatio(HolidayCardArt.pictureAspect(design)),
            )
            PrintedStrip(caption.orEmpty(), year, mailedOn, scale)
        }
        Box(Modifier.matchParentSize().drawBehind { agedEdges(scale.px(0.03f)) })
    }
}

/** The strip under the picture: the caption, CHRISTMAS, 2026 and the postmark, on the card's grained paper. */
@Composable
private fun PrintedStrip(
    caption: String,
    year: Int,
    mailedOn: String?,
    scale: CardScale,
) {
    // About the size the original cards printed it; a long caption gets smaller so it stays on one line beside the
    // postmark (the hand runs up to 0.53 em a letter).
    val captionSize = minOf(0.048f, 0.70f / maxOf(1f, caption.length * 0.53f))
    val grainStep = scale.px(0.0176f)
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .drawBehind { paperGrain(PantopusColors.cardGrain, step = grainStep, dot = grainStep / 3f) },
    ) {
        Text(
            caption,
            fontFamily = HolidayCardArt.captionHand,
            fontSize = scale.sp(captionSize),
            lineHeight = scale.sp(captionSize),
            color = PantopusColors.cardCaptionInk,
            textAlign = TextAlign.Center,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Visible,
            modifier = Modifier.offset(x = scale.dp(0.04f), y = scale.dp(0.034f)).width(scale.dp(0.74f)),
        )
        Text(
            "CHRISTMAS, $year",
            fontFamily = FontFamily.Serif,
            fontSize = scale.sp(0.022f),
            letterSpacing = 0.42.em,
            color = PantopusColors.cardYearInk,
            textAlign = TextAlign.Center,
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.offset(x = scale.dp(0.04f), y = scale.dp(0.102f)).width(scale.dp(0.74f)),
        )
        CardPostmark(
            day = HolidayCardTimes.postmarkDay(mailedOn, HolidayCardTimes.zone(null)),
            year = year,
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = -scale.dp(0.02f), y = scale.dp(0.018f))
                    .size(width = scale.dp(0.2f), height = scale.dp(0.12f)),
        )
    }
}

/** Two red rings with the day it was mailed over the year, and three wavy cancel lines (the web's 100 × 60 drawing). */
@Composable
private fun CardPostmark(
    day: String,
    year: Int,
    modifier: Modifier = Modifier,
) {
    val measurer = rememberTextMeasurer()
    Canvas(modifier = modifier.clearAndSetSemantics {}) {
        val unit = size.width / 100f
        val ink = PantopusColors.cardPostmark
        val lines = ink.copy(alpha = 0.82f)
        val center = Offset(36f * unit, 30f * unit)
        drawCircle(lines, radius = 22f * unit, center = center, style = Stroke(width = 1.6f * unit))
        drawCircle(lines, radius = 18.5f * unit, center = center, style = Stroke(width = 0.8f * unit))
        listOf(21f, 30f, 39f).forEach { y ->
            val wave =
                Path().apply {
                    moveTo(58f * unit, y * unit)
                    quadraticBezierTo(64f * unit, (y - 4f) * unit, 70f * unit, y * unit)
                    quadraticBezierTo(76f * unit, (y + 4f) * unit, 82f * unit, y * unit)
                    quadraticBezierTo(88f * unit, (y - 4f) * unit, 94f * unit, y * unit)
                }
            drawPath(wave, lines, style = Stroke(width = 1.6f * unit))
        }
        val words = ink.copy(alpha = 0.86f)

        fun word(
            text: String,
            baseline: Float,
            fontSize: Float,
        ) {
            val layout =
                measurer.measure(
                    text,
                    TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = (fontSize * unit).toSp()),
                )
            drawText(
                layout,
                color = words,
                topLeft = Offset(36f * unit - layout.size.width / 2f, baseline * unit - layout.firstBaseline),
            )
        }
        if (day.isNotEmpty()) {
            word(day, baseline = 28f, fontSize = 7.6f)
            word(year.toString(), baseline = 40f, fontSize = 8.5f)
        } else {
            word("DEC", baseline = 33f, fontSize = 10f)
            word(year.toString(), baseline = 45f, fontSize = 8.5f)
        }
    }
}

/**
 * The back of a Christmas card: the same card stock, faint lines, the note in fountain-pen blue, and who it's from
 * printed at the bottom. It fills the box it's given (the flip lays it over the picture side, the same size). Pass
 * [writing] for the writing box while it's being written; it gets the note's style.
 */
@Composable
fun HolidayCardBack(
    paper: String?,
    fromName: String,
    year: Int,
    modifier: Modifier = Modifier,
    message: String? = null,
    writing: (@Composable (TextStyle) -> Unit)? = null,
) {
    val paperColor = remember(paper) { HolidayCardArt.paper(paper) }
    BoxWithConstraints(modifier = modifier.fillMaxSize().background(paperColor)) {
        val scale = CardScale(constraints.maxWidth.toFloat(), LocalDensity.current)
        val grainStep = scale.px(0.0176f)
        val lineHeight = scale.px(0.076f)
        val noteStyle =
            TextStyle(
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
                fontSize = scale.sp(0.047f),
                lineHeight = scale.sp(0.076f),
                // Every line exactly one rule tall, so the writing sits on the lines.
                lineHeightStyle = LineHeightStyle(alignment = LineHeightStyle.Alignment.Center, trim = LineHeightStyle.Trim.None),
                color = PantopusColors.cardNoteInk,
            )
        Box(Modifier.matchParentSize().drawBehind { paperGrain(PantopusColors.cardGrain, step = grainStep, dot = grainStep / 3f) })
        Box(
            modifier =
                Modifier
                    .padding(start = scale.dp(0.08f), end = scale.dp(0.08f), top = scale.dp(0.08f), bottom = scale.dp(0.15f))
                    .fillMaxSize()
                    .drawWithContent {
                        // Faint ruled lines under the writing, one per line of text.
                        var y = lineHeight
                        while (y <= size.height) {
                            drawLine(PantopusColors.cardRule, Offset(0f, y - 0.5f), Offset(size.width, y - 0.5f), strokeWidth = 1f)
                            y += lineHeight
                        }
                        drawContent()
                    },
        ) {
            if (writing != null) {
                writing(noteStyle)
            } else {
                Text(message.orEmpty(), style = noteStyle, overflow = TextOverflow.Clip)
            }
        }
        Text(
            "FROM ${fromName.uppercase()}",
            fontFamily = FontFamily.Serif,
            fontSize = scale.sp(0.03f),
            letterSpacing = 0.2.em,
            color = PantopusColors.cardFromInk,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier =
                Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = scale.dp(0.08f), end = scale.dp(0.08f), bottom = scale.dp(0.075f)),
        )
        Text(
            "PANTOPUS POST · CHRISTMAS $year",
            fontFamily = FontFamily.Serif,
            fontSize = scale.sp(0.019f),
            letterSpacing = 0.3.em,
            color = PantopusColors.cardFooterInk,
            textAlign = TextAlign.Center,
            maxLines = 1,
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(bottom = scale.dp(0.03f)),
        )
        Box(Modifier.matchParentSize().drawBehind { agedEdges(scale.px(0.03f)) })
    }
}

/**
 * A card you can turn over: the picture side, and the back laid over it at the same size. Turning takes half a
 * second; with animations off (Remove animations) the sides swap without turning. The side facing away is hidden
 * from screen readers.
 */
@Composable
fun HolidayCardFlip(
    showBack: Boolean,
    front: @Composable () -> Unit,
    back: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    val reduceMotion = rememberReduceMotion()
    val turn by animateFloatAsState(
        targetValue = if (showBack) 180f else 0f,
        animationSpec = if (reduceMotion) snap() else tween(durationMillis = 500, easing = EaseOut),
        label = "holidayCardTurn",
    )
    val density = LocalDensity.current.density
    val backUp = turn > 90f
    Box(
        modifier =
            modifier.graphicsLayer {
                rotationY = turn
                cameraDistance = 16f * density
            },
    ) {
        Box(
            Modifier
                .graphicsLayer { alpha = if (backUp) 0f else 1f }
                .then(if (backUp) Modifier.clearAndSetSemantics {} else Modifier),
        ) { front() }
        Box(
            Modifier
                .matchParentSize()
                .graphicsLayer {
                    rotationY = 180f
                    alpha = if (backUp) 1f else 0f
                }.then(if (backUp) Modifier else Modifier.clearAndSetSemantics {}),
        ) { back() }
    }
}
