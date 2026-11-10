@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.R
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.screens.mailbox.components.MailStamp
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.lang.ref.SoftReference
import kotlin.math.min

/**
 * What a card's row in the Mailbox needs of the table's art (launch key `card_table`): the red paper, the stamps, the
 * postmark and the wax seal. Far less than the whole table, shared by every card row, and read away from the main thread.
 */
internal class CardRowArt private constructor(
    val paper: Bitmap,
    val postmark: Bitmap,
    val wax: Bitmap,
    val stamps: Map<MailStamp, Bitmap>,
) {
    companion object {
        private var kept = SoftReference<CardRowArt>(null)

        fun load(context: Context): CardRowArt {
            synchronized(this) { kept.get() }?.let { return it }
            val resources = context.applicationContext.resources

            fun read(id: Int) = BitmapFactory.decodeResource(resources, id)
            val art =
                CardRowArt(
                    paper = read(R.drawable.card_table_env_front),
                    postmark = read(R.drawable.card_table_postmark),
                    wax = read(R.drawable.card_table_wax),
                    stamps =
                        mapOf(
                            MailStamp.Fir to read(R.drawable.card_table_stamp_fir),
                            MailStamp.Peak to read(R.drawable.card_table_stamp_peak),
                            MailStamp.River to read(R.drawable.card_table_stamp_river),
                        ),
                )
            synchronized(this) { kept = SoftReference(art) }
            return art
        }
    }
}

/** The row's art once it's read; null until then, and the row shows its plain red. */
@Composable
internal fun rememberCardRowArt(): CardRowArt? {
    val context = LocalContext.current
    val art by produceState(initialValue = null as CardRowArt?, context) {
        value = withContext(Dispatchers.IO) { CardRowArt.load(context) }
    }
    return art
}

/** The real red paper across the whole row, its middle cut to the row's shape. */
internal fun DrawScope.drawCardRowPaper(art: CardRowArt) {
    val paper = art.paper
    val shape = size.width / size.height
    val cutWidth = min(paper.width.toFloat(), paper.height * shape)
    val cutHeight = cutWidth / shape
    val left = (paper.width - cutWidth) / 2f
    val top = (paper.height - cutHeight) / 2f
    drawIntoCanvas { canvas ->
        canvas.nativeCanvas.drawBitmap(
            paper,
            Rect(left.toInt(), top.toInt(), (left + cutWidth).toInt(), (top + cutHeight).toInt()),
            RectF(0f, 0f, size.width, size.height),
            Paint(Paint.FILTER_BITMAP_FLAG),
        )
    }
}

/**
 * The row's stamp with the postmark over its left edge, as on the envelope: the mailed day printed on the ring. With no
 * postmark yet (a card still being written) the stamp stands alone.
 */
@Composable
internal fun CardRowPostage(
    art: CardRowArt,
    piece: MailPieceModel,
    postmarked: Boolean,
    modifier: Modifier = Modifier,
) {
    val paints = remember { EnvelopePaints() }
    val rowPostmarkInk = PantopusColors.tablePostmarkCream.toArgb()
    Canvas(modifier = modifier.size(width = 130.dp, height = 64.dp).clearAndSetSemantics {}) {
        val canvas = drawContext.canvas.nativeCanvas
        val stamp = art.stamps[piece.stamp]
        val stampWidth = 42.dp.toPx()
        if (stamp != null) {
            val left = size.width - stampWidth
            val stampHeight = stampWidth * stamp.height / stamp.width
            canvas.drawBitmap(stamp, null, RectF(left, 0f, size.width, stampHeight), paints.bitmap)
        }
        if (postmarked) {
            val width = stampWidth * 2.57f
            val left = size.width - stampWidth + stampWidth * 0.536f - width
            val year = piece.postmarkYear.toIntOrNull() ?: 0
            // In cream on the row's dark red, so it reads there; the table's envelope keeps its black ink.
            drawEnvelopePostmark(canvas, art.postmark, left, 0f, width, piece.postmarkDay, year, paints, ink = rowPostmarkInk)
        }
    }
}

/** A row's seal while it's sealed: the wax, and "DO NOT OPEN UNTIL CHRISTMAS" beside it in the envelope's gold. */
@Composable
internal fun CardRowSeal(
    art: CardRowArt,
    modifier: Modifier = Modifier,
) {
    // Printed marks keep their printed size at any text size; the piece's sentence says the same.
    val density = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1f)) {
        Row(
            modifier = modifier.padding(start = 10.dp, bottom = 8.dp).clearAndSetSemantics {},
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Canvas(Modifier.size(width = 44.dp, height = 44.dp)) {
                drawIntoCanvas { canvas ->
                    canvas.nativeCanvas.drawBitmap(
                        art.wax,
                        null,
                        RectF(0f, 0f, size.width, size.height * art.wax.height / art.wax.width),
                        Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG),
                    )
                }
            }
            Text(
                "DO NOT OPEN UNTIL CHRISTMAS",
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 9.5.sp,
                lineHeight = 12.sp,
                letterSpacing = 0.12.em,
                color = PantopusColors.tableGoldInk,
                maxLines = 1,
            )
        }
    }
}
