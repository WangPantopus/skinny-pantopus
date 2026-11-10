@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.LineHeightStyle
import app.pantopus.android.R
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardArt
import app.pantopus.android.ui.theme.PantopusColors

/** The note's pen as a font: La Belle Aurore (SIL Open Font License, `assets/licenses`). */
internal val cardPen = FontFamily(Font(R.font.la_belle_aurore))

/**
 * The picture side at the card's own 5:6 shape (launch key `card_table`), the same drawing as on the table: for the
 * large look on Pick a card, Look it over and Sent.
 */
@Composable
internal fun CardTableFront(
    design: String,
    caption: String?,
    paper: String?,
    year: Int,
    mailedOn: String?,
    modifier: Modifier = Modifier,
) {
    val art = rememberCardFaceArt()
    val density = LocalDensity.current.density
    val painter = remember(art, density) { art?.let { CardFacePainter(it, density) } }
    val picture = rememberCardPicture(design)
    val words =
        remember(design, caption, paper, year, mailedOn) {
            CardFaceWords(
                number = cardNumber(null, design),
                caption = caption.orEmpty(),
                paper = cardPaperColor(paper),
                year = year,
                postmarkDay = cardPostmarkDay(mailedOn),
                note = "",
                from = "",
            )
        }
    val loaded = (picture as? CardPictureState.Loaded)?.picture
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .aspectRatio(5f / 6f)
                .background(HolidayCardArt.paper(paper))
                .drawBehind {
                    val face = painter ?: return@drawBehind
                    drawIntoCanvas { face.drawFront(it.nativeCanvas, size.width, words, loaded) }
                },
    )
}

/**
 * The back at the card's own shape: its rules, who it's from and the foot, with the note in the pen, or [writing] (the
 * writing box) on the same rules, in the same pen and at the same size, so what's written is what arrives.
 */
@Composable
internal fun CardTableBack(
    design: String?,
    paper: String?,
    fromName: String,
    year: Int,
    message: String?,
    writing: (@Composable (TextStyle) -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val art = rememberCardFaceArt()
    val density = LocalDensity.current
    val painter = remember(art, density.density) { art?.let { CardFacePainter(it, density.density) } }
    val first = remember(fromName) { fromName.trim().substringBefore(' ').removeSuffix(",") }
    val words =
        remember(design, paper, first, year, message, writing == null) {
            CardFaceWords(
                number = cardNumber(null, design.orEmpty()),
                caption = "",
                paper = cardPaperColor(paper),
                year = year,
                postmarkDay = "",
                note = if (writing == null) message.orEmpty() else "",
                from = first,
            )
        }
    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxSize()
                .background(HolidayCardArt.paper(paper))
                .drawBehind {
                    val face = painter ?: return@drawBehind
                    // Off the table there's no lamp to brighten it: the grain at a quarter keeps the back bright cream.
                    val grain = art?.paperQuarter ?: return@drawBehind
                    drawIntoCanvas { face.drawBack(it.nativeCanvas, size.width, words, grain) }
                },
    ) {
        if (writing != null) {
            val u = with(density) { constraints.maxWidth.toFloat() / 100f }
            val style =
                TextStyle(
                    fontFamily = cardPen,
                    fontSize = with(density) { (u * 6f).toSp() },
                    lineHeight = with(density) { (u * 7.6f).toSp() },
                    lineHeightStyle = LineHeightStyle(alignment = LineHeightStyle.Alignment.Center, trim = LineHeightStyle.Trim.None),
                    color = PantopusColors.tablePen,
                )
            Box(
                modifier =
                    Modifier
                        .padding(
                            start = with(density) { (u * 8f).toDp() },
                            end = with(density) { (u * 7f).toDp() },
                            top = with(density) { (u * 9f).toDp() },
                        ).height(with(density) { (u * 83.6f).toDp() }),
            ) { writing(style) }
        }
    }
}
