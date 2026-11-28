@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.components

import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentStampKinds
import app.pantopus.android.data.api.models.moments.MomentStampPlacement
import app.pantopus.android.data.api.models.moments.MomentStampValueDto
import app.pantopus.android.data.api.models.moments.MomentWeatherDto
import app.pantopus.android.data.api.models.moments.beforeAfter
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlinx.coroutines.delay
import java.time.Instant
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/*
 * How a Pantopus-checked stamp looks ("Pulse, reinvented" phase 0 step 3; boards B1, B2, B3, B5), the same as on
 * iPhone (`MomentStampViews.swift`). The postmark is one round mark (the place over the top, the weather under it, the
 * date and time inside), in wet red ink while the Moment reads "Live from here" and dark ink after; every other stamp
 * is a small chip with its icon and words. The same drawing shows a stamp in the Studio and in the viewer.
 *
 * A stamp sits where its author put it, 0 to 1 across and down the picture itself (as `MomentMarks` places text and
 * drawings), and its size is a share of the picture's drawn width: scale 1 is 96/402 of it for the postmark and 34/402
 * tall for a chip (the lead, 2026-11-27). The stamps are drawn at their natural size on a 402-wide picture and scaled.
 */

/** The picture width the natural sizes are given for (an iPhone 17's points). */
const val STAMP_PICTURE_WIDTH = 402f

/** The postmark's natural size. */
private val POSTMARK_SIZE = 96.dp

/** What a stamp says and how it's named, for every app the same. */
object MomentStampWords {
    /** What a chip reads ("48°F · Fog", "Lacamas Lake", "180 ft"). */
    fun words(
        kind: String,
        value: MomentStampValueDto?,
    ): String =
        when (kind) {
            MomentStampKinds.WEATHER -> weather(MomentWeatherDto(value?.tempF, value?.kind, value?.label))
            else -> value?.label.orEmpty()
        }

    /** "48°F · Fog". */
    fun weather(weather: MomentWeatherDto?): String {
        weather ?: return ""
        val temp = weather.tempF?.let { "${it.roundToInt()}°F" }
        return listOfNotNull(temp, weather.label?.takeIf { it.isNotBlank() }).joinToString(" · ")
    }

    fun icon(kind: String): PantopusIcon =
        when (kind) {
            MomentStampKinds.POSTMARK -> PantopusIcon.CircleDot
            MomentStampKinds.WEATHER -> PantopusIcon.Cloud
            MomentStampKinds.ELEVATION -> PantopusIcon.Mountain
            MomentStampKinds.PLACE -> PantopusIcon.MapPin
            MomentStampKinds.TIME -> PantopusIcon.Clock
            MomentStampKinds.SUNSET -> PantopusIcon.Sunset
            else -> PantopusIcon.Home
        }

    /** The tray's name for each kind, for TalkBack. */
    fun name(kind: String): String =
        when (kind) {
            MomentStampKinds.POSTMARK -> "Postmark"
            MomentStampKinds.WEATHER -> "Weather"
            MomentStampKinds.ELEVATION -> "Elevation"
            MomentStampKinds.PLACE -> "Place"
            MomentStampKinds.TIME -> "Time"
            MomentStampKinds.SUNSET -> "Sunset"
            else -> "Miles from home"
        }

    /** What TalkBack reads for a stamp on the picture. */
    fun spoken(
        kind: String,
        value: MomentStampValueDto?,
    ): String =
        if (kind == MomentStampKinds.POSTMARK) {
            val parts = listOf(value?.place, value?.dateLabel, value?.timeLabel, weather(value?.weather))
            "Postmark: " + parts.filterNot { it.isNullOrBlank() }.joinToString(", ")
        } else {
            words(kind, value)
        }
}

/** One stamp at its natural size (scale 1 on a 402-wide picture). */
@Composable
fun MomentStampView(
    kind: String,
    value: MomentStampValueDto?,
    wet: Boolean,
    modifier: Modifier = Modifier,
) {
    if (kind == MomentStampKinds.POSTMARK) {
        MomentPostmark(
            place = value?.place.orEmpty(),
            date = value?.dateLabel.orEmpty(),
            time = value?.timeLabel.orEmpty(),
            weather = MomentStampWords.weather(value?.weather),
            wet = wet,
            modifier = modifier,
        )
    } else {
        MomentStampChip(icon = MomentStampWords.icon(kind), words = MomentStampWords.words(kind, value), modifier = modifier)
    }
}

/** A small stamp: its icon and its words on a dark glass chip (B2's "180 ft"). */
@Composable
fun MomentStampChip(
    icon: PantopusIcon,
    words: String,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(17.dp)
    Row(
        modifier =
            modifier
                .height(34.dp)
                .background(PantopusColors.studioStampChip, shape)
                .border(1.dp, PantopusColors.studioStampChipEdge, shape)
                .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, strokeWidth = 2.2f, tint = Color.White)
        Text(text = words, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, softWrap = false)
    }
}

/**
 * The postmark (B2): a round paper mark with two rings, the place along the top, the weather along the bottom, and the
 * date over the time in the middle, all in one ink (iPhone's measures: a 76-unit mark drawn 96 across).
 */
@Composable
fun MomentPostmark(
    place: String,
    date: String,
    time: String,
    weather: String,
    wet: Boolean,
    modifier: Modifier = Modifier,
) {
    val ink = if (wet) PantopusColors.studioWetInk else PantopusColors.studioDriedInk
    val paper = PantopusColors.studioPaper
    Canvas(
        modifier =
            modifier
                .size(POSTMARK_SIZE)
                .shadow(5.dp, CircleShape, ambientColor = PantopusColors.studioStampShadow),
    ) {
        val unit = size.minDimension / 76f
        val c = center
        drawCircle(paper)
        drawCircle(ink, radius = size.minDimension / 2 - 3.5f * unit, style = Stroke(width = 1.8f * unit))
        drawCircle(ink, radius = 20f * unit, style = Stroke(width = 1f * unit))
        drawIntoCanvas { canvas ->
            val native = canvas.nativeCanvas
            val paint = postmarkPaint(ink.toArgb())
            arcText(native, c, ArcLine(place.uppercase(), 25f * unit, 8.4f * unit, 1.6f * unit, top = true), paint)
            arcText(native, c, ArcLine(weather.uppercase(), 28.5f * unit, 7.4f * unit, 1.3f * unit, top = false), paint)
            paint.textAlign = Paint.Align.CENTER
            paint.letterSpacing = 0f
            paint.textSize = 9.6f * unit
            native.drawText(date.uppercase(), c.x, c.y - 1.2f * unit, paint)
            paint.textSize = 7.6f * unit
            paint.typeface = boldFace()
            native.drawText(time.uppercase(), c.x, c.y + 8.4f * unit, paint)
        }
    }
}

private fun heavyFace(): Typeface =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(Typeface.DEFAULT, 900, false) else Typeface.DEFAULT_BOLD

private fun boldFace(): Typeface =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(Typeface.DEFAULT, 700, false) else Typeface.DEFAULT_BOLD

private fun postmarkPaint(color: Int): Paint =
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
        typeface = heavyFace()
    }

/** One line of the postmark's words along its circle: how far out, how big, how far apart, and over or under. */
private data class ArcLine(
    val text: String,
    val radius: Float,
    val fontSize: Float,
    val kerning: Float,
    val top: Boolean,
)

/**
 * Words set along a circle of [ArcLine.radius] around [center]: over the top reading left to right, or under the bottom
 * reading left to right, both upright, centred on the circle. A long name shrinks until it fits a little less than half
 * of it, as on iPhone.
 */
private fun arcText(
    canvas: android.graphics.Canvas,
    center: Offset,
    line: ArcLine,
    paint: Paint,
) {
    val text = line.text
    val radius = line.radius
    val fontSize = line.fontSize
    val cx = center.x
    val cy = center.y
    if (text.isBlank()) return
    paint.textAlign = Paint.Align.LEFT
    paint.textSize = fontSize
    paint.letterSpacing = line.kerning / fontSize
    val natural = paint.measureText(text)
    val room = (PI * radius * 0.82).toFloat()
    if (natural > room) paint.textSize = fontSize * room / natural
    val width = paint.measureText(text)
    val oval = RectF(cx - radius, cy - radius, cx + radius, cy + radius)
    // Over the top the path runs clockwise from the left; under the bottom, the other way, so both read left to right.
    val path = Path().apply { addArc(oval, 180f, if (line.top) 180f else -180f) }
    val length = (PI * radius).toFloat()
    canvas.drawTextOnPath(text, path, (length - width) / 2, paint.textSize * 0.35f, paint)
}

/** The rectangle a picture of [picture]'s shape fills in [container], cropped to it (as the viewer and the Studio draw it). */
fun stampFrame(
    picture: IntSize?,
    width: Float,
    height: Float,
): Rect {
    if (picture == null || picture.width <= 0 || picture.height <= 0) return Rect(0f, 0f, width, height)
    val scale = max(width / picture.width, height / picture.height)
    val w = picture.width * scale
    val h = picture.height * scale
    return Rect((width - w) / 2, (height - h) / 2, (width + w) / 2, (height + h) / 2)
}

/**
 * Places [content] (a stamp at its natural size) with its centre at the stamp's point on [frame], at its size (the
 * stamp's scale on this frame's width) and turn. Its layout box is the stamp's own, unturned, so a tap lands on it.
 */
fun Modifier.stampPlaced(
    placement: MomentStampPlacement,
    frame: Rect,
): Modifier =
    layout { measurable, constraints ->
        val stamp = measurable.measure(Constraints())
        val cx = frame.left + placement.x.toFloat() * frame.width
        val cy = frame.top + placement.y.toFloat() * frame.height
        layout(constraints.maxWidth, constraints.maxHeight) {
            stamp.place((cx - stamp.width / 2f).roundToInt(), (cy - stamp.height / 2f).roundToInt())
        }
    }

/** A stamp's contents drawn at its size on a [frameWidthPx]-wide picture: its natural size times its scale there. */
@Composable
fun StampSized(
    scale: Double,
    frameWidthPx: Float,
    content: @Composable () -> Unit,
) {
    val density = LocalDensity.current
    val factor = (scale.toFloat() * frameWidthPx / density.density / STAMP_PICTURE_WIDTH).coerceAtLeast(0.01f)
    // A stamp is part of the picture: it keeps its size whatever the person's text size.
    CompositionLocalProvider(LocalDensity provides Density(density.density * factor, 1f), content = content)
}

/** A list of stamps drawn over a frame the picture fills (the viewer; nothing to touch). */
@Composable
fun MomentStampsDrawing(
    stamps: List<Pair<MomentStampPlacement, MomentStampValueDto?>>,
    picture: IntSize?,
    wet: Boolean,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val frame = stampFrame(picture, constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat())
        stamps.forEach { (placement, value) ->
            Box(
                modifier =
                    Modifier
                        .stampPlaced(placement, frame)
                        .graphicsLayer { rotationZ = placement.rotation.toFloat() }
                        .clearAndSetSemantics { contentDescription = MomentStampWords.spoken(placement.kind, value) },
            ) {
                StampSized(placement.scale, frame.width) { MomentStampView(placement.kind, value, wet) }
            }
        }
    }
}

/**
 * A posted Moment's stamps over its picture, in today's viewer, only while the viewer is opened with the Studio on
 * (`pulse_reinvented`); the server sends `stamps` only then. The postmark is wet red while the Moment reads "Live from
 * here" (`live_until` not passed) and dark ink after, and on every Moment without the Live mark; it dries on time, as the
 * Live pill does.
 */
@Composable
fun MomentStampsOverlay(
    moment: MomentDto,
    modifier: Modifier = Modifier,
) {
    // "Pulse, reinvented"'s layers over the picture, bottom to top: moving words (CONTRACT 7k) and a swatch's try-on
    // (7g) on the photo, the stamps, the fog a reader wipes (7g), the swatch's chips once the fog is wiped, then the cards
    // a reader answers (7b, 7g).
    MomentMovingWordsLayer(moment, modifier)
    MomentSwatchLayer(moment, modifier)
    MomentStampsOnly(moment, modifier)
    MomentFogLayer(moment, modifier)
    MomentSwatchChipsLayer(moment, modifier)
    MomentPlayLayer(moment, modifier)
}

@Composable
private fun MomentStampsOnly(
    moment: MomentDto,
    modifier: Modifier,
) {
    val stamps =
        remember(moment.id, moment.stamps) {
            moment.stamps.orEmpty().mapNotNull { stamp -> stamp.placement?.let { it to stamp.value } }.distinctBy { it.first.kind }
        }
    if (stamps.isEmpty()) return
    val liveUntil = remember(moment.liveUntil) { moment.liveUntil?.let { runCatching { Instant.parse(it) }.getOrNull() } }
    val wet by produceState(moment.takenHere && liveUntil?.isAfter(Instant.now()) == true, moment.id, liveUntil) {
        val until = liveUntil?.takeIf { moment.takenHere } ?: return@produceState
        val left = until.toEpochMilli() - Instant.now().toEpochMilli()
        if (left > 0) delay(left)
        value = false
    }
    val picture =
        moment.width
            ?.let { w -> moment.height?.let { h -> IntSize(w, h) } }
            ?.takeIf { moment.kind != "text" }
            // Before and after: the stamps sit on one half's frame (CONTRACT 7g).
            ?.let { if (moment.beforeAfter != null) halfOf(it) else it }
    MomentStampsDrawing(
        stamps = stamps,
        picture = picture,
        wet = wet,
        modifier = modifier.testTag("moments.stamps"),
    )
}

/** The larger of a stamp's two half sizes, as shares of the frame, kept inside [boxWidth] and [boxHeight]. */
fun stampHalf(
    sizePx: IntSize,
    frame: Rect,
    boxWidth: Float,
    boxHeight: Float,
): Pair<Float, Float> =
    min(sizePx.width / 2f / max(frame.width, 1f), boxWidth / 2) to min(sizePx.height / 2f / max(frame.height, 1f), boxHeight / 2)
