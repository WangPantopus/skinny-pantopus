@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PerforatedStamp
import app.pantopus.android.ui.components.Postmark
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusMark

/**
 * One piece of mail, drawn as the thing it is (Mail tab drawings, `MailPiece` and `Parts`): a cream envelope for a
 * letter, a window envelope for a bill or notice, a picture postcard, a booklet, a kraft parcel, a bundle, or a
 * Special delivery with its chevron border. Each carries a postmark with the town and day, a return address, and
 * either printed postage (verified senders) or a stamp (neighbors); an unknown sender gets no printed mark and says
 * "Unverified sender" in red. Sealed pieces are whole; opened envelopes show a torn top with the letter peeking out.
 * Old opened mail fades.
 *
 * The paper's own lettering stops growing at 1.4x text size so a piece keeps its shape; everything it says is also
 * in the line under it and in its one-sentence screen-reader label, which grow freely.
 */
@Composable
fun MailPiece(
    piece: MailPieceModel,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(density.density, minOf(density.fontScale, PIECE_MAX_FONT_SCALE))) {
        Box(
            modifier =
                modifier
                    .fillMaxWidth()
                    // Faded paper is drawn once into its own layer and kept, so a long list of old mail scrolls smoothly.
                    .then(
                        if (piece.fade < 1f) {
                            Modifier.graphicsLayer {
                                alpha = piece.fade
                                compositingStrategy = CompositingStrategy.Offscreen
                            }
                        } else {
                            Modifier
                        },
                    ),
        ) {
            when (piece.kind) {
                MailKind.Postcard -> PostcardPiece(piece)
                MailKind.Booklet -> BookletPiece(piece)
                MailKind.Parcel -> ParcelPiece(piece)
                MailKind.Bundle -> BundlePiece(piece)
                MailKind.Bill, MailKind.Notice ->
                    Opening(piece.opened) {
                        if (piece.special) SpecialEnvelope(piece) else WindowEnvelope(piece)
                    }
                MailKind.Letter ->
                    Opening(piece.opened) {
                        if (piece.special) SpecialEnvelope(piece) else LetterEnvelope(piece)
                    }
            }
        }
    }
}

/** The paper's lettering stops growing here (see [MailPiece]). */
private const val PIECE_MAX_FONT_SCALE = 1.4f

private val handwriting = TextStyle(fontFamily = FontFamily.Serif, fontStyle = FontStyle.Italic, color = PantopusColors.mailInkHand)
private val typewriter = TextStyle(fontFamily = FontFamily.Monospace, color = PantopusColors.mailInk)

// ── Sealed or torn ─────────────────────────────────────────────

/** An opened envelope: the top torn away and the letter peeking out above it. A sealed one is just [envelope]. */
@Composable
private fun Opening(
    opened: Boolean,
    envelope: @Composable () -> Unit,
) {
    if (!opened) return envelope()
    Box(modifier = Modifier.fillMaxWidth()) {
        // The letter inside, a strip of white paper with two printed lines, behind the torn edge.
        Column(
            modifier =
                Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth()
                    .height(30.dp)
                    .shadow(1.dp, RoundedCornerShape(2.dp))
                    .background(PantopusColors.appSurface, RoundedCornerShape(2.dp))
                    .padding(start = 14.dp, top = 7.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Box(Modifier.fillMaxWidth(0.46f).height(2.dp).background(PantopusColors.appBorder))
            Box(Modifier.fillMaxWidth(0.30f).height(2.dp).background(PantopusColors.appBorderSubtle))
        }
        Box(modifier = Modifier.padding(top = 14.dp).clip(TornTop)) { envelope() }
    }
}

/** The envelope's top edge torn open, as the drawing's ragged clip. */
private object TornTop : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density,
    ): Outline {
        val low = with(density) { 8.dp.toPx() }
        val high = with(density) { 2.dp.toPx() }
        val path =
            Path().apply {
                moveTo(0f, low)
                val teeth = 34
                for (index in 1..teeth) {
                    lineTo(size.width * index / teeth, if (index % 2 == 0) low else high)
                }
                lineTo(size.width, size.height)
                lineTo(0f, size.height)
                close()
            }
        return Outline.Generic(path)
    }
}

// ── Kinds ──────────────────────────────────────────────────────

/** A personal letter: cream envelope, handwritten addresses, a stamp or printed postage, the postmark. */
@Composable
private fun LetterEnvelope(piece: MailPieceModel) {
    val shape = RoundedCornerShape(6.dp)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 150.dp)
                .shadow(3.dp, shape)
                .background(PantopusColors.mailLetterPaper, shape)
                .border(1.dp, PantopusColors.mailLetterEdge, shape)
                .padding(start = 16.dp, end = 12.dp, top = 12.dp, bottom = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f).padding(top = 4.dp)) {
                Text(piece.from, style = handwriting, fontSize = 13.sp, lineHeight = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                piece.fromLine?.let {
                    Text(it, style = handwriting, fontSize = 12.sp, lineHeight = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            Postage(piece, stampWhenUnmarked = true)
        }
        Spacer(Modifier.height(10.dp))
        Row {
            Spacer(Modifier.weight(0.34f))
            Column(modifier = Modifier.weight(0.66f)) {
                piece.to?.let {
                    Text(it, style = handwriting, color = PantopusColors.mailInk, fontSize = 16.sp, lineHeight = 21.sp, maxLines = 2)
                }
                piece.toLine?.let {
                    Text(it, style = handwriting, color = PantopusColors.mailInk, fontSize = 15.sp, lineHeight = 20.sp, maxLines = 2)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        TrustLine(piece.sender)
    }
}

/** A bill or notice: a white window envelope with the sender's name printed, the address typed behind the window. */
@Composable
private fun WindowEnvelope(
    piece: MailPieceModel,
    noteOverride: String? = null,
) {
    val shape = RoundedCornerShape(4.dp)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 150.dp)
                .shadow(3.dp, shape)
                .background(PantopusColors.appSurface, shape)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(start = 16.dp, end = 14.dp, top = 14.dp, bottom = 13.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            SenderBlock(piece, modifier = Modifier.weight(1f))
            Postage(piece, stampWhenUnmarked = piece.sender.stamps)
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            AddressWindow(piece, modifier = Modifier.weight(0.6f))
            Spacer(Modifier.width(10.dp))
            (noteOverride ?: piece.note)?.let {
                Text(
                    it.uppercase(),
                    style = typewriter,
                    color = PantopusColors.appTextStrong,
                    fontSize = 9.5.sp,
                    lineHeight = 12.sp,
                    letterSpacing = 0.06.em,
                    textAlign = TextAlign.End,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(0.4f),
                )
            } ?: Spacer(Modifier.weight(0.4f))
        }
    }
}

/**
 * A Special delivery: it came on its own, outside the morning round. The red, white and blue chevron border around
 * an official envelope.
 */
@Composable
private fun SpecialEnvelope(piece: MailPieceModel) {
    val shape = RoundedCornerShape(6.dp)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 150.dp)
                .shadow(4.dp, shape)
                .clip(shape)
                .drawBehind { drawChevrons() }
                .padding(5.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 140.dp)
                    .background(PantopusColors.mailSpecialPaper, RoundedCornerShape(3.dp))
                    .padding(start = 12.dp, end = 10.dp, top = 10.dp, bottom = 10.dp),
        ) {
            Row(verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "SPECIAL DELIVERY",
                        style = typewriter,
                        color = PantopusColors.error,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.12.em,
                    )
                    Spacer(Modifier.height(6.dp))
                    SenderBlock(piece, withInitial = false)
                }
                Postage(piece, stampWhenUnmarked = piece.kind == MailKind.Letter || piece.sender.stamps)
            }
            Spacer(Modifier.height(10.dp))
            Row {
                Spacer(Modifier.weight(0.4f))
                TypedAddress(piece, modifier = Modifier.weight(0.6f))
            }
        }
    }
}

/** A picture postcard: readable without opening, the message on the left and the address on the right. */
@Composable
private fun PostcardPiece(piece: MailPieceModel) {
    val shape = RoundedCornerShape(4.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 150.dp)
                .shadow(3.dp, shape)
                .background(PantopusColors.mailPostcardPaper, shape)
                .border(1.dp, PantopusColors.mailPostcardRule, shape)
                .padding(start = 14.dp, end = 12.dp, top = 13.dp, bottom = 13.dp),
    ) {
        Column(modifier = Modifier.weight(0.55f)) {
            Text(
                piece.from.uppercase(),
                fontSize = 10.sp,
                lineHeight = 13.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.06.em,
                color = PantopusColors.primary600,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            piece.note?.let {
                Spacer(Modifier.height(6.dp))
                Text(it, style = handwriting, color = PantopusColors.appText, fontSize = 13.sp, lineHeight = 18.sp, maxLines = 4)
            }
            Spacer(Modifier.height(8.dp))
            TrustLine(piece.sender)
        }
        Box(
            modifier =
                Modifier
                    .padding(horizontal = 10.dp)
                    .width(1.dp)
                    .heightIn(min = 120.dp)
                    .background(PantopusColors.mailPostcardRule),
        )
        Column(modifier = Modifier.weight(0.45f), horizontalAlignment = Alignment.End) {
            Postage(piece, stampWhenUnmarked = true)
            Spacer(Modifier.height(10.dp))
            listOfNotNull(piece.to, piece.toLine).forEach { line ->
                Text(
                    line,
                    style = typewriter,
                    fontSize = 10.sp,
                    lineHeight = 15.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().drawBehind { drawRuledLine() },
                )
            }
        }
    }
}

/** A booklet: a printed cover with the sender's name and title, a mailing label, the pages behind it. */
@Composable
private fun BookletPiece(piece: MailPieceModel) {
    val shape = RoundedCornerShape(4.dp)
    Box(modifier = Modifier.fillMaxWidth().heightIn(min = 172.dp)) {
        Box(
            Modifier
                .matchParentSize()
                .padding(start = 6.dp, top = 6.dp)
                .shadow(4.dp, shape)
                .background(PantopusColors.appSurfaceSunken, shape)
                .border(1.dp, PantopusColors.appBorder, shape),
        )
        Box(
            Modifier
                .matchParentSize()
                .padding(start = 3.dp, top = 3.dp, end = 3.dp, bottom = 3.dp)
                .background(PantopusColors.appSurfaceMuted, shape)
                .border(1.dp, PantopusColors.appBorder, shape),
        )
        Column(
            modifier =
                Modifier
                    .padding(end = 6.dp, bottom = 6.dp)
                    .fillMaxWidth()
                    .heightIn(min = 166.dp)
                    .background(PantopusColors.primary900, shape)
                    .padding(start = 22.dp, end = 12.dp, top = 16.dp, bottom = 12.dp),
        ) {
            Text(
                piece.from.uppercase(),
                fontSize = 11.sp,
                lineHeight = 14.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.06.em,
                color = PantopusColors.mailBookletInk,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            piece.note?.let {
                Spacer(Modifier.height(10.dp))
                Text(
                    it,
                    fontFamily = FontFamily.Serif,
                    fontSize = 20.sp,
                    lineHeight = 24.sp,
                    color = PantopusColors.appSurface,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth(0.62f),
                )
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    piece.fromLine.orEmpty(),
                    fontSize = 11.sp,
                    lineHeight = 14.sp,
                    color = PantopusColors.mailBookletByline,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
                Column(
                    modifier =
                        Modifier
                            .width(132.dp)
                            .background(PantopusColors.appSurface, RoundedCornerShape(3.dp))
                            .padding(horizontal = 9.dp, vertical = 7.dp),
                ) {
                    listOfNotNull(piece.to, piece.toLine).forEach { line ->
                        Text(
                            line,
                            style = typewriter,
                            fontSize = 9.5.sp,
                            lineHeight = 12.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
        // Two staples on the spine.
        Box(Modifier.padding(start = 7.dp, top = 34.dp).size(width = 2.dp, height = 16.dp).background(PantopusColors.appBorder))
        Box(
            Modifier
                .align(Alignment.BottomStart)
                .padding(start = 7.dp, bottom = 40.dp)
                .size(width = 2.dp, height = 16.dp)
                .background(PantopusColors.appBorder),
        )
    }
}

/** A parcel: kraft paper, packing tape, a shipping label with a barcode, a stamp. */
@Composable
private fun ParcelPiece(piece: MailPieceModel) {
    val shape = RoundedCornerShape(6.dp)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 160.dp)
                .shadow(4.dp, shape)
                .clip(shape)
                .background(PantopusColors.mailKraft)
                .drawBehind {
                    // Packing tape across the box.
                    drawRect(
                        color = PantopusColors.mailKraftTape.copy(alpha = 0.78f),
                        topLeft = Offset(0f, size.height * 0.41f),
                        size = Size(size.width, 26.dp.toPx()),
                    )
                }
                .padding(14.dp),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth(0.58f)
                    .shadow(1.dp, RoundedCornerShape(3.dp))
                    .background(PantopusColors.appSurface, RoundedCornerShape(3.dp))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
        ) {
            Text("FROM", style = typewriter, color = PantopusColors.appTextMuted, fontSize = 9.5.sp, lineHeight = 13.sp)
            Text(piece.from, style = typewriter, fontWeight = FontWeight.Bold, fontSize = 9.5.sp, lineHeight = 13.sp, maxLines = 2)
            Spacer(Modifier.height(5.dp))
            Text("TO", style = typewriter, color = PantopusColors.appTextMuted, fontSize = 9.5.sp, lineHeight = 13.sp)
            listOfNotNull(piece.to, piece.toLine).forEach { line ->
                Text(line, style = typewriter, fontSize = 9.5.sp, lineHeight = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(6.dp))
            Canvas(Modifier.fillMaxWidth().height(14.dp)) { drawBarcode(piece.id) }
        }
        Box(modifier = Modifier.align(Alignment.TopEnd)) { Stamp(piece.stamp) }
        piece.note?.let {
            Text(
                it.uppercase(),
                style = typewriter,
                color = PantopusColors.mailKraftInk,
                fontSize = 9.5.sp,
                lineHeight = 12.sp,
                letterSpacing = 0.06.em,
                textAlign = TextAlign.End,
                maxLines = 3,
                modifier = Modifier.align(Alignment.BottomEnd).fillMaxWidth(0.34f),
            )
        }
    }
}

/** A bundle: pieces that came together, banded into one stack with the count on top. */
@Composable
private fun BundlePiece(piece: MailPieceModel) {
    val shape = RoundedCornerShape(4.dp)
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            Modifier
                .matchParentSize()
                .padding(start = 8.dp)
                .background(PantopusColors.mailLetterPaper, shape)
                .border(1.dp, PantopusColors.mailLetterEdge, shape),
        )
        Box(
            Modifier
                .matchParentSize()
                .padding(start = 4.dp, top = 4.dp)
                .background(PantopusColors.appSurface, shape)
                .border(1.dp, PantopusColors.appBorder, shape),
        )
        Box(modifier = Modifier.padding(top = 8.dp, end = 8.dp)) {
            Opening(piece.opened) {
                WindowEnvelope(piece, noteOverride = piece.note ?: piece.bundleCount?.let { "Bundle · $it pieces" } ?: "Bundle")
            }
        }
    }
}

// ── Parts ──────────────────────────────────────────────────────

/** The sender's printed name, address and how Pantopus checked them, as a bill or notice prints it. */
@Composable
private fun SenderBlock(
    piece: MailPieceModel,
    modifier: Modifier = Modifier,
    withInitial: Boolean = true,
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (withInitial) {
            Box(
                modifier = Modifier.size(24.dp).background(PantopusColors.mailInk, RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    piece.from.firstOrNull { it.isLetterOrDigit() }?.uppercase().orEmpty(),
                    color = PantopusColors.appSurface,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        Column {
            Text(
                piece.from,
                fontSize = 12.sp,
                lineHeight = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            piece.fromLine?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    lineHeight = 14.sp,
                    color = PantopusColors.appTextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.height(3.dp))
            TrustLine(piece.sender)
        }
    }
}

/** How Pantopus checked the sender; red, with a warning sign, for an unknown one. */
@Composable
private fun TrustLine(sender: MailSender) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        PantopusIconImage(icon = sender.icon, contentDescription = null, size = 12.dp, tint = sender.color)
        Text(sender.line, fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Medium, color = sender.color)
    }
}

/** The address behind a bill's window, typed. */
@Composable
private fun AddressWindow(
    piece: MailPieceModel,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .heightIn(min = 50.dp)
                .background(PantopusColors.mailWindow, RoundedCornerShape(4.dp))
                .border(1.dp, PantopusColors.mailWindowEdge, RoundedCornerShape(4.dp))
                .padding(horizontal = 10.dp, vertical = 9.dp),
    ) { TypedAddress(piece) }
}

@Composable
private fun TypedAddress(
    piece: MailPieceModel,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        listOfNotNull(piece.to, piece.toLine).forEach { line ->
            Text(line, style = typewriter, fontSize = 10.5.sp, lineHeight = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

/**
 * The top-right corner: printed postage for a verified sender (or Pantopus), else a stamp when [stampWhenUnmarked]
 * (a person's letter or card), with the postmark over its left edge. An unknown sender's envelope has no mark.
 */
@Composable
private fun Postage(
    piece: MailPieceModel,
    stampWhenUnmarked: Boolean,
) {
    val mark = piece.sender.mark
    // Printed marks keep their printed size in their fixed box at any text size; the piece's sentence says the same.
    val density = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1f)) {
        Box(modifier = Modifier.size(width = 108.dp, height = 56.dp)) {
            when {
                piece.sender == MailSender.Pantopus -> PantopusPostage(modifier = Modifier.align(Alignment.TopEnd))
                mark != null -> PrintedPostage(mark, modifier = Modifier.align(Alignment.TopEnd))
                stampWhenUnmarked -> Box(Modifier.align(Alignment.TopEnd)) { Stamp(piece.stamp) }
            }
            Postmark(
                modifier = Modifier.align(Alignment.CenterStart).offset(x = (-2).dp).size(width = 64.dp, height = 50.dp),
                ink = PantopusColors.mailInk,
                topLine = piece.postmarkTown?.uppercase() ?: piece.postmarkDay,
                bottomLine = if (piece.postmarkTown != null) piece.postmarkDay else piece.postmarkYear,
            )
        }
    }
}

/**
 * "PANTOPUS POST · VERIFIED · BUSINESS": the printed indicia verified senders carry instead of a stamp. One text of
 * three lines, so a long list lays out one paragraph per piece here rather than three.
 */
@Composable
private fun PrintedPostage(
    mark: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(width = 66.dp, height = 44.dp)
                .border(1.5.dp, PantopusColors.mailInk, RoundedCornerShape(2.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("PANTOPUS POST") }
                append("\nVERIFIED\n")
                append(mark)
            },
            style = typewriter,
            fontSize = 6.5.sp,
            lineHeight = 8.sp,
            letterSpacing = 0.04.em,
            textAlign = TextAlign.Center,
            maxLines = 3,
        )
    }
}

/** Pantopus's own printed mark on its letters (drawing `Parts`): the mark and PANTOPUS, in Pantopus blue. */
@Composable
private fun PantopusPostage(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .size(width = 66.dp, height = 44.dp)
                .border(1.5.dp, PantopusColors.primary600, RoundedCornerShape(2.dp)),
        horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusMark(size = 16.dp)
        Text(
            "PANTOPUS",
            style = typewriter,
            color = PantopusColors.primary600,
            fontSize = 6.5.sp,
            letterSpacing = 0.04.em,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
    }
}

/** A stamp from the stamp book: white perforated paper around Fir, Peak or River. */
@Composable
private fun Stamp(stamp: MailStamp) {
    PerforatedStamp(
        ink = PantopusColors.appSurface,
        width = 42.dp,
        height = 54.dp,
        toothRadius = 1.6.dp,
        toothGap = 6.dp,
    ) {
        Canvas(Modifier.padding(3.dp).fillMaxSize()) { drawStampArt(stamp) }
    }
}

// ── Drawing ────────────────────────────────────────────────────

/** Fir, Peak or River on its ink, from the drawing's 36×48 artwork. */
private fun DrawScope.drawStampArt(stamp: MailStamp) {
    val sx = size.width / 36f
    val sy = size.height / 48f

    fun at(
        x: Float,
        y: Float,
    ) = Offset(x * sx, y * sy)

    fun shape(
        color: Color,
        vararg points: Pair<Float, Float>,
    ) {
        val path =
            Path().apply {
                points.forEachIndexed { index, (x, y) -> if (index == 0) moveTo(x * sx, y * sy) else lineTo(x * sx, y * sy) }
                close()
            }
        drawPath(path, color)
    }
    when (stamp) {
        MailStamp.Fir -> {
            drawRect(PantopusColors.mailStampFir)
            drawCircle(PantopusColors.mailStampSun, radius = 4f * sx, center = at(27f, 11f))
            shape(PantopusColors.mailStampFirArt, 18f to 10f, 27f to 25f, 22f to 25f, 29f to 37f, 7f to 37f, 14f to 25f, 9f to 25f)
            drawRect(PantopusColors.mailStampFirArt, topLeft = at(16.5f, 37f), size = Size(3f * sx, 6f * sy))
        }
        MailStamp.Peak -> {
            drawRect(PantopusColors.mailStampPeak)
            shape(PantopusColors.mailStampPeakArt, 2f to 40f, 15f to 18f, 21f to 27f, 25f to 21f, 34f to 40f)
            shape(PantopusColors.appSurface, 15f to 18f, 19f to 24.5f, 16.5f to 23f, 13.5f to 25f)
            drawCircle(PantopusColors.mailStampSun, radius = 3.5f * sx, center = at(9f, 11f))
        }
        MailStamp.River -> {
            drawRect(PantopusColors.mailStampRiver)
            shape(
                PantopusColors.mailStampRiverArt,
                0f to 30f,
                6f to 27f,
                12f to 30f,
                18f to 27f,
                24f to 30f,
                30f to 27f,
                36f to 30f,
                36f to 48f,
                0f to 48f,
            )
            shape(PantopusColors.homeBg, 11f to 22f, 18f to 9f, 25f to 22f)
        }
    }
}

/** The Special delivery border: red, white, blue and white chevrons on the diagonal. */
private fun DrawScope.drawChevrons() {
    val red = 9.dp.toPx()
    val gap = 5.dp.toPx()
    val blue = 9.dp.toPx()
    val period = red + gap + blue + gap
    val reach = size.width + size.height
    drawRect(PantopusColors.appSurface)
    rotate(degrees = 45f, pivot = Offset(size.width / 2f, size.height / 2f)) {
        var x = -reach
        while (x < reach * 2) {
            drawRect(PantopusColors.error, topLeft = Offset(x, -reach), size = Size(red, reach * 3))
            drawRect(PantopusColors.primary600, topLeft = Offset(x + red + gap, -reach), size = Size(blue, reach * 3))
            x += period
        }
    }
}

/** A postcard's address rule under each typed line. */
private fun DrawScope.drawRuledLine() {
    drawLine(
        color = PantopusColors.mailPostcardRule,
        start = Offset(0f, size.height - 1f),
        end = Offset(size.width, size.height - 1f),
        strokeWidth = 1.dp.toPx(),
    )
}

/** A shipping label's barcode, the same bars for the same piece. */
private fun DrawScope.drawBarcode(seed: String) {
    var x = 0f
    var index = 0
    val unit = 1.dp.toPx()
    while (x < size.width) {
        val code = seed.getOrNull(index % seed.length.coerceAtLeast(1))?.code ?: index
        val bar = unit * (1 + code % 2)
        val space = unit * (1 + (code / 2) % 3)
        drawRect(PantopusColors.mailInk, topLeft = Offset(x, 0f), size = Size(bar, size.height))
        x += bar + space
        index++
    }
}
