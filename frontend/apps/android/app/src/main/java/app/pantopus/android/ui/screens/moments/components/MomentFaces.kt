@file:Suppress("MagicNumber", "LongParameterList", "TooManyFunctions", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.moments.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentAuthorDto
import app.pantopus.android.ui.theme.MarkVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevation
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusMark
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import coil.compose.AsyncImage
import kotlin.math.PI
import kotlin.math.abs

/** The colors behind a face without a photo, picked from the author's id so a person keeps theirs (board M1). */
data class MomentFacePalette(
    val background: Color,
    val ink: Color,
)

private val personPalettes =
    listOf(
        MomentFacePalette(PantopusColors.momentFaceBlueBg, PantopusColors.momentFaceBlue),
        MomentFacePalette(PantopusColors.momentFaceGreenBg, PantopusColors.momentFaceGreen),
        MomentFacePalette(PantopusColors.momentFaceAmberBg, PantopusColors.momentFaceAmber),
        MomentFacePalette(PantopusColors.momentFaceRoseBg, PantopusColors.momentFaceRose),
        MomentFacePalette(PantopusColors.momentFaceSlateBg, PantopusColors.momentFaceSlate),
        MomentFacePalette(PantopusColors.momentFaceTealBg, PantopusColors.momentFaceTeal),
    )

private val businessPalette = MomentFacePalette(PantopusColors.momentFaceVioletBg, PantopusColors.momentFaceViolet)

/** A business's face sits on violet, the curator's on white; a person's color follows their id. */
fun MomentAuthorDto.facePalette(): MomentFacePalette =
    when (kind) {
        "business" -> businessPalette
        "pantopus" -> MomentFacePalette(PantopusColors.appSurface, PantopusColors.momentBrand)
        else -> personPalettes[abs(id.hashCode() % personPalettes.size)]
    }

/** "AM" for Aisha M.: the server's initials, else the first letters of the name. */
fun MomentAuthorDto.faceInitials(): String =
    initials?.takeIf { it.isNotBlank() }?.take(2)?.uppercase()
        ?: (name ?: firstName).orEmpty().split(' ').filter { it.isNotBlank() }.take(2).mapNotNull { it.firstOrNull()?.uppercaseChar() }
            .joinToString("")

/**
 * A face: the person's photo (initials under it while it loads or when there is none), a business's logo or store
 * glyph, or the Pantopus mark for the curator.
 */
@Composable
fun MomentFace(
    author: MomentAuthorDto,
    size: Dp,
    modifier: Modifier = Modifier,
    initialsSize: TextUnit = (size.value * 0.36f).sp,
) {
    val palette = author.facePalette()
    Box(
        modifier = modifier.size(size).clip(CircleShape).background(palette.background),
        contentAlignment = Alignment.Center,
    ) {
        when (author.kind) {
            "pantopus" -> PantopusMark(size = size * 0.6f, variant = MarkVariant.Light)
            "business" ->
                PantopusIconImage(icon = PantopusIcon.Store, contentDescription = null, size = size * 0.48f, tint = palette.ink)
            else -> {
                val initials = author.faceInitials()
                if (initials.isEmpty()) {
                    PantopusIconImage(icon = PantopusIcon.User, contentDescription = null, size = size * 0.48f, tint = palette.ink)
                } else {
                    Text(text = initials, color = palette.ink, fontSize = initialsSize, fontWeight = FontWeight.SemiBold, maxLines = 1)
                }
            }
        }
        if (author.kind != "pantopus" && !author.avatarUrl.isNullOrBlank()) {
            AsyncImage(
                model = author.avatarUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

/** Your own face before a photo loads: the person glyph on blue (boards P3 and P5). */
@Composable
fun MomentSelfFace(
    size: Dp,
    avatarUrl: String?,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.size(size).clip(CircleShape).background(PantopusColors.momentFaceBlueBg),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.User, contentDescription = null, size = size * 0.48f, tint = PantopusColors.momentFaceBlue)
        if (!avatarUrl.isNullOrBlank()) {
            AsyncImage(model = avatarUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        }
    }
}

/** The small check of a verified resident (boards M1, V1): white on sky, with a ring in the surface color. */
@Composable
fun MomentVerifiedCheck(
    size: Dp,
    modifier: Modifier = Modifier,
    ring: Dp = 2.dp,
    ringColor: Color = PantopusColors.appSurface,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .background(ringColor)
                .padding(ring)
                .clip(CircleShape)
                .background(PantopusColors.primary600),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = size * 0.5f, strokeWidth = 4f, tint = Color.White)
    }
}

/**
 * Draws a Moments ring: one segment per Moment with an 8-unit gap (one full circle for a single Moment), each in the
 * sky-to-green gradient while new and gray once watched ([seen], oldest first, starting at the top and going
 * clockwise). Measured on a 64-unit pin, as the boards are.
 */
fun DrawScope.drawMomentRing(
    seen: List<Boolean>,
    center: Offset,
    radius: Float,
    strokeWidth: Float,
    gap: Float,
) {
    val count = seen.size.coerceAtLeast(1)
    val gradient =
        Brush.linearGradient(
            colors = listOf(PantopusColors.momentRingStart, PantopusColors.momentRingEnd),
            start = Offset(center.x - radius, center.y - radius),
            end = Offset(center.x + radius, center.y + radius),
        )
    val topLeft = Offset(center.x - radius, center.y - radius)
    val arcSize = Size(radius * 2, radius * 2)
    if (count == 1) {
        val watched = seen.firstOrNull() ?: false
        if (watched) {
            drawCircle(color = PantopusColors.momentRingSeen, radius = radius, center = center, style = Stroke(strokeWidth))
        } else {
            drawCircle(brush = gradient, radius = radius, center = center, style = Stroke(strokeWidth))
        }
        return
    }
    val circumference = 2 * PI.toFloat() * radius
    val step = 360f / count
    val sweep = ((circumference / count - gap) / circumference * 360f).coerceAtLeast(1f)
    for (index in 0 until count) {
        val start = -90f + index * step
        val stroke = Stroke(width = strokeWidth, cap = StrokeCap.Round)
        if (seen[index]) {
            drawArc(PantopusColors.momentRingSeen, start, sweep, false, topLeft, arcSize, style = stroke)
        } else {
            drawArc(gradient, start, sweep, false, topLeft, arcSize, style = stroke)
        }
    }
}

/** A posting ring: the track, and the sky arc for how far the upload has come (board P5). */
fun DrawScope.drawPostingRing(
    progress: Float,
    center: Offset,
    radius: Float,
    strokeWidth: Float,
) {
    drawCircle(color = PantopusColors.momentRingTrack, radius = radius, center = center, style = Stroke(strokeWidth))
    val sweep = 360f * progress.coerceIn(0f, 1f)
    if (sweep > 0f) {
        drawArc(
            color = PantopusColors.primary600,
            startAngle = -90f,
            sweepAngle = sweep,
            useCenter = false,
            topLeft = Offset(center.x - radius, center.y - radius),
            size = Size(radius * 2, radius * 2),
            style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
        )
    }
}

/** The pin's outline: its round head and the point under it (64 × 72 on the boards). */
private val PinShape =
    GenericShape { size, _ ->
        val unit = size.width / 64f
        addOval(androidx.compose.ui.geometry.Rect(0.5f * unit, 0.5f * unit, 63.5f * unit, 63.5f * unit))
        moveTo(25f * unit, 58f * unit)
        lineTo(32f * unit, 71f * unit)
        lineTo(39f * unit, 58f * unit)
        close()
    }

/** `drop-shadow(0 2px 3px rgba(0,0,0,0.30))` under a pin. */
private val PinShadow = PantopusElevation(Color.Black, 0.30f, 3.dp, 0.dp, 2.dp)

/** Where a map pin's point is, from its top: the overlay places that spot on the Moment's location. */
val MOMENT_PIN_ANCHOR_FROM_TOP: Dp = 71.dp

/**
 * A ring on the map (board M1): a 64 × 72 pin in the surface color with the face inside the ring and the check of a
 * verified resident at its lower right. [seen] holds each Moment's watched state, oldest first.
 */
@Composable
fun MomentMapPin(
    author: MomentAuthorDto,
    seen: List<Boolean>,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.size(width = 64.dp, height = 72.dp)) {
        Canvas(modifier = Modifier.fillMaxSize().pantopusShadow(PinShadow, PinShape)) {
            val unit = size.width / 64f
            drawCircle(color = Color.White, radius = 31.5f * unit, center = Offset(32f * unit, 32f * unit))
            val tail =
                Path().apply {
                    moveTo(25f * unit, 58f * unit)
                    lineTo(32f * unit, 71f * unit)
                    lineTo(39f * unit, 58f * unit)
                    close()
                }
            drawPath(tail, Color.White)
            drawMomentRing(seen, Offset(32f * unit, 32f * unit), 29.25f * unit, 3.5f * unit, 8f * unit)
        }
        MomentFace(author = author, size = 50.dp, modifier = Modifier.offset(x = 7.dp, y = 7.dp), initialsSize = 18.sp)
        if (author.verified) {
            MomentVerifiedCheck(size = 18.dp, modifier = Modifier.offset(x = 44.dp, y = 42.dp))
        }
    }
}

/**
 * Your Moment while it posts (board P5): the progress ring around your face, on the pin. With [author] (you, as the
 * server names you) the face is the one your ring will wear, so nothing changes when the ring takes its place.
 */
@Composable
fun MomentPostingPin(
    progress: Float,
    avatarUrl: String?,
    modifier: Modifier = Modifier,
    author: MomentAuthorDto? = null,
) {
    Box(modifier = modifier.size(width = 64.dp, height = 72.dp)) {
        Canvas(modifier = Modifier.fillMaxSize().pantopusShadow(PinShadow, PinShape)) {
            val unit = size.width / 64f
            drawCircle(color = Color.White, radius = 31.5f * unit, center = Offset(32f * unit, 32f * unit))
            val tail =
                Path().apply {
                    moveTo(25f * unit, 58f * unit)
                    lineTo(32f * unit, 71f * unit)
                    lineTo(39f * unit, 58f * unit)
                    close()
                }
            drawPath(tail, Color.White)
            drawPostingRing(progress, Offset(32f * unit, 32f * unit), 29.25f * unit, 3.5f * unit)
        }
        if (author != null) {
            MomentFace(author = author, size = 50.dp, modifier = Modifier.offset(x = 7.dp, y = 7.dp), initialsSize = 18.sp)
        } else {
            MomentSelfFace(size = 50.dp, avatarUrl = avatarUrl, modifier = Modifier.offset(x = 7.dp, y = 7.dp))
        }
    }
}

/**
 * A face in the strip (board M1): a 56 dp ring over the first name, gray once everything in it is watched. [label] is
 * what the strip writes under it ("Aisha", "You").
 */
@Composable
fun MomentStripFace(
    author: MomentAuthorDto,
    seen: List<Boolean>,
    label: String,
    modifier: Modifier = Modifier,
) {
    val watched = seen.all { it }
    Column(
        modifier = modifier.width(62.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(56.dp)) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val unit = size.width / 56f
                drawCircle(color = Color.White, radius = 27.5f * unit, center = Offset(28f * unit, 28f * unit))
                drawMomentRing(seen, Offset(28f * unit, 28f * unit), 25.75f * unit, 3f * unit, 8f * unit)
            }
            MomentFace(author = author, size = 44.dp, modifier = Modifier.offset(x = 6.dp, y = 6.dp), initialsSize = 15.sp)
            if (author.verified) {
                MomentVerifiedCheck(size = 16.dp, modifier = Modifier.offset(x = 39.dp, y = 37.dp))
            }
        }
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = if (watched) PantopusColors.appTextSecondary else PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(60.dp),
        )
    }
}

/** The strip's "Posting" cell while your Moment uploads (board P5). */
@Composable
fun MomentStripPosting(
    progress: Float,
    avatarUrl: String?,
    label: String,
    modifier: Modifier = Modifier,
    author: MomentAuthorDto? = null,
) {
    Column(
        modifier = modifier.width(62.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(modifier = Modifier.size(56.dp)) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val unit = size.width / 56f
                drawCircle(color = Color.White, radius = 27.5f * unit, center = Offset(28f * unit, 28f * unit))
                drawPostingRing(progress, Offset(28f * unit, 28f * unit), 25.75f * unit, 3f * unit)
            }
            if (author != null) {
                MomentFace(author = author, size = 44.dp, modifier = Modifier.offset(x = 6.dp, y = 6.dp), initialsSize = 15.sp)
            } else {
                MomentSelfFace(size = 44.dp, avatarUrl = avatarUrl, modifier = Modifier.offset(x = 6.dp, y = 6.dp))
            }
        }
        Text(text = label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600, maxLines = 1)
    }
}

/**
 * A crowded spot (board M1): up to three faces and "+N" in a pill with the gradient border, and the point under it.
 * [extra] is how many more people the bubble holds than it shows.
 */
@Composable
fun MomentClusterBubble(
    authors: List<MomentAuthorDto>,
    extra: Int,
    anyNew: Boolean,
    modifier: Modifier = Modifier,
) {
    val border =
        if (anyNew) {
            Brush.linearGradient(listOf(PantopusColors.momentRingStart, PantopusColors.momentRingEnd))
        } else {
            Brush.linearGradient(listOf(PantopusColors.momentRingSeen, PantopusColors.momentRingSeen))
        }
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Row(
            modifier =
                Modifier
                    .height(50.dp)
                    .pantopusShadow(ClusterShadow, RoundedCornerShape(25.dp))
                    .clip(RoundedCornerShape(25.dp))
                    .background(Color.White)
                    .border(3.dp, border, RoundedCornerShape(25.dp))
                    .padding(start = 7.dp, end = 15.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box {
                authors.take(3).forEachIndexed { index, author ->
                    Box(
                        modifier =
                            Modifier
                                .offset(x = (24 * index).dp)
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                                .padding(2.dp),
                    ) {
                        MomentFace(author = author, size = 32.dp, initialsSize = 13.sp)
                    }
                }
                // Holds the overlapped faces' full width.
                Box(modifier = Modifier.width((36 + 24 * (authors.take(3).size - 1).coerceAtLeast(0)).dp).height(36.dp))
            }
            if (extra > 0) {
                Text(
                    text = "+$extra",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.padding(start = 10.dp),
                )
            }
        }
        Canvas(modifier = Modifier.size(width = 16.dp, height = 9.dp).clearAndSetSemantics {}) {
            val path =
                Path().apply {
                    moveTo(0f, 0f)
                    lineTo(size.width / 2, size.height)
                    lineTo(size.width, 0f)
                    close()
                }
            drawPath(path, Color.White)
        }
    }
}

/** How far a cluster bubble's point is from its top: the overlay places the spot there. */
val MOMENT_CLUSTER_ANCHOR_FROM_TOP: Dp = 59.dp

private val ClusterShadow = PantopusElevation(Color.Black, 0.25f, 6.dp, 0.dp, 2.dp)
