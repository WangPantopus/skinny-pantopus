@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.Rect
import android.graphics.RectF
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.HolidayCardPreviewLinkPage
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * Look it over's picture of the page a card's link opens, with the table on: the table in the default slate, the shut
 * envelope with its wax seal, no picture and no note, and how to open it. By email it keeps its words about using the
 * address it was sent to; by link any account works.
 */
@Composable
internal fun LinkPageOnTable(page: HolidayCardPreviewLinkPage) {
    val art = rememberCardTableArt()
    val shape = RoundedCornerShape(16.dp)
    val cloth =
        remember { Paint(Paint.FILTER_BITMAP_FLAG).apply { colorFilter = PorterDuffColorFilter(clothTint(null).toArgb(), PorterDuff.Mode.MULTIPLY) } }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.tableSlate)
                .drawBehind {
                    val bitmap = art?.cloth ?: return@drawBehind
                    drawIntoCanvas { canvas ->
                        // The cloth's own weave, cut to the box rather than stretched.
                        val cut = minOf(bitmap.width.toFloat(), bitmap.height * size.width / size.height)
                        val top = (bitmap.height - cut * size.height / size.width) / 2f
                        canvas.nativeCanvas.drawBitmap(
                            bitmap,
                            Rect(0, top.toInt(), cut.toInt(), (top + cut * size.height / size.width).toInt()),
                            RectF(0f, 0f, size.width, size.height),
                            cloth,
                        )
                    }
                }.padding(horizontal = Spacing.s4, vertical = 18.dp)
                .testTag("sendCardLookLinkPage"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (art != null) {
            Canvas(Modifier.fillMaxWidth(0.62f).aspectRatio(1200f / 1392f)) {
                val width = size.width
                val height = size.height
                val depth = width * 512f / 1200f
                val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
                drawIntoCanvas { canvas ->
                    val native = canvas.nativeCanvas
                    native.save()
                    native.rotate(-1.1f, width / 2f, height / 2f)
                    native.drawBitmap(art.pocket, null, RectF(0f, 0f, width, height), paint)
                    native.drawBitmap(art.flapShadow, null, RectF(0f, 0f, width, height), paint)
                    native.drawBitmap(art.flapOut, null, RectF(0f, 0f, width, depth), paint)
                    val sealWidth = width * 0.28f
                    val sealHeight = sealWidth * art.wax.height / art.wax.width
                    val left = width * 0.36f
                    val top = depth * 0.71f
                    native.drawBitmap(art.wax, null, RectF(left, top, left + sealWidth, top + sealHeight), paint)
                    native.restore()
                }
            }
        }
        Text(
            "A Christmas card for you.",
            fontFamily = FontFamily.Serif,
            fontStyle = FontStyle.Italic,
            fontSize = 19.sp,
            lineHeight = 1.3.em,
            color = PantopusColors.tableCream,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s2),
        )
        Text(
            "From ${page.senderName.trim().removeSuffix(".")}.",
            fontFamily = FontFamily.Serif,
            fontSize = 15.sp,
            lineHeight = 1.3.em,
            color = PantopusColors.tableCreamSoft,
            textAlign = TextAlign.Center,
        )
        Text(
            (if (page.sealed) "It’s sealed until Christmas morning. " else "") +
                "You’ll need a free Pantopus account to open it and keep it.",
            fontSize = 13.5.sp,
            lineHeight = 1.4.em,
            color = PantopusColors.tableCreamSoft,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Spacing.s1),
        )
        PagePill("Open your card", strong = true)
        PagePill("Create a free account", strong = false)
        if (!page.byLink && page.sentTo.isNotBlank()) {
            Text(
                "Use ${page.sentTo}, the address this card was sent to.",
                fontSize = 12.5.sp,
                lineHeight = 1.35.em,
                color = PantopusColors.tableCreamFaint,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** A button on the picture of the page, drawn: it does nothing here. */
@Composable
private fun PagePill(
    words: String,
    strong: Boolean,
) {
    val shape = RoundedCornerShape(22.dp)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(shape)
                .background(if (strong) PantopusColors.cardWax else PantopusColors.tableGlass)
                .border(0.5.dp, PantopusColors.tableGlassLine, shape),
        contentAlignment = Alignment.Center,
    ) {
        Text(words, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.tableCream)
    }
}
